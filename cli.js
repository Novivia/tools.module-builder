import yargs from "yargs";
import {build, publication} from "./lib";
import getPkgInfo from "pkginfo-json5";

const pkgInfo = getPkgInfo(module);

function buildCommand(args) {
  const argv = (
    args
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

function publishCommand(args) {
  const argv = (
    args
    .example(
      "$0 publish myModule-v1.2.3-8e19b7c8-d5d6-4e60-87fb-9c8aceadae51.tar.gz",
      "Publish the specified module",
    )

    .alias("c", "clean")
    .default("c", true)
    .describe("c", "Remove the file after publication")

    .alias("m", "most-recent")
    .describe(
      "m",
      "If no file is specified, use the most recent matching the pattern",
    )

    .help("h")
    .alias("h", "help")
    .argv
  );

  const isSilent = !!argv.silent;

  let publishFile;
  if (argv._.length > 1) {
    publishFile = argv._[1];
  }

  publication.publish({
    file: publishFile,
    mostRecent: !!argv.mostRecent,
    silent: isSilent,
    verbose: !!argv.verbose,
  }).then(publishedFile => {
    if (!publishedFile) {
      return;
    }

    if (!isSilent) {
      console.log("Package published!");
    }

    if (argv.clean) {
      build.clean(publishedFile);
    }
  }).catch(e => {
    if (!isSilent) {
      console.error("Publication failed:", e);
    }
  });
}

yargs
.usage("Usage: $0 <command> [options]")

.alias("s", "silent")
.describe("s", "Don't output anything")

.alias("v", "verbose")
.describe("v", "Be explicit about everything")

.help("h")
.alias("h", "help")

.command("build", "Build the module to a .tar.gz file", buildCommand)
.command("publish", "Publish the module from a .tar.gz file", publishCommand)
.demand(1)

.epilog(`Version ${pkgInfo.version}`)
.argv;
