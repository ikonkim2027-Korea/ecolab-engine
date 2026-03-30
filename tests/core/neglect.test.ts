import { describe, test, expect } from 'vitest'
import { simulateNeglect } from '../../src/core/neglect.js'
import { createPlant, createOptimalSoil, createOptimalEnvironment, createDefaultEcosystem } from '../../src/core/growth.js'
import { FullSimulationState } from '../../src/types.js'

function createFullState(species: string): FullSimulationState {
  return {
    plant: createPlant(species),
    soil: createOptimalSoil(species),
    environment: createOptimalEnvironment(species),
    ecosystem: createDefaultEcosystem(),
  }
}

describe('neglect system', () => {
  test('short absence causes minor degradation', () => {
    const state = createFullState('tomato')
    const result = simulateNeglect(state, 2, 'normal')
    expect(result.state.soil.moisture).toBeLessThan(state.soil.moisture)
    expect(result.state.plant.isAlive).toBe(true)
    expect(result.report.events.length).toBeGreaterThanOrEqual(0)
  })

  test('long absence causes significant damage', () => {
    const state = createFullState('tomato')
    const result = simulateNeglect(state, 24, 'normal')
    expect(result.state.soil.moisture).toBeLessThan(0.15)
    expect(result.report.events.length).toBeGreaterThan(0)
  })

  test('very long absence can kill plant', () => {
    const state = createFullState('tomato')
    const result = simulateNeglect(state, 72, 'normal')
    expect(result.state.plant.health).toBeLessThan(50)
  })

  test('easy mode reduces degradation', () => {
    const state = createFullState('tomato')
    const normalResult = simulateNeglect(state, 24, 'normal')
    const easyResult = simulateNeglect(state, 24, 'easy')
    expect(easyResult.state.soil.moisture).toBeGreaterThan(normalResult.state.soil.moisture)
  })

  test('hard mode increases degradation', () => {
    const state = createFullState('tomato')
    const normalResult = simulateNeglect(state, 12, 'normal')
    const hardResult = simulateNeglect(state, 12, 'hard')
    expect(hardResult.state.plant.health).toBeLessThan(normalResult.state.plant.health)
  })

  test('report contains educational explanations', () => {
    const state = createFullState('tomato')
    const result = simulateNeglect(state, 24, 'normal')

    if (result.report.events.length > 0) {
      const event = result.report.events[0]
      expect(event.what).toBeTruthy()
      expect(event.why).toBeTruthy()
      expect(event.science).toBeTruthy()
      expect(event.recovery).toBeTruthy()
    }
  })

  test('dead plant does not degrade further', () => {
    const state = createFullState('tomato')
    state.plant.isAlive = false
    state.plant.health = 0
    const result = simulateNeglect(state, 100, 'normal')
    expect(result.report.events.length).toBe(0)
  })
})
