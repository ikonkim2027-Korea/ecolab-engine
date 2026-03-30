import {
  SoilState, EnvironmentState, Experiment, DataPoint
} from '../types.js'
import { tick, createPlant, createOptimalSoil, createOptimalEnvironment, createDefaultEcosystem } from '../core/growth.js'
import { getSpecies } from '../species/index.js'

/**
 * Experiment mode: control vs experimental group.
 * Both groups run through identical ticks except the one changed variable.
 * Data is logged per-tick for graphing.
 */

/**
 * Deep clone a state object for creating independent control/experimental groups.
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/**
 * Create a new experiment with identical initial conditions.
 */
export function createExperiment(
  speciesName: string,
  hypothesis: string,
  changedVariable: string,
  controlEnvOverrides?: Partial<EnvironmentState>,
  experimentalEnvOverrides?: Partial<EnvironmentState>,
  controlSoilOverrides?: Partial<SoilState>,
  experimentalSoilOverrides?: Partial<SoilState>
): Experiment {
  const basePlant = createPlant(speciesName)
  const baseSoil = createOptimalSoil(speciesName)
  const baseEnv = createOptimalEnvironment(speciesName)

  return {
    hypothesis,
    changedVariable,
    controlGroup: {
      plant: deepClone(basePlant),
      soil: { ...deepClone(baseSoil), ...controlSoilOverrides },
      env: { ...deepClone(baseEnv), ...controlEnvOverrides },
    },
    experimentalGroup: {
      plant: deepClone(basePlant),
      soil: { ...deepClone(baseSoil), ...experimentalSoilOverrides },
      env: { ...deepClone(baseEnv), ...experimentalEnvOverrides },
    },
    dataLog: [],
  }
}

/**
 * Run one tick of the experiment, updating both groups identically
 * except for the changed variable.
 */
export function tickExperiment(experiment: Experiment): Experiment {
  const species = getSpecies(experiment.controlGroup.plant.species)
  if (!species) return experiment

  const controlResult = tick(
    experiment.controlGroup.plant,
    experiment.controlGroup.soil,
    experiment.controlGroup.env,
    1,
    undefined,
    species
  )

  const experimentResult = tick(
    experiment.experimentalGroup.plant,
    experiment.experimentalGroup.soil,
    experiment.experimentalGroup.env,
    1,
    undefined,
    species
  )

  const tickNum = experiment.dataLog.length

  const dataPoint: DataPoint = {
    tick: tickNum,
    controlValue: controlResult.plant.totalGrowthPoints,
    experimentValue: experimentResult.plant.totalGrowthPoints,
  }

  return {
    ...experiment,
    controlGroup: {
      ...experiment.controlGroup,
      plant: controlResult.plant,
      soil: controlResult.soil,
    },
    experimentalGroup: {
      ...experiment.experimentalGroup,
      plant: experimentResult.plant,
      soil: experimentResult.soil,
    },
    dataLog: [...experiment.dataLog, dataPoint],
  }
}

/**
 * Run a full experiment for N ticks.
 */
export function runExperiment(experiment: Experiment, ticks: number): Experiment {
  let exp = experiment
  for (let i = 0; i < ticks; i++) {
    exp = tickExperiment(exp)
  }
  return exp
}

/**
 * Export data log for graphing.
 */
export function exportData(experiment: Experiment): DataPoint[] {
  return experiment.dataLog
}

/**
 * Helper: simulate yield for a species under given conditions.
 * Runs to harvest or max ticks, returns total growth points as yield proxy.
 */
export function simulateYield(
  speciesName: string,
  envOverrides?: Partial<EnvironmentState>,
  soilOverrides?: Partial<SoilState>,
  maxTicks: number = 300
): number {
  let plant = createPlant(speciesName)
  let soil = { ...createOptimalSoil(speciesName), ...soilOverrides }
  const env = { ...createOptimalEnvironment(speciesName), ...envOverrides }
  const species = getSpecies(speciesName)!
  const ecosystem = createDefaultEcosystem()

  for (let i = 0; i < maxTicks; i++) {
    // Maintain soil at reasonable levels for yield measurement
    soil.moisture = Math.max(soil.moisture, species.waterProfile.optimalMoisture * 0.9)
    soil.nitrogen = Math.max(soil.nitrogen, 40)
    soil.phosphorus = Math.max(soil.phosphorus, 30)
    soil.potassium = Math.max(soil.potassium, 35)

    const result = tick(plant, soil, env, 1, ecosystem, species)
    plant = result.plant
    soil = result.soil
    if (!plant.isAlive) break
  }

  return plant.totalGrowthPoints
}
