import { SoilState, PlantSpecies, GrowthStage, NutrientName, AmendmentType } from '../types.js'
import { AMENDMENT_EFFECTS } from '../constants.js'

/**
 * Michaelis-Menten enzyme kinetics for nutrient uptake.
 *
 * uptake_rate = Vmax × [S] / (Km + [S])
 *
 * Source: Epstein & Bloom (2005) Mineral Nutrition of Plants
 * Source: Barber (1995) Soil Nutrient Bioavailability
 */
export function michaelisMenten(
  concentration: number,
  Vmax: number,
  Km: number
): number {
  if (concentration <= 0 || Vmax <= 0) return 0
  return (Vmax * concentration) / (Km + concentration)
}

/**
 * pH-dependent nutrient availability multipliers.
 * Models the real soil chemistry where pH controls ion solubility.
 *
 * Source: Brady & Weil (2017) The Nature and Properties of Soils, 15th ed.
 * Source: Havlin et al. (2014) Soil Fertility and Fertilizers, 8th ed.
 * Source: Truog (1946) — classic nutrient availability vs pH diagram
 */
export function nutrientAvailability(nutrient: NutrientName, pH: number): number {
  switch (nutrient) {
    case 'nitrogen':
      // N available pH 6.0–8.0, drops sharply below 5.5
      // Nitrifying bacteria inactive below pH 5.0
      if (pH < 4.5) return 0.1
      if (pH < 5.5) return 0.1 + 0.6 * ((pH - 4.5) / 1.0)
      if (pH <= 8.0) return 0.7 + 0.3 * Math.min(1, (pH - 5.5) / 0.5)
      if (pH <= 9.0) return 1.0 - 0.3 * ((pH - 8.0) / 1.0)
      return 0.5

    case 'phosphorus':
      // P: peak availability pH 6.0–7.0
      // Locked by Al/Fe below pH 5.0, by Ca above pH 8.5
      if (pH < 4.0) return 0.05
      if (pH < 5.0) return 0.05 + 0.15 * ((pH - 4.0) / 1.0)
      if (pH < 6.0) return 0.2 + 0.7 * ((pH - 5.0) / 1.0)
      if (pH <= 7.0) return 0.9 + 0.1 * ((pH - 6.0) / 1.0)
      if (pH <= 7.5) return 1.0 - 0.1 * ((pH - 7.0) / 0.5)
      if (pH <= 8.5) return 0.9 - 0.6 * ((pH - 7.5) / 1.0)
      return 0.2

    case 'potassium':
      // K: available pH 6.0–8.0, slight reduction at extremes
      if (pH < 5.0) return 0.4
      if (pH < 6.0) return 0.4 + 0.5 * ((pH - 5.0) / 1.0)
      if (pH <= 8.0) return 0.9 + 0.1 * Math.min(1, (pH - 6.0) / 1.0)
      if (pH <= 9.0) return 1.0 - 0.2 * ((pH - 8.0) / 1.0)
      return 0.7

    case 'iron':
    case 'manganese':
    case 'zinc':
      // Micronutrients: MORE available at LOW pH, locked out above 7.5
      // Source: Lindsay (1979) Chemical Equilibria in Soils
      if (pH < 4.5) return 1.0
      if (pH < 6.0) return 1.0 - 0.2 * ((pH - 4.5) / 1.5)
      if (pH < 7.0) return 0.8 - 0.3 * ((pH - 6.0) / 1.0)
      if (pH < 7.5) return 0.5 - 0.3 * ((pH - 7.0) / 0.5)
      if (pH < 8.5) return 0.2 - 0.15 * ((pH - 7.5) / 1.0)
      return 0.05
  }
}

/**
 * Effective nutrient concentration after pH availability adjustment.
 */
export function effectiveNutrient(
  nutrient: NutrientName,
  soil: SoilState
): number {
  const concentration = nutrient === 'nitrogen' ? soil.nitrogen
    : nutrient === 'phosphorus' ? soil.phosphorus
    : nutrient === 'potassium' ? soil.potassium
    : 0 // micronutrients not tracked in soil state; availability only
  return concentration * nutrientAvailability(nutrient, soil.pH)
}

/**
 * Calculate nutrient uptake for a given nutrient.
 */
export function nutrientUptake(
  concentration: number,
  species: PlantSpecies,
  nutrient: 'N' | 'P' | 'K'
): number {
  return michaelisMenten(
    concentration,
    species.nutrientVmax[nutrient],
    species.nutrientKm[nutrient]
  )
}

/**
 * Liebig's Law of the Minimum — growth is limited by the scarcest resource.
 *
 * "The growth of a plant is dependent on the amount of foodstuff
 *  which is presented to it in minimum quantity."
 * — Justus von Liebig (1840)
 *
 * Returns 0–1 factor representing nutrient limitation.
 */
