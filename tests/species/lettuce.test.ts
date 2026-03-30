import { describe, test, expect } from 'vitest'
import { lettuce } from '../../src/species/lettuce.js'
import { GrowthStage } from '../../src/types.js'

describe('lettuce species profile', () => {
  test('is Tier 1', () => {
    expect(lettuce.tier).toBe(1)
  })

  test('is C3 plant', () => {
    expect(lettuce.pathway).toBe('C3')
  })

  test('prefers cool temperatures (Topt = 18°C)', () => {
    expect(lettuce.temperatureProfile.Topt).toBe(18)
    expect(lettuce.temperatureProfile.Tmax).toBeLessThan(30)
  })

  test('tolerates mild frost', () => {
    expect(lettuce.temperatureProfile.TlethalLow).toBeLessThan(-2)
  })

  test('does not require pollination', () => {
    expect(lettuce.requiresPollination).toBe(false)
  })

  test('has lower growth thresholds than fruiting crops', () => {
    const totalThreshold = lettuce.stages.reduce((sum, s) => sum + s.threshold, 0)
    expect(totalThreshold).toBeLessThan(100)
  })

  test('skips flowering/fruiting (leaf vegetable)', () => {
    // Lettuce goes seed → ... → vegetative → harvest_ready
    const stages = lettuce.stages.map(s => s.stage)
    expect(stages).toContain(GrowthStage.Vegetative)
    expect(stages).toContain(GrowthStage.HarvestReady)
  })

  test('has shallow root system', () => {
    expect(lettuce.maxRootDepth).toBeLessThan(50)
  })
})
