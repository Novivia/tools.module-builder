import fsExtra from "fs-extra";
import {load, commands as npmCommands} from "npm";
import Logger from "./Logger";
import {promisify, promisifyAll} from "bluebird";

const fs = promisifyAll(fsExtra);
const npmLoad = promisify(load);

export class Publication {
  basePath = process.cwd()
  fileMatcher = /^[\w-]+-v(?:[0-9]+\.){2}[0-9]+-[\w-]+?\.tar\.gz$/

  constructor({
    file,
    mostRecent,
    silent,
    verbose,
  } = {}) {
    this.logger = new Logger({silent, verbose});

    if (file) {
      this.fileToPublish = file;
    }

    if (mostRecent) {
      this.publishMostRecentCandidate = mostRecent;
    }
  }

  async determineFileToPublish() {
    // File was specified.
    if (this.fileToPublish) {
      try {
        await fs.statAsync(this.fileToPublish);
      } catch(e) {
        this.logger.error(
          `Cannot publish inexisting file: ${this.fileToPublish}`
        );
        this.fileToPublish = null;
      }

      return;
    }

    const candidates = [];
    const files = await fs.readdirAsync(this.basePath);
    for (let file of files) {
      if (this.fileMatcher.test(file)) {
        const stat = await fs.statAsync(file);

        if (stat.isFile()) {
          candidates.push({file, stat});
        }
      }
    }

    // No candidate.
    if (candidates.length === 0) {
      this.logger.error("Unable to publish, no candidate found.");

      return;
    }

    // One candidate.
    if (candidates.length === 1) {
      return (this.fileToPublish = candidates[0].file);
    }

    // Multiple candidates, no selection strategy.
    if (candidates.length > 1 && !this.publishMostRecentCandidate) {
      this.logger.warn("Multiple publish candidates found:\n");

      for (let candidate of candidates) {
        this.logger.log(`  * ${candidate.file} (${candidate.stat.mtime})`);
      }

      return;
    }

    // Multiple candidates, automatically select the most recent.
    candidates.sort(
      (candidateA, candidateB) => (
        candidateB.stat.mtime.getTime() - candidateA.stat.mtime.getTime()
      )
    );

    return (this.fileToPublish = candidates[0].file);
  }

  /**
   * Manages and orchestrates the publication process flow.
   */
  async publish() {
    this.logger.verbose("In:", this.basePath);

    try {
      await this.determineFileToPublish();

      if (!this.fileToPublish) {
        return;
      }

      await this.publishFile();
    } catch(e) {
      this.logger.error(e);
    }

    return this.fileToPublish;
  }

  async publishFile() {
    console.log("Publishing", this.fileToPublish);

    // await npmLoad({loglevel: "silent"});
    await npmLoad();

    // FIXME: Proof of concept.
    const npmLs = promisify(npmCommands.ls);
    const dependencies = await npmLs();
    // const [{dependencies}] = await npmLs();
    console.log("Dependencies: ", dependencies);

    // TODO: Publish using npm.
    // Will probably use the CLI as they recommend since the CLI entry point
    // does the contrived config parsing and merging and we don't want to drift
    // away from that.
    // const npmPublish = promisify(npmCommands.publish);
    // npmPublish(this.fileToPublish)
  }
}

export async function publish(options) {
  const publication = new Publication(options);
  return await publication.publish();
}
