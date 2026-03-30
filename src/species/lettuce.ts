import { PlantSpecies, GrowthStage } from '../types.js'

/**
 * TIER 1: Lettuce (Lactuca sativa) — Cool-season C3 crop
 *
 * Scientific basis:
 * - C3 photosynthesis pathway — responds to elevated CO₂
 * - Optimal temperature: 15–20°C (Source: FAO crop data, UC Davis Extension)
 * - Real growth duration: 45–80 days seed to harvest
 * - Game compression: ~30:1 → approximately 70–90 ticks
 * - pH preference: 6.0–7.0 (Source: Maynard & Hochmuth, Knott's Handbook)
 * - NPK ratio: moderate N, low P, moderate K
 * - Does NOT require pollination (harvested as leaf vegetable)
 * - Frost tolerant to -2°C (Source: Rubatzky & Yamaguchi, World Vegetables)
 * - Light: partial shade tolerant (lower Amax than fruiting crops)
 *
 * Source: Ryder (1999) Lettuce, Endive and Chicory
 * Source: USDA Plant Hardiness data
 */
export const lettuce: PlantSpecies = {
  name: 'lettuce',
  tier: 1,
  pathway: 'C3',

  stages: [
    { stage: GrowthStage.Seed, threshold: 5 },
    { stage: GrowthStage.Germination, threshold: 10 },
    { stage: GrowthStage.Seedling, threshold: 20 },
    { stage: GrowthStage.Vegetative, threshold: 40 },
    // Lettuce is harvested vegetative — no flowering/fruiting needed
    { stage: GrowthStage.HarvestReady, threshold: 0 },
  ],

  temperatureProfile: {
    Tmin: 4,           // °C — growth stops (Source: FAO)
    Topt: 18,          // °C — maximum growth (Source: Wurr et al., 1992)
    Tmax: 25,          // °C — growth stops (bolting occurs)
    TlethalLow: -5,    // °C — survives mild frost but dies at hard frost
    TlethalHigh: 38,   // °C — heat death
  },

  waterProfile: {
    fieldCapacity: 0.35,              // typical loam soil
    permanentWiltPoint: 0.12,         // lettuce has shallow roots, wilts earlier
    stomatalClosureThreshold: 0.20,   // closes stomata relatively early
    optimalMoisture: 0.28,            // prefers consistently moist soil
    transpirationRate: 0.03,          // moderate — small leaf area
  },

  nutrientDemand: {
    [GrowthStage.Seed]: { N: 0, P: 0, K: 0 },
    [GrowthStage.Germination]: { N: 0.2, P: 0.1, K: 0.1 },
    [GrowthStage.Seedling]: { N: 0.4, P: 0.2, K: 0.3 },
    [GrowthStage.Vegetative]: { N: 0.7, P: 0.3, K: 0.5 },
    [GrowthStage.Flowering]: { N: 0.5, P: 0.4, K: 0.4 },
    [GrowthStage.Fruiting]: { N: 0.3, P: 0.3, K: 0.3 },
    [GrowthStage.HarvestReady]: { N: 0.1, P: 0.1, K: 0.1 },
    [GrowthStage.Dead]: { N: 0, P: 0, K: 0 },
  },

  // C3 photosynthesis parameters
  quantumYield: 0.05,       // mol CO₂/mol photons — typical C3 quantum yield
  Amax: 18,                 // µmol CO₂ m⁻² s⁻¹ — lower than fruiting crops
  curvatureFactor: 0.8,     // moderate curvature
  co2Km: 300,               // ppm — C3 effective Km (includes photorespiration; Source: Farquhar 1980)

  // Nutrient uptake kinetics
  nutrientVmax: { N: 0.8, P: 0.4, K: 0.6 },
  nutrientKm: { N: 20, P: 15, K: 15 },

  // Growth parameters
  maxLeafArea: 0.3,         // m² — head lettuce
  maxRootDepth: 30,         // cm — shallow root system
  leafGrowthRate: 0.005,    // m²/tick
  rootGrowthRate: 0.4,      // cm/tick

  // Pollination — not needed for leaf harvest
  requiresPollination: false,
  selfPollinationRate: 0,
  vernalizationRequired: false,
  vernalizationTicks: 0,
  vernalizationTempMax: 0,

  // Toxicity thresholds (ppm)
  nutrientToxicityThreshold: { N: 200, P: 150, K: 200 },
}
