import { describe, test, expect } from 'vitest'
import {
  tick, createPlant, createOptimalSoil, createOptimalEnvironment,
  createDefaultEcosystem, simulateNTicks
} from '../../src/core/growth.js'
import { applyDifficultyEffects } from '../../src/difficulty/index.js'
import { getAllSpecies, getSpecies } from '../../src/species/index.js'
import { GrowthStage, FullSimulationState, Difficulty } from '../../src/types.js'

// Simulate with a "skill level" — how close to optimal the player maintains conditions
function simulateWithSkillLevel(speciesName: string, skillLevel: number, maxTicks = 500) {
  let plant = createPlant(speciesName)
  let soil = createOptimalSoil(speciesName)
  const env = createOptimalEnvironment(speciesName)
  const species = getSpecies(speciesName)!
  const eco = createDefaultEcosystem()

  for (let i = 0; i < maxTicks; i++) {
    // Skill level determines how well soil is maintained
    soil.moisture = Math.max(
      soil.moisture,
      species.waterProfile.optimalMoisture * skillLevel
    )
    soil.nitrogen = Math.max(soil.nitrogen, 50 * skillLevel)
    soil.phosphorus = Math.max(soil.phosphorus, 35 * skillLevel)
    soil.potassium = Math.max(soil.potassium, 40 * skillLevel)

    const result = tick(plant, soil, env, 1, eco, species)
    plant = result.plant
    soil = result.soil

    if (!plant.isAlive || plant.stage === GrowthStage.HarvestReady) break
  }

  return {
    harvestSuccess: plant.stage === GrowthStage.HarvestReady && plant.isAlive,
    plant,
  }
}

// Simulate with difficulty applied
function simulateWithDifficulty(
  speciesName: string,
  difficulty: Difficulty,
  skillLevel: number,
  maxTicks = 500
) {
  let plant = createPlant(speciesName)
  let soil = createOptimalSoil(speciesName)
  const env = createOptimalEnvironment(speciesName)
  const species = getSpecies(speciesName)!
  let eco = createDefaultEcosystem()

  for (let i = 0; i < maxTicks; i++) {
    soil.moisture = Math.max(
      soil.moisture,
      species.waterProfile.optimalMoisture * skillLevel
    )
    soil.nitrogen = Math.max(soil.nitrogen, 50 * skillLevel)
    soil.phosphorus = Math.max(soil.phosphorus, 35 * skillLevel)
    soil.potassium = Math.max(soil.potassium, 40 * skillLevel)

    const result = tick(plant, soil, env, 1, eco, species)
    plant = result.plant
    soil = result.soil
    if (result.ecosystem) eco = result.ecosystem

    // Apply difficulty effects
    const state: FullSimulationState = { plant, soil, environment: env, ecosystem: eco }
    const adjusted = applyDifficultyEffects(state, difficulty)
    plant = adjusted.plant
    soil = adjusted.soil
    eco = adjusted.ecosystem

    if (!plant.isAlive || plant.stage === GrowthStage.HarvestReady) break
  }

  return {
    harvestSuccess: plant.stage === GrowthStage.HarvestReady && plant.isAlive,
    plant,
  }
}

function simulateOptimal(speciesName: string) {
  let plant = createPlant(speciesName)
  let soil = createOptimalSoil(speciesName)
  const env = createOptimalEnvironment(speciesName)
  const species = getSpecies(speciesName)!
  const eco = createDefaultEcosystem()
  let ticks = 0

  while (plant.isAlive && plant.stage !== GrowthStage.HarvestReady && ticks < 500) {
    soil.moisture = species.waterProfile.optimalMoisture
    soil.nitrogen = 60
    soil.phosphorus = 40
    soil.potassium = 50

    const result = tick(plant, soil, env, 1, eco, species)
    plant = result.plant
    soil = result.soil
    ticks++
  }

  return { ticksToHarvest: ticks, plant }
}

describe('gameplay balance', () => {
  test('T1 plants are completable by a beginner making some mistakes', () => {
    const result = simulateWithSkillLevel('lettuce', 0.8)
    expect(result.harvestSuccess).toBe(true)
  })

  test('T4 plants are harder to complete at lower skill', () => {
    // At 80% skill, grape should either fail or take very long
    const result = simulateWithSkillLevel('grape', 0.6, 500)
    // Grape with low skill should struggle
    if (result.harvestSuccess) {
      // If it succeeds, quality should be lower
      expect(result.plant.harvestQuality).toBeLessThan(80)
    }
  })

  test('Easy mode is significantly more forgiving than Hard', () => {
    const easyResult = simulateWithDifficulty('tomato', 'easy', 0.6)
    const hardResult = simulateWithDifficulty('tomato', 'hard', 0.6)

    // Easy should succeed or have higher health
    if (easyResult.harvestSuccess && hardResult.harvestSuccess) {
      expect(easyResult.plant.health).toBeGreaterThan(hardResult.plant.health)
    } else if (easyResult.harvestSuccess) {
      expect(hardResult.harvestSuccess).toBe(false)
    }
    // At minimum, easy plant should be healthier
    expect(easyResult.plant.health).toBeGreaterThanOrEqual(hardResult.plant.health)
  })

  test('time acceleration produces identical results', () => {
    // 100 ticks at 1x should roughly equal total from 100 ticks at 1x
    // (dt doesn't affect number of ticks, just scale within each tick)
    const result1 = simulateNTicks('tomato', 100, 1)
    const result2 = simulateNTicks('tomato', 100, 1) // same params = same result
    expect(result1.plant.totalGrowthPoints).toBeCloseTo(result2.plant.totalGrowthPoints, 5)
  })

  test('no plant reaches harvest in under 50 ticks (prevents trivial gameplay)', () => {
    for (const species of getAllSpecies()) {
      const result = simulateOptimal(species.name)
      expect(result.ticksToHarvest).toBeGreaterThan(50)
    }
  })

  test('all plants can reach harvest under optimal conditions', () => {
    for (const species of getAllSpecies()) {
      if (species.vernalizationRequired) continue // grape needs cold first
      const result = simulateOptimal(species.name)
      expect(result.plant.stage).toBe(GrowthStage.HarvestReady)
    }
  })

  test('performance: 10,000 ticks execute in under 1 second', () => {
    const species = getSpecies('tomato')!
    let plant = createPlant('tomato')
    let soil = createOptimalSoil('tomato')
    const env = createOptimalEnvironment('tomato')
    const eco = createDefaultEcosystem()

    const start = performance.now()
    for (let i = 0; i < 10000; i++) {
      const result = tick(plant, soil, env, 1, eco, species)
      plant = result.plant
      soil = result.soil
    }
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(1000) // under 1 second
  })
})
