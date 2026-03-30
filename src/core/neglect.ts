import {
  FullSimulationState, Difficulty, NeglectReport, NeglectEvent
} from '../types.js'
import { NEGLECT_RATES } from '../constants.js'
import { getSpecies } from '../species/index.js'

/**
 * Simulate plant degradation during player absence.
 * Models realistic environmental effects over time.
 *
 * Source: General plant physiology — drought, pest, and weed dynamics
 */
export function simulateNeglect(
  state: FullSimulationState,
  offlineDurationHours: number,
  difficulty: Difficulty
): { state: FullSimulationState; report: NeglectReport } {
  const events: NeglectEvent[] = []
  const plantsLost: string[] = []
  const plantsRecoverable: string[] = []

  // Clone state to avoid mutation
  let plant = { ...state.plant, stressAccumulator: { ...state.plant.stressAccumulator } }
  let soil = { ...state.soil }
  let ecosystem = { ...state.ecosystem }
  const env = state.environment

  const species = getSpecies(plant.species)
  if (!species || !plant.isAlive) {
    return {
      state: { ...state, plant, soil, ecosystem, environment: env },
      report: { hoursOffline: offlineDurationHours, events, plantsLost, plantsRecoverable },
    }
  }

  // Difficulty modifiers
  const degradationMultiplier = difficulty === 'easy' ? 0.15 : difficulty === 'hard' ? 1.5 : 1.0

  // ── Moisture loss ──────────────────────────────────────────────
  const moistureLoss = NEGLECT_RATES.moistureLoss * offlineDurationHours * degradationMultiplier
  soil.moisture = Math.max(0, soil.moisture - moistureLoss)

  if (soil.moisture < species.waterProfile.permanentWiltPoint) {
    events.push({
      what: `Your ${plant.species} wilted`,
      why: `Soil moisture dropped to ${Math.round(soil.moisture * 100)}%, below the permanent wilt point of ${Math.round(species.waterProfile.permanentWiltPoint * 100)}%`,
      science: 'Plants absorb water through osmosis. When soil water potential drops below root water potential, the flow reverses and cells lose turgor pressure, causing wilting.',
      recovery: plant.health > 30
        ? 'Water immediately. If health is above 30%, the plant can recover in ~5 ticks.'
        : 'The plant may be too damaged to recover. Try watering, but prepare for possible loss.',
    })

    // Drought stress accumulation
    const droughtDamage = Math.min(1, moistureLoss * 2)
    plant.stressAccumulator.drought = Math.min(1, plant.stressAccumulator.drought + droughtDamage)
    plant.health = Math.max(0, plant.health - offlineDurationHours * 3 * degradationMultiplier)
    plant.waterContent = Math.max(0, plant.waterContent - moistureLoss * 0.8)
  }

  // ── Pest growth ────────────────────────────────────────────────
  const pestGrowth = NEGLECT_RATES.pestGrowth * offlineDurationHours * degradationMultiplier
  const oldPestPop = ecosystem.pestPopulation
  ecosystem.pestPopulation = Math.min(1, ecosystem.pestPopulation + pestGrowth * (1 - ecosystem.pestPopulation))

  if (ecosystem.pestPopulation > 0.5 && oldPestPop <= 0.5) {
    events.push({
      what: `Pest infestation on your ${plant.species}`,
      why: `Pest population grew from ${Math.round(oldPestPop * 100)}% to ${Math.round(ecosystem.pestPopulation * 100)}% of carrying capacity during ${offlineDurationHours} hours`,
      science: 'Pest populations follow logistic growth curves. Without management, they grow exponentially at first, then slow as they approach the environment\'s carrying capacity.',
      recovery: 'Apply targeted pesticide or introduce beneficial insects. Broad-spectrum pesticides work fastest but also harm beneficial insect populations.',
    })

    plant.stressAccumulator.pestDamage = Math.min(1, ecosystem.pestPopulation * 0.5)
    plant.health = Math.max(0, plant.health - ecosystem.pestPopulation * 10 * degradationMultiplier)
  }

  // ── Weed growth ────────────────────────────────────────────────
  ecosystem.weedCoverage = Math.min(1, ecosystem.weedCoverage +
    NEGLECT_RATES.weedGrowth * offlineDurationHours * degradationMultiplier)

  if (ecosystem.weedCoverage > 0.4) {
    events.push({
      what: `Weeds are competing with your ${plant.species}`,
      why: `Weed coverage reached ${Math.round(ecosystem.weedCoverage * 100)}% — they compete for light, water, and nutrients`,
      science: 'Weeds compete with crops through allelopathy (chemical inhibition), nutrient competition, and light interception. Some weeds grow faster than crops because they allocate more resources to vegetative growth.',
      recovery: 'Remove weeds manually. This will immediately reduce competition for resources.',
    })
  }

  // ── Temperature effects ────────────────────────────────────────
  // Soil temperature drifts toward air temp during absence
  soil.temperature = soil.temperature + (env.airTemperature - soil.temperature) * Math.min(1, offlineDurationHours * 0.1)

  // ── Update stress total ────────────────────────────────────────
  plant.stressAccumulator.total = Math.min(1,
    plant.stressAccumulator.drought +
    plant.stressAccumulator.heat +
    plant.stressAccumulator.cold +
    plant.stressAccumulator.pestDamage +
    plant.stressAccumulator.nitrogenDeficiency +
    plant.stressAccumulator.waterlog
  )

  // ── Check for plant death ──────────────────────────────────────
  if (plant.health <= 0) {
    plant.isAlive = false
    plant.health = 0
    plantsLost.push(plant.species)
    events.push({
      what: `Your ${plant.species} died`,
      why: 'Accumulated stress exceeded the plant\'s ability to survive',
      science: 'Plants can tolerate short periods of stress, but prolonged exposure to drought, pests, or extreme temperatures causes irreversible cellular damage.',
      recovery: 'This plant cannot be saved. Start a new planting and try to check in more regularly.',
    })
  } else if (plant.health < 40) {
    plantsRecoverable.push(plant.species)
  }

  return {
    state: { plant, soil, environment: env, ecosystem },
    report: {
      hoursOffline: offlineDurationHours,
      events,
      plantsLost,
      plantsRecoverable,
    },
  }
}
