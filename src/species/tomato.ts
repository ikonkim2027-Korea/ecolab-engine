import { PlantSpecies, GrowthStage } from '../types.js'

/**
 * TIER 2: Tomato (Solanum lycopersicum) — Warm-season C3 crop
 *
 * Scientific basis:
 * - C3 photosynthesis pathway — strongly responds to elevated CO₂
 * - Optimal temperature: 22–28°C (Source: FAO, Peet et al. 1998)
 * - Pollen non-viable above 35°C (Source: Sato et al., 2006)
 * - Real growth duration: 60–100 days transplant to first harvest
 * - Game compression: ~30:1 → approximately 100–150 ticks
 * - pH preference: 6.0–6.8 (Source: Hochmuth, UF/IFAS Extension)
 * - NPK ratio: high N vegetative, high P/K fruiting
 * - REQUIRES pollination for fruit set (buzz pollination by bumblebees)
 * - Frost-sensitive: dies below 2°C (Source: Lyons, 1973 — chilling injury)
 * - Indeterminate type modeled (continues producing)
 *
 * Source: Heuvelink (2005) Tomatoes
 * Source: Jones (2007) Tomato Plant Culture
 */
export const tomato: PlantSpecies = {
  name: 'tomato',
  tier: 2,
  pathway: 'C3',

  stages: [
    { stage: GrowthStage.Seed, threshold: 8 },
    { stage: GrowthStage.Germination, threshold: 12 },
    { stage: GrowthStage.Seedling, threshold: 25 },
    { stage: GrowthStage.Vegetative, threshold: 45 },
    { stage: GrowthStage.Flowering, threshold: 25 },
    { stage: GrowthStage.Fruiting, threshold: 35 },
    { stage: GrowthStage.HarvestReady, threshold: 0 },
  ],

  temperatureProfile: {
    Tmin: 10,          // °C — growth stops (Source: FAO)
    Topt: 25,          // °C — maximum growth
    Tmax: 35,          // °C — growth stops
    TlethalLow: 2,     // °C — chilling injury threshold
    TlethalHigh: 42,   // °C — heat death
  },

  waterProfile: {
    fieldCapacity: 0.35,
    permanentWiltPoint: 0.15,
    stomatalClosureThreshold: 0.22,
    optimalMoisture: 0.30,
    transpirationRate: 0.04,          // moderate-high transpiration
  },

  nutrientDemand: {
    [GrowthStage.Seed]: { N: 0, P: 0, K: 0 },
    [GrowthStage.Germination]: { N: 0.2, P: 0.15, K: 0.1 },
    [GrowthStage.Seedling]: { N: 0.5, P: 0.3, K: 0.3 },
    [GrowthStage.Vegetative]: { N: 0.8, P: 0.4, K: 0.5 },
    [GrowthStage.Flowering]: { N: 0.6, P: 0.6, K: 0.6 },
    [GrowthStage.Fruiting]: { N: 0.5, P: 0.5, K: 0.8 },  // K critical for fruit quality
    [GrowthStage.HarvestReady]: { N: 0.2, P: 0.2, K: 0.3 },
    [GrowthStage.Dead]: { N: 0, P: 0, K: 0 },
  },

  // C3 photosynthesis parameters
  quantumYield: 0.05,       // mol CO₂/mol photons — typical C3
  Amax: 25,                 // µmol CO₂ m⁻² s⁻¹ — typical C3 crop (Source: Taiz & Zeiger)
  curvatureFactor: 0.8,
  co2Km: 300,               // ppm — C3 effective Km (includes photorespiration; Source: Farquhar 1980)

  // Nutrient uptake kinetics
  nutrientVmax: { N: 1.0, P: 0.6, K: 0.8 },
  nutrientKm: { N: 25, P: 20, K: 20 },

  // Growth parameters
  maxLeafArea: 0.8,         // m² — large canopy
  maxRootDepth: 60,         // cm — moderate root depth
  leafGrowthRate: 0.008,
  rootGrowthRate: 0.6,

  // Pollination — requires buzz pollination
  requiresPollination: true,
  selfPollinationRate: 0.3,  // some self-pollination via wind vibration
  vernalizationRequired: false,
  vernalizationTicks: 0,
  vernalizationTempMax: 0,

  // Toxicity thresholds
  nutrientToxicityThreshold: { N: 250, P: 200, K: 250 },
}
