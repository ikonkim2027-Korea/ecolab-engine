import { PlantSpecies, GrowthStage } from '../types.js'

/**
 * TIER 4: Grape (Vitis vinifera) — Perennial C3 vine
 *
 * Scientific basis:
 * - C3 photosynthesis — responds to CO₂ enrichment
 * - Optimal temperature: 20–30°C (Source: Mullins et al., Biology of the Grapevine)
 * - Real growth duration: 150–180 days bud break to harvest (first season)
 *   Perennial: real vines take 3+ years to first fruit
 * - Game compression: ~30:1 → approximately 180–250 ticks
 * - pH preference: 5.5–6.5 (slightly acidic) (Source: Winkler et al., 1974)
 * - REQUIRES vernalization (cold dormancy period) to break bud
 *   Source: Dokoozlian (1999) — chilling requirements
 * - Highly sensitive to management — premium quality requires precision
 * - Requires bee pollination for fruit set (though some self-fertile)
 * - Frost-sensitive during active growth, but dormant vines survive winter
 * - Deep root system (several meters in real life)
 *
 * Source: Mullins, Bouquet & Williams (1992) Biology of the Grapevine
 * Source: Keller (2010) The Science of Grapevines
 */
export const grape: PlantSpecies = {
  name: 'grape',
  tier: 4,
  pathway: 'C3',

  stages: [
    { stage: GrowthStage.Seed, threshold: 15 },
    { stage: GrowthStage.Germination, threshold: 20 },
    { stage: GrowthStage.Seedling, threshold: 40 },
    { stage: GrowthStage.Vegetative, threshold: 80 },
    { stage: GrowthStage.Flowering, threshold: 35 },
    { stage: GrowthStage.Fruiting, threshold: 60 },
    { stage: GrowthStage.HarvestReady, threshold: 0 },
  ],

  temperatureProfile: {
    Tmin: 8,           // °C — growth stops
    Topt: 25,          // °C — maximum growth
    Tmax: 35,          // °C — growth stops (heat stress)
    TlethalLow: -3,    // °C — active growth frost kill
    TlethalHigh: 42,   // °C — heat death
  },

  waterProfile: {
    fieldCapacity: 0.35,
    permanentWiltPoint: 0.12,
    stomatalClosureThreshold: 0.18,
    optimalMoisture: 0.25,            // grapes prefer slightly drier conditions
    transpirationRate: 0.045,         // moderate-high — large canopy
  },

  nutrientDemand: {
    [GrowthStage.Seed]: { N: 0, P: 0, K: 0 },
    [GrowthStage.Germination]: { N: 0.3, P: 0.2, K: 0.2 },
    [GrowthStage.Seedling]: { N: 0.5, P: 0.3, K: 0.4 },
    [GrowthStage.Vegetative]: { N: 0.7, P: 0.4, K: 0.6 },
    [GrowthStage.Flowering]: { N: 0.5, P: 0.5, K: 0.7 },
    [GrowthStage.Fruiting]: { N: 0.4, P: 0.4, K: 0.9 },    // K very important for grape quality
    [GrowthStage.HarvestReady]: { N: 0.2, P: 0.2, K: 0.3 },
    [GrowthStage.Dead]: { N: 0, P: 0, K: 0 },
  },

  // C3 photosynthesis parameters
  quantumYield: 0.05,       // mol CO₂/mol photons
  Amax: 20,                 // µmol CO₂ m⁻² s⁻¹ — moderate C3 vine
  curvatureFactor: 0.85,
  co2Km: 300,               // ppm — C3 effective Km (includes photorespiration; Source: Farquhar 1980)

  // Nutrient uptake kinetics
  nutrientVmax: { N: 0.9, P: 0.5, K: 0.8 },
  nutrientKm: { N: 22, P: 18, K: 18 },

  // Growth parameters
  maxLeafArea: 1.2,         // m² — large canopy
  maxRootDepth: 120,        // cm — very deep roots (real: several meters)
  leafGrowthRate: 0.007,
  rootGrowthRate: 0.5,

  // Pollination
  requiresPollination: true,
  selfPollinationRate: 0.4,  // some self-fertile cultivars
  vernalizationRequired: true,
  vernalizationTicks: 15,    // needs 15 ticks of cold exposure
  vernalizationTempMax: 10,  // temps below 10°C count

  // Toxicity thresholds
  nutrientToxicityThreshold: { N: 200, P: 150, K: 250 },
}
