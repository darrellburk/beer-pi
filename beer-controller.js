"use strict;";
const Gpio = require('onoff').Gpio;
var power = new Gpio(17, 'out');
const sensor = require('ds18b20-raspi');
const config = require("./config.js");

// some symbolic constants for safety
const ENCLOSURE = "enclosure";
const FERMENTATION = "fermentation";

// TODO delete this temp thing...
var value = 0;

/*
Call onExit when the app is terminating because process.exit() is called or there is no more work to do.
*/
process.on("exit", onExit);
process.on("SIGINT", function() {
  console.log("Received SIGINT");
  process.exit();
});

var state = {
  lastTs: -1, // timestamp for previous controlTemperature() pass
  power: 0,
  stayOffUntilTs: -1,
  stayOnUntilTs: -1,
  loggingFlags: {
    unknownProbes: false
  },
  enclosureProbeId: null,
  fermenterProbeId: null
};


validateConfig(config);



/**
 * Intended to be called at regular intervals (every 30 seconds probably), this function
 * uses the most recently read temperatures from the probes and then decides whether to 
 * turn the power to the freezer on or off.
 * 
 */
function controlTemperature() {
  var now = new Date().valueOf();

  // make sure we let the compressor rest after controller restart
  if (state.lastTs == -1) {
    // the controller just started, so we don't know how long the compressor has been off
    state.stayOffUntilTs = now + (config.compressorRestSeconds * 1000);
  }

  // protect the compressor from coming on too soon after going off
  if (now < state.stayOffUntilTs) {
    turnPowerOff(now);
    return;
  }

  // enforce minimum on-time
  if (state.power != 0 && state.stayOnUntilTs > now) {
    turnPowerOn(now);
    return;
  }

  // currently just supporting one control mode: manage enclosure temperature

  if (config.mode == ENCLOSURE) {
    // control enclosure temperature
    if (probeDefinedFor("enclosure")) {
      var temp = getTempFor("enclosure");
      if (temp > config.targetEnclosureTemp + 1) {
        turnPowerOn(now);
      } else if (temp < config.targetEnclosureTemp - 1) {
        turnPowerOff(now);
      }
    } else if (!state.loggingFlags.unknownProbes) {
      console.log("Temperature probe ID for freezer enclosure is incorrect or not specfied. Temperature control is not possible. Turning power off.");
      state.loggingFlags.unknownProbes = true;
      turnPowerOff(now);
    }

    state.lastTs = now;
  } else if (config.mode == FERMENTATION) {
    // TODO log not implemented
  }


}

function turnPowerOff(now) {
  if (state.power != 0) {
    state.power = 0;
    power.writeSync(state.power);
    state.stayOffUntilTs = now + (config.compressorRestSeconds * 1000);
  }
}

function turnPowerOn(now) {
  if (state.power == 0) {
    state.power = 1;
    power.writeSync(state.power);
    state.stayOnUntilTs = now + (config.minCompressorRunSeconds * 1000);
  }
}


/**
 * TODO implement
 * 
 * This function is intended to be called periodically
 */
function readTemperatureProbes(successCallback) {
  var temp = sensor.readF(state.enclosureProbeId, 4, readProbeCallback);
  console.log("Enclosure probe: %f", temp);
  if (state.fermenterProbeId!=null) {
    temp = sensor.readF(state.fermenterProbeId, 4, readProbeCallback);
    console.log("Fermentation probe: %f", temp);
  }
}

setInterval(function() {
  value = (value == 0) ? 1 : 0;
  power.writeSync(value);

  // TODO have this call back to controlTemperature()
  readTemperatureProbes();
  console.log("finished toggling LED");
}, 1000);



function readProbeCallback(error, readings) {
  console.log("readProbeCallback: readings="+readings+", error="+error);
}

/**
 * Handler that is intended to be called upon receipt of any external signal that requests the
 * app to terminate.
 */
function exitRequested() {
  process.exit();
}

/**
 * Handler that is invoked when the app is exiting (intended to be in ALL normal and abnormal
 * exit cases) and should do any needed cleanup like TURNING THE FREEZER OFF!!!
 * 
 * @param {} code 
 */
function onExit(code) {
  // turn off the power and then unexport that GPIO pin
  power.writeSync(0);
  power.unexport();
  power = null;

  console.log("beer-controller is exiting with code "+code);
}

/**
 * Validates the configuration settings read from config.js. If values are missing or 
 * don't make sense or are dangerous, sets default values. If correction is not possible,
 * terminates.
 * 
 * @param {} config 
 */
