import { describe, test, expect } from 'vitest'
import { tomato } from '../../src/species/tomato.js'

describe('tomato species profile', () => {
  test('is Tier 2', () => {
    expect(tomato.tier).toBe(2)
  })

  test('is C3 plant', () => {
    expect(tomato.pathway).toBe('C3')
    expect(tomato.co2Km).toBe(300)
  })

  test('prefers warm temperatures (Topt = 25°C)', () => {
    expect(tomato.temperatureProfile.Topt).toBe(25)
  })

  test('frost-sensitive (dies at 2°C)', () => {
    expect(tomato.temperatureProfile.TlethalLow).toBe(2)
  })

  test('requires pollination for fruit', () => {
    expect(tomato.requiresPollination).toBe(true)
  })

  test('higher growth thresholds than lettuce', () => {
    const totalThreshold = tomato.stages.reduce((sum, s) => sum + s.threshold, 0)
    expect(totalThreshold).toBeGreaterThan(100)
  })

  test('potassium demand highest during fruiting', () => {
    expect(tomato.nutrientDemand.fruiting.K).toBeGreaterThan(
      tomato.nutrientDemand.vegetative.K
    )
  })
})
