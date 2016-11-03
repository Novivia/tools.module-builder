/**
 * Copyright 2013-present, Novivia, Inc.
 * All rights reserved.
 */

if (!global.__BUILDING__) {
  require("@novivia/babel")();
}

require("better-log/install");
require("./lib/cli");
