/**
 * This is the main script for running the real freezer controller
 */
"use strict;";
const os = require('os');
const config = require("./config.js");
const physicalInterface = require("./physical-interface-mock");
const controller = require("./controller");
const logging = require("./logging");
const data = require("./data");

var state = data.state;
var logData = data.logData;

console.log("os.homedir()="+os.homedir());
console.log("os.tmpdir()="+os.tmpdir());
console.log("process.env="+JSON.stringify(process.env));


logging.openControlLog();
logging.addControlLog("Freezer controller started");
logging.addControlLog("ts, power, enclosureTemp, fermentationTemp, mode, reason, note");


controller.init(physicalInterface);
controller.validateConfig();
physicalInterface.start(exitRequested);


/**
 * Handler that is intended to be called upon receipt of any external signal that requests the
 * app to terminate.
 */
function exitRequested() {
  logging.addControlLog("Freezer controller stopping");
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





