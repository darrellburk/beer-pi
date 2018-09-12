const Gpio = require('onoff').Gpio;
var power = new Gpio(17, 'out');
const sensor = require('ds18b20-raspi');

var value = 0;
/*
[ { id: '28-031647c7f3ff', t: 75.2 },
  { id: '28-041652951fff', t: 75.2 } ]

*/

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
  }
};

var probes = discoverTemperatureProbes();

// TODO delete this test
// call the callback with an error hopefully 
sensor.readF("bogus probe ID", 4, readProbeCallback);

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
    turnPowerOff();
    return;
  }

  // enforce minimum on-time
  if (state.power != 0 && state.stayOnUntilTs > now) {
    turnPowerOn();
    return;
  }

  // currently just supporting one control mode: manage enclosure temperature

  // manage enclosure temperature
  if (true) {
    if (probeDefinedFor("enclosure")) {
      var temp = 

    } else if (!state.loggingFlags.unknownProbes) {
      console.log("Temperature probe ID for freezer enclosure is incorrect or not specfied. Temperature control is not possible.");
      state.loggingFlags.unknownProbes = true;
    }

  }


}

function turnPowerOff() {
  if (state.power != 0) {
    state.power = 0;
    power.writeSync(state.power);
  }
}

function turnPowerOn() {
  if (state.power == 0) {
    state.power = 1;
    power.writeSync(state.power);
  }
}

/**
 * TODO implement
 * 
 * This function is intended to be called periodically
 */
function readTemperatureProbes(successCallback) {

}

setInterval(function() {
  value = (value == 0) ? 1 : 0;
  power.writeSync(value);

  for (var i = 0 ; i<probes.length; i++ ) {
    var temp = sensor.readF(probes[i], 4, readProbeCallback);
    console.log("Probe %s: %f", probes[i], temp);
  }

  console.log("finished toggling LED");
}, 1000);


function discoverTemperatureProbes() {
  var result = [];
  var probes = sensor.readAllF();
  for (var i = 0; i < probes.length; i++ ){
    result.push(probes[i].id);
  }
  console.log("Discovered DS18B20 probes: "+probes);
  return result;
}

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