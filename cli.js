import {argv} from "yargs";
import {build} from "./lib";

const baseBuildPath = process.cwd();

build.make({verbose: true});

console.log("Yargs!", argv);
console.log(process.cwd());

