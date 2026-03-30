import { FullSimulationState, Difficulty } from '../types.js'

/**
 * Difficulty is a FILTER/WRAPPER — not baked into the engine.
 * The core engine ALWAYS runs the full simulation.
 * Difficulty controls:
 * 1. Which variables are VISIBLE to the player
 * 2. Which variables AUTO-CORRECT toward optimal (Easy only)
 * 3. Which systems the player must MANUALLY manage
 *
 * CRITICAL: tick() output is IDENTICAL regardless of difficulty
 * when given the same inputs. Difficulty only affects what the
 * player sees and what gets auto-adjusted between ticks.
 */

export interface VisibleState {
  // Always visible
  plantStage: string
  plantHealth: number
  isAlive: boolean
  harvestQuality: number

  // Visible on Normal+
  soilMoisture?: number
  soilpH?: number

  // Visible on Hard only
  soilNPK?: { N: number; P: number; K: number }
  stressDetails?: Record<string, number>
  pestPopulation?: number
  beneficialInsects?: number
  leafArea?: number
  rootDepth?: number
}

/**
 * Filter raw simulation state based on difficulty.
 * Determines what information the player can see.
 */
export function applyDifficulty(
  rawState: FullSimulationState,
  difficulty: Difficulty
): VisibleState {
  const base: VisibleState = {
    plantStage: rawState.plant.stage,
    plantHealth: Math.round(rawState.plant.health),
    isAlive: rawState.plant.isAlive,
    harvestQuality: Math.round(rawState.plant.harvestQuality),
  }

  if (difficulty === 'normal' || difficulty === 'hard') {
    base.soilMoisture = Math.round(rawState.soil.moisture * 100) / 100
    base.soilpH = Math.round(rawState.soil.pH * 10) / 10
  }

  if (difficulty === 'hard') {
    base.soilNPK = {
      N: Math.round(rawState.soil.nitrogen),
      P: Math.round(rawState.soil.phosphorus),
      K: Math.round(rawState.soil.potassium),
    }
    base.stressDetails = {
      drought: rawState.plant.stressAccumulator.drought,
      heat: rawState.plant.stressAccumulator.heat,
      cold: rawState.plant.stressAccumulator.cold,
      nutrientToxicity: rawState.plant.stressAccumulator.nutrientToxicity,
      pestDamage: rawState.plant.stressAccumulator.pestDamage,
    }
    base.pestPopulation = rawState.ecosystem.pestPopulation
    base.beneficialInsects = rawState.ecosystem.beneficialInsects
    base.leafArea = rawState.plant.leafArea
    base.rootDepth = rawState.plant.rootDepth
  }

  return base
}

/**
 * Apply Easy mode auto-corrections after each tick.
 * These adjustments drift conditions toward optimal,
 * making the game more forgiving for beginners.
 */
export function applyEasyCorrections(state: FullSimulationState): FullSimulationState {
  const soil = { ...state.soil }
  const plant = { ...state.plant, stressAccumulator: { ...state.plant.stressAccumulator } }
  const ecosystem = { ...state.ecosystem }

  // pH drifts toward 6.5 at rate 0.01/tick
  soil.pH += (6.5 - soil.pH) * 0.01

  // NPK replenishes slowly (simulating "magic soil")
  soil.nitrogen = Math.min(80, soil.nitrogen + 0.2)
  soil.phosphorus = Math.min(50, soil.phosphorus + 0.1)
  soil.potassium = Math.min(60, soil.potassium + 0.15)

  // Pest population capped at harmless levels
  ecosystem.pestPopulation = Math.min(0.15, ecosystem.pestPopulation)

  // Temperature stress reduced by 50%
  plant.stressAccumulator.heat *= 0.5
  plant.stressAccumulator.cold *= 0.5

  // Moisture slowly recovers toward optimal
  soil.moisture += (0.28 - soil.moisture) * 0.02

  // Recalculate total stress (match weights in growth.ts)
  const s = plant.stressAccumulator
  s.total = Math.min(1,
    s.drought * 0.20 + s.heat * 0.15 + s.cold * 0.15 +
    s.waterlog * 0.15 + s.nitrogenDeficiency * 0.10 +
    s.phosphorusDeficiency * 0.08 + s.potassiumDeficiency * 0.07 +
    s.nutrientToxicity * 0.20 + s.pestDamage * 0.10
  )

  return { ...state, soil, plant, ecosystem }
}

/**
 * Apply Hard mode effects — additional challenges.
 */
export function applyHardEffects(state: FullSimulationState): FullSimulationState {
  const ecosystem = { ...state.ecosystem }

  // Pests grow faster on Hard
  ecosystem.pestPopulation = Math.min(1, ecosystem.pestPopulation * 1.02)

  // Weeds grow faster
  ecosystem.weedCoverage = Math.min(1, ecosystem.weedCoverage + 0.002)

  return { ...state, ecosystem }
}

/**
 * Full difficulty pipeline: tick → difficulty adjustments.
 */
export function applyDifficultyEffects(
  state: FullSimulationState,
  difficulty: Difficulty
): FullSimulationState {
  switch (difficulty) {
    case 'easy':
      return applyEasyCorrections(state)
    case 'hard':
      return applyHardEffects(state)
    case 'normal':
    default:
      return state
  }
}
