import {basename, extname, join, relative} from "path";
import {createGzip} from "zlib";
import fsExtra from "fs-extra";
import {Reader as fstreamReader} from "fstream";
import {isRegExp} from "lodash";
import {parse as parseJson5} from "json5";
import Logger from "./Logger";
import micromatch from "micromatch";
import {noMultiSpaceAfterLineFeed} from "tempura";
import {promisify, promisifyAll} from "bluebird";
import {Pack as tarPack} from "tar";
import {transformFile} from "babel-core";
import {v4 as uuidv4} from "node-uuid";
import walk from "walkdir";

const fs = promisifyAll(fsExtra);
const transformBabelFile = promisify(transformFile);

export class Build {
  patternsToPackage = new Set([
    ["lib/**", "!*.js~"],
    "index.js",
    "package.json",
    "CHANGELOG*",
    "CONTRIBUTING*",
    "LICENSE*",
    "README*",
  ])

  patternsToBabelCompile = new Map([
    ["lib/**/*.js"],
  ])

  matchedFiles = new Set()
  compiledFiles = new Set()

  basePath = process.cwd()
  useBabelRuntime = true

  constructor({
    babelPatterns,
    forceBabelRuntime,
    gzipOptions = {
      level: 6,
      memLevel: 6,
    },
    packagePatterns,
    silent,
    verbose,
  } = {}) {
    this.logger = new Logger({silent, verbose});

    this.gzipOptions = gzipOptions;

    if (packagePatterns && Array.isArray(packagePatterns)) {
      for (let pattern of packagePatterns) {
        this.patternsToPackage.add(pattern);
      }
    }

    if (forceBabelRuntime) {
      this.forceBabelRuntime = true;
    }

    if (babelPatterns && Array.isArray(babelPatterns)) {
      for (let pattern of babelPatterns) {
        this.patternsToBabelCompile.set(pattern, {});
      }
    }
  }

  async compileFiles() {
    if (this.packageIsJson5) {
      await this.compilePackageJson5();
    }

    await this.compileBabelFiles();
  }

  async compilePackageJson5() {
    await fs.writeFileAsync(
      join(this.temporaryDirectoryPath, "package.json"),
      JSON.stringify(this.packageInfo),
    );
    this.compiledFiles.add("package.json");
  }

  async compileBabelFiles() {
    const {
      compiledGlobs,
      compiledRegexes,
    } = this.compilePatterns(
      [for ([pattern] of this.patternsToBabelCompile) pattern]
    );
    this.compiledBabelGlobs = compiledGlobs;
    this.compiledBabelRegexes = compiledRegexes;

    if (!this.forceBabelRuntime) {
      try {
        require("babel-runtime");
      } catch(e) {
        this.logger.warn(noMultiSpaceAfterLineFeed`
          The module "babel-runtime" wasn't found, defaulting to inlining
          polyfills.
        `);
        this.useBabelRuntime = false;
      }
    }

    await new Promise((resolve, reject) => {
      const walker = walk(this.basePath);
      const compilations = [];

      walker.on(
        "file",
        (...args) => compilations.push(this.compileBabelFile(...args)),
      );
      walker.on("error", reject);
      walker.on("end", async (...args) => {
        try {
          await* compilations;
        } catch(e) {
          return reject(e);
        }

        resolve(...args);
      });
    });
  }

  async compileBabelFile(filePath) {
    const relativePath = relative(this.basePath, filePath);

    // Ignore temporary directory.
    if (basename(relativePath) === this.temporaryDirectoryName) {
      return;
    }

    const isMatch = this.matchFilePattern({
      compiledGlobs: this.compiledBabelGlobs,
      compiledRegexes: this.compiledBabelRegexes,
      relativePath,
    });

    if (isMatch) {
      const options = {};

      if (this.useBabelRuntime) {
        options.optional = ["runtime"];
      }

      this.logger.verbose(`Compiling file: ${relativePath}`);
      const {code} = await transformBabelFile(relativePath, options);
      await fs.outputFileAsync(
        join(this.temporaryDirectoryPath, relativePath),
        code,
      );
      this.compiledFiles.add(relativePath);
    }
  }

  compilePatterns(patterns) {
    const compiledRegexes = new Set();
    const compiledGlobs = [];

    for (let pattern of patterns) {
      if (isRegExp(pattern)) {
        compiledRegexes.add(pattern);
      } else {
        compiledGlobs.push(pattern);
      }
    }

    this.logger.verbose("Globs:", compiledGlobs);
    this.logger.verbose("Regexes:", Array.from(compiledRegexes));

    return {
      compiledRegexes,
      compiledGlobs,
    };
  }

