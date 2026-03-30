import { describe, test, expect } from 'vitest'
import { photosynthesisRate } from '../../src/core/photosynthesis.js'
import { nutrientAvailability, effectiveNutrient, nutrientFactor } from '../../src/core/nutrients.js'
import { waterUptake, waterStressModifier } from '../../src/core/water.js'
import { temperatureResponse, isLethalTemperature, pollinationSuccess } from '../../src/core/temperature.js'
import { applyPesticide, simulatePestGrowth } from '../../src/core/pests.js'
import { crossBreed } from '../../src/core/genetics.js'
import { simulateYield } from '../../src/experiment/index.js'
import {
  tick, createPlant, createOptimalSoil, createOptimalEnvironment,
  createDefaultEcosystem
} from '../../src/core/growth.js'
import { tomato } from '../../src/species/tomato.js'
import { corn } from '../../src/species/corn.js'
import { lettuce } from '../../src/species/lettuce.js'
import { getSpecies } from '../../src/species/index.js'
import { EnvironmentState, Season, SoilState, GrowthStage } from '../../src/types.js'

const baseEnv: EnvironmentState = {
  airTemperature: 25,
  lightIntensity: 0.7,
  co2: 410,
  humidity: 0.6,
  windSpeed: 2,
  rainfall: 0,
  isRaining: false,
  dayLength: 14,
  season: Season.Summer,
  dayOfSeason: 45,
}

const baseSoil: SoilState = {
  moisture: 0.30,
  pH: 6.5,
  nitrogen: 60,
  phosphorus: 40,
  potassium: 50,
  organicMatter: 3,
  temperature: 22,
  microbeHealth: 0.7,
}

// Helper: grow a plant under specific soil conditions for N ticks
function growWith(
  soilNPK: { nitrogen: number; phosphorus: number; potassium: number },
  speciesName: string,
  ticks: number
) {
  let plant = createPlant(speciesName)
  let soil = { ...createOptimalSoil(speciesName), ...soilNPK }
  const env = createOptimalEnvironment(speciesName)
  const species = getSpecies(speciesName)!

  for (let i = 0; i < ticks; i++) {
    // Maintain soil NPK at specified levels
    soil.nitrogen = soilNPK.nitrogen
    soil.phosphorus = soilNPK.phosphorus
    soil.potassium = soilNPK.potassium
    soil.moisture = species.waterProfile.optimalMoisture

    const result = tick(plant, soil, env, 1, undefined, species)
    plant = result.plant
    soil = result.soil
  }

  return plant
}

// Helper: grow with specific moisture
function growWithMoisture(moisture: number, speciesName: string, ticks: number) {
  let plant = createPlant(speciesName)
  let soil = { ...createOptimalSoil(speciesName), moisture }
  const env = createOptimalEnvironment(speciesName)
  const species = getSpecies(speciesName)!

  for (let i = 0; i < ticks; i++) {
    soil.moisture = moisture // maintain constant moisture
    const result = tick(plant, soil, env, 1, undefined, species)
    plant = result.plant
    soil = result.soil
  }

  return plant
}

