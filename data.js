
var state = {
  lastTs: -1, // timestamp for previous controlTemperature() pass
  power: -1,
  stayOffUntilTs: -1,
  stayOnUntilTs: -1,
  loggingFlags: {
    unknownProbes: false
  },
  enclosureProbeId: null,
  fermenterProbeId: null,
  enclosureTemp: -1,
  fermentationTemp: -1
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


module.exports = {
  state: state,
  logData: logData
}