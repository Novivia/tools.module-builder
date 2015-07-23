import {exec, spawn} from "child_process";
import {promisify} from "bluebird";

// const execute = promisify(spawn);
const execute = promisify(exec);

let npmName;

export async function npmExecute(command) {
  // const command = stringCommand.split(" ");

  if (!npmName) {
    // Attempt to use yapm, but fallback to npm if not found.
    npmName = "yapm";
    try {
      // await execute(npmName, ["--version"], {});
      await execute(`${npmName} --version`);
    } catch(e) {
      console.log(e);
      npmName = "npm";
    }
  }

  // return await execute(npmName, command, {stdio: "inherit"});
  return await execute(`${npmName} ${command}`);
}
