import { describe, test, expect } from 'vitest'
import { corn } from '../../src/species/corn.js'

describe('corn species profile', () => {
  test('is Tier 3', () => {
    expect(corn.tier).toBe(3)
  })

  test('is C4 plant', () => {
    expect(corn.pathway).toBe('C4')
  })

  test('has low CO₂ Km (C4 concentrating mechanism)', () => {
    expect(corn.co2Km).toBe(30)
  })

  test('prefers hot temperatures (Topt = 30°C)', () => {
    expect(corn.temperatureProfile.Topt).toBe(30)
  })

  test('higher quantum yield than C3 plants', () => {
    expect(corn.quantumYield).toBeGreaterThan(0.06)
  })

  test('deep root system', () => {
    expect(corn.maxRootDepth).toBeGreaterThan(80)
  })

  test('heavy nitrogen feeder during vegetative stage', () => {
    expect(corn.nutrientDemand.vegetative.N).toBeGreaterThanOrEqual(1.0)
  })
})
