import fsExtra from "fs-extra";
import {isRegExp} from "lodash";
import micromatch from "micromatch";
import {basename, resolve, relative} from "path";
import {promisifyAll} from "bluebird";
import {v4 as uuidv4} from "node-uuid";
import walk from "walkdir";

const fs = promisifyAll(fsExtra);

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

  matchedFiles = new Set()
  compiledRegexes = new Set()
  compiledGlobs = []

  basePath = process.cwd()

  //FIXME:
  packageInfo = {
    name: "fixme",
    version: "1.2.3",
  }

  constructor({
    silent,
    verbose,
  } = {}) {
    this.isSilent = silent;
    this.isVerbose = verbose;
  }

  async compileFiles() {
    // TODO.
    // await this.compileJSON5();
    // await this.compileBabel();
  }

  compilePatterns() {
    for (let pattern of this.patternsToPackage) {
      if (isRegExp(pattern)) {
        this.compiledRegexes.add(pattern);
      } else {
        this.compiledGlobs.push(pattern);
      }
    }

    this.verbose("Globs:", this.compiledGlobs);
    this.verbose("Regexes:", Array.from(this.compiledRegexes));
  }

  async copyFiles() {
    // TODO.
  }

  async deleteTemporaryFiles() {
    // TODO.
  }

  error(...args) {
    if (this.isSilent) {
      return;
    }

    console.error(...args);
  }

  info(...args) {
    if (this.isSilent) {
      return;
    }

    console.info(...args);
  }

  log(...args) {
    if (this.isSilent) {
      return;
    }

    console.log(...args);
  }

  verbose(...args) {
    if (!this.isVerbose) {
      return;
    }

    this.info(...args);
  }

  async makeTemporaryDirectory() {
    this.temporaryDirectoryName = (
      `${this.packageName}-v${this.packageVersion}-${uuidv4()}`
    );
    this.verbose("Directory name:", this.temporaryDirectoryName);

    this.temporaryDirectoryPath = resolve(
      this.basePath,
      this.temporaryDirectoryName,
    );
    await fs.ensureDir(this.temporaryDirectoryPath);
  }

  matchFile(relativePath) {
    // Ignore temporary directory.
    if (basename(relativePath) === this.temporaryDirectoryName) {
      return false;
    }

    const isGlobMatch = micromatch.any(
      relativePath,
      this.compiledGlobs,
    );

    if (isGlobMatch) {
      return true;
    }

    for (let pattern of this.compiledRegexes) {
      if (pattern.test(relativePath)) {
        return true;
      }
    }

    return false;
  }

  async getPackageInfo() {
    // TODO.
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
      this.verbose("Adding file:", relativePath);
      this.matchedFiles.add(relativePath);
    }
  }

  async collectFiles() {
    await new Promise((resolve, reject) => {
      const walker = walk(this.basePath);

      walker.on("file", ::this.collectFile);
      walker.on("error", () => reject());
      walker.on("end", () => resolve());
    });
  }

  async make() {
    this.log("In:", this.basePath);
    this.compilePatterns();

    try {
      // await this.getPackageInfo();
      await this.makeTemporaryDirectory();
      // await this.compileFiles();
      await this.collectFiles();
      // await this.copyFiles();
      // await this.makeTarFile();
      // await this.deleteTemporaryFiles();
    } catch(e) {
      this.error(e);
    }

    this.log("Done!");
  }

  async makeTarFile() {
    // TODO.
  }
}

export async function make(options) {
  const build = new Build(options);
  console.log("Making build!", options);
  await build.make();
  console.log("Build done!");
}

export function test() {};
