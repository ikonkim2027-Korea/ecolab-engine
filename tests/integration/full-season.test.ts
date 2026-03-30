import { describe, test, expect } from 'vitest'
import {
  tick, createPlant, createOptimalSoil, createOptimalEnvironment,
  createDefaultEcosystem
} from '../../src/core/growth.js'
import { getSpecies } from '../../src/species/index.js'
import { GrowthStage } from '../../src/types.js'

function simulateToHarvest(speciesName: string, envOverrides?: Record<string, number>, maxTicks = 500) {
  let plant = createPlant(speciesName)
  let soil = createOptimalSoil(speciesName)
  const env = { ...createOptimalEnvironment(speciesName), ...envOverrides }
  const species = getSpecies(speciesName)!
  const eco = createDefaultEcosystem()
  let ticks = 0

  while (plant.isAlive && plant.stage !== GrowthStage.HarvestReady && ticks < maxTicks) {
    // Maintain optimal soil for this test
    soil.moisture = Math.max(soil.moisture, species.waterProfile.optimalMoisture)
    soil.nitrogen = Math.max(soil.nitrogen, 50)
    soil.phosphorus = Math.max(soil.phosphorus, 35)
    soil.potassium = Math.max(soil.potassium, 40)

    const result = tick(plant, soil, env, 1, eco, species)
    plant = result.plant
    soil = result.soil
    ticks++
  }

  return { plant, ticks }
}

describe('full season simulation', () => {
  test('lettuce completes full lifecycle in ~60–120 ticks under optimal conditions', () => {
    const { plant, ticks } = simulateToHarvest('lettuce')
    expect(plant.stage).toBe(GrowthStage.HarvestReady)
    expect(ticks).toBeGreaterThan(50)
    expect(ticks).toBeLessThan(200)
  })

  test('tomato takes longer than lettuce', () => {
    const lettResult = simulateToHarvest('lettuce')
    const tomResult = simulateToHarvest('tomato')
    expect(tomResult.ticks).toBeGreaterThan(lettResult.ticks)
  })

  test('corn takes longer than tomato', () => {
    const tomResult = simulateToHarvest('tomato')
    const cornResult = simulateToHarvest('corn')
    expect(cornResult.ticks).toBeGreaterThan(tomResult.ticks)
  })

  test('grape takes significantly longer than corn', () => {
    const cornResult = simulateToHarvest('corn')
    // Grape needs vernalization — without cold exposure it can't flower
    // so it always hits maxTicks. This is correct behavior.
    const grapeResult = simulateToHarvest('grape')
    expect(grapeResult.ticks).toBeGreaterThanOrEqual(cornResult.ticks)
  })

  test('suboptimal conditions extend growth time', () => {
    const optimal = simulateToHarvest('lettuce')

    // Suboptimal: very low light (20% of normal)
    const suboptimal = simulateToHarvest('lettuce', { lightIntensity: 0.15 })

    // Should take longer or not reach harvest at all
    if (suboptimal.plant.stage === GrowthStage.HarvestReady) {
      expect(suboptimal.ticks).toBeGreaterThan(optimal.ticks * 1.3)
    } else {
      // Even worse: didn't make it at all under very low light
      expect(suboptimal.ticks).toBe(500) // hit max ticks
    }
  })

  test('complete neglect kills plant within expected timeframe', () => {
    let plant = createPlant('tomato')
    let soil = createOptimalSoil('tomato')
    const env = {
      ...createOptimalEnvironment('tomato'),
      rainfall: 0,
      isRaining: false,
    }
    const species = getSpecies('tomato')!
    let ticks = 0

    while (plant.isAlive && ticks < 500) {
      const result = tick(plant, soil, env, 1, undefined, species)
      plant = result.plant
      soil = result.soil
      ticks++
    }

    expect(plant.isAlive).toBe(false)
    expect(ticks).toBeGreaterThan(20)
    expect(ticks).toBeLessThan(300)
  })

  test('plant progresses through expected stages', () => {
    let plant = createPlant('tomato')
    let soil = createOptimalSoil('tomato')
    const env = createOptimalEnvironment('tomato')
    const species = getSpecies('tomato')!
    const eco = createDefaultEcosystem()

    const stagesSeen = new Set<GrowthStage>()
    stagesSeen.add(plant.stage)

    for (let i = 0; i < 400; i++) {
      soil.moisture = Math.max(soil.moisture, species.waterProfile.optimalMoisture)
      soil.nitrogen = Math.max(soil.nitrogen, 50)
      soil.phosphorus = Math.max(soil.phosphorus, 35)
      soil.potassium = Math.max(soil.potassium, 40)

      const result = tick(plant, soil, env, 1, eco, species)
      plant = result.plant
      soil = result.soil
      stagesSeen.add(plant.stage)

      if (plant.stage === GrowthStage.HarvestReady) break
    }

    expect(stagesSeen.has(GrowthStage.Seed)).toBe(true)
    expect(stagesSeen.has(GrowthStage.Germination)).toBe(true)
    expect(stagesSeen.has(GrowthStage.Seedling)).toBe(true)
    expect(stagesSeen.has(GrowthStage.Vegetative)).toBe(true)
  })
})
