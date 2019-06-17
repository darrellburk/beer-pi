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

var simData = {
  /*
  Tamb = ambient temperature
Tair = air temperature inside the keezer
Tload = temperature of the freezer contents
Tenc = temperature of the freezer body (interior) and evaporator coil

Ramb = heat transfer coefficient from Tamb to Tair
Rload = from Tload to Tair
Rair = from Tair to Tenc
*/
  // state (values that express the behavior of the freezer and contents)
  state : {
    /**
     * tXxx values are temperatures
     */
    tAmb : 72, // ambient temperature outside of the keezer
    tEnc : simData.state.tAmb, // temperature of the freezer box and evaporator coil (i.e. the hardware that is interior)
    tAir : simData.state.tAmb, // temperature of the air inside the freezer
    tLoad : simData.state.tAmb, // temperature of the keezer contents (kegs, fermenters, six-packs, etc.)
    cRefTotal : 0, // total amount of refrigerant that is currently compressed
    power : 0
  },
  // physical properties/constants
  prop : {
    /**
     * rXxx are heat transfer rates in [heat unit] per second per degree of temperature delta
     * 
     * TODO adjust these!
     */
    rEnc : 1, // from tAir to tEnc
    rAmb : 1, // from tAmb to tAir
    rLoad : 1, // from tLoad to tAir
    /**
     * hXxx values are heat capacity (i.e. thermal mass) in degrees of temperature change per [heat unit]
     * NOTE that hAmb is not provided, it is assumed to be infinite
     */
    hEnc : 1, // of the freezer box and coil (potential thermal mass of compressed refrigerant is separate)
    hAir : 1, // of the air inside the keezer
    hLoad : 1, // of the keezer contents
    /**
     * Characteristics of the refrigeration system. Focuses on the heat sinking capacity of the compressed
     * refrigerant, and the rate at which the running compressor increases that capacity, and the way in
     * which that capacity is reduced (consumed) by heat transferred from tAir to tEnc, and on what the
     * maximum potential capacity is.
     */
    refTotal : 1, // total amount of refrigerant in the refrigeration system
    cRefRate : 1,

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
  this.cRefTotal = 0;
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
  var prop = simData.prop;
  var state = simData.state;

  /**
   * TODO Simulate!
   * 
   * 
   */

  /**
   * Simulate the refrigeration system
   * 1) How much refrigerant gets added to the compressed refrigerant in this cycle
   * 2) Heat transfer from ambient to internal air
   * 3) Heat transfer from load to internal air
   * 4) Heat transfer from internal air to enclosure (remember, enclosure includes refrigeration system)
   *    2), 3), and 4) are each done independently and assumed not to interact with each other (we'll revisit
   *    this assumption  if it results in too much error)
   * 5) use 2), 3) and 4) to calculate the new temperatures for interior air, load, and enclosure
   * 6) use 4) to calculate how much compressed refrigerant got used up during this cycle, and then use 1) to 
   *    also calculate how much compressed refrigerant remains at the end of the cycle.
   *    If there is no compressed refrigerant left, calculate how enclosure temperature increases.
   * 
   */

  // additional refrigerant compressed this cycle
  var crefAdded = 0;
  if (state.power == 1) {
    crefAdded = prop.cRefRate * (prop.refTotal - state.cRefTotal) * seconds;
  }

  // TODO simulate for heat generated in the load (fermenting wort)

  // heat transfer from ambient to internal air
  var hAmb = (state.tAmb - state.tAir) * prop.rAmb * seconds;

  // heat from load to internal air
  var hLoad = (state.tLoad - state.tAir) * prop.rLoad * seconds;

  // TODO heat from internal air to enclosure/coil

 
  this.enclosureTemp += (enclosureDeltaFromCoils + enclosureDeltaFromAmbient);

  this.ts = ts;
}

module.exports = {
  FreezerSimulator: FreezerSimulator
};