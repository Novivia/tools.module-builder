/**
 * Copyright 2013-present, Novivia, Inc.
 * All rights reserved.
 */

import {exec} from "child_process";
import fsExtra from "fs-extra";
import {parse as parseJson5} from "json5";
import {promisify, promisifyAll} from "bluebird";

const execute = promisify(exec);
const fs = promisifyAll(fsExtra);

/**
 * Attempts to read the `package.json5` file and defaults to the
 * `package.json` file otherwise.
 * @return {object} Information contained in the read package file.
 */
export async function getPackageInfo() {
  let packageData;
  let packageFilename;

  try {
    packageData = await readFile("package.json5");
    packageFilename = "package.json5";
  } catch (e) {
    packageData = await readFile("package.json");
    packageFilename = "package.json";
  }

  return {
    packageData: parseJson5(packageData),
    packageFilename,
  };
}

/*
 * Attempts to find the npm CLI name to use.
 */
async function findNpmName(npmClis) {
  if (!npmClis || npmClis.length === 0) {
    // Fallback to npm if no special npm CLI is found.
    return "npm";
  }

  const [currentCli, ...otherClis] = npmClis;

  try {
    await execute(`${currentCli} --version`);

    return currentCli;
  } catch (e) {
    return await findNpmName(otherClis);
  }
}

let npmName;

/*
 * Executes an npm command using the CLI.
 */
export async function npmExecute(command) {
  if (!npmName) {
    npmName = await findNpmName(["yapm", "npm-json5"]);
  }

  return await execute(`${npmName} ${command}`);
}


/**
 * Reads a file and returns its content.
 * @param  {string} filename Path and/or name of the file to read.
 * @return {string}          Content of the read file.
 */
export async function readFile(filename: string) {
  return await fs.readFileAsync(filename, "utf8");
}
