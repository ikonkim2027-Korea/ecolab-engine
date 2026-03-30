import { describe, test, expect } from 'vitest'
import {
  evaporationRate, waterUptake, waterStressModifier,
  stomatalOpenness, isWaterlogged, rainfallToMoisture
} from '../../src/core/water.js'
import { tomato } from '../../src/species/tomato.js'
import { createPlant } from '../../src/core/growth.js'
import { EnvironmentState, Season, SoilState } from '../../src/types.js'

const baseEnv: EnvironmentState = {
  airTemperature: 25,
  lightIntensity: 0.7,
  co2: 410,
  humidity: 0.6,
  windSpeed: 2,
  rainfall: 0,
  isRaining: false,
  dayLength: 14,
  season: Season.Summer,
  dayOfSeason: 45,
}

const baseSoil: SoilState = {
  moisture: 0.30,
  pH: 6.5,
  nitrogen: 60,
  phosphorus: 40,
  potassium: 50,
  organicMatter: 3,
  temperature: 22,
  microbeHealth: 0.7,
}

describe('water system', () => {
  describe('evaporation', () => {
    test('higher temperature increases evaporation', () => {
      const coolRate = evaporationRate({ ...baseEnv, airTemperature: 15 })
      const hotRate = evaporationRate({ ...baseEnv, airTemperature: 35 })
      expect(hotRate).toBeGreaterThan(coolRate)
    })

    test('higher humidity reduces evaporation', () => {
      const dryRate = evaporationRate({ ...baseEnv, humidity: 0.2 })
      const humidRate = evaporationRate({ ...baseEnv, humidity: 0.9 })
      expect(dryRate).toBeGreaterThan(humidRate)
    })

    test('wind increases evaporation', () => {
      const calmRate = evaporationRate({ ...baseEnv, windSpeed: 0 })
      const windyRate = evaporationRate({ ...baseEnv, windSpeed: 10 })
      expect(windyRate).toBeGreaterThan(calmRate)
    })
  })

  describe('plant water uptake', () => {
    test('below permanent wilt point, water uptake stops', () => {
      const plant = { ...createPlant('tomato'), rootDepth: 30, leafArea: 0.4 }
      const uptake = waterUptake(
        { ...baseSoil, moisture: 0.10 },
        tomato, plant
      )
      expect(uptake).toBeCloseTo(0, 2)
    })

    test('above wilt point, uptake is positive', () => {
      const plant = { ...createPlant('tomato'), rootDepth: 30, leafArea: 0.4 }
      const uptake = waterUptake(
        { ...baseSoil, moisture: 0.30 },
        tomato, plant
      )
      expect(uptake).toBeGreaterThan(0)
    })

    test('deeper roots increase water uptake', () => {
      const shallow = { ...createPlant('tomato'), rootDepth: 10, leafArea: 0.4 }
      const deep = { ...createPlant('tomato'), rootDepth: 50, leafArea: 0.4 }
      const uptakeShallow = waterUptake(baseSoil, tomato, shallow)
      const uptakeDeep = waterUptake(baseSoil, tomato, deep)
      expect(uptakeDeep).toBeGreaterThan(uptakeShallow)
    })
  })

  describe('water stress', () => {
    test('optimal moisture gives factor 1.0', () => {
      const factor = waterStressModifier(tomato.waterProfile.optimalMoisture, tomato)
      expect(factor).toBeCloseTo(1.0, 1)
    })

    test('at wilt point, factor is 0', () => {
      const factor = waterStressModifier(tomato.waterProfile.permanentWiltPoint, tomato)
      expect(factor).toBeCloseTo(0, 1)
    })

    test('drought reduces factor linearly', () => {
      const mid = (tomato.waterProfile.permanentWiltPoint + tomato.waterProfile.optimalMoisture) / 2
      const factor = waterStressModifier(mid, tomato)
      expect(factor).toBeGreaterThan(0.3)
      expect(factor).toBeLessThan(0.7)
    })
  })

  describe('stomatal openness', () => {
    test('fully open above closure threshold', () => {
      expect(stomatalOpenness(0.35, tomato)).toBe(1.0)
    })

    test('closed at wilt point', () => {
      expect(stomatalOpenness(tomato.waterProfile.permanentWiltPoint, tomato)).toBe(0)
    })
  })

  describe('waterlogging', () => {
    test('detects waterlogged conditions', () => {
      expect(isWaterlogged(0.96)).toBe(true)
      expect(isWaterlogged(0.30)).toBe(false)
    })

    test('waterlogged soil reduces growth factor', () => {
      const normal = waterStressModifier(0.30, tomato)
      const waterlogged = waterStressModifier(0.98, tomato)
      expect(waterlogged).toBeLessThan(normal)
    })
  })

  describe('rainfall conversion', () => {
    test('converts mm rainfall to soil moisture fraction', () => {
      const change = rainfallToMoisture(10) // 10mm
      expect(change).toBeGreaterThan(0)
      expect(change).toBeLessThan(0.1)
    })
  })
})
