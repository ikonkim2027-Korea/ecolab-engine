// ── Universal Scientific Constants ──────────────────────────────────
// All values cited from established agricultural science literature

/** Ambient CO₂ concentration (ppm) — pre-industrial ~280, current ~410-420
 *  Source: NOAA Global Monitoring Laboratory, 2024 */
export const AMBIENT_CO2 = 410

/** Maximum stress accumulator value before plant death */
export const MAX_STRESS = 5.0

/** Health recovery rate per tick when stress factors are removed
 *  Plants can recover ~1% health per tick under optimal conditions */
export const HEALTH_RECOVERY_RATE = 1.0

/** Health decay rate multiplier per unit of stress
 *  At stress=0.5, plant loses 2.5 health/tick → dead in ~40 ticks */
export const HEALTH_DECAY_RATE = 5.0

/** Minimum health before plant dies */
export const LETHAL_HEALTH = 0

/** Evaporation coefficient — base rate of soil moisture loss
 *  Modified by humidity, temperature, and wind
 *  Source: FAO Penman-Monteith simplified model */
export const EVAPORATION_BASE_RATE = 0.008

/** Wind effect on evaporation — higher wind = more evaporation
 *  Source: FAO Irrigation and Drainage Paper 56 */
export const WIND_EVAPORATION_FACTOR = 0.005

/** Runoff threshold — fraction above field capacity that runs off per tick */
export const RUNOFF_RATE = 0.3

/** Soil temperature lag coefficient — how fast soil temp approaches air temp
 *  Real soil at 10cm depth lags air temp by hours
 *  Source: Campbell & Norman, Environmental Biophysics */
export const SOIL_TEMP_LAG = 0.05

/** Organic matter decomposition rate per tick
 *  Controlled by microbe health and temperature */
export const ORGANIC_DECOMPOSITION_RATE = 0.001

/** NPK release from organic matter decomposition (ppm per % OM decomposed)
 *  Source: Brady & Weil, The Nature and Properties of Soils */
export const ORGANIC_NPK_RELEASE = { N: 0.5, P: 0.1, K: 0.3 }

/** Maximum light intensity in µmol photons m⁻² s⁻¹ (PAR)
 *  Full sunlight ≈ 2000 µmol/m²/s PAR
 *  Source: Taiz & Zeiger, Plant Physiology */
export const MAX_PAR = 2000

/** Waterlog damage threshold — moisture above this causes anaerobic root damage
 *  Source: Kozlowski, Flooding and Plant Growth */
export const WATERLOG_THRESHOLD = 0.95

/** Waterlog damage rate per tick when soil is saturated
 *  Anaerobic conditions damage roots rapidly */
export const WATERLOG_DAMAGE_RATE = 0.08

/** Nitrogen toxicity causes osmotic stress — burn rate per tick
 *  Source: Marschner, Mineral Nutrition of Higher Plants */
export const TOXICITY_DAMAGE_RATE = 0.03

/** Pest population growth rate (logistic r parameter)
 *  Source: Simplified Lotka-Volterra dynamics */
export const PEST_GROWTH_RATE = 0.05

/** Pest carrying capacity multiplier for monoculture vs polyculture
 *  Source: Altieri, Biodiversity and Pest Management */
export const PEST_MONO_K = 1.0
export const PEST_POLY_K_MIN = 0.3

/** Predation rate — beneficial insects consume pests
 *  Scaled so predation doesn't overwhelm growth at low pest populations
 *  Source: van Lenteren, Biological Control */
export const PREDATION_RATE = 0.03

/** Pesticide efficacy and collateral damage rates */
export const PESTICIDE_EFFICACY: Record<string, { pestKill: number; beneficialKill: number }> = {
  broad_spectrum: { pestKill: 0.85, beneficialKill: 0.70 },
  targeted: { pestKill: 0.60, beneficialKill: 0.15 },
  organic: { pestKill: 0.40, beneficialKill: 0.05 },
}

/** Neglect degradation rates (per real-world hour of absence) */
export const NEGLECT_RATES = {
  moistureLoss: 0.05,     // -5%/hr
  pestGrowth: 0.08,       // +8%/hr (logistic)
  weedGrowth: 0.03,       // +3%/hr
}

/** Fertilizer amendment effects
 *  Source: Havlin et al., Soil Fertility and Fertilizers */
export const AMENDMENT_EFFECTS: Record<string, {
  N: number; P: number; K: number;
  pHChange: number; organicMatter: number; microbeHealth: number;
}> = {
  ammonium_nitrate: { N: 3.0, P: 0, K: 0, pHChange: -0.15, organicMatter: 0, microbeHealth: 0 },
  bone_meal: { N: 0, P: 2.5, K: 0, pHChange: 0.1, organicMatter: 0.05, microbeHealth: 0 },
  potash: { N: 0, P: 0, K: 2.5, pHChange: 0, organicMatter: 0, microbeHealth: 0 },
  lime: { N: 0, P: 0, K: 0, pHChange: 0.7, organicMatter: 0, microbeHealth: 0.02 },
  sulfur: { N: 0, P: 0, K: 0, pHChange: -0.4, organicMatter: 0, microbeHealth: -0.02 },
  compost: { N: 0.5, P: 0.3, K: 0.4, pHChange: 0.05, organicMatter: 0.5, microbeHealth: 0.1 },
}
