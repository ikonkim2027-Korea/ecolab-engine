import { describe, test, expect } from 'vitest'
import {
  temperatureResponse, isLethalTemperature,
  pollinationSuccess, temperatureStress, updateSoilTemperature
} from '../../src/core/temperature.js'
import { tomato } from '../../src/species/tomato.js'
import { lettuce } from '../../src/species/lettuce.js'
import { corn } from '../../src/species/corn.js'

const tomatoProfile = tomato.temperatureProfile
const lettuceProfile = lettuce.temperatureProfile
const cornProfile = corn.temperatureProfile

describe('temperature response', () => {
  test('optimal temperature gives factor ≈ 1.0', () => {
    expect(temperatureResponse(25, tomatoProfile)).toBeCloseTo(1.0, 1)
  })

  test('below Tmin gives factor ≈ 0', () => {
    expect(temperatureResponse(8, tomatoProfile)).toBeCloseTo(0, 1)
  })

  test('above Tmax gives factor ≈ 0', () => {
    expect(temperatureResponse(36, tomatoProfile)).toBeCloseTo(0, 1)
  })

  test('at Tmin gives factor 0', () => {
    expect(temperatureResponse(10, tomatoProfile)).toBe(0)
  })

  test('at Tmax gives factor 0', () => {
    expect(temperatureResponse(35, tomatoProfile)).toBe(0)
  })

  test('response is asymmetric bell curve', () => {
    // Slightly below optimum should give higher value than equally above
    const below = temperatureResponse(20, tomatoProfile) // 5 below opt
    const above = temperatureResponse(30, tomatoProfile) // 5 above opt
    // Both should be positive and less than 1
    expect(below).toBeGreaterThan(0)
    expect(above).toBeGreaterThan(0)
    expect(below).toBeLessThan(1)
    expect(above).toBeLessThan(1)
  })

  test('lettuce prefers cooler temps than tomato', () => {
    expect(temperatureResponse(18, lettuceProfile)).toBeGreaterThan(
      temperatureResponse(18, tomatoProfile)
    )
    expect(temperatureResponse(32, tomatoProfile)).toBeGreaterThan(
      temperatureResponse(32, lettuceProfile)
    )
  })

  test('corn prefers warmer temps (C4 plant)', () => {
    expect(temperatureResponse(30, cornProfile)).toBeCloseTo(1.0, 1)
    expect(temperatureResponse(30, lettuceProfile)).toBeLessThan(0.3)
  })
})

describe('lethal temperature', () => {
  test('below Tlethal_low kills plant', () => {
    expect(isLethalTemperature(1, tomatoProfile)).toBe(true)
  })

  test('above Tlethal_high kills plant', () => {
    expect(isLethalTemperature(45, tomatoProfile)).toBe(true)
  })

  test('optimal temperature is not lethal', () => {
    expect(isLethalTemperature(25, tomatoProfile)).toBe(false)
  })

  test('lettuce survives mild frost', () => {
    expect(isLethalTemperature(-2, lettuceProfile)).toBe(false)
    // But hard frost kills it
    expect(isLethalTemperature(-6, lettuceProfile)).toBe(true)
  })

  test('tomato dies at frost', () => {
    expect(isLethalTemperature(-2, tomatoProfile)).toBe(true)
  })
})

describe('pollination', () => {
  test('heat stress reduces pollen viability in tomato', () => {
    const normalPoll = pollinationSuccess(25, tomatoProfile)
    const heatPoll = pollinationSuccess(38, tomatoProfile)
    expect(heatPoll).toBeLessThan(normalPoll * 0.3)
  })

  test('optimal temperature gives full pollination', () => {
    expect(pollinationSuccess(25, tomatoProfile)).toBeCloseTo(1.0, 1)
  })
})

describe('temperature stress', () => {
  test('no stress at optimal temperature', () => {
    const stress = temperatureStress(25, tomatoProfile)
    expect(stress.heat).toBe(0)
    expect(stress.cold).toBe(0)
  })

  test('heat stress above optimal + 3', () => {
    const stress = temperatureStress(35, tomatoProfile)
    expect(stress.heat).toBeGreaterThan(0)
  })

  test('cold stress below optimal - 5', () => {
    const stress = temperatureStress(12, tomatoProfile)
    expect(stress.cold).toBeGreaterThan(0)
  })
})

describe('soil temperature', () => {
  test('soil temp lags toward air temp', () => {
    const soilTemp = updateSoilTemperature(15, 25, 0.05)
    expect(soilTemp).toBeGreaterThan(15)
    expect(soilTemp).toBeLessThan(25)
    expect(soilTemp).toBeCloseTo(15.5, 1)
  })
})
