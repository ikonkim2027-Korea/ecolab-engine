import { PlantSpecies, GrowthStage } from '../types.js'

/**
 * TIER 3: Corn / Maize (Zea mays) — Warm-season C4 crop
 *
 * Scientific basis:
 * - C4 photosynthesis pathway — CO₂ concentrating mechanism (bundle sheath cells)
 *   Already CO₂-saturated at ambient 410 ppm, minimal response to elevated CO₂
 *   Source: von Caemmerer & Furbank (2003)
 * - Optimal temperature: 28–33°C (Source: FAO, Sánchez et al. 2014)
 *   Higher Topt than C3 crops because C4 pathway evolved in hot climates
 * - Real growth duration: 90–120 days seed to harvest
 * - Game compression: ~30:1 → approximately 130–180 ticks
 * - pH preference: 5.8–7.0 (Source: Iowa State Extension)
 * - NPK ratio: very high N demand (heavy feeder)
 * - Wind-pollinated — doesn't need bee pollinators
 * - Tropical origin, sensitive to cold: dies below 4°C
 * - High water demand — deep root system
 *
 * Source: Ritchie et al. (1993) How a Corn Plant Develops
 * Source: Leakey (2009) — C4 photosynthesis and FACE experiments
 */
export const corn: PlantSpecies = {
  name: 'corn',
  tier: 3,
  pathway: 'C4',

  stages: [
    { stage: GrowthStage.Seed, threshold: 10 },
    { stage: GrowthStage.Germination, threshold: 15 },
    { stage: GrowthStage.Seedling, threshold: 30 },
    { stage: GrowthStage.Vegetative, threshold: 60 },
    { stage: GrowthStage.Flowering, threshold: 30 },
    { stage: GrowthStage.Fruiting, threshold: 40 },
    { stage: GrowthStage.HarvestReady, threshold: 0 },
  ],

  temperatureProfile: {
    Tmin: 10,          // °C — growth stops (Source: FAO)
    Topt: 30,          // °C — maximum growth (higher than C3 crops)
    Tmax: 40,          // °C — growth stops
    TlethalLow: 4,     // °C — tropical origin, cold sensitive
    TlethalHigh: 45,   // °C — heat death
  },

  waterProfile: {
    fieldCapacity: 0.35,
    permanentWiltPoint: 0.15,
    stomatalClosureThreshold: 0.20,
    optimalMoisture: 0.28,
    transpirationRate: 0.05,          // high transpiration — large plant
  },

  nutrientDemand: {
    [GrowthStage.Seed]: { N: 0, P: 0, K: 0 },
    [GrowthStage.Germination]: { N: 0.3, P: 0.2, K: 0.15 },
    [GrowthStage.Seedling]: { N: 0.6, P: 0.3, K: 0.4 },
    [GrowthStage.Vegetative]: { N: 1.0, P: 0.5, K: 0.7 },   // heavy N feeder
    [GrowthStage.Flowering]: { N: 0.8, P: 0.6, K: 0.6 },
    [GrowthStage.Fruiting]: { N: 0.6, P: 0.5, K: 0.8 },
    [GrowthStage.HarvestReady]: { N: 0.2, P: 0.2, K: 0.3 },
    [GrowthStage.Dead]: { N: 0, P: 0, K: 0 },
  },

  // C4 photosynthesis parameters — key differences from C3:
  quantumYield: 0.065,      // mol CO₂/mol photons — C4 has higher quantum yield than C3
  Amax: 40,                 // µmol CO₂ m⁻² s⁻¹ — C4 advantage (Source: Leakey 2009)
  curvatureFactor: 0.7,     // sharper saturation curve
  co2Km: 30,                // ppm — C4 Km is MUCH lower than C3 (200)
                             // This means at 410ppm, corn is already at 410/(410+30) = 93% saturated
                             // vs tomato at 410/(410+200) = 67% saturated
                             // So doubling CO₂ barely helps corn but significantly helps tomato

  // Nutrient uptake kinetics — heavy feeder
  nutrientVmax: { N: 1.2, P: 0.7, K: 0.9 },
  nutrientKm: { N: 30, P: 25, K: 25 },

  // Growth parameters
  maxLeafArea: 1.0,         // m² — large leaves
  maxRootDepth: 100,        // cm — deep root system
  leafGrowthRate: 0.01,
  rootGrowthRate: 0.8,

  // Pollination — wind-pollinated (tassels release pollen to silks)
  requiresPollination: true,
  selfPollinationRate: 0.7,  // high self-poll rate via wind
  vernalizationRequired: false,
  vernalizationTicks: 0,
  vernalizationTempMax: 0,

  // Toxicity thresholds
  nutrientToxicityThreshold: { N: 300, P: 200, K: 300 },
}