function validateConfig(config) {
  var probes;

  // minimum compressor off time between cycles
  if (typeof config.compressorRestSeconds != "number") {
    config.compressorRestSeconds = 300;
    console.log("config.compressorRestSeconds not set correctly; defaulting to 300.");
  } else if (config.compressorRestSeconds < 120) {
    config.compressorRestSeconds = 300;
    console.log("config.compressorRestSeconds is too short and could lead to compressor damage/failure; defaulting to 300.");
  } else if (config.compressorRestSeconds > 600) {
    config.compressorRestSeconds = 600;
    console.log("config.compressorRestSeconds is unnecessarily long, which can interfere with temperature control; limiting to 600.");
  }

  // minimum compressor run time
  if (typeof config.minCompressorRunSeconds != "number") {
    config.minCompressorRunSeconds = 120;
    console.log("config.minCompressorRunSeconds not set correctly; defaulting to 120.");
  } else if (config.minCompressorRunSeconds > 600) {
    config.minCompressorRunSeconds = 600;
    console.log("config.minCompressorRunSeconds is too long; this could lead to unintentional freezing. Limiting to 600.");
  }


  /**
   * Any target temp is acceptable. If set too high, we will never turn on the freezer. If set too low, 
   * we will leave the freezer on all the time, and it's own thermostat will maitain freezing temperature.
   * In between these two extremes, we will control power to the freezer in order to achieve the target
   * temperature. In all three cases, no harm.
   */
  if (typeof config.targetEnclosureTemp != "number") {
    console.log("Fatal error: config.targetEnclosureTemp not set correctly. Terminating.");
    process.exit();
  } else if (config.targetEnclosureTemp > 72) {
    console.log("NOTICE: config.targetEnclosureTemp > 72. It is likely that freezer will never be powered and no cooling will occur.");
  } else if (config.targetEnclosureTemp < 0) {
    console.log("WARNING: config.targetEnclosureTemp < 0. Freezer will likely remain powered continuously and will operate as a freezer. Beer/wort will freeze. Kegs and fermenters and bottles may burst!");
  }
  
  /**
   * temperature probes
   * readAllF() returns something like this:
   * [ { id: '28-031647c7f3ff', t: 72.162 },
   * { id: '28-041652951fff', t: 73.625 } ]
   */
  console.log({"discovered probes":sensor.readAllF()});
  if (typeof config.enclosureProbeId != "string" ) {
    console.log("Fatal: config.enclosureProbeId is missing or malformed. Please set it to one of the probe IDs reported just below. To help distinguish probes, expose them to different temperatures.");
    process.exit();
  }
  if (typeof config.fermenterProbeId != "string") {
    console.log("config.fermenterProbeId is missing or malformed. Fermentation control is not available. Setting mode=enclosure.");
    config.mode = ENCLOSURE;
  }
  probes = sensor.readAllF();
  state.enclosureProbeId = null;
  state.fermenterProbeId = null;
  // match up probe IDs from config to attached probes
  for (var i = 0; i < probes.length; i++) {
    probes[i].used = false;
    if (probes[i].id == config.enclosureProbeId) {
      state.enclosureProbeId = probes[i].id;
      probes[i].used = true;
    } else if (probes[i].id == config.fermenterProbeId) {
      state.fermenterProbeId = probes[i].id;
      probes[i].used = true;
    }
    if (!probes[i].used) {
      console.log("Warning: probe %s is not used by config.enclosureProbeId or config.fermenterProbeId. Is this intentional?", probes[i].id);
    }
  }
  if (state.enclosureProbeId==null) {
    console.log("Fatal: config.enclosureProbeId is set to %s but no such probe is connected. Terminating.", config.enclosureProbeId);
    process.exit();
  }
  if (state.fermenterProbeId==null && config.fermenterProbeId!=null) {
    console.log("Warning: config.fermenterProbeId is set to %s but no such probe is connected. Fermentation control is not available. Setting mode=enclosure.", config.fermenterProbeId);
    config.mode = ENCLOSURE;
  }

  if (typeof config.mode != "string" || (config.mode != ENCLOSURE && config.mode != FERMENTATION)) {
    console.log("config.mode must be set to either '%s' or '%s'. Defaulting to %s.", ENCLOSURE, FERMENTATION, ENCLOSURE);
  }

  console.log({
    message:"Finished validating config",
    config: config,
    state: state
  });

}