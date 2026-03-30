import { PlantSpecies } from '../types.js'
import { lettuce } from './lettuce.js'
import { tomato } from './tomato.js'
import { corn } from './corn.js'
import { grape } from './grape.js'

export { lettuce, tomato, corn, grape }

const speciesRegistry: Record<string, PlantSpecies> = {
  lettuce,
  tomato,
  corn,
  grape,
}

export function getSpecies(name: string): PlantSpecies | undefined {
  return speciesRegistry[name]
}

export function getAllSpecies(): PlantSpecies[] {
  return Object.values(speciesRegistry)
}

export function getSpeciesNames(): string[] {
  return Object.keys(speciesRegistry)
}
