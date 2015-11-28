# Versions

## v0.2.0 - ()

* Updated tooling to Babel 6.


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
