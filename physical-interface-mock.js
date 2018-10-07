"use strict;";
/**
 * This is a mock of physical-interface.js that simulates the temperatures of the freezer enclosure and fermenting
 * wort. The purpose is to test the control and protection algorithms in beer-controller.js.
 * 
 * To run the tests, simply cause beer-controller.js to require this module in place of physical-interface.js, and then
 * run the controller. 
 */

var simulator = require("./simulator");
const data = require("./data");
const config = require("./config");
var state = data.state;

// TODO if two different modules both require data.js, do they get the same data objects?

var controlFunction = null;
var setPowerCallback = null;
var stopCallback = null;


/**
 * 
 * @param function fControl function that controls the freezer power (by calling setPower()). This module will call
 * the control function periodically after reading the temperature probes
 */
function init(fControl) {
  controlFunction = fControl;
}

/**
 * Starts the physical interface. Once started, it will periodically read the temperature probes, then call the control
 * and protection functions, and control freezer power based on their outputs.
 */
function start(exit) {
  testStartupDelay();

  // shut it down after the tests
  if (typeof exit == "function") {
    exit();
  }
}

/** 
 * Sets the power on the freezer simulator for the current test
 * 
 */
function setPower(power) {
  if (typeof setPowerCallback == "function") {
    setPowerCallback(power ? 1 : 0);
  }
}

/**
 * Turns freezer power off and stops the physical interface.
 */
function stop() {
  if (typeof stopCallback == "function") {
    stopCallback();
  }
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
  var endTs = ts + config.compressorRestSeconds * 1000 + config.controlIntervalSeconds * 100 * 1000;
  var powerTs = ts + config.compressorRestSeconds * 1000;
  var powerOnCount = 0;

  startTest("After start, freezer power does not come on until after "+config.compressorRestSeconds+" seconds");

  // set the test/simulation callbacks
  setPowerCallback = function(power) {
    console.log("here");
    freezer.setPower(power);
    if (power) {
      powerOnCount++;
      if (powerOnCount==1 && ts > powerTs) {
        fail("power should have come on at "+(powerTs/1000)+" seconds, but didn't");
      }
    }
    if (power && ts < powerTs) {
      fail("power came on at "+(ts/1000)+" seconds, too early");
    }
  }

  stopCallback = function() {
    freezer.setPower(0);
    fail("stop() was called");
  }

  while (ts <= endTs) {
    state.enclosureTemp = freezer.enclosureTemp;
    state.fermentationTemp = freezer.fermentationTemp;
    controlFunction(ts);
    freezer.simulate(ts);
    ts += config.controlIntervalSeconds * 1000;
  }

  // clear the callbacks (so that normal exit doesn't fail the test)
  setPowerCallback = null;
  stopCallback = null;

}

function startTest(name) {
  console.log("Starting test: "+name);
}

function fail(message) {
  console.log("FAIL: "+message);
}


module.exports = {
  init: init,
  discoverProbes: discoverProbes,
  start: start,
  setPower: setPower,
  stop: stop
}