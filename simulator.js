/*
 * Simulates the thermal characterists of the freezer and of the fermenting wort.
 * 
 * Enclosure (enc)
 * This is the freezer body and the evaporator coils that do the cooling. For simplicity, we assume that
 * the entire freezer body (inside) and coils are always exactly the same temperature as each other.
 * 
 * Important characteristics of the enclosure:
 * + It has a non-zero heat capacity that is large enough to be significant in the simulation
 * + The refrigeration system is part of it, and has these important characteristics
 *   + A reserve of compressed refrigerant begins to accumulate when the compressor is on. The accumulated
 *     compressed refrigerant has a "potential heat capacity". It may be some time after the compressor is
 *     turned off before this compressed refrigerant is exhausted.
 *   + As long as there is compressed refrigerant available, the coil/enclosure temperature is held to
 *     the minimum (this is a function of the regulator valve). When it is exhausted, then the coil/enclosure
 *     temperature rises as heat is transferred into it from the air inside the freezer (internal air)
 *   + The rate at which compressed refrigerant is used up is proportional to the rate of heat transfer from
 *     the internal air into the enclosure/coils. Compressed refrigerant is also used up to cool the coils/
 *     enclosure down to their minimum temperature.
 *   + The rate at which the compressor adds to the reserve of compressed refrigerant is inversely proportional
 *     to the ratio of compressed refrigerant to total refrigerant. Of course, this only happens when the
 *     compressor is running.
 *   + There is an upper limit to the compressor's rate of production of compressed refrigerant. The actual
 *     rate will usually be lower than this. The maximum rate occurs when conditions cause the compressed
 *     refrigerant to be used up as fast as the compressor can compress it.
 * 
 * 
 * 
 * Internal air
 * This is the air inside the freezer enclosure. It is important because it is primarily through this air
 * that heat is transferred from the load (the freezer contents, possibly including fermenters that may
 * be generating heat) into the enclosure/coils.
 * 
 * Important characteristics:
 * + it has a heat capacity (which we will assume is constant, ignoring the fact that the volume of air and
 *   therefore its total heat capacity will decrease as more items are placed in the freezer)
 * + there is a constant heat transfer coefficient that expresses how fast heat is transferred from the air 
 *   into the enclosure/coils degrees per second per degree of temperature delta between the two
 * + there is a heat transfer coefficient that expresses how fast heat is transferred from the load (the
 *   freezer contents) into the internal air. This coefficient is not constant in real life (it varies 
 *   depending on the characteristics of the things in the freezer), but for our application we are safe
 *   to assume it's constant.
 * 
 * Load
 * This is the contents of the freezer, the stuff whose temperature we ultimately want to control. Six packs
 * of beer, kegs of finished beer, fermenters filled with fermenting wort.
 * 
 * Important characteristics:
 * + the heat transfer rate described in the "internal air" section
 * + fermenting wort will generate heat
 * + the load has a specific heat capacity (aka thermal mass). This value varies dramatically depending on 
 *   what the load actually is. For simulation purposes, we can just assume that the load is always a 
 *   5-gallon carboy of wort.
 * 
 * 
 * The temperature controller is intended to estimate the thermal mass of the wort and the freezer by monitoring
 * the freezer internal air temperature and the wort temperature over time, and calculating how rapidly heat 
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
   *   at their minimum temperature. We'll assume this temperature is constant (specifically, we'll ignore the slight
   *   )
   * + The rate at which the compressed refrigerant is used increases in proportion to the
   *   delta between the coil temperature and the enclosure temperature.
   * + The heat capacity of the compressed refrigerant is proportional to its quantity.
   * 
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