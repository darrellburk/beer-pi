"use strict;";
/**
 * This is a mock of physical-interface.js that simulates the temperatures of the freezer enclosure and fermenting
 * wort. The purpose is to test the control and protection algorithms in beer-controller.js.
 * 
 * To run the tests, simply cause beer-controller.js to require this module in place of physical-interface.js, and then
 * run the controller. 
 */

var simulator = require("./simulator.js");

var config = null;
var state = null;
var controlFunction = null;
var setPowerCallback = null;
var stopCallback = null;


/**
 * 
 * @param {*} pconfig configuration object from config.js
 * @param function fControl function that controls the freezer power (by calling setPower()). This module will call
 * the control function periodically after reading the temperature probes
 * @param function fLogToFile callback to log current state to the control history file
 */
function configure(pconfig, pstate, fControl) {
  config = pconfig;
  state = pstate;
  controlFunction = fControl;
}

/**
 * Starts the physical interface. Once started, it will periodically read the temperature probes, then call the control
 * and protection functions, and control freezer power based on their outputs.
 */
function start() {
  testStartupDelay();
}

/** 
 * Sets the power on the freezer simulator for the current test
 * 
 */
function setPower(power) {
  setPowerCallback(power ? 1 : 0);
}

/**
 * Turns freezer power off and stops the physical interface.
 */
function stop() {
  stopCallback();
}

/**
 * Returns the probe(s) defined in the config file, like this:
 * [ { id: '28-031647c7f3ff', t: 72.162 },
 * { id: '28-041652951fff', t: 73.625 } ]
 */
function discoverProbes() {
  var probes = [];
  if (config.fermenterProbeId) {
    probes.push({id:config.fermenterProbeId, t:72});
  }
  probes.push({id:config.enclosureProbeId, t:72});
  return probes;
}

/**
 * This test confirms that the compressor startup delay is honored after beer-controller first starts up.
 */
function testStartupDelay() {
  state.lastTs = -1;
  state.power = -1;
  var freezer = new simulator.FreezerSimulator(72);
  var ts = 0;
  // stop the test after the rest period plus 10 control intervals
  var endTs = ts + config.compressorRestSeconds * 1000 + config.controlIntervalSeconds * 10 * 1000;
  var powerTs = ts + config.compressorRestSeconds * 1000;

  startTest("After start, freezer power does not come on until after "+config.compressorRestSeconds+" seconds");

  setPowerCallback = function(power) {
    freezer.setPower(power);
    if (power && ts < powerTs) {
      fail("power came on at "+(ts/1000)+" seconds, too early");
    }
  }

  stopCallback = function() {
    fail("stop() was called");
  }

  while (ts <= endTs) {
    controlFunction(ts);
    ts += config.controlIntervalSeconds * 1000;
  }
}

function startTest(name) {
  console.log("Starting test: "+name);
}

function fail(message) {
  console.log("FAIL: "+message);
}


module.exports = {
  configure: configure,
  discoverProbes: discoverProbes,
  start: start,
  setPower: setPower,
  stop: stop
}