# Versions

## v0.5.3 - (01/05/2017)

* Updated dependencies:
    * `fs-extra` to v3.
    * `yargs` to v7.


## v0.5.2 - (16/12/2016)

* Now always ignoring `__mocks__` sub-paths both for Babel building and for
  packaging.

* Updated dependencies:
    * `@novivia/babel` to v1.
    * `fs-extra` to v1.


## v0.5.1 - (04/11/2016)

* Addressed v0.5.0 not working at all.


## v0.5.0 - (04/11/2016)

* Now also accepting options in the `novivia-builder` package field.
* Renamed the CLI binary from `build-module` to `novivia-builder` for
  consistency with other `@novivia` tools.

* Added the `@novivia/babel` dependency.

* Removed dependencies:
    * `babel-plugin-add-module-exports`
    * `babel-plugin-transform-decorators-legacy`
    * `babel-plugin-transform-runtime`
    * `babel-plugin-typecheck`
    * `babel-polyfill`
    * `babel-preset-es2015`
    * `babel-preset-react`
    * `babel-preset-stage-0`
    * `babel-register`


## v0.4.0 - (27/10/2016)

* Now officially requiring Node 4+ and npm 3+ to work.
* Now always ignoring `__tests__` and `node_modules` sub-paths both for Babel
  building and for packaging.


## v0.3.1 - (17/10/2016)

* Updated `yargs` dependency to v6.


## v0.3.0 - (25/07/2016)

* Project now maintained under the Novivia scope. (@novivia)
* If the `publishConfig` key is not present in the package information, it is
  now assumed that the package shall be published to the public npm registry.

* New dependencies:
    * `@novivia/open-sourcer`

* Updated dependencies:
    * `@novivia/linter` to v1.
    * `babel-plugin-add-module-exports` to v0.2.
    * `fs-extra` to v0.30.
    * `json5` to v0.5.
    * `lodash` to v4.
    * `yargs` to v4.

## v0.2.6 - (28/06/2016)

* Added "npm-json5" to the list of npm CLIs to detect. The order is now "yapm",
  "npm-json5" and then "npm".


## v0.2.5 - (27/01/2016)

* No longer compiling any file located in the "node_modules" directory.


## v0.2.4 - (14/01/2016)

* Now properly building third-party code by leveraging additions from v0.2.3.


## v0.2.3 - (14/01/2016)

* Now aliasing `module.exports` to lone `export default` statements as was the
  case under Babel 5.
* Now recognizing experimental decorator syntax, as was the case under Babel 5.

* New dependencies:
    * `babel-plugin-add-module-exports`
    * `babel-plugin-transform-decorators-legacy`


## v0.2.2 - (12/01/2016)

* Now compiling Babel with default presets "es2015", "react" and "stage-0" as
  should have been the case with v0.2.0.


## v0.2.1 - (11/01/2016)

* Fixed a bug preventing the compilation when requesting the runtime helper.


## v0.2.0 - (11/01/2016)

* Updated code to be compliant with Babel 6.

* New dependencies:
    * `babel-plugin-transform-runtime`
    * `babel-plugin-typecheck`
    * `babel-polyfill`
    * `babel-preset-es2015`
    * `babel-preset-react`
    * `babel-preset-stage-0`
    * `babel-register`

* Updated dependencies:
    * `@auex/eslint-myrules` to v0.5.
    * `babel-core` to v6.
    * `bluebird` to v3.
    * `fs-extra` to v0.26.
    * `walkdir` to v0.0.11.


## v0.1.2 - (01/09/2015)

* Now properly recognizing pre-release semantic versioning patterns at
  publication time, such as "v1.2.3-rc.1". Previously, the `publish` command
  would erroneously output: "Unable to publish, no candidate found."

* Updated dependencies:
    * `@auex/eslint-myrules` to v0.3.
    * `fs-extra` to v0.24.


## v0.1.1 - (26/08/2015)

* Not binding the `babel-runtime` injected dependency to the full Babel version
  anymore, only to the same major version.


## v0.1.0 - (31/07/2015)

* Added a change log. (This!)
* Added a readme.
* First version "production-ready" for other modules.
* Corrected an erroneous glob to ignore temporary files that caused missing out
  on valid files.


## v0.0.3 - (23/07/2015)

* Ability to release modules.


## v0.0.2 - (22/07/2015)

* Ability to publish modules.


## v0.0.1 - (20/07/2015)

* Initial tagged version of the module builder.
* Ability to build modules to a .tar.gz file.
