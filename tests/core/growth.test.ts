import { describe, test, expect } from 'vitest'
import {
  tick, createPlant, createOptimalSoil, createOptimalEnvironment,
  createDefaultEcosystem
} from '../../src/core/growth.js'
import { tomato } from '../../src/species/tomato.js'
import { lettuce } from '../../src/species/lettuce.js'
import { GrowthStage, Season } from '../../src/types.js'

describe('growth engine', () => {
  test('plant grows under optimal conditions', () => {
    const plant = createPlant('tomato')
    const soil = createOptimalSoil('tomato')
    const env = createOptimalEnvironment('tomato')
    const result = tick(plant, soil, env, 1, undefined, tomato)
    expect(result.plant.growthPoints).toBeGreaterThan(0)
    expect(result.plant.totalGrowthPoints).toBeGreaterThan(0)
  })

  test('plant does not grow in darkness', () => {
    const plant = createPlant('tomato')
    const soil = createOptimalSoil('tomato')
    const env = { ...createOptimalEnvironment('tomato'), lightIntensity: 0 }
    const result = tick(plant, soil, env, 1, undefined, tomato)
    expect(result.plant.growthPoints).toBe(0)
  })

  test('lethal temperature kills plant', () => {
    const plant = createPlant('tomato')
    const soil = createOptimalSoil('tomato')
    const env = { ...createOptimalEnvironment('tomato'), airTemperature: -5 }
    const result = tick(plant, soil, env, 1, undefined, tomato)
    expect(result.plant.isAlive).toBe(false)
    expect(result.plant.stage).toBe(GrowthStage.Dead)
  })

  test('stage advances when growth points exceed threshold', () => {
    let plant = createPlant('lettuce')
    const soil = createOptimalSoil('lettuce')
    const env = createOptimalEnvironment('lettuce')

    // Run enough ticks to advance from Seed
    for (let i = 0; i < 50; i++) {
      const result = tick(plant, soil, env, 1, undefined, lettuce)
      plant = result.plant
    }

    expect(plant.stage).not.toBe(GrowthStage.Seed)
  })

  test('age increments each tick', () => {
    const plant = createPlant('tomato')
    const soil = createOptimalSoil('tomato')
    const env = createOptimalEnvironment('tomato')
    const result = tick(plant, soil, env, 1, undefined, tomato)
    expect(result.plant.age).toBe(1)
  })

  test('dt multiplier scales growth proportionally', () => {
    const plant = createPlant('tomato')
    const soil = createOptimalSoil('tomato')
    const env = createOptimalEnvironment('tomato')

    const result1x = tick(plant, soil, env, 1, undefined, tomato)
    const result4x = tick(plant, soil, env, 4, undefined, tomato)

    // 4x should produce roughly 4x the growth (not exactly due to soil changes)
    expect(result4x.plant.growthPoints).toBeGreaterThan(result1x.plant.growthPoints * 3)
    expect(result4x.plant.growthPoints).toBeLessThan(result1x.plant.growthPoints * 5)
  })

  test('soil moisture decreases over time without rain', () => {
    const plant = createPlant('tomato')
    const soil = createOptimalSoil('tomato')
    const env = { ...createOptimalEnvironment('tomato'), rainfall: 0, isRaining: false }
    const result = tick(plant, soil, env, 1, undefined, tomato)
    expect(result.soil.moisture).toBeLessThan(soil.moisture)
  })

  test('soil nutrients decrease as plant grows', () => {
    let plant = createPlant('tomato')
    let soil = createOptimalSoil('tomato')
    const env = createOptimalEnvironment('tomato')

    for (let i = 0; i < 20; i++) {
      const result = tick(plant, soil, env, 1, undefined, tomato)
      plant = result.plant
      soil = result.soil
    }

    expect(soil.nitrogen).toBeLessThan(60) // started at 60
  })

  test('health recovers when stress is low', () => {
    const plant = { ...createPlant('tomato'), health: 80 }
    const soil = createOptimalSoil('tomato')
    const env = createOptimalEnvironment('tomato')
    const result = tick(plant, soil, env, 1, undefined, tomato)
    expect(result.plant.health).toBeGreaterThan(80)
  })

  test('dead plant does not update', () => {
    const plant = { ...createPlant('tomato'), isAlive: false, health: 0 }
    const soil = createOptimalSoil('tomato')
    const env = createOptimalEnvironment('tomato')
    const result = tick(plant, soil, env, 1, undefined, tomato)
    expect(result.plant.growthPoints).toBe(0)
    expect(result.plant.isAlive).toBe(false)
  })
})
