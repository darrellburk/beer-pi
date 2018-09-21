"use strict;";
const config = require("./config.js");
const physicalInterface = require("./physical-interface.js");
const fs = require('fs');

// some symbolic constants for safety
const ENCLOSURE = "enclosure";
const FERMENTATION = "fermentation";

/*
Call onExit when the app is terminating because process.exit() is called or there is no more work to do.

TODO systemctl restart does not trigger our exit handling, fix that
*/
process.on("exit", onExit);
process.on("SIGINT", function () {
  console.log("Received SIGINT");
  process.exit();
});

var state = {
  lastTs: -1, // timestamp for previous controlTemperature() pass
  power: -1,
  stayOffUntilTs: -1,
  stayOnUntilTs: -1,
  loggingFlags: {
    unknownProbes: false
  },
  enclosureProbeId: null,
  fermenterProbeId: null
};

var logData = {
  ts: 0,
  mode: "",
  enclosureTemp: -1,
  fermentationTemp: -1,
  power: -1,
  reason: "",
  note: "",
  previousReason: "",
  previousNote: ""
};
var logFileFd = null;

fs.open("./keezer.log", "a", function (err, fd) {
  if (err) throw err;
  logFileFd = fd;
  fs.write(fd, "Freezer controller started", callback)
});

validateConfig(config);
physicalInterface.configure(config, state, controlFreezerPower);
physicalInterface.start();


/**
 * Intended to be called at regular intervals (every 30 seconds probably) by the physical interface after it has read the
 * temperature probes, this function uses the most recently read temperatures from the probes and then decides whether to 
 * turn the power to the freezer on or off.
 */
