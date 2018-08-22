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
 * any heat. The wort also has thermal mass (which is to say, a certain amount of energy is required
 * to heat (by adding energy) or cool (by removing energy) the wort by 1 degree F. The thermal mass is that
 * ratio between enerty addition/removal, and the resulting temperature increase/decrease. The thermal mass
 * is proportional to the number of gallons and is probably nearly identical to the thermal mass of water.
 * 
 * The wort also has a heat transfer cooeficient. This is the ratio that specifies the relationship between
 * the heat addition/removal rate relative to the temperature delta between the wort and the air surrouding
 * it. The heat transfer coefficient depends on things like the surface area of the container that holds
 * the wort, whether the wort is circulating, what kind of material the container is made of, how thick it
 * is, etc. For example, if the fermentation vessel is well insulated, then the heat transfer coefficient is
 * low, and if the wort temperature is 75F and the air surrounding it is -10F, the wort wil be cooled at
 * a certain rate; if the fermentation vessel is not insulated and all other conditions are the same, then the
 * wort will be cooled at a higher rate. 
 * 
 * The temperature controller is intended to estimate the thermal mass of the wort and the freezer by monitoring
 * the ambient temperature and wort temperature over time, and calculating how rapidly heat is transferred.
 * And then, using these values, it is also intended to calculate the heat output of the fermenting wort, and to
 * use that value to determine whether the wort is in primary/active fermentation, secondary fermentation, or
 * fermentation not happening (i.e. fermentation not started, or fermentation complete).
 * 
 * 
 * This module contains both the code and configuration for the simulator.
 * 
*/

var simConfig = {
	freezer: {
    thermalMass: 1,   // in degrees F per second per delta (in degrees F), 1 is not at all right I'm sure
    minCoilTempF: 0,  // that's a very unverified assumption
    maxWatts: 200,    // maximum heat power removal rate (when load temp is loadTempF)
    loadTempF: 80,    // temperature of freezer contents at which maximum cooling rate (maxWatts) occurs
  },
  wort: {
    thermalMass: 1,   // again, 1 is certainly not right
    primaryWatts: 15, // heat power generated during active fermentation
    secondaryWatts: 1, // heat power generated during secondary fermentation
  }
  
};