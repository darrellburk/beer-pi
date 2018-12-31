/*
 * Simulates the thermal characterists of the freezer and of the fermenting wort.
 * 
 * The freezer has thermal mass. That means that [at all times, including when it is not running], the 
 * coldness of its internal parts can cool things that are put into it (by transferring heat from those 
 * things into the interior of the freezer until everything is at the same temperature).
 * 
 * The freezer also has the ability to remove heat (when it is running). The heat removal rate varies 
 * linearly based on the delta between the temperature of the load (the things in the freezer and the 
 * interior of the freezer itself) and the minimum temperature of the freezer coils. The maximum heat 
 * removal rate occurs when this delta is maximum. We'll arbitrarily say that maximum load temperature 
 * is 80F, and specify the heat removal rate constant relative to that. 
 * 
 * Our only load (other than the freezer interior itself) will be the carboy of fermenting beer, the wort. 
 * During fermentation, the wort generates heat. When no fermentation is happening, the wort doesn't generate
 * any heat. The wort also has thermal mass, which is to say, a certain amount of energy is required
 * to heat (by adding energy) or cool (by removing energy) the wort by 1 degree F. The thermal mass is that
 * ratio between energy addition/removal, and the resulting temperature change. The thermal mass
 * is proportional to the number of gallons and is probably nearly identical to the thermal mass of water.
 * 
 * The wort also has a heat transfer cooeficient. This is the ratio that specifies the relationship between
 * the heat addition/removal rate relative to the temperature delta between the wort and the air surrouding
 * it. The heat transfer coefficient depends on things like the surface area of the container that holds
 * the wort, whether the wort is circulating, what kind of material the container is made of, how thick it
 * is, etc. For example, if the fermentation vessel is well insulated, then the heat transfer coefficient is
 * low, and heat will be transferred at a certain rate between the carboy and the air surrounding it; if the 
 * fermentation vessel is not insulated and all other conditions are the same, then heat will be transferred
 * at a higher rate. 
 * 
 * The temperature controller is intended to estimate the thermal mass of the wort and the freezer by monitoring
 * the freezer internal ambient temperature and wort temperature over time, and calculating how rapidly heat 
 * is transferred. And then, using these values, it is also intended to calculate the heat output of the 
 * fermenting wort, and to use that value to determine whether the wort is in primary/active fermentation, 
 * secondary fermentation, or fermentation not happening (i.e. fermentation not started, or fermentation complete).
 * 
 * 
 * This module contains both the code and configuration for the simulator.
 * 
 * Thermal mass values are relative. The important elements to simulate include:
 * + the ambient environment (thermal mass is infinite and therefore irrelevant)
 * + the refrigeration system 
 * + the freezer interior structure (the parts that change temperature as the interior temperature changes, so the
 *   insulation, interior plastic, shelves, freezer contents other than fermenting wort, etc.). Thermal mass matters,
 *   but also varies depending on what's being chilled in the freezer.
 * + Carboy(s) of fermenting wort (which will be generating some heat).
 * 
 * 
*/

var simConfig = {
  freezer: {
    /**
     * Lowest temperature the coils can be, with the compressor running. Since the typical home freezer can cool
     * the enclosure to -20F, the coil temperature must be a bit lower than that.
     */
    minCoilTempF: -30,
    /**
     * The rate of heat removal from the freezer enclosure is proportional to the difference between the enclosure temperature
     * and the coil temperature.
     * 
     * Degrees per second per degree of temperature delta
     */
    enclosureToCoilRate: 0.0005,
    /**
     * There is an upper limit to how fast the freezer can remove heat from the enclosure. Below this limit, the heat transfer
     * rate is enclosureToCoilRate. 
     * 
     * Degrees per second
     */
    enclosureToCoilMaxRate: 0.5,
    /**
     * The rate at which heat transfers between the exterior (ambient) and interior of the freezer.
     * 
     * Degrees per second per degree of temperature delta
     */
    enclosureToAmbientRate: 0.0001,
    /**
     * Heat capacity of the refrigeration system. Used to help simulate how the freezer keeps cooling down for a while even
     * after the power is turned off.
     * 
     * TODO implement this
     */
    coilThermalMass: 1
  },
  wort: {
    thermalMass: 1,   // again, 1 is certainly not right
    primaryWatts: 15, // heat power generated during active fermentation
    secondaryWatts: 1, // heat power generated during secondary fermentation
  }

};



