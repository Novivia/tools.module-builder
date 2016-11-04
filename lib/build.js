/**
 * Copyright 2013-present, Novivia, Inc.
 * All rights reserved.
 */

import {basename, join, relative} from "path";
import {createGzip} from "zlib";
import fsExtra from "fs-extra";
import getBabelBackendConfiguration from "@novivia/babel/config/backend";
import {Reader as fstreamReader} from "fstream";
import {getPackageInfo as packageInfo} from "./utils";
import {isRegExp} from "lodash";
import Logger from "./Logger";
import {any as matchAny} from "micromatch";
import {noMultiSpaceAfterLineFeed} from "tempura";
import {promisify, promisifyAll} from "bluebird";
import {Pack as tarPack} from "tar";
import {transformFile, version as babelVersion} from "babel-core";
import {v4 as uuidv4} from "node-uuid";
import walk from "walkdir";

const fs = promisifyAll(fsExtra);
const transformBabelFile = promisify(transformFile);

export class Build {
  ignoredNestedDirectories = new Set([
    "__tests__",
    "node_modules",
  ]);

  patternsToBabelCompile = new Map([
    ["lib/**/*.js"],
    ["index.js"],
  ]);

  patternsToPackage = new Set([
    "lib/**!(*.js~)",
    "index.js",
    "package.json",
    "CHANGELOG*",
    "CONTRIBUTING*",
    "LICENSE*",
    "README*",
  ]);

  basePath = process.cwd();
  compiledFiles = new Set();
  matchedFiles = new Set();
  useBabelRuntime = true;

  /**
   * Removes a file from the filesystem.
   * @param  {string} file Path of the file to remove.
   */
  static async clean(file) {
    await fs.removeAsync(file);
  }

  get bundleName() {
    return `${this.temporaryDirectoryName}.tar.gz`;
  }

  /**
   * Returns the name of the current package, without the prefix if it's a
   * scoped package.
   * @return {string} Name of the current package.
   */
  get packageName() {
    const realName = this.packageInfo.name;

    // Scoped package?
    if (realName.charAt(0) === "@") {
      return realName.split("/")[1];
    }

    return realName;
  }

  /**
   * Returns the version of the current package.
   * @return {string} Version of the current package.
   */
  get packageVersion() {
    return this.packageInfo.version;
  }

  constructor({
    babelPatterns,
    compileTargets = {node: 4},
    forceBabelRuntime,
    gzipOptions = {
      level: 6,
      memLevel: 6,
    },
    packagePatterns,
    silent,
    verbose,
  } = {}) {
    this.compileTargets = compileTargets;
    this.logger = new Logger({
      silent,
      verbose,
    });
    this.gzipOptions = gzipOptions;

    // Merge provided package patterns with default ones.
    if (packagePatterns && Array.isArray(packagePatterns)) {
      for (const pattern of packagePatterns) {
        this.patternsToPackage.add(pattern);
      }
    }

    if (forceBabelRuntime) {
      this.forceBabelRuntime = true;
    }

    // Merge provided Babel compile patterns with default ones.
    if (babelPatterns && Array.isArray(babelPatterns)) {
      for (const pattern of babelPatterns) {
        this.patternsToBabelCompile.set(pattern, {});
      }
    }
  }

  /**
   * Remember the path and name of a file if it matched any of the provided
   * patterns.
   * @param  {string} filePath Path and name of the file.
   */
  collectFile(filePath: string) {
    const relativePath = relative(this.basePath, filePath);
    const isMatch = this.matchFile(relativePath);

    if (isMatch) {
      this.logger.verbose("Adding file:", relativePath);
      this.matchedFiles.add(relativePath);
    }
  }

  /**
   * Finds and collects all files that match any of the previously stored
   * patterns.
   */
  async collectFiles() {
    await new Promise((resolve, reject) => {
      const walker = this.getWalker();

      walker.on("file", ::this.collectFile);
      walker.on("error", reject);
      walker.on("end", resolve);
    });
  }

  /**
   * Compiles one file using Babel.
   * @param  {string} filePath Path to the file to compile.
   */
  async compileBabelFile(filePath: string) {
    const relativePath = relative(this.basePath, filePath);

    // Ignore the  temporary directory.
    if (basename(relativePath) === this.temporaryDirectoryName) {
      return;
    }

    const isMatch = Build.matchFilePattern({
      compiledGlobs: this.compiledBabelGlobs,
      compiledRegexes: this.compiledBabelRegexes,
      relativePath,
    });

    if (isMatch) {
      const babelConfiguration = getBabelBackendConfiguration({
        convertFlowToComments: true,
        targets: this.compileTargets,
        useRuntime: this.useBabelRuntime,
      });

      this.logger.verbose(`Compiling file: ${relativePath}`);

      // This automatically takes care of passing in options found in .babelrc
      // for us, yay!
      const {code} = await transformBabelFile(relativePath, babelConfiguration);
      await fs.outputFileAsync(
        join(this.temporaryDirectoryPath, relativePath),
        code,
      );
      this.compiledFiles.add(relativePath);
    }
  }

  /**
   * Finds files that need to be compiled using Babel, and compiles them.
   */
  async compileBabelFiles() {
    const {
      compiledGlobs,
      compiledRegexes,
    } = this.compilePatterns(
      Array.from(this.patternsToBabelCompile.entries()).map(entry => entry[0]),
    );
    this.compiledBabelGlobs = compiledGlobs;
    this.compiledBabelRegexes = compiledRegexes;

    await new Promise((resolve, reject) => {
      const walker = this.getWalker();
      const compilations = [];

      // We aggregate the compilation "subprocesses" when `file` events are
      // fired and we wait until one errors or they're all done to proceed.
      walker.on(
        "file",
        (...args) => compilations.push(this.compileBabelFile(...args)),
      );
      walker.on("error", reject);
      walker.on("end", async (...args) => {
        try {
          await Promise.all(compilations);
        } catch (e) {
          return reject(e);
        }

        resolve(...args);
      });
    });
  }

