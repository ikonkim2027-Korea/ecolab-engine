import { describe, test, expect } from 'vitest'
import {
  michaelisMenten, nutrientAvailability, nutrientFactor,
  nutrientToxicity, applyAmendment, effectiveNutrient
} from '../../src/core/nutrients.js'
import { tomato } from '../../src/species/tomato.js'
import { SoilState, GrowthStage } from '../../src/types.js'

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

describe('nutrient uptake', () => {
  describe('Michaelis-Menten kinetics', () => {
    test('at [S] = Km, uptake is exactly 50% of Vmax', () => {
      const result = michaelisMenten(20, 1.0, 20)
      expect(result).toBeCloseTo(0.5, 5)
    })

    test('at [S] >> Km, uptake approaches Vmax', () => {
      const result = michaelisMenten(10000, 1.0, 20)
      expect(result).toBeGreaterThan(0.99)
    })

    test('at [S] = 0, uptake is 0', () => {
      expect(michaelisMenten(0, 1.0, 20)).toBe(0)
    })

    test('negative concentration returns 0', () => {
      expect(michaelisMenten(-10, 1.0, 20)).toBe(0)
    })
  })

  describe('Liebig minimum law', () => {
    test('growth limited by scarcest nutrient', () => {
      const abundant = { nitrogen: 100, phosphorus: 100, potassium: 100 }
      const pDeficient = { nitrogen: 100, phosphorus: 5, potassium: 100 }
      const growthFull = nutrientFactor(abundant, tomato)
      const growthLimited = nutrientFactor(pDeficient, tomato)
      expect(growthLimited).toBeLessThan(growthFull * 0.5)
    })

    test('all nutrients deficient → very low growth', () => {
      const deficient = { nitrogen: 2, phosphorus: 2, potassium: 2 }
      const growth = nutrientFactor(deficient, tomato)
      expect(growth).toBeLessThan(0.2)
    })
  })

  describe('pH-dependent nutrient availability', () => {
    test('phosphorus unavailable below pH 5.0', () => {
      const available = nutrientAvailability('phosphorus', 6.5)
      const locked = nutrientAvailability('phosphorus', 4.5)
      expect(available).toBeGreaterThan(0.9)
      expect(locked).toBeLessThan(0.25)
    })

    test('nitrogen available pH 6.0–8.0', () => {
      expect(nutrientAvailability('nitrogen', 7.0)).toBeGreaterThan(0.8)
      expect(nutrientAvailability('nitrogen', 4.5)).toBeLessThan(0.2)
    })

    test('iron/manganese locked out above pH 7.5', () => {
      expect(nutrientAvailability('iron', 5.5)).toBeGreaterThan(0.7)
      expect(nutrientAvailability('iron', 8.0)).toBeLessThan(0.3)
    })

    test('micronutrients MORE available at low pH', () => {
      const lowPH = nutrientAvailability('manganese', 4.5)
      const highPH = nutrientAvailability('manganese', 8.0)
      expect(lowPH).toBeGreaterThan(highPH * 3)
    })

    test('effective nutrient accounts for pH', () => {
      const soil1 = { ...baseSoil, pH: 6.5, phosphorus: 50 }
      const soil2 = { ...baseSoil, pH: 4.5, phosphorus: 50 }
      const avail1 = effectiveNutrient('phosphorus', soil1)
      const avail2 = effectiveNutrient('phosphorus', soil2)
      expect(avail1).toBeGreaterThan(avail2 * 3)
    })
  })

  describe('soil amendments', () => {
    test('lime application raises pH via CaCO₃ neutralization', () => {
      const soil = { ...baseSoil, pH: 5.0 }
      const after = applyAmendment(soil, 'lime', 50)
      expect(after.pH).toBeGreaterThan(5.5)
      expect(after.pH).toBeLessThan(7.5)
    })

    test('sulfur lowers pH', () => {
      const soil = { ...baseSoil, pH: 7.0 }
      const after = applyAmendment(soil, 'sulfur', 50)
      expect(after.pH).toBeLessThan(7.0)
    })

    test('ammonium nitrate adds nitrogen and slightly acidifies', () => {
      const after = applyAmendment(baseSoil, 'ammonium_nitrate', 50)
      expect(after.nitrogen).toBeGreaterThan(baseSoil.nitrogen)
      expect(after.pH).toBeLessThan(baseSoil.pH)
    })

    test('compost adds NPK slowly and improves organic matter', () => {
      const after = applyAmendment(baseSoil, 'compost', 50)
      expect(after.nitrogen).toBeGreaterThan(baseSoil.nitrogen)
      expect(after.phosphorus).toBeGreaterThan(baseSoil.phosphorus)
      expect(after.potassium).toBeGreaterThan(baseSoil.potassium)
      expect(after.organicMatter).toBeGreaterThan(baseSoil.organicMatter)
      expect(after.microbeHealth).toBeGreaterThan(baseSoil.microbeHealth)
    })

    test('bone meal adds phosphorus', () => {
      const after = applyAmendment(baseSoil, 'bone_meal', 50)
      expect(after.phosphorus).toBeGreaterThan(baseSoil.phosphorus)
      expect(after.nitrogen).toBe(baseSoil.nitrogen) // no N from bone meal
    })
  })

  describe('nutrient toxicity', () => {
    test('no toxicity at normal levels', () => {
      const tox = nutrientToxicity(baseSoil, tomato)
      expect(tox).toBe(0)
    })

    test('excess nitrogen causes toxicity', () => {
      const toxicSoil = { ...baseSoil, nitrogen: 500 }
      const tox = nutrientToxicity(toxicSoil, tomato)
      expect(tox).toBeGreaterThan(0)
    })
  })
})