function FreezerSimulator(startTemp) {
  this.ambientTemp = 72;  // temperature outside the freezer
  this.enclosureTemp = startTemp;
  this.power = 0;
  this.hasWort = false;
  this.ts = 0;
  this.setPower = setPower;
  this.simulate = simulate;

}

function setPower(newPower) {
  this.power = newPower ? 1 : 0;
}

/**
 * TODO will "this" make it in here and be correct???
 * 
 * @param {*} ts current timestamp
 */
function simulate(ts) {
  // length of this time slice in seconds
  var seconds = (ts - this.ts) / 1000;

  /**
   * TODO Simulate!
   * 
   * 
   */

  /**
   * Simulate the refrigeration system
   * + When power is on, compressor runs and the amount of compressed refrigerant
   *   increases toward the maximum. The rate of increase depends on the difference
   *   between current quantity and max quantity. When the power goes off, the remaining
   *   compressed refrigerant gets depleted.
   * + As long as compressed refrigerant is present, the evaporator coils will be held
   *   at their minimum temperature. The minimum temperature is mostly constant, but increases
   *   slightly in proportion to the delta between the freezer interior temperature and
   *   the coil temperature (really, in proportion to how much heat is being removed by
   *   the evaporator)
   * + The rate at which the compressed refrigerant is used increases in proportion to the
   *   delta between the coil temperature and the enclosure temperature.
   * + The heat capacity of the compressed refrigerant is proportional to its quantity.
   */

  // heat capacity of compressed refrigerant
  var refrigerantHeatCapacity = this.compressedRefrigerant * simConfig.refrigerantHeatCapacity;
  var maxRefrigerantHeatTransfer = 0;
  if (this.enclosureTemp > simConfig.minCoilTempF) {
    maxRefrigerantHeatTransfer = seconds * (this.enclosureTemp - simConfig.minCoilTempF) * simConfig.refrigerantHeatTransferRate;
  }
  
  var actualRefrigerantHeatTransfer = refrigerantHeatCapacity > maxRefrigerantHeatTransfer ? maxRefrigerantHeatTransfer : refrigerantHeatCapacity;


  

  /**
   * simulate the evaporator coil temperature
   * 
   * + Initial condition is that the coil temperature is the same as the interior temperature.
   * + When freezer power is on, the coil temperature decreases at a rate that is proportional to 
   *   [current coil temperature] - simConfig.minCoilTempF
   */

  // TODO stop assuming that the coils have no thermal inertia...
  var coilTemp = this.power ? simConfig.freezer.minCoilTempF : this.enclosureTemp;

  // change of enclosure temperature due to coils
  var enclosureToCoilRate = (coilTemp - this.enclosureTemp) * simConfig.freezer.enclosureToCoilRate;
  if (Math.abs(enclosureToCoilRate) > simConfig.freezer.enclosureToCoilMaxRate) {
    enclosureToCoilRate = Math.sign(enclosureToCoilRate) * simConfig.freezer.enclosureToCoilMaxRate
  }
  var enclosureDeltaFromCoils = enclosureToCoilRate * seconds;

  // heat from ambient to enclosure
  var enclosureDeltaFromAmbient = ((this.ambientTemp - this.enclosureTemp) * simConfig.freezer.enclosureToAmbientRate) * seconds;

  if (this.hasWort) {

  }

  this.enclosureTemp += (enclosureDeltaFromCoils + enclosureDeltaFromAmbient);

  this.ts = ts;
}

module.exports = {
  FreezerSimulator: FreezerSimulator
};