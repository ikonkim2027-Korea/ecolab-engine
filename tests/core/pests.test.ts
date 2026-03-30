import { describe, test, expect } from 'vitest'
import {
  pestGrowthRate, pestCarryingCapacity, applyPesticide,
  pestDamage, simulatePestGrowth
} from '../../src/core/pests.js'
import { EcosystemState } from '../../src/types.js'

const baseEco: EcosystemState = {
  pestPopulation: 0.3,
  beneficialInsects: 0.5,
  beePopulation: 0.6,
  biodiversityScore: 0.5,
  weedCoverage: 0,
}

describe('pest dynamics', () => {
  test('pest population grows logistically', () => {
    const pop = pestGrowthRate({ ...baseEco, pestPopulation: 0.1 }, 1)
    expect(pop).toBeGreaterThan(0.1)
  })

  test('pest growth slows near carrying capacity', () => {
    const lowPop = pestGrowthRate({ ...baseEco, pestPopulation: 0.1 }, 1)
    const highPop = pestGrowthRate({ ...baseEco, pestPopulation: 0.8 }, 1)
    const lowGrowthRate = lowPop - 0.1
    const highGrowthRate = highPop - 0.8
    // High pop should grow less (or decline due to predation)
    expect(highGrowthRate).toBeLessThan(lowGrowthRate)
  })

  test('beneficial insects reduce pest population through predation', () => {
    const noPredators = pestGrowthRate({ ...baseEco, beneficialInsects: 0 }, 1)
    const withPredators = pestGrowthRate({ ...baseEco, beneficialInsects: 0.8 }, 1)
    expect(withPredators).toBeLessThan(noPredators)
  })
})

describe('carrying capacity', () => {
  test('monoculture has higher carrying capacity', () => {
    const monoK = pestCarryingCapacity(0.1)
    const polyK = pestCarryingCapacity(0.8)
    expect(monoK).toBeGreaterThan(polyK)
  })
})

describe('pesticide effects', () => {
  test('broad spectrum kills pests AND beneficials', () => {
    const after = applyPesticide(baseEco, 'broad_spectrum')
    expect(after.pestPopulation).toBeLessThan(0.2)
    expect(after.beneficialInsects).toBeLessThan(0.3)
  })

  test('targeted pesticide has less collateral damage', () => {
    const broad = applyPesticide(baseEco, 'broad_spectrum')
    const targeted = applyPesticide(baseEco, 'targeted')
    expect(targeted.beneficialInsects).toBeGreaterThan(broad.beneficialInsects)
  })

  test('organic pesticide has minimal beneficial damage', () => {
    const organic = applyPesticide(baseEco, 'organic')
    expect(organic.beneficialInsects).toBeGreaterThan(baseEco.beneficialInsects * 0.8)
  })
})

describe('monoculture vs polyculture', () => {
  test('monoculture increases pest pressure vs polyculture', () => {
    const mono = simulatePestGrowth({ biodiversityScore: 0.1 }, 50)
    const poly = simulatePestGrowth({ biodiversityScore: 0.8 }, 50)
    expect(mono.pestPopulation).toBeGreaterThan(poly.pestPopulation * 2)
  })
})

describe('pest damage', () => {
  test('low pest population causes minimal damage', () => {
    expect(pestDamage(0.1)).toBeLessThan(0.05)
  })

  test('high pest population causes significant damage', () => {
    expect(pestDamage(0.8)).toBeGreaterThan(0.1)
  })
})