  /*
   * Takes an iterable of mixed glob patterns and regexes and separates them.
   */
  compilePatterns(patterns: Iterable<string | Array<string>>) {
    const compiledRegexes = new Set();
    const compiledGlobs = [];

    for (const pattern of patterns) {
      if (isRegExp(pattern)) {
        compiledRegexes.add(pattern);
      } else {
        compiledGlobs.push(pattern);
      }
    }

    this.logger.verbose("Globs:", compiledGlobs);
    this.logger.verbose("Regexes:", Array.from(compiledRegexes));

    return {
      compiledGlobs,
      compiledRegexes,
    };
  }

  /**
   * Copy previously identified files to the temporary directory.
   */
  async copyFiles() {
    for (const file of this.matchedFiles) {
      this.logger.verbose(`Copying file: ${file}`);

      // eslint-disable-next-line babel/no-await-in-loop
      await fs.copyAsync(
        file,
        join(
          this.temporaryDirectoryPath,
          file,
        ),
      );
    }
  }

  /**
   * Deletes the temporary directory and all its content.
   */
  async deleteTemporaryDirectory() {
    this.logger.verbose("Removing:", this.temporaryDirectoryPath);
    await fs.removeAsync(this.temporaryDirectoryPath);
  }

  /**
   * Generates or finds and compiles all files that need to be compiled.
   */
  async generateFiles() {
    this.injectBabelRuntimeDependency();
    await this.compileBabelFiles();
    await this.generatePackageJson();
  }

  /**
   * Generates the `package.json` file to be bundled.
   */
  async generatePackageJson() {
    await fs.writeFileAsync(
      join(this.temporaryDirectoryPath, "package.json"),
      JSON.stringify(this.packageInfo),
    );
    this.compiledFiles.add("package.json");
  }

  /**
   * Attempts to read the `package.json5` file and defaults to the
   * `package.json` file otherwise.
   * @return {object} Information contained in the read package file.
   */
  async getPackageInfo() {
    const {packageData} = await packageInfo();

    return (this.packageInfo = packageData);
  }

  getWalker() {
    const self = this;

    return walk(
      this.basePath,
      function walkPath(path) {
        // Don't ever package files in directories with specific names.
        if (self.ignoredNestedDirectories.has(basename(path))) {
          this.ignore(path); // eslint-disable-line no-invalid-this
        }
      },
    );
  }

  /**
   * Injects the babel-runtime dependency in the package.json if necessary.
   */
  injectBabelRuntimeDependency() {
    // Attempt to find the Babel runtime package if we're not forced to leverage
    // it blindly.
    if (!this.forceBabelRuntime) {
      try {
        // eslint-disable-next-line import/no-unresolved
        require("babel-runtime");
      } catch (e) {
        this.logger.warn(noMultiSpaceAfterLineFeed`
          The module "babel-runtime" wasn't found, defaulting to inlining
          polyfills.
        `);
        this.useBabelRuntime = false;
      }
    }

    if (!this.useBabelRuntime) {
      return;
    }

    // Could have used the "semver" module here, but this is very simple.
    const [major] = babelVersion.split(".");

    this.packageInfo.dependencies = this.packageInfo.dependencies || {};
    this.packageInfo.dependencies["babel-runtime"] = `^${major}.0.0`;
  }

  /**
   * Manages and orchestrates the build process flow.
   */
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
      await this.generateFiles();
      await this.collectFiles();
      await this.copyFiles();
      await this.makeTarFile();
      await this.deleteTemporaryDirectory();
    } catch (e) {
      this.logger.error(e);
    }
  }

  /**
   * Creates the .tar.gz file containing the final build by including the whole
   * temporary directory.
   */
  async makeTarFile() {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const tarFile = fs.createWriteStream(
      this.bundleName,
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

  /**
   * Creates a temporary directory, where all assets targeted to be in the final
   * build will be stored intermediately.
   */
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

  /**
   * Attempts to match a file against previously stored glob and regex patterns.
   * @param  {string} relativePath Relative path to the file.
   * @return {boolean}             Whether the file matched any of the patterns.
   */
  matchFile(relativePath: string) {
    // Ignore temporary directory.
    if (basename(relativePath) === this.temporaryDirectoryName) {
      return false;
    }

    // Don't ever package files in directories with specific names.
    if (this.ignoredNestedDirectories.has(basename(relativePath))) {
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

    return Build.matchFilePattern({
      compiledGlobs: this.compiledGlobs,
      compiledRegexes: this.compiledRegexes,
      relativePath,
    });
  }

  /**
   * Attempts to match a file against provided glob and regex patterns.
   * @return {boolean}             Whether the file matched any of the patterns.
   */
  static matchFilePattern({relativePath, compiledRegexes, compiledGlobs}) {
    // Attempt to match the file against the globs, if any.
    const isGlobMatch = matchAny(
      relativePath,
      compiledGlobs,
    );

    if (isGlobMatch) {
      return true;
    }

    // Attempt to match the file against the regexes, if any.
    for (const pattern of compiledRegexes) {
      if (pattern.test(relativePath)) {
        return true;
      }
    }

    return false;
  }
}

export async function make(options) {
  const build = new Build(options);
  await build.make();
}

export async function clean(file) {
  await Build.clean(file);
}
