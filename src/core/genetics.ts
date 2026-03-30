import { Allele, GeneticProfile, SeededRNG } from '../types.js'

/**
 * Mendelian inheritance system with simple dominance.
 *
 * Each trait is controlled by one gene with two alleles.
 * Uppercase = dominant, lowercase = recessive.
 * Phenotype determined by presence of at least one dominant allele.
 *
 * Source: Mendel (1866) Experiments in Plant Hybridization
 * Source: Griffiths et al. (2015) Introduction to Genetic Analysis
 */

/**
 * Create a seeded pseudo-random number generator (mulberry32).
 * Deterministic: same seed → same sequence.
 *
 * Source: Tommy Ettinger — mulberry32 PRNG algorithm
 */
export function createRNG(seed: number): SeededRNG {
  let state = seed | 0
  return {
    next(): number {
      state = (state + 0x6D2B79F5) | 0
      let t = Math.imul(state ^ (state >>> 15), 1 | state)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
}

/**
 * Perform a single-trait cross between two parents.
 * Returns one offspring allele pair selected randomly via Punnett square.
 *
 * Parent1: [A1, A2], Parent2: [B1, B2]
 * Possible gametes from P1: A1 or A2
 * Possible gametes from P2: B1 or B2
 * Offspring gets one from each parent.
 */
export function crossTrait(
  parent1: [Allele, Allele],
  parent2: [Allele, Allele],
  rng: SeededRNG
): [Allele, Allele] {
  // Select one allele from each parent (random segregation)
  const allele1 = rng.next() < 0.5 ? parent1[0] : parent1[1]
  const allele2 = rng.next() < 0.5 ? parent2[0] : parent2[1]
  // Convention: sort so dominant (uppercase) comes first
  return [allele1, allele2].sort() as [Allele, Allele]
}

/**
 * Determine if an allele is dominant (uppercase).
 */
export function isDominant(allele: Allele): boolean {
  return allele === allele.toUpperCase() && allele !== allele.toLowerCase()
}

/**
 * Determine phenotype from genotype.
 * Dominant phenotype if at least one dominant allele is present.
 */
export function hasDominantPhenotype(alleles: [Allele, Allele]): boolean {
  return isDominant(alleles[0]) || isDominant(alleles[1])
}

/**
 * Cross two parents to produce N offspring.
 * Each offspring's traits are independently assorted (Mendel's second law).
 *
 * Source: Mendel's Law of Independent Assortment
 */
export function crossBreed(
  parent1: Partial<Record<string, [Allele, Allele]>>,
  parent2: Partial<Record<string, [Allele, Allele]>>,
  count: number,
  seed: number = 42
): Record<string, [Allele, Allele]>[] {
  const rng = createRNG(seed)
  const traits = new Set([...Object.keys(parent1), ...Object.keys(parent2)])
  const offspring: Record<string, [Allele, Allele]>[] = []

  for (let i = 0; i < count; i++) {
    const child: Record<string, [Allele, Allele]> = {}
    for (const trait of traits) {
      const p1Alleles = parent1[trait] ?? ['r', 'r'] as [Allele, Allele]
      const p2Alleles = parent2[trait] ?? ['r', 'r'] as [Allele, Allele]
      child[trait] = crossTrait(p1Alleles, p2Alleles, rng)
    }
    offspring.push(child)
  }

  return offspring
}

/**
 * Create a full genetic profile for cross-breeding.
 */
export function crossGeneticProfiles(
  parent1: GeneticProfile,
  parent2: GeneticProfile,
  rng: SeededRNG
): GeneticProfile {
  return {
    fruitColor: crossTrait(parent1.fruitColor, parent2.fruitColor, rng),
    size: crossTrait(parent1.size, parent2.size, rng),
    sweetness: crossTrait(parent1.sweetness, parent2.sweetness, rng),
    diseaseResistance: crossTrait(parent1.diseaseResistance, parent2.diseaseResistance, rng),
    droughtTolerance: crossTrait(parent1.droughtTolerance, parent2.droughtTolerance, rng),
  }
}

/**
 * Default genetic profile (heterozygous for all traits).
 */
export function defaultGeneticProfile(): GeneticProfile {
  return {
    fruitColor: ['R', 'r'],
    size: ['S', 's'],
    sweetness: ['W', 'w'],
    diseaseResistance: ['D', 'd'],
    droughtTolerance: ['T', 't'],
  }
}
