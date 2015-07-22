import argv from "yargs";
import {build} from "./lib";
import getPkgInfo from "pkginfo-json5";

const pkgInfo = getPkgInfo(module);

function buildCommand(yargs) {
  const argv = (
    yargs
    .example(
      "$0 build -b 'util/**/*.js'", "Build the matching files using Babel"
    )

    .alias("b", "babel")
    .describe("b", "Provide a pattern to compile with Babel")

    .alias("p", "package")
    .describe("p", "Provide a pattern to package")

    .alias("r", "runtime")
    .default("r", true)
    .describe(
      "r",
      "Force to use the Babel runtime even if it can't be found during " +
      "compilation",
    )

    .alias("s", "silent")
    .describe("s", "Don't output anything")

    .alias("v", "verbose")
    .describe("v", "Be explicit about everything")


    .help("h")
    .alias("h", "help")
    .argv
  );

  let packagePatterns = [];
  if (argv.package) {
    packagePatterns = Array.isArray(argv.package) ?
      argv.package
    : [argv.package];
  }

  let babelPatterns = [];
  if (argv.babel) {
    babelPatterns = Array.isArray(argv.babel) ? argv.babel : [argv.babel];
  }

  const isSilent = !!argv.silent;
  // console.log("Package filters:", packagePatterns);
  // console.log("Babel filters:", babelPatterns);

  build.make({
    babelPatterns,
    forceBabelRuntime: argv.runtime,
    packagePatterns,
    silent: isSilent,
    verbose: !!argv.verbose,
  }).then(() => {
    if (!isSilent) {
      console.log("Compilation complete!");
    }
  }).catch(e => {
    if (!isSilent) {
      console.error("Compilation failed:", e);
    }
  });
}

argv
.usage("Usage: $0 <command> [options]")
.command("build", "Build the module to a .tar.gz file", buildCommand)
.demand(1)
.help("h")
.alias("h", "help")
.epilog(`Version ${pkgInfo.version}`)
.argv;

