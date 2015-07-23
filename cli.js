import {build, publication, utils} from "./lib";
import getPkgInfo from "pkginfo-json5";
import yargs from "yargs";

const {npmExecute} = utils;
const pkgInfo = getPkgInfo(module);

const terminalWidth = Math.min(yargs.terminalWidth(), 160);

function printLog(logLines) {
  process.stdout.write(logLines.reverse().join());
}

async function buildCommand(args) {
  const argv = (
    args
    .wrap(terminalWidth)
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
    .alias("v", "verbose")

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

  try {
    await build.make({
      babelPatterns,
      forceBabelRuntime: argv.runtime,
      packagePatterns,
      silent: isSilent,
      verbose: !!argv.verbose,
    });
  } catch(e) {
    if (!isSilent) {
      console.error("Compilation failed:", e);
    }

    return;
  }

  if (!isSilent) {
    console.log("Compilation complete!");
  }
}


async function publishCommand(args) {
  const argv = (
    args
    .wrap(terminalWidth)
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

    .alias("s", "silent")
    .alias("v", "verbose")

    .help("h")
    .alias("h", "help")
    .argv
  );

  const isSilent = !!argv.silent;

  let publishFile;
  if (argv._.length > 1) {
    publishFile = argv._[1];
  }

  let publishedFile;
  try {
    publishedFile = await publication.publish({
      file: publishFile,
      mostRecent: !!argv.mostRecent,
      silent: isSilent,
      verbose: !!argv.verbose,
    });
  } catch(e) {
    if (!isSilent) {
      console.error("Publication failed:", e);
    }

    return;
  }

  if (!publishedFile) {
    return;
  }

  if (!isSilent) {
    console.log("Package published!");
  }

  if (argv.clean) {
    try {
      await build.clean(publishedFile);
    } catch(e) {
      if (!isSilent) {
        console.error("Unable to clean published file:", e);
      }
    }
  }

  return publishedFile;
}

async function releaseCommand(args) {
  const argv = (
    args
    .example(
      "$0 release major", "Release the current code with a major version bump"
    )
    .example(
      "$0 release minor", "Release the current code with a minor version bump"
    )
    .example(
      "$0 release patch", "Release the current code with a patch version bump"
    )
    .example(
      "$0 release 1.2.3", "Release the current code under version 1.2.3"
    )

    .demand(2)

    .alias("s", "silent")
    .alias("v", "verbose")

    .help("h")
    .alias("h", "help")
    .argv
  );

  const isSilent = !!argv.silent;
  const isVerbose = !!argv.verbose;
  let verbosity = "";
  if (isSilent) {
    verbosity += "--silent ";
  } else if (isVerbose) {
    verbosity += "--verbose ";
  }

  const newVersion = argv._[1];


  // npm version bump.
  try {
    await npmExecute(`version ${newVersion} ${verbosity}`);
  } catch(e) {
    if (isSilent) {
      return;
    }

    if (~e.message.indexOf("Git working directory not clean")) {
      return console.error(
        "You cannot release if you have changes not committed or stashed!"
      );
    }

    return console.error(e);
  }

  if (verbosity) {
    verbosity = `-- ${verbosity}`;
  }

  try {
    printLog(
      await npmExecute(`run build ${verbosity}`)
    );
    printLog(
      await npmExecute(`run pub ${verbosity}`)
    );
  } catch(e) {
    return process.stderr.write(e);
  }
}

yargs
.usage("Usage: $0 <command> [options]")

.wrap(terminalWidth)

.alias("s", "silent")
.describe("s", "Don't output anything")

.alias("v", "verbose")
.describe("v", "Be explicit about everything")

.help("h")
.alias("h", "help")

.command("build", "Build the module to a .tar.gz file", buildCommand)
.command("publish", "Publish the module from a .tar.gz file", publishCommand)
.command(
  "release",
  "Bumps the version, builds the tarball and publishes it",
  releaseCommand,
)
.demand(1)

.version(pkgInfo.version)
.epilog(`Version ${pkgInfo.version}`)
.argv;
