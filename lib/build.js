import {basename, join, relative} from "path";
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
    "lib/**",
    "index.js",
    "package.json",
    "CHANGELOG*",
    "CONTRIBUTING*",
    "LICENSE*",
    "README*",
  ])

  patternsToBabelCompile = new Map([
    ["src/**", ["src", "lib"]],
  ])

  matchedFiles = new Set()
  compiledFiles = new Set()

  basePath = process.cwd()

  constructor({
    silent,
    verbose,
  } = {}) {
    this.logger = new Logger({silent, verbose});
  }

  async compileFiles() {
    // TODO.
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
      compiledRegexes,
      compiledGlobs,
    } = this.compilePatterns(
      [for ([pattern] of this.patternsToBabelCompile) pattern]
    );

    // TODO.
    // await new Promise((resolve, reject) => {
    //   const walker = walk(this.basePath);

    //   walker.on("file", ::this.compileBabelFile);
    //   walker.on("error", reject);
    //   walker.on("end", resolve);
    // });
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
    // TODO.
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

    // Attempt to match the file against the globs, if any.
    const isGlobMatch = micromatch.any(
      relativePath,
      this.compiledGlobs,
    );

    if (isGlobMatch) {
      return true;
    }

    // Attempt to match the file against the regexes, if any.
    for (let pattern of this.compiledRegexes) {
      if (pattern.test(relativePath)) {
        return true;
      }
    }

    return false;
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

  collectFile(filePath, fileStat) {
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
    this.logger.log("In:", this.basePath);
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
      // await this.copyFiles();
      await this.makeTarFile();
      await this.deleteTemporaryDirectory();
    } catch(e) {
      this.logger.error(e);
    }

    this.logger.log("Done!");
  }

  async makeTarFile() {
    const tarFile = fs.createWriteStream(`${this.temporaryDirectoryName}.tar`);

    await new Promise((resolve, reject) => {
      const packer = tarPack({noProprietary: true});
      packer.on("error", reject);

      const streamer = fstreamReader({
        path: this.temporaryDirectoryName,
        type: "Directory",
      });
      streamer.on("error", reject);
      streamer.on("end", resolve);
      streamer.pipe(packer).pipe(tarFile);
    });
  }
}

export async function make(options) {
  const build = new Build(options);
  await build.make();
}
