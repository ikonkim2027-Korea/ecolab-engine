import { describe, test, expect } from 'vitest'
import { lightResponseCurve, co2ResponseFactor, photosynthesisRate, stomatalConductance } from '../../src/core/photosynthesis.js'
import { tomato } from '../../src/species/tomato.js'
import { corn } from '../../src/species/corn.js'
import { lettuce } from '../../src/species/lettuce.js'
import { EnvironmentState, Season } from '../../src/types.js'

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

describe('photosynthesis', () => {
  describe('light response curve', () => {
    test('follows non-rectangular hyperbola shape', () => {
      const rate0 = lightResponseCurve(0, tomato)
      const rate25 = lightResponseCurve(0.25, tomato)
      const rate50 = lightResponseCurve(0.5, tomato)
      const rate75 = lightResponseCurve(0.75, tomato)
      const rate100 = lightResponseCurve(1.0, tomato)

      // Zero light = zero photosynthesis
      expect(rate0).toBe(0)

      // Monotonically increasing
      expect(rate25).toBeGreaterThan(rate0)
      expect(rate50).toBeGreaterThan(rate25)
      expect(rate100).toBeGreaterThan(rate50)

      // Diminishing returns — increments get smaller
      const gain1 = rate50 - rate25
      const gain2 = rate100 - rate75
      expect(gain2).toBeLessThan(gain1)
    })

    test('light saturation: doubling light above saturation yields <35% gain', () => {
      const rateMid = lightResponseCurve(0.5, tomato)
      const rateFull = lightResponseCurve(1.0, tomato)
      const gain = (rateFull - rateMid) / rateMid
      expect(gain).toBeLessThan(0.35)
    })

    test('photosynthesis is zero in darkness', () => {
      const rate = photosynthesisRate({ ...baseEnv, lightIntensity: 0 }, tomato)
      expect(rate).toBe(0)
    })

    test('very low light produces negligible photosynthesis', () => {
      const rate = photosynthesisRate({ ...baseEnv, lightIntensity: 0.02 }, tomato)
      expect(rate).toBeLessThan(0.1)
    })
  })

  describe('CO₂ response', () => {
    test('C3 plants respond strongly to elevated CO₂', () => {
      const rate410 = photosynthesisRate({ ...baseEnv, co2: 410 }, tomato)
      const rate800 = photosynthesisRate({ ...baseEnv, co2: 800 }, tomato)
      // C3 plants with Km~300 show ~25% increase at doubled CO₂
      expect(rate800).toBeGreaterThan(rate410 * 1.2)
    })

    test('C4 plants show minimal CO₂ response above ambient', () => {
      const rate410 = photosynthesisRate({ ...baseEnv, co2: 410 }, corn)
      const rate800 = photosynthesisRate({ ...baseEnv, co2: 800 }, corn)
      expect(rate800).toBeLessThan(rate410 * 1.1)
    })

    test('zero CO₂ gives zero photosynthesis factor', () => {
      expect(co2ResponseFactor(0, tomato)).toBe(0)
    })

    test('CO₂ response follows Michaelis-Menten kinetics', () => {
      // At [CO₂] = Km, response should be 50% of max
      const atKm = co2ResponseFactor(300, tomato) // Km = 300 for C3
      const atHigh = co2ResponseFactor(10000, tomato)
      expect(atKm / atHigh).toBeCloseTo(0.5, 1)
    })
  })

  describe('stomatal conductance', () => {
    test('full conductance at high water content', () => {
      expect(stomatalConductance(0.8)).toBe(1.0)
    })

    test('reduced conductance at low water content', () => {
      expect(stomatalConductance(0.2)).toBeLessThan(0.5)
    })

    test('minimal conductance at very low water', () => {
      expect(stomatalConductance(0.1)).toBeCloseTo(0.05, 1)
    })
  })
})
