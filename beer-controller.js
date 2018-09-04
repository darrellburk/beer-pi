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


var probes = discoverTemperatureProbes();

// call the callback with an error hopefully 
sensor.readF("bogus probe ID", 4, readProbeCallback);

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