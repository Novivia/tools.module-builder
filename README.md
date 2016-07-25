# Module builder tool

## Installation

```bash
npm install @novivia/build-module --save-dev
```


## Usage on the command-line

```
Usage: build-module <command> [options]

Commands:
  build    Build the module to a .tar.gz file
  publish  Publish the module from a .tar.gz file
  release  Bumps the version, builds the tarball and publishes it

Options:
  -s, --silent   Don't output anything
  -v, --verbose  Be explicit about everything
  -h, --help     Show help
  --version      Show version number
```

### Build a module

```
Options:
  -b, --babel    Provide a pattern to compile with Babel
  -p, --package  Provide a pattern to package
  -r, --runtime  Force to use the Babel runtime even if it can't be found during compilation    [default: true]
  -h, --help     Show help
```

You can specify the `-b` and `-p` options as many times as you desire. They
accept either a glob pattern or a JavaScript regular expression.

Please note that for files that are matched by any of the Babel patterns, they
will get compiled and put in the right place, but the originals will not be
copied over even if they are matched by any of the `-p` patterns.

By default, files matching the following glob are compiled using Babel:
`lib/**/*.js`.

By default, files matching any of the following globs are copied over to the
package:

  * `lib/**!(*.js~)`
  * `index.js`
  * `package.json`
  * `CHANGELOG*`
  * `CONTRIBUTING*`
  * `LICENSE*`
  * `README*`

### Publish a module

```
Options:
  -c, --clean        Remove the file after publication         [default: true]
  -m, --most-recent  If no file is specified, use the most recent matching the pattern
  -h, --help         Show help
```

If a file is provided as an argument, the tool will attempt to publish it to
npm. Otherwise, it will automatically publish the .tar.gz file it recognizes as
coming from itself. If more than one matches, it will list them, allowing the
user to select one, unless the ̀-m` option was specified, in which case it will
publish the most recent one.

### Release a module

This command first executes `npm version` with the same argument that you
provided to it to bump the version, so `build-module release patch` would
execute `npm version patch`. It then builds & publishes the module, with a
twist: it leverages `npm run build` and `npm run pub` to do so, meaning that you
still get to leverage whatever options you put in your package file for these
two.

This command is essentially equivalent to

```bash
npm patch <version> && npm run build && npm run pub
```

with the exception that it clarifies and tries to prevent some common mistakes
around the use of npm.

## Usage with the programmatic API

Not yet.

## Roadmap

  * Tests.
  * Programmatic API.
  * Entry point for negative globs.
  * Resulting path rewrite.
