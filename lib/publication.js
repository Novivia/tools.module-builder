import fsExtra from "fs-extra";
import {getPackageInfo} from "./utils";
import Logger from "./Logger";
import {noMultiSpaceAfterLineFeed} from "tempura";
import {npmExecute} from "./utils";
import {promisifyAll} from "bluebird";

const fs = promisifyAll(fsExtra);

export class Publication {
  basePath = process.cwd();
  fileMatcher = /^[\w-]+-v(?:[0-9]+\.){2}[0-9]+-[\w.-]+?\.tar\.gz$/;

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

  /**
   * Determines which file should be published based on the provided options.
   * @return {string} Path and name of the file that should be published.
   */
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
    for (const file of files) {
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

    // Multiple candidates, sort them from most to least recent.
    candidates.sort(
      (candidateA, candidateB) => (
        candidateB.stat.mtime.getTime() - candidateA.stat.mtime.getTime()
      )
    );

    // Multiple candidates, no selection strategy.
    if (candidates.length > 1 && !this.publishMostRecentCandidate) {
      this.logger.warn("Multiple publish candidates found:\n");

      for (const candidate of candidates) {
        this.logger.log(`  * ${candidate.file} (${candidate.stat.mtime})`);
      }

      return;
    }

    // Multiple candidates, automatically select the most recent.
    return (this.fileToPublish = candidates[0].file);
  }

  /*
   * Manages and orchestrates the publication process flow.
   */
  async publish() {
    this.logger.verbose("In:", this.basePath);

    try {
      await this.determineFileToPublish();
    } catch(e) {
      this.logger.error(e);

      return;
    }

    if (!this.fileToPublish) {
      return;
    }

    try {
      const {packageData: {publishConfig: {registry}}} = await getPackageInfo();
      const [auth] = await npmExecute(`whoami --registry ${registry}`);

      if (auth === "Not authed.  Run 'npm adduser'\n") {
        this.logger.error(noMultiSpaceAfterLineFeed`
          You need to be authenticated to the npm registry if you want to
          publish a package.
        `);

        return;
      }

      await this.publishFile();
    } catch(e) {
      this.logger.error(e);

      return;
    }

    return this.fileToPublish;
  }

  /**
   * Publishes the file that was selected, using yapm or npm.
   */
  async publishFile() {
    this.logger.info(`Publishing "${this.fileToPublish}"`);

    await npmExecute(`publish ${this.fileToPublish}`);

    this.logger.info("Publication complete!");
  }
}

// FIXME: Workaround for https://phabricator.babeljs.io/T3085
export async function publish(options) {
  const publication = new Publication(options);
  return await publication.publish();
}
