/**
 * This is the main script for running the real freezer controller
 */
"use strict;";
const config = require("./config.js");
// this is the real physical interface
//const physicalInterface = require("./physical-interface.js");
// this physical interface runs the tests
const physicalInterface = require("./physical-interface-mock");
const controller = require("./controller");
const logging = require("./logging");
const data = require("./data");
var state = data.state;
var logData = data.logData;

// some symbolic constants for safety


/*
Call onExit when the app is terminating because process.exit() is called or there is no more work to do.

TODO systemctl restart does not trigger our exit handling, fix that
*/
process.on("exit", onExit);
process.on("SIGINT", function () {
  console.log("Received SIGINT");
  exitRequested();
});


logging.openControlLog();
logging.addControlLog("Freezer controller started\n");
logging.addControlLog("\n");


controller.init(physicalInterface);
controller.validateConfig();
physicalInterface.start();



/**
 * Handler that is intended to be called upon receipt of any external signal that requests the
 * app to terminate.
 */
function exitRequested() {
  logging.addControlLog("Freezer controller stopping\n");
  logging.closeControlLog()
  .then(function() {
    process.exit();
  })
  .catch(function() {
    process.exit();
  });
}

/**
 * Handler that is invoked when the app is exiting (intended to be in ALL normal and abnormal
 * exit cases) and should do any needed cleanup like TURNING THE FREEZER OFF!!!
 * 
 * @param {} code 
 */
function onExit(code) {
  // turn off the power and then unexport that GPIO pin
  physicalInterface.stop();

  console.log("beer-controller is exiting with code " + code);
}





