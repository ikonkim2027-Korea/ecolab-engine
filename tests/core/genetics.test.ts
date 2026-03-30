import { describe, test, expect } from 'vitest'
import {
  crossBreed, crossTrait, hasDominantPhenotype,
  isDominant, createRNG
} from '../../src/core/genetics.js'

describe('Mendelian genetics', () => {
  describe('basic allele mechanics', () => {
    test('uppercase alleles are dominant', () => {
      expect(isDominant('R')).toBe(true)
      expect(isDominant('r')).toBe(false)
    })

    test('dominant phenotype with at least one dominant allele', () => {
      expect(hasDominantPhenotype(['R', 'R'])).toBe(true)
      expect(hasDominantPhenotype(['R', 'r'])).toBe(true)
      expect(hasDominantPhenotype(['r', 'r'])).toBe(false)
    })
  })

  describe('F1 cross', () => {
    test('homozygous parents produce all heterozygous offspring', () => {
      const parent1 = { color: ['R', 'R'] as [string, string] }
      const parent2 = { color: ['r', 'r'] as [string, string] }
      const offspring = crossBreed(parent1, parent2, 100)
      offspring.forEach(o => {
        expect(o['color'].sort()).toEqual(['R', 'r'])
      })
    })
  })

  describe('F2 cross', () => {
    test('approximates 3:1 ratio over large sample', () => {
      const parent = { color: ['R', 'r'] as [string, string] }
      const offspring = crossBreed(parent, parent, 1000)
      const dominant = offspring.filter(o => o['color'].includes('R')).length
      const ratio = dominant / 1000
      // 3:1 = 75% ± 5%
      expect(ratio).toBeGreaterThan(0.70)
      expect(ratio).toBeLessThan(0.80)
    })

    test('chi-square test: monohybrid F2 at p>0.05', () => {
      const parent = { color: ['R', 'r'] as [string, string] }
      const offspring = crossBreed(parent, parent, 400, 123)
      const dominant = offspring.filter(o => o['color'].includes('R')).length
      const recessive = 400 - dominant
      // Expected 300:100 under 3:1
      const chi2 = ((dominant - 300) ** 2) / 300 + ((recessive - 100) ** 2) / 100
      // Critical value at p=0.05, df=1 is 3.84
      expect(chi2).toBeLessThan(3.84)
    })
  })

  describe('dihybrid cross', () => {
    test('approximates 9:3:3:1 ratio', () => {
      const parent = {
        color: ['R', 'r'] as [string, string],
        size: ['S', 's'] as [string, string],
      }
      const offspring = crossBreed(parent, parent, 10000, 42)
      const bothDom = offspring.filter(
        o => o['color'].includes('R') && o['size'].includes('S')
      ).length
      // 9/16 = 0.5625
      expect(bothDom / offspring.length).toBeCloseTo(0.5625, 1)
    })
  })

  describe('seeded RNG', () => {
    test('same seed produces same sequence', () => {
      const rng1 = createRNG(42)
      const rng2 = createRNG(42)
      for (let i = 0; i < 100; i++) {
        expect(rng1.next()).toBe(rng2.next())
      }
    })

    test('different seeds produce different sequences', () => {
      const rng1 = createRNG(42)
      const rng2 = createRNG(43)
      // Very unlikely to match
      let matches = 0
      for (let i = 0; i < 100; i++) {
        if (rng1.next() === rng2.next()) matches++
      }
      expect(matches).toBeLessThan(5)
    })

    test('output is in range [0, 1)', () => {
      const rng = createRNG(42)
      for (let i = 0; i < 1000; i++) {
        const val = rng.next()
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThan(1)
      }
    })
  })
})