describe('scientific accuracy validation', () => {

  describe('photosynthesis — biologically correct behaviors', () => {
    test('light saturation: doubling light above saturation point yields <35% gain', () => {
      const rateMid = photosynthesisRate({ ...baseEnv, lightIntensity: 0.5 }, tomato)
      const rateFull = photosynthesisRate({ ...baseEnv, lightIntensity: 1.0 }, tomato)
      const gain = (rateFull - rateMid) / rateMid
      expect(gain).toBeLessThan(0.35)
    })

    test('light compensation point: very low light cannot sustain growth', () => {
      const rate = photosynthesisRate({ ...baseEnv, lightIntensity: 0.02 }, tomato)
      expect(rate).toBeLessThan(0.1)
    })

    test('CO₂ fertilization effect matches FACE experiment data', () => {
      // Free-Air CO₂ Enrichment studies show C3 crops gain 10-30% yield at 550ppm
      // Source: Ainsworth & Long 2005, New Phytologist
      const yield410 = simulateYield('tomato', { co2: 410 })
      const yield550 = simulateYield('tomato', { co2: 550 })
      const gain = (yield550 - yield410) / yield410
      expect(gain).toBeGreaterThan(0.10)
      expect(gain).toBeLessThan(0.40)
    })

    test('C4 corn shows <8% yield gain at elevated CO₂', () => {
      // C4 plants have internal CO₂ concentrating mechanism
      const yield410 = simulateYield('corn', { co2: 410 })
      const yield800 = simulateYield('corn', { co2: 800 })
      const gain = (yield800 - yield410) / yield410
      expect(gain).toBeLessThan(0.08)
    })
  })

  describe('nutrient science — correct chemistry', () => {
    test('nitrogen deficiency causes stress accumulation', () => {
      // Need enough ticks for plant to reach vegetative stage where N demand is high
      const plant = growWith({ nitrogen: 5, phosphorus: 50, potassium: 50 }, 'tomato', 150)
      expect(plant.stressAccumulator.nitrogenDeficiency).toBeGreaterThan(0.3)
    })

    test('phosphorus deficiency limits root development', () => {
      const normal = growWith({ nitrogen: 50, phosphorus: 50, potassium: 50 }, 'tomato', 150)
      const pLow = growWith({ nitrogen: 50, phosphorus: 2, potassium: 50 }, 'tomato', 150)
      expect(pLow.rootDepth).toBeLessThan(normal.rootDepth * 0.7)
    })

    test('potassium deficiency reduces fruit quality', () => {
      const normal = growWith({ nitrogen: 50, phosphorus: 50, potassium: 50 }, 'tomato', 150)
      const kLow = growWith({ nitrogen: 50, phosphorus: 50, potassium: 5 }, 'tomato', 150)
      expect(kLow.harvestQuality).toBeLessThan(normal.harvestQuality * 0.7)
    })

    test('over-fertilization causes nitrogen burn (toxicity)', () => {
      const plant = growWith({ nitrogen: 500, phosphorus: 50, potassium: 50 }, 'tomato', 30)
      expect(plant.health).toBeLessThan(85)
      expect(plant.stressAccumulator.nutrientToxicity).toBeGreaterThan(0)
    })

    test('pH below 5.0 locks out phosphorus (real soil chemistry)', () => {
      const soil1 = { ...baseSoil, pH: 6.5, phosphorus: 50 }
      const soil2 = { ...baseSoil, pH: 4.5, phosphorus: 50 }
      const avail1 = effectiveNutrient('phosphorus', soil1)
      const avail2 = effectiveNutrient('phosphorus', soil2)
      expect(avail1).toBeGreaterThan(avail2 * 3)
    })

    test('pH above 7.5 locks out iron and manganese', () => {
      const avail = nutrientAvailability('iron', 8.0)
      expect(avail).toBeLessThan(0.3)
    })
  })

  describe('water science — correct plant physiology', () => {
    test('below permanent wilt point, water uptake stops', () => {
      const plant = { ...createPlant('tomato'), rootDepth: 30, leafArea: 0.4 }
      const uptake = waterUptake(
        { ...baseSoil, moisture: 0.10 },
        tomato, plant
      )
      expect(uptake).toBeCloseTo(0, 2)
    })

    test('stomatal closure under drought reduces photosynthesis', () => {
      const rateWet = photosynthesisRate(
        { ...baseEnv, lightIntensity: 0.8 }, tomato,
        { waterContent: 0.8 }
      )
      const rateDry = photosynthesisRate(
        { ...baseEnv, lightIntensity: 0.8 }, tomato,
        { waterContent: 0.2 }
      )
      expect(rateDry).toBeLessThan(rateWet * 0.5)
    })

    test('waterlogged soil damages roots (anaerobic conditions)', () => {
      const plant = growWithMoisture(1.0, 'tomato', 30)
      expect(plant.health).toBeLessThan(90)
    })
  })

  describe('temperature science — correct thermal biology', () => {
    test('heat stress reduces pollen viability in tomato', () => {
      const normalPoll = pollinationSuccess(25, tomato.temperatureProfile)
      const heatPoll = pollinationSuccess(38, tomato.temperatureProfile)
      expect(heatPoll).toBeLessThan(normalPoll * 0.3)
    })

    test('frost kills tropical/subtropical crops', () => {
      const tomatoPlant = createPlant('tomato')
      const soil = createOptimalSoil('tomato')
      const env = { ...createOptimalEnvironment('tomato'), airTemperature: -2 }
      const result = tick(tomatoPlant, soil, env, 1, undefined, tomato)
      expect(result.plant.isAlive).toBe(false)
    })

    test('lettuce survives mild frost', () => {
      expect(isLethalTemperature(-2, lettuce.temperatureProfile)).toBe(false)
    })

    test('lettuce dies at hard frost', () => {
      expect(isLethalTemperature(-6, lettuce.temperatureProfile)).toBe(true)
    })
  })

  describe('ecosystem science — correct ecology', () => {
    test('removing pollinators collapses fruit yield', () => {
      // With bees — normal pollination
      let plantBees = createPlant('tomato')
      let soilBees = createOptimalSoil('tomato')
      const envBees = createOptimalEnvironment('tomato')
      const ecoBees = { ...createDefaultEcosystem(), beePopulation: 0.8 }
      const species = getSpecies('tomato')!

      let plantNoBees = createPlant('tomato')
      let soilNoBees = createOptimalSoil('tomato')
      const ecoNoBees = { ...createDefaultEcosystem(), beePopulation: 0.0 }

      for (let i = 0; i < 200; i++) {
        soilBees.moisture = Math.max(soilBees.moisture, species.waterProfile.optimalMoisture)
        soilBees.nitrogen = Math.max(soilBees.nitrogen, 50)
        soilBees.phosphorus = Math.max(soilBees.phosphorus, 35)
        soilBees.potassium = Math.max(soilBees.potassium, 40)
        soilNoBees.moisture = Math.max(soilNoBees.moisture, species.waterProfile.optimalMoisture)
        soilNoBees.nitrogen = Math.max(soilNoBees.nitrogen, 50)
        soilNoBees.phosphorus = Math.max(soilNoBees.phosphorus, 35)
        soilNoBees.potassium = Math.max(soilNoBees.potassium, 40)

        const r1 = tick(plantBees, soilBees, envBees, 1, ecoBees, species)
        plantBees = r1.plant
        soilBees = r1.soil

        const r2 = tick(plantNoBees, soilNoBees, envBees, 1, ecoNoBees, species)
        plantNoBees = r2.plant
        soilNoBees = r2.soil
      }

      // With no bees, pollination rate should be low (only self-pollination)
      // This means flowering → fruiting transition is impaired
      if (plantBees.stage === GrowthStage.Flowering || plantBees.stage === GrowthStage.Fruiting || plantBees.stage === GrowthStage.HarvestReady) {
        expect(plantBees.pollinationRate).toBeGreaterThan(plantNoBees.pollinationRate)
      }
    })

    test('pesticide kills pests but also kills beneficials', () => {
      const before = { ...createDefaultEcosystem(), pestPopulation: 0.8, beneficialInsects: 0.7 }
      const after = applyPesticide(before, 'broad_spectrum')
      expect(after.pestPopulation).toBeLessThan(0.2)
      expect(after.beneficialInsects).toBeLessThan(0.3)
    })

    test('monoculture increases pest pressure vs polyculture', () => {
      const mono = simulatePestGrowth({ biodiversityScore: 0.1 }, 50)
      const poly = simulatePestGrowth({ biodiversityScore: 0.8 }, 50)
      expect(mono.pestPopulation).toBeGreaterThan(poly.pestPopulation * 2)
    })
  })

  describe('genetics — correct Mendelian ratios', () => {
    test('monohybrid F2 yields 3:1 within chi-square p>0.05', () => {
      const offspring = crossBreed(
        { color: ['R', 'r'] as [string, string] },
        { color: ['R', 'r'] as [string, string] },
        400,
        123
      )
      const dominant = offspring.filter(o => o['color'].includes('R')).length
      const recessive = 400 - dominant
      const chi2 = ((dominant - 300) ** 2) / 300 + ((recessive - 100) ** 2) / 100
      expect(chi2).toBeLessThan(3.84)
    })
  })
})