export function nutrientFactor(
  soilNPK: { nitrogen: number; phosphorus: number; potassium: number },
  species: PlantSpecies,
  stage: GrowthStage = GrowthStage.Vegetative,
  pH: number = 6.5
): number {
  const demand = species.nutrientDemand[stage]
  if (!demand) return 1.0

  // Apply pH availability
  const effectiveN = soilNPK.nitrogen * nutrientAvailability('nitrogen', pH)
  const effectiveP = soilNPK.phosphorus * nutrientAvailability('phosphorus', pH)
  const effectiveK = soilNPK.potassium * nutrientAvailability('potassium', pH)

  // Michaelis-Menten uptake for each nutrient
  const nUptake = michaelisMenten(effectiveN, species.nutrientVmax.N, species.nutrientKm.N)
  const pUptake = michaelisMenten(effectiveP, species.nutrientVmax.P, species.nutrientKm.P)
  const kUptake = michaelisMenten(effectiveK, species.nutrientVmax.K, species.nutrientKm.K)

  // Normalize to demand
  const nFactor = demand.N > 0 ? Math.min(1, nUptake / demand.N) : 1
  const pFactor = demand.P > 0 ? Math.min(1, pUptake / demand.P) : 1
  const kFactor = demand.K > 0 ? Math.min(1, kUptake / demand.K) : 1

  // Liebig's Law: minimum factor determines growth
  return Math.min(nFactor, pFactor, kFactor)
}

/**
 * Check for nutrient toxicity — excess nutrients cause osmotic stress.
 * Source: Marschner (2012) Mineral Nutrition of Higher Plants, 3rd ed.
 */
export function nutrientToxicity(
  soil: SoilState,
  species: PlantSpecies
): number {
  const thresholds = species.nutrientToxicityThreshold
  let toxicity = 0

  if (soil.nitrogen > thresholds.N) {
    toxicity += (soil.nitrogen - thresholds.N) / thresholds.N
  }
  if (soil.phosphorus > thresholds.P) {
    toxicity += (soil.phosphorus - thresholds.P) / thresholds.P
  }
  if (soil.potassium > thresholds.K) {
    toxicity += (soil.potassium - thresholds.K) / thresholds.K
  }

  return Math.min(1, toxicity)
}

/**
 * Apply a soil amendment (fertilizer, lime, sulfur, compost).
 * Models actual chemical reactions:
 * - NH₄NO₃: provides N, slightly acidifies (nitrification produces H⁺)
 * - Ca₃(PO₄)₂ (bone meal): provides P, slight pH increase
 * - KCl (potash): provides K, pH neutral
 * - CaCO₃ (lime): neutralization reaction raises pH
 * - S → H₂SO₄ (bacterial oxidation): lowers pH
 * - Compost: slow-release NPK, builds OM and microbes
 *
 * Source: Havlin et al. (2014) Soil Fertility and Fertilizers
 */
export function applyAmendment(
  soil: SoilState,
  amendment: AmendmentType,
  amount: number
): SoilState {
  const effects = AMENDMENT_EFFECTS[amendment]
  if (!effects) return soil

  const factor = amount / 50 // normalize to a "standard dose" of 50 units

  return {
    ...soil,
    nitrogen: Math.max(0, soil.nitrogen + effects.N * amount),
    phosphorus: Math.max(0, soil.phosphorus + effects.P * amount),
    potassium: Math.max(0, soil.potassium + effects.K * amount),
    pH: clampPH(soil.pH + effects.pHChange * factor),
    organicMatter: Math.min(10, Math.max(0, soil.organicMatter + effects.organicMatter * factor)),
    microbeHealth: Math.min(1, Math.max(0, soil.microbeHealth + effects.microbeHealth * factor)),
  }
}

function clampPH(pH: number): number {
  return Math.min(9, Math.max(4, pH))
}

/**
 * Consume nutrients from soil based on plant uptake.
 */
export function consumeNutrients(
  soil: SoilState,
  species: PlantSpecies,
  stage: GrowthStage,
  dt: number
): SoilState {
  // Stage-specific nutrient demand modifies consumption rate
  const demand = species.nutrientDemand[stage]
  const demandFactor = demand ? Math.max(0.2, (demand.N + demand.P + demand.K) / 3) : 0.5
  const effectiveN = effectiveNutrient('nitrogen', soil)
  const effectiveP = effectiveNutrient('phosphorus', soil)
  const effectiveK = effectiveNutrient('potassium', soil)

  const nUptake = michaelisMenten(effectiveN, species.nutrientVmax.N, species.nutrientKm.N) * dt
  const pUptake = michaelisMenten(effectiveP, species.nutrientVmax.P, species.nutrientKm.P) * dt
  const kUptake = michaelisMenten(effectiveK, species.nutrientVmax.K, species.nutrientKm.K) * dt

  return {
    ...soil,
    nitrogen: Math.max(0, soil.nitrogen - nUptake * 0.1 * demandFactor),
    phosphorus: Math.max(0, soil.phosphorus - pUptake * 0.1 * demandFactor),
    potassium: Math.max(0, soil.potassium - kUptake * 0.1 * demandFactor),
  }
}
