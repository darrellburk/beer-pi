/**
 * Encapsulates the physical interface to the freezer (reading the temperature probes and turning freezer power on and off).
 * 
 * The encapsulation separates the physical interface from the control and protection algorithms to make it easier to 
 * test those algorithms via a mocked physical interface.
 * 
 * Division of responsibilities:
 * + Control algorithm: uses data from the temperature probes to decide whether to enable/disable power to the freezer
 *   in order to manage the temperature. This algorithm is only concerned with managing the temperature, and it trusts the
 *   probes. 
 * + protection algorithm: uses current and historical data from the temperature probes and power setting to determine 
 *   whether the system is operating correctly. Checks for things like:
 *   + heat decreases more while freezer is powered than when it is not (detects but doesn't necessarily distinguish between
 *     failures like freezer not working, freezer is actually a warmer, probes are not in the enclosure, etc.)
 *   + control algorithm is causing enclosure temperature to be dangerously low (example: suppose boiling wort is placed in
 *     the freezer for cooling, and there are also bottles of beer in the freezer; if the control algorithm cools the wort
 *     as fast as possible by running the freezer continuously, this could simultaneously freeze the bottled beer and break
 *     the bottles)
 * + physical interface: reads the temperature probes, then consults with the control and protection algorithms and sets
 *   power to the freezer based on their outputs. Then records what was done and why.
*/

var config = null;
var logData = null;
var state = null;
var controlFunction = null;
var protectionFunction = null;
var controlInterval = null;
/**
 * we keep our own private copy of the current freezer power here; relying on the one in state (which can be corrupted
 * elsewhere) could cause catastrophic failure. Starts at -1 to ensure desired power of 0 or 1 are both seen as a change.
 */
var power = -1;

/**
 * 
 * @param {*} pconfig configuration object from config.js
 * @param {*} plogData logData object from beer-controller.js
 * @param function pcontrolFunction function that returns 1 (power on) or 0 (power off) to indicate freezer power needed to 
 * control temperature 
 * @param function pprotectionFunction 
 * function that returns {forcePowerOff: boolean, forcePowerOn: boolean, reason: string} indicating whether power must 
 * be forced on or off, and if so, why. Overrides the output of controFunction
 */
function configure(pconfig, pstate, plogData, pcontrolFunction, pprotectionFunction) {
  config = pconfig;
  state = pstate;
  logData = plogData;
  controlFunction = pcontrolFunction;
  protectionFunction = pprotectionFunction;
}

/**
 * Starts the physical interface. Once started, it will periodically read the temperature probes, then call the control
 * and protection functions, and control freezer power based on their outputs.
 */
function start() {
  controlInterval = setInterval(function () {
    controlFreezerPower(controlFunction, protectionFunction);
    logToFile();
  }, config.controlIntervalSeconds);
}

/**
 * Turns freezer power off and stops the physical interface.
 */
function stop() {
  setPower(0);
  if (controlInterval) {
    clearInterval(controlInterval);
    controlInterval = null;
  }
}

/**
 * Implements the periodic control behavior of the physical interface.
 */
function controlFreezerPower() {
  var now = new Date().valueOf();
  state.lastTs = now;
  readTemperature();
  var newPower = controlFunction();
  var protection = protectionFunction();

  logData.reason = "control";

  if (protection.forcePowerOff) {
    newPower = 0;
    logData.reason = "protection";
    logData.note = protection.reason;
  } else if (protection.forcePowerOn) {
    newPower = 1;
    logData.reason = "protection";
    logData.note = protection.reason;
  }

  if (logData.reason == logData.previousReason && logData.note == logData.previousNote) {
    logData.note == "";
  } else {
    logData.previousReason = logData.reason;
    logData.previousNote = logData.note;
  }

  setPower(newPower, now);
}

// TODO need to move the node modules for temp probes and power switch into here
function setPower(newPower, now) {
  now = now || new Date().valueOf();

  newPower = newPower ? 1 : 0;
  if (power != newPower) {
    power = newPower;
    state.power = newPower;
    powerSwitch.writeSync(newPower);

    // TODO in future this should be handled by controller side, as stayOffUntilTs and stayOnUntilTs more
    // properly belong to its state
    if (!newPower) {
      state.stayOffUntilTs = now + (config.compressorRestSeconds * 1000);
    } else {
      state.stayOnUntilTs = now + (config.minCompressorRunSeconds * 1000);
    }
  }
}

/**
 * Reads the temperature probes and stores them in the state object
 */
function readTemperature() {
  state.enclosureTemp = sensor.readF(state.enclosureProbeId, 4, readProbeCallback);
  console.log("Enclosure probe: %f", temp);
  if (state.fermenterProbeId != null) {
    state.fermentationTemp = sensor.readF(state.fermenterProbeId, 4, readProbeCallback);
    console.log("Fermentation probe: %f", temp);
  }
}

function readProbeCallback(error, readings) {
  console.log("readProbeCallback: readings=" + readings + ", error=" + error);
}


module.exports = {
  configure: configure,
  start: start,
  stop: stop
}