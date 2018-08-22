const Gpio = require('onoff').Gpio;
const power = new Gpio(17, 'out');
const sensor = require('ds18b20-raspi');

var value = 0;
/*
[ { id: '28-031647c7f3ff', t: 75.2 },
  { id: '28-041652951fff', t: 75.2 } ]

*/

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
