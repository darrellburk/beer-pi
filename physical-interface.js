/**
 * Encapsulates the interface (reading the temperature probes and turning freezer power on and off).
 * 
 * The encapsulation separates the physical interface from the control algorithm to make it easier to test the control
 * algorithm via a mocked physical interface.
 * 
 * Division of responsibilities:
 * + Control algorithm: uses data from the temperature probes to decide whether to enable/disable power to the freezer
 *   in order to manage the temperature. This algorithm is only concerned with managing the temperature, and it trusts the
 *   probes. 
 * + physical interface: makes final decision about powering the freezer as requested by the control algorithm. Enforces
 *   limits to ensure that
 *   + probes and freezer can be trusted (i.e. that the freezer is working correctly, that the probes are inside the
 *     compartment; it does this by confirming that probe temperatures respond to freezer power
 * enclosure temperature never
 */

/**
 * The function of the physical interface is to periodically read the temperature probes and then call
 * controlCallback to allow it to decide about turning on/off the power to the freezer.
 * 
 * @param function controlFunction function that implements the control algorithm
 * @param function protectionFunction implements the beer/wort/freezer protection logic
 */
function startPhysicalInterface(controlFunction, protectionFunction) {
    setInterval(function(){
        controlFreezerPower(controlFunction, protectionFunction);
    }, 30000);
}

/**
 * 
 * @param boolean controllFunction 
 * @param {*} protectionFunction 
 */
function controlFreezerPower(controlFunction, protectionFunction) {
    var now = new Date.valueOf();
    state.lastTs = now;
    readTemperature();
    var power = controlFunction();
    var protection = protectionFunction();

    if (protection.forcePowerOff) {
        power = 0;
    } else if (protection.forcePowerOn) {
        power = 1;
    }
    setPower(power, now);
}

function setPower(power, now) {
    power = power ? 1 : 0;
    if (state.power != power) {
        state.power = power;
        powerSwitch.writeSync(state.power);

        if (!power) {
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
    if (state.fermenterProbeId!=null) {
        state.fermentationTemp = sensor.readF(state.fermenterProbeId, 4, readProbeCallback);
        console.log("Fermentation probe: %f", temp);
    }
}

/**
 * TODO implement
 * 
 * This function is intended to be called periodically
 */
function readTemperatureProbes(successCallback) {
}
  
  function readProbeCallback(error, readings) {
    console.log("readProbeCallback: readings="+readings+", error="+error);
  }
  
    