  async copyFiles() {
    for (let file of this.matchedFiles) {
      this.logger.verbose(`Copying file: ${file}`);
      await fs.copyAsync(
        file,
        join(
          this.temporaryDirectoryPath,
          file,
        ),
      );
    }
  }

  async deleteTemporaryDirectory() {
    this.logger.verbose("Removing:", this.temporaryDirectoryPath);
    await fs.removeAsync(this.temporaryDirectoryPath);
  }


  async makeTemporaryDirectory() {
    this.temporaryDirectoryName = (
      `${this.packageName}-v${this.packageVersion}-${uuidv4()}`
    );
    this.logger.verbose("Directory name:", this.temporaryDirectoryName);

    this.temporaryDirectoryPath = join(
      this.basePath,
      this.temporaryDirectoryName,
    );
    await fs.ensureDirAsync(this.temporaryDirectoryPath);
  }

  matchFilePattern({relativePath, compiledRegexes, compiledGlobs}) {
    // Attempt to match the file against the globs, if any.
    const isGlobMatch = micromatch.any(
      relativePath,
      compiledGlobs,
    );

    if (isGlobMatch) {
      return true;
    }

    // Attempt to match the file against the regexes, if any.
    for (let pattern of compiledRegexes) {
      if (pattern.test(relativePath)) {
        return true;
      }
    }

    return false;
  }

  matchFile(relativePath) {
    // Ignore temporary directory.
    if (basename(relativePath) === this.temporaryDirectoryName) {
      return false;
    }

    // Don't copy files with a path that match a compiled file.
    if (this.compiledFiles.has(relativePath)) {
      this.logger.warn(noMultiSpaceAfterLineFeed`
        Not copying over "${relativePath}" because a compiled version already
        exists.
      `);
      return false;
    }

    return this.matchFilePattern({
      compiledGlobs: this.compiledGlobs,
      compiledRegexes: this.compiledRegexes,
      relativePath,
    });
  }

  async readPackageFile(filename) {
    return await fs.readFileAsync(
      join(this.basePath, filename),
      "utf8",
    );
  }

  async getPackageInfo() {
    let packageData;

    try {
      packageData = await this.readPackageFile("package.json5");
      this.packageIsJson5 = true;
    } catch(e) {
      packageData = await this.readPackageFile("package.json");
    }

    return (this.packageInfo = parseJson5(packageData));
  }

  get packageName() {
    const realName = this.packageInfo.name;

    // Scoped package?
    if (realName.charAt(0) === "@") {
      return realName.split("/")[1];
    }

    return realName;
  }

  get packageVersion() {
    return this.packageInfo.version;
  }

  collectFile(filePath) {
    const relativePath = relative(this.basePath, filePath);
    const isMatch = this.matchFile(relativePath);

    if (isMatch) {
      this.logger.verbose("Adding file:", relativePath);
      this.matchedFiles.add(relativePath);
    }
  }

  async collectFiles() {
    await new Promise((resolve, reject) => {
      const walker = walk(this.basePath);

      walker.on("file", ::this.collectFile);
      walker.on("error", reject);
      walker.on("end", resolve);
    });
  }

  async make() {
    this.logger.verbose("In:", this.basePath);
    const {
      compiledRegexes,
      compiledGlobs,
    } = this.compilePatterns(this.patternsToPackage);
    this.compiledRegexes = compiledRegexes;
    this.compiledGlobs = compiledGlobs;

    try {
      await this.getPackageInfo();
      await this.makeTemporaryDirectory();
      await this.compileFiles();
      await this.collectFiles();
      await this.copyFiles();
      await this.makeTarFile();
      await this.deleteTemporaryDirectory();
    } catch(e) {
      this.logger.error(e);
    }
  }

  async makeTarFile() {
    const tarFile = fs.createWriteStream(
      `${this.temporaryDirectoryName}.tar.gz`
    );
    const gzip = createGzip(this.gzipOptions);

    await new Promise((resolve, reject) => {
      const packer = tarPack({noProprietary: true});
      packer.on("error", reject);

      const streamer = fstreamReader({
        path: this.temporaryDirectoryName,
        type: "Directory",
      });
      streamer.on("error", reject);
      streamer.on("end", resolve);

      streamer
      .pipe(packer)
      .pipe(gzip)
      .pipe(tarFile);
    });
  }
}

export async function make(options) {
  const build = new Build(options);
  await build.make();
}
