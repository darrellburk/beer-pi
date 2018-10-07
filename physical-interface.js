"use strict;";
/**
 * Encapsulates the physical interface to the freezer (reading the temperature probes and turning freezer power on and off).
 * 
 * The encapsulation separates the physical interface from the control and protection algorithms to make it easier to 
 * test those algorithms via a mocked physical interface.
 * 
 * Division of responsibilities:
 * + Physical interface is in charge of the control interval (so that a simulated physical interface can accellerate time
 *   so that, for example, 7-day test scenarios don't take seven days to run)
 * + It periodically reads the probes, stores the value and the current power setting in the state objhect,  and calls 
 *   the control function. It also exports the setPower() function, and the control function is expected to call this
 *   when needed to turn the power on or off.
 * + All the other important operations are outside the physical interface's responsibility: temperature control algorithm,
 *   freezer and contents protection algorithm, logging, etc.
 * 
 * NOTE that this module does not have any protection mechanisms. It will turn the freezer power on and off on command,
 * without attempting to prevent the destruction that would result from rapid cycling or worse.
 */

const Gpio = require('onoff').Gpio;
var powerSwitch = new Gpio(17, 'out');
const sensor = require('ds18b20-raspi');
const data = require("./data");
const config = require("./config");
var state = data.state;

var controlFunction = null;
var controlInterval = null;

// very first thing, turn the power off, just to be sure
powerSwitch.writeSync(0);


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
  if (controlInterval == null) {
    var now = new Date().valueOf();
    readTemperature();
    controlFunction(now);
    controlInterval = setInterval(function () {
      var now = new Date().valueOf();
      readTemperature();
      controlFunction(now);
    }, config.controlIntervalSeconds * 1000);
  }
}

function setPower(power) {
  powerSwitch.writeSync(power ? 1 : 0);
}

/**
 * Turns freezer power off and stops the physical interface.
 */
function stop() {
  setPower(0);
  powerSwitch.writeSync(0);
  powerSwitch.unexport();
  powerSwitch = null;
  if (controlInterval) {
    clearInterval(controlInterval);
    controlInterval = null;
  }
}


/**
 * Reads the temperature probes and stores them in the state object
 */
function readTemperature() {
  var temp = state.enclosureTemp = sensor.readF(state.enclosureProbeId, 4, readProbeCallback);
  if (state.fermenterProbeId != null) {
    temp = state.fermentationTemp = sensor.readF(state.fermenterProbeId, 4, readProbeCallback);
  }
}

function readProbeCallback(error, readings) {
  //console.log("readProbeCallback: readings=" + readings + ", error=" + error);
}

function discoverProbes() {
  return sensor.readAllF();
}


module.exports = {
  init: init,
  discoverProbes: discoverProbes,
  start: start,
  setPower: setPower,
  stop: stop
}