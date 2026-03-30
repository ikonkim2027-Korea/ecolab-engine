import { EcosystemState, PesticideType } from '../types.js'
import {
  PEST_GROWTH_RATE, PEST_MONO_K, PEST_POLY_K_MIN,
  PREDATION_RATE, PESTICIDE_EFFICACY
} from '../constants.js'

/**
 * Pest population dynamics using logistic growth with predation.
 *
 * dP/dt = r × P × (1 - P/K) - predation
 *
 * Where:
 * - r = intrinsic growth rate
 * - K = carrying capacity (higher in monoculture)
 * - predation = beneficial_insects × predation_rate × pest_pop
 *
 * Source: Lotka (1925) Elements of Physical Biology
 * Source: Volterra (1926) — predator-prey dynamics
 * Source: Altieri (1999) — biodiversity and pest management
 */
export function pestGrowthRate(
  ecosystem: EcosystemState,
  dt: number
): number {
  const P = ecosystem.pestPopulation
  const K = pestCarryingCapacity(ecosystem.biodiversityScore)

  // Logistic growth
  const growth = PEST_GROWTH_RATE * P * (1 - P / K) * dt

  // Predation by beneficial insects
  const predation = ecosystem.beneficialInsects * PREDATION_RATE * P * dt

  const newPop = P + growth - predation
  return Math.max(0, Math.min(1, newPop))
}

/**
 * Carrying capacity depends on biodiversity.
 * Monocultures support higher pest populations.
 *
 * Source: Root (1973) — Resource Concentration Hypothesis
 * Source: Andow (1991) — vegetational diversity and arthropod communities
 */
export function pestCarryingCapacity(biodiversityScore: number): number {
  // High biodiversity → low K, low biodiversity → high K
  const K = PEST_MONO_K - (PEST_MONO_K - PEST_POLY_K_MIN) * biodiversityScore
  return Math.max(PEST_POLY_K_MIN, K)
}

/**
 * Beneficial insect population dynamics.
 * Population grows with biodiversity and in absence of pesticides.
 * Food availability (pest population) also matters — predators need prey.
 *
 * Source: van Lenteren (2012) — biological control
 */
export function updateBeneficialInsects(
  ecosystem: EcosystemState,
  dt: number
): number {
  const target = ecosystem.biodiversityScore * 0.8 + ecosystem.pestPopulation * 0.2
  const current = ecosystem.beneficialInsects
  // Slow convergence toward target
  const delta = (target - current) * 0.02 * dt
  return Math.max(0, Math.min(1, current + delta))
}

/**
 * Bee population — critical for pollination.
 * Depends on biodiversity (flowering plants), habitat, and pesticide absence.
 *
 * Source: Potts et al. (2010) — global pollinator declines
 */
export function updateBeePopulation(
  ecosystem: EcosystemState,
  dt: number
): number {
  const target = ecosystem.biodiversityScore * 0.9
  const current = ecosystem.beePopulation
  const delta = (target - current) * 0.01 * dt
  return Math.max(0, Math.min(1, current + delta))
}

/**
 * Apply pesticide — kills pests but also damages beneficial insects.
 *
 * Source: Pimentel (2005) Environmental and Economic Costs of Pesticides
 * Broad-spectrum: high efficacy, high collateral
 * Targeted (e.g., Bt): moderate efficacy, low collateral
 * Organic (e.g., neem): lower efficacy, minimal collateral
 */
export function applyPesticide(
  ecosystem: EcosystemState,
  type: PesticideType
): EcosystemState {
  const effects = PESTICIDE_EFFICACY[type]
  if (!effects) return ecosystem

  return {
    ...ecosystem,
    pestPopulation: Math.max(0, ecosystem.pestPopulation * (1 - effects.pestKill)),
    beneficialInsects: Math.max(0, ecosystem.beneficialInsects * (1 - effects.beneficialKill)),
    beePopulation: Math.max(0, ecosystem.beePopulation * (1 - effects.beneficialKill * 0.8)),
  }
}

/**
 * Pest damage to plant health.
 * Higher pest populations cause more damage.
 */
export function pestDamage(pestPopulation: number): number {
  // Damage scales quadratically — low populations do little harm
  return pestPopulation * pestPopulation * 0.3
}

/**
 * Update full ecosystem state for one tick.
 */
export function updateEcosystem(
  ecosystem: EcosystemState,
  dt: number
): EcosystemState {
  return {
    ...ecosystem,
    pestPopulation: pestGrowthRate(ecosystem, dt),
    beneficialInsects: updateBeneficialInsects(ecosystem, dt),
    beePopulation: updateBeePopulation(ecosystem, dt),
    weedCoverage: Math.min(1, ecosystem.weedCoverage + 0.001 * dt),
  }
}

/**
 * Simulate pest growth over multiple ticks for testing.
 */
export function simulatePestGrowth(
  config: { biodiversityScore: number },
  ticks: number
): EcosystemState {
  let ecosystem: EcosystemState = {
    pestPopulation: 0.1,
    beneficialInsects: config.biodiversityScore * 0.5,
    beePopulation: config.biodiversityScore * 0.5,
    biodiversityScore: config.biodiversityScore,
    weedCoverage: 0,
  }

  for (let i = 0; i < ticks; i++) {
    ecosystem = updateEcosystem(ecosystem, 1)
  }

  return ecosystem
}
