import { describe, test, expect } from 'vitest'
import { grape } from '../../src/species/grape.js'

describe('grape species profile', () => {
  test('is Tier 4', () => {
    expect(grape.tier).toBe(4)
  })

  test('is C3 plant', () => {
    expect(grape.pathway).toBe('C3')
  })

  test('requires vernalization', () => {
    expect(grape.vernalizationRequired).toBe(true)
    expect(grape.vernalizationTicks).toBeGreaterThan(0)
  })

  test('highest total growth thresholds', () => {
    const total = grape.stages.reduce((sum, s) => sum + s.threshold, 0)
    expect(total).toBeGreaterThan(200)
  })

  test('deep root system (deepest of all species)', () => {
    expect(grape.maxRootDepth).toBeGreaterThan(100)
  })

  test('potassium critical during fruiting', () => {
    expect(grape.nutrientDemand.fruiting.K).toBeGreaterThan(0.8)
  })
})