function controlFreezerPower(now) {
  var newPower = controlTemperature(now);
  var protection = protectFreezerAndContents(now);

  // this must come AFTER calling protectFreezerAndContents() or the startup delay won't work
  state.lastTs = now;

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

/**
 * 
 * @returns a request to leave the power as-is, turn it on, or turn it off
 */
function controlTemperature(now) {
  var requestedPower = state.power;

  // currently just supporting one control mode: manage enclosure temperature
  if (config.mode == ENCLOSURE) {
    // control enclosure temperature
    var temp = state.enclosureTemp;
    if (state.enclosureTemp > config.targetEnclosureTemp + 1) {
      requestedPower = 1;
    } else if (temp < config.targetEnclosureTemp - 1) {
      requestedPower = 0;
    }
  } else if (config.mode == FERMENTATION) {
    // TODO log not implemented
  }

  return requestedPower;
}

/**
 * Protects the freezer equipment and contents by
 * + preventing rapid cycling of the compressor
 * + verifying that the enclosure probe is in the enclosure
 * + verifying that the freezer does remove heat when it's powered on
 * + maybe other things as well
 * 
 * Returns an object that indicates whether power should be forced off or forced on, along with a loggable
 * description of why.
 * 
 * TODO compressor off time after startup didnt' work!
 */
function protectFreezerAndContents(now) {
  var result = {
    forcePowerOff: false,
    forcePowerOn: false,
    reason: ""
  }

  // make sure compressor doesn't cycle too frequently
  if (state.lastTs == -1) {
    state.stayOffUntilTs = now + (config.compressorRestSeconds * 1000);
    result.forcePowerOff = true;
    result.reason = "Startup delay to prevent premature start after power failure";
  } else if (now < state.stayOffUntilTs) {
    result.forcePowerOff = true;
    result.reason = "Ensure minimum compressor off time between run cycles";
  } else if (state.power != 0 && now < state.stayOnUntilTs) {
    result.forcePowerOn = true;
    result.reason = "Ensure minimum compressor run time";
  }

  // TODO make this minimum temperature configurable
  if (state.enclosureTemp < 32) {
    result.forcePowerOff = true;
    result.forcePowerOn = false;
    result.reason = "Prevent freezing kegs/wort"
  }

  /**
   * TODO add tests for assessing whether freezer is actually running and removing heat,
   * and whether the enclosure probe is sensing temperature changes inside the freezer.
   */


  return result;
}


function setPower(newPower, now) {
  now = now || new Date().valueOf();

  newPower = newPower ? 1 : 0;
  if (state.power != newPower) {
    state.power = newPower;
    physicalInterface.setPower(newPower);

    // TODO in future this should be handled by controller side, as stayOffUntilTs and stayOnUntilTs more
    // properly belong to its state
    if (newPower == 0) {
      state.stayOffUntilTs = now + (config.compressorRestSeconds * 1000);
    } else {
      state.stayOnUntilTs = now + (config.minCompressorRunSeconds * 1000);
    }
  }
}


// TODO implement data logging to local file (local and web servable from node.js perspective)
function logToFile(logData) {
  console.log({ state: state, details: logData });
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
  physicalInterface.stop();

  if (logFileFd) {
    fs.close(logFileFd, function (err) {

    });
  }

  console.log("beer-controller is exiting with code " + code);
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
    console.log("compressorRestSeconds not set correctly; defaulting to 300.");
  } else if (config.compressorRestSeconds < 120) {
    config.compressorRestSeconds = 300;
    console.log("compressorRestSeconds is too short and could lead to compressor damage/failure; defaulting to 300.");
  } else if (config.compressorRestSeconds > 600) {
    config.compressorRestSeconds = 600;
    console.log("compressorRestSeconds is unnecessarily long, which can interfere with temperature control; limiting to 600.");
  }

  // minimum compressor run time
  if (typeof config.minCompressorRunSeconds != "number") {
    config.minCompressorRunSeconds = 120;
    console.log("minCompressorRunSeconds not set correctly; defaulting to 120.");
  } else if (config.minCompressorRunSeconds > 600) {
    config.minCompressorRunSeconds = 600;
    console.log("minCompressorRunSeconds is too long; this could lead to unintentional freezing. Limiting to 600.");
  }


  /**
   * Any target temp is acceptable. If set too high, we will never turn on the freezer. If set too low, 
   * we will leave the freezer on all the time, and it's own thermostat will maitain freezing temperature.
   * In between these two extremes, we will control power to the freezer in order to achieve the target
   * temperature. In all three cases, no harm.
   */
  if (typeof config.targetEnclosureTemp != "number") {
    console.log("Fatal error: targetEnclosureTemp not set correctly. Terminating.");
    process.exit();
  } else if (config.targetEnclosureTemp > 72) {
    console.log("NOTICE: targetEnclosureTemp > 72. It is likely that freezer will never be powered and no cooling will occur.");
  } else if (config.targetEnclosureTemp < 0) {
    console.log("WARNING: targetEnclosureTemp < 0. Freezer will likely remain powered continuously and will operate as "
      + "a freezer. Beer/wort will freeze. Kegs and fermenters and bottles may burst!");
  }

  /**
   * temperature probes
   * readAllF() returns something like this:
   * [ { id: '28-031647c7f3ff', t: 72.162 },
   * { id: '28-041652951fff', t: 73.625 } ]
   */
  probes = physicalInterface.discoverProbes();
  console.log({ "discovered probes": probes });
  if (typeof config.enclosureProbeId != "string") {
    console.log("Fatal: enclosureProbeId is missing or malformed. Please set it to one of the probe IDs reported just below. To help distinguish probes, expose them to different temperatures.");
    process.exit();
  }
  if (typeof config.fermenterProbeId != "string") {
    console.log("fermenterProbeId is missing or malformed. Fermentation control is not available. Setting mode=enclosure.");
    config.mode = ENCLOSURE;
  }
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
      console.log("Warning: probe %s is not used by enclosureProbeId or fermenterProbeId. Is this intentional?", probes[i].id);
    }
  }
  if (state.enclosureProbeId == null) {
    console.log("Fatal: enclosureProbeId is set to %s but no such probe is connected. Terminating.", config.enclosureProbeId);
    process.exit();
  }
  if (state.fermenterProbeId == null && config.fermenterProbeId != null) {
    console.log("Warning: fermenterProbeId is set to %s but no such probe is connected. Fermentation control is not available. Setting mode=enclosure.", config.fermenterProbeId);
    config.mode = ENCLOSURE;
  }

  if (typeof config.mode != "string" || (config.mode != ENCLOSURE && config.mode != FERMENTATION)) {
    console.log("mode must be set to either '%s' or '%s'. Defaulting to %s.", ENCLOSURE, FERMENTATION, ENCLOSURE);
  }

  if (typeof config.controlIntervalSeconds != "number"
    || (config.controlIntervalSeconds < 1 || config.controlIntervalSeconds > 60)) {
    console.log("controlIntervalSeconds must be >=1 and <=60. Defaulting to 30.");
    config.controlIntervalSeconds = 30;
  }

  console.log({
    message: "Finished validating config",
    config: config,
    state: state
  });

}