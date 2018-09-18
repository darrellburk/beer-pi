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
 * the control and protection callbacks
 * 
 * @param function controlFunction function that implements the control algorithm
 * @param function protectionFunction implements the beer/wort/freezer protection logic
 */
function startPhysicalInterface(controlFunction, protectionFunction) {
    setInterval(function(){
        controlFreezerPower(controlFunction, protectionFunction);
        logToFile();
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

    logData.reason = "control";

    if (protection.forcePowerOff) {
        power = 0;
        logData.reason = "protection";
        logData.note = protection.reason;
    } else if (protection.forcePowerOn) {
        power = 1;
        logData.reason = "protection";
        logData.note = protection.reason;
    }

    if (logData.reason == logData.previousReason && logData.note==logData.previousNote) {
        logData.note == "";
    } else {
        logData.previousReason = logData.reason;
        logData.previousNote = logData.note;
    }
    
    setPower(power, now);
}

function setPower(power, now) {
    power = power ? 1 : 0;
    if (state.power != power) {
        state.power = power;
        powerSwitch.writeSync(state.power);

        // TODO in future this should be handled by controller side, as stayOffUntilTs and stayOnUntilTs more
        // properly belong to its state
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
  
    