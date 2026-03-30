import { describe, test, expect } from 'vitest'
import { applyDifficulty, applyEasyCorrections, applyHardEffects } from '../../src/difficulty/index.js'
import { createPlant, createOptimalSoil, createOptimalEnvironment, createDefaultEcosystem } from '../../src/core/growth.js'
import { FullSimulationState } from '../../src/types.js'

function createFullState(): FullSimulationState {
  return {
    plant: createPlant('tomato'),
    soil: createOptimalSoil('tomato'),
    environment: createOptimalEnvironment('tomato'),
    ecosystem: createDefaultEcosystem(),
  }
}

describe('difficulty system', () => {
  describe('visibility filtering', () => {
    test('easy shows minimal info', () => {
      const state = createFullState()
      const visible = applyDifficulty(state, 'easy')
      expect(visible.plantStage).toBeTruthy()
      expect(visible.plantHealth).toBeDefined()
      expect(visible.soilMoisture).toBeUndefined()
      expect(visible.soilNPK).toBeUndefined()
    })

    test('normal shows soil moisture and pH', () => {
      const state = createFullState()
      const visible = applyDifficulty(state, 'normal')
      expect(visible.soilMoisture).toBeDefined()
      expect(visible.soilpH).toBeDefined()
      expect(visible.soilNPK).toBeUndefined()
    })

    test('hard shows everything', () => {
      const state = createFullState()
      const visible = applyDifficulty(state, 'hard')
      expect(visible.soilMoisture).toBeDefined()
      expect(visible.soilpH).toBeDefined()
      expect(visible.soilNPK).toBeDefined()
      expect(visible.stressDetails).toBeDefined()
      expect(visible.pestPopulation).toBeDefined()
    })
  })

  describe('easy mode corrections', () => {
    test('pH drifts toward 6.5', () => {
      const state = createFullState()
      state.soil.pH = 5.0
      const corrected = applyEasyCorrections(state)
      expect(corrected.soil.pH).toBeGreaterThan(5.0)
    })

    test('NPK slowly replenishes', () => {
      const state = createFullState()
      state.soil.nitrogen = 10
      const corrected = applyEasyCorrections(state)
      expect(corrected.soil.nitrogen).toBeGreaterThan(10)
    })

    test('pest population capped at harmless level', () => {
      const state = createFullState()
      state.ecosystem.pestPopulation = 0.5
      const corrected = applyEasyCorrections(state)
      expect(corrected.ecosystem.pestPopulation).toBeLessThanOrEqual(0.15)
    })

    test('temperature stress reduced by 50%', () => {
      const state = createFullState()
      state.plant.stressAccumulator.heat = 0.6
      const corrected = applyEasyCorrections(state)
      expect(corrected.plant.stressAccumulator.heat).toBeCloseTo(0.3, 1)
    })
  })

  describe('hard mode effects', () => {
    test('pests grow faster', () => {
      const state = createFullState()
      state.ecosystem.pestPopulation = 0.3
      const hard = applyHardEffects(state)
      expect(hard.ecosystem.pestPopulation).toBeGreaterThan(0.3)
    })

    test('weeds grow faster', () => {
      const state = createFullState()
      const hard = applyHardEffects(state)
      expect(hard.ecosystem.weedCoverage).toBeGreaterThan(0)
    })
  })
})
