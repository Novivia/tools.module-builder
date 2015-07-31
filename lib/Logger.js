/* eslint-disable no-console */
import {red, yellow} from "chalk";

export default class Logger {
  constructor({
    silent,
    verbose,
  } = {}) {
    this.isSilent = silent;
    this.isVerbose = verbose;
  }

  error(...args) {
    if (this.isSilent) {
      return;
    }

    console.error(red(...args));
  }

  info(...args) {
    if (this.isSilent) {
      return;
    }

    console.info(...args);
  }

  log(...args) {
    if (this.isSilent) {
      return;
    }

    console.log(...args);
  }

  verbose(...args) {
    if (!this.isVerbose) {
      return;
    }

    this.info(...args);
  }

  warn(...args) {
    if (this.isSilent) {
      return;
    }

    console.warn(yellow(...args));
  }

}
