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
// FIXME: Workaround for https://phabricator.babeljs.io/T3085
const getPackageInfo = async function getPackageInfo() {
  let packageData;
  let packageFilename;

  try {
    packageData = await readFile("package.json5");
    packageFilename = "package.json5";
  } catch(e) {
    packageData = await readFile("package.json");
    packageFilename = "package.json";
  }

  return {
    packageData: parseJson5(packageData),
    packageFilename,
  };
}
export {getPackageInfo};


let npmName;

/*
 * Executes an npm command using the CLI.
 */
// FIXME: Workaround for https://phabricator.babeljs.io/T3085
const npmExecute = async function npmExecute(command) {
  if (!npmName) {
    // Attempt to use yapm, but fallback to npm if not found.
    npmName = "yapm";
    try {
      await execute(`${npmName} --version`);
    } catch(e) {
      npmName = "npm";
    }
  }

  return await execute(`${npmName} ${command}`);
}
export {npmExecute};


/**
 * Reads a file and returns its content.
 * @param  {string} filename Path and/or name of the file to read.
 * @return {string}          Content of the read file.
 */
// FIXME: Workaround for https://phabricator.babeljs.io/T3085
const readFile = async function readFile(filename: string) {
  return await fs.readFileAsync(filename, "utf8");
}
export {readFile};
