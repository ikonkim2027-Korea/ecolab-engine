import { describe, test, expect } from 'vitest'
import { createExperiment, runExperiment, exportData, simulateYield } from '../../src/experiment/index.js'

describe('experiment mode', () => {
  test('creates independent control and experimental groups', () => {
    const exp = createExperiment(
      'tomato',
      'Elevated CO₂ increases tomato growth',
      'co2',
      { co2: 410 },
      { co2: 800 }
    )

    expect(exp.controlGroup.env.co2).toBe(410)
    expect(exp.experimentalGroup.env.co2).toBe(800)
    expect(exp.dataLog).toHaveLength(0)
  })

  test('running experiment produces data log', () => {
    const exp = createExperiment(
      'tomato',
      'Elevated CO₂ increases growth',
      'co2',
      { co2: 410 },
      { co2: 800 }
    )

    const result = runExperiment(exp, 50)
    expect(result.dataLog).toHaveLength(50)
  })

  test('elevated CO₂ produces higher growth in C3 plant', () => {
    const exp = createExperiment(
      'tomato',
      'Elevated CO₂ increases tomato growth',
      'co2',
      { co2: 410 },
      { co2: 800 }
    )

    const result = runExperiment(exp, 100)
    const lastData = result.dataLog[result.dataLog.length - 1]
    expect(lastData.experimentValue).toBeGreaterThan(lastData.controlValue * 1.2)
  })

  test('data export returns all data points', () => {
    const exp = createExperiment('tomato', 'test', 'co2')
    const result = runExperiment(exp, 30)
    const data = exportData(result)
    expect(data).toHaveLength(30)
    expect(data[0]).toHaveProperty('tick')
    expect(data[0]).toHaveProperty('controlValue')
    expect(data[0]).toHaveProperty('experimentValue')
  })

  test('simulateYield helper returns growth points', () => {
    const yield1 = simulateYield('tomato')
    expect(yield1).toBeGreaterThan(0)
  })

  test('different environments produce different yields', () => {
    const yieldNormal = simulateYield('tomato', { co2: 410 })
    const yieldHighCO2 = simulateYield('tomato', { co2: 800 })
    expect(yieldHighCO2).toBeGreaterThan(yieldNormal)
  })
})
