import {
  PlantState, SoilState, EnvironmentState, EcosystemState,
  GrowthStage, PlantSpecies, StressState, FullSimulationState,
} from '../types.js'
import { MAX_STRESS, HEALTH_RECOVERY_RATE, HEALTH_DECAY_RATE, SOIL_TEMP_LAG, ORGANIC_DECOMPOSITION_RATE, ORGANIC_NPK_RELEASE, WATERLOG_DAMAGE_RATE } from '../constants.js'
import { photosynthesisRate } from './photosynthesis.js'
import { nutrientFactor, nutrientToxicity, consumeNutrients, effectiveNutrient, michaelisMenten } from './nutrients.js'
import { waterStressModifier, updateSoilMoisture, updatePlantWater, isWaterlogged } from './water.js'
import { temperatureResponse, isLethalTemperature, temperatureStress, pollinationSuccess, updateSoilTemperature } from './temperature.js'
import { updateEcosystem, pestDamage } from './pests.js'
import { getSpecies } from '../species/index.js'
import { defaultGeneticProfile } from './genetics.js'

/**
 * Core growth tick function.
 * Runs every game tick and updates plant + soil state.
 *
 * ALL growth factors are multiplicative (0–1 each).
 * If ANY factor is 0, growth is 0 — creating realistic bottleneck behavior.
 *
 * growthPoints = baseGrowth × nutrientFactor × waterFactor × tempFactor × healthFactor × stressFactor × dt
 */
export function tick(
  plant: PlantState,
  soil: SoilState,
  env: EnvironmentState,
  dt: number,
  ecosystem?: EcosystemState,
  species?: PlantSpecies
): { plant: PlantState; soil: SoilState; ecosystem?: EcosystemState } {
  // Resolve species
  const sp = species ?? getSpecies(plant.species)
  if (!sp) throw new Error(`Unknown species: ${plant.species}`)

  // Dead plants don't update
  if (!plant.isAlive) return { plant, soil, ecosystem }

  // Clone to avoid mutation
  let p = deepClonePlant(plant)
  let s = { ...soil }
  let eco = ecosystem ? { ...ecosystem } : undefined

  // ── Check lethal temperature ─────────────────────────────────
  if (isLethalTemperature(env.airTemperature, sp.temperatureProfile)) {
    p.isAlive = false
    p.stage = GrowthStage.Dead
    p.health = 0
    return { plant: p, soil: s, ecosystem: eco }
  }

  // ── Calculate growth factors ─────────────────────────────────

  // 1. Photosynthesis (light + CO₂ + stomatal conductance)
  const baseGrowth = photosynthesisRate(env, sp, p)

  // 2. Nutrient limitation (Liebig's Law)
  const nutFactor = nutrientFactor(
    { nitrogen: s.nitrogen, phosphorus: s.phosphorus, potassium: s.potassium },
    sp, p.stage, s.pH
  )

  // 3. Water stress
  const waterFactor = waterStressModifier(s.moisture, sp)

  // 4. Temperature response
  const tempFactor = temperatureResponse(env.airTemperature, sp.temperatureProfile)

  // 5. Health factor
  const healthFactor = p.health / 100

  // 6. Stress factor
  const stressFactor = Math.max(0, 1 - (p.stressAccumulator.total / MAX_STRESS))

  // ── Calculate growth points ──────────────────────────────────
  // Scale photosynthesis output to game-appropriate growth rate.
  // Raw photosynthesisRate is 0–1; we multiply by a base rate constant
  // to produce ~1 growth point/tick under optimal conditions for mature plants.
  const BASE_GROWTH_RATE = 1.8
  const growthPoints = baseGrowth * nutFactor * waterFactor * tempFactor * healthFactor * stressFactor * BASE_GROWTH_RATE * dt

  p.growthPoints += growthPoints
  p.totalGrowthPoints += growthPoints
  p.age += dt

  // ── Stage transitions ────────────────────────────────────────
  p = advanceStage(p, sp)

  // ── Update soil ──────────────────────────────────────────────

  // Save pre-update moisture for stress calculations (waterlog detection)
  const preMoisture = s.moisture

  // Soil moisture
  s.moisture = updateSoilMoisture(s, env, sp, p, dt)

  // Soil temperature
  s.temperature = updateSoilTemperature(s.temperature, env.airTemperature, SOIL_TEMP_LAG)

  // Nutrient consumption
  s = consumeNutrients(s, sp, p.stage, dt)

  // Organic matter decomposition → slow NPK release
  if (s.organicMatter > 0 && s.microbeHealth > 0) {
    const decomp = ORGANIC_DECOMPOSITION_RATE * s.microbeHealth * Math.max(0, s.temperature / 25) * dt
    const actualDecomp = Math.min(s.organicMatter, decomp)
    s.organicMatter -= actualDecomp
    s.nitrogen += actualDecomp * ORGANIC_NPK_RELEASE.N
    s.phosphorus += actualDecomp * ORGANIC_NPK_RELEASE.P
    s.potassium += actualDecomp * ORGANIC_NPK_RELEASE.K
  }

  // ── Update plant water content ───────────────────────────────
  p.waterContent = updatePlantWater(p, s, sp, dt)

  // ── Update leaf area and root depth ──────────────────────────
  // All pre-harvest stages develop leaves and roots (cotyledons → true leaves → canopy)
  if (p.stage !== GrowthStage.HarvestReady && p.stage !== GrowthStage.Dead) {
    // Phosphorus availability specifically controls root growth
    // Source: Lynch (2011) — root responses to low P
    const pEffective = effectiveNutrient('phosphorus', s)
    const pFactor = michaelisMenten(pEffective, sp.nutrientVmax.P, sp.nutrientKm.P)
    const pDemand = sp.nutrientDemand[p.stage]?.P ?? 0.3
    const pRootFactor = pDemand > 0 ? Math.min(1, pFactor / pDemand) : 1

    // Minimum growth rate from seed energy (cotyledon expansion)
    // Plants invest stored energy to bootstrap leaf area before they can photosynthesize efficiently
    const seedEnergyFactor = p.leafArea < sp.maxLeafArea * 0.3 ? 0.5 : 0
    const effectiveGrowth = growthPoints + seedEnergyFactor

    p.leafArea = Math.min(sp.maxLeafArea, p.leafArea + sp.leafGrowthRate * effectiveGrowth * dt)
    p.rootDepth = Math.min(sp.maxRootDepth, p.rootDepth + sp.rootGrowthRate * effectiveGrowth * pRootFactor * dt)
  }

  // ── Pollination ──────────────────────────────────────────────
  if (p.stage === GrowthStage.Flowering && sp.requiresPollination) {
    const tempPollFactor = pollinationSuccess(env.airTemperature, sp.temperatureProfile)
    const beeFactor = eco ? eco.beePopulation : 0.5
    p.pollinationRate = Math.min(1,
      sp.selfPollinationRate + (1 - sp.selfPollinationRate) * beeFactor
    ) * tempPollFactor
  }

  // ── Vernalization tracking ───────────────────────────────────
  if (sp.vernalizationRequired && env.airTemperature <= sp.vernalizationTempMax) {
    p.coldExposureTicks += dt
  }

  // ── Update stress accumulator ────────────────────────────────
  // Use pre-update moisture for waterlog detection (before drainage)
  p.stressAccumulator = updateStress(p, { ...s, moisture: preMoisture }, env, sp, eco)

  // ── Update health ────────────────────────────────────────────
  const totalStress = p.stressAccumulator.total
  if (totalStress > 0.1) {
    p.health = Math.max(0, p.health - totalStress * HEALTH_DECAY_RATE * dt)
  } else {
    // Recovery when stress is low
    p.health = Math.min(100, p.health + HEALTH_RECOVERY_RATE * dt)
  }

  // ── Check death ──────────────────────────────────────────────
  if (p.health <= 0) {
    p.isAlive = false
    p.stage = GrowthStage.Dead
    p.health = 0
  }

  // ── Update harvest quality ───────────────────────────────────
  // Quality tracks the average growing conditions over the plant's life
  // Potassium specifically affects fruit/harvest quality
  // Source: Marschner (2012) — K role in sugar transport and quality
  {
    const qualityFactor = nutFactor * waterFactor * tempFactor * healthFactor
    const kEffective = effectiveNutrient('potassium', s)
    const kFactor = Math.min(1, kEffective / 30)
    const kQualityWeight = (p.stage === GrowthStage.Fruiting || p.stage === GrowthStage.HarvestReady) ? 0.4 : 0.15
    const adjustedQuality = qualityFactor * (1 - kQualityWeight + kQualityWeight * kFactor)
    p.harvestQuality = p.harvestQuality * 0.97 + adjustedQuality * 100 * 0.03
  }

  // ── Update ecosystem ─────────────────────────────────────────
  if (eco) {
    eco = updateEcosystem(eco, dt)
  }

  return { plant: p, soil: s, ecosystem: eco }
}

/**
 * Advance growth stage when growth points exceed threshold.
 */
function advanceStage(plant: PlantState, species: PlantSpecies): PlantState {
  const stageOrder = [
    GrowthStage.Seed,
    GrowthStage.Germination,
    GrowthStage.Seedling,
    GrowthStage.Vegetative,
    GrowthStage.Flowering,
    GrowthStage.Fruiting,
    GrowthStage.HarvestReady,
  ]

  const currentIdx = stageOrder.indexOf(plant.stage)
  if (currentIdx < 0 || currentIdx >= stageOrder.length - 1) return plant

  const stageConfig = species.stages.find(s => s.stage === plant.stage)
  if (!stageConfig) return plant

  // Vernalization gate: can't enter flowering without cold exposure
  if (stageOrder[currentIdx + 1] === GrowthStage.Flowering &&
      species.vernalizationRequired &&
      plant.coldExposureTicks < species.vernalizationTicks) {
    return plant
  }

  if (plant.growthPoints >= stageConfig.threshold) {
    // Check if species skips this stage (threshold 0 on next stage means skip)
    let nextIdx = currentIdx + 1
    // Skip stages that don't apply (e.g., lettuce skips flowering/fruiting)
    while (nextIdx < stageOrder.length - 1) {
      const nextStage = stageOrder[nextIdx]
      const nextConfig = species.stages.find(s => s.stage === nextStage)
      if (!nextConfig || nextConfig.threshold === 0) {
        // This is the terminal stage or should be skipped
        if (nextStage === GrowthStage.HarvestReady) {
          return { ...plant, stage: GrowthStage.HarvestReady, growthPoints: 0 }
        }
        nextIdx++
        continue
      }
      break
    }

    if (nextIdx < stageOrder.length) {
      return {
        ...plant,
        stage: stageOrder[nextIdx],
        growthPoints: plant.growthPoints - stageConfig.threshold,
      }
    }
  }

  return plant
}

/**
 * Update stress accumulator based on current conditions.
 */
function updateStress(
  plant: PlantState,
  soil: SoilState,
  env: EnvironmentState,
  species: PlantSpecies,
  ecosystem?: EcosystemState
): StressState {
  const stress: StressState = { ...plant.stressAccumulator }

  // Drought stress
  if (soil.moisture < species.waterProfile.stomatalClosureThreshold) {
    const severity = 1 - (soil.moisture - species.waterProfile.permanentWiltPoint) /
      (species.waterProfile.stomatalClosureThreshold - species.waterProfile.permanentWiltPoint)
    stress.drought = Math.min(1, Math.max(0, severity))
  } else {
    stress.drought = Math.max(0, stress.drought - 0.05) // recovery
  }

  // Temperature stress
  const tempStress = temperatureStress(env.airTemperature, species.temperatureProfile)
  stress.heat = tempStress.heat
  stress.cold = tempStress.cold

  // Waterlog stress
  if (isWaterlogged(soil.moisture)) {
    stress.waterlog = Math.min(1, stress.waterlog + WATERLOG_DAMAGE_RATE)
  } else {
    stress.waterlog = Math.max(0, stress.waterlog - 0.02)
  }

  // Nutrient deficiency stress
  // Compare effective available nutrients against demand
  const demand = species.nutrientDemand[plant.stage]
  if (demand) {
    const nEffective = effectiveNutrient('nitrogen', soil)
    const pEffective = effectiveNutrient('phosphorus', soil)
    const kEffective = effectiveNutrient('potassium', soil)

    // Scale: demand * 30 ppm = optimal supply level
    const nSupply = demand.N > 0 ? Math.min(1, nEffective / (demand.N * 30)) : 1
    const pSupply = demand.P > 0 ? Math.min(1, pEffective / (demand.P * 30)) : 1
    const kSupply = demand.K > 0 ? Math.min(1, kEffective / (demand.K * 30)) : 1

    stress.nitrogenDeficiency = Math.max(0, 1 - nSupply)
    stress.phosphorusDeficiency = Math.max(0, 1 - pSupply)
    stress.potassiumDeficiency = Math.max(0, 1 - kSupply)
  }

  // Nutrient toxicity
  stress.nutrientToxicity = nutrientToxicity(soil, species)

  // Pest damage
  if (ecosystem) {
    stress.pestDamage = pestDamage(ecosystem.pestPopulation)
  }

  // Total stress (capped at 1)
  // Each stress contributes proportionally to overall plant damage
  stress.total = Math.min(1,
    stress.drought * 0.20 +
    stress.heat * 0.15 +
    stress.cold * 0.15 +
    stress.waterlog * 0.15 +
    stress.nitrogenDeficiency * 0.10 +
    stress.phosphorusDeficiency * 0.08 +
    stress.potassiumDeficiency * 0.07 +
    stress.nutrientToxicity * 0.20 +
    stress.pestDamage * 0.10
  )

  return stress
}

// ── Factory Functions ────────────────────────────────────────────

/**
 * Create a new plant in seed stage.
 */
export function createPlant(speciesName: string): PlantState {
  return {
    species: speciesName,
    stage: GrowthStage.Seed,
    growthPoints: 0,
    totalGrowthPoints: 0,
    health: 100,
    stressAccumulator: createEmptyStress(),
    age: 0,
    waterContent: 0.5,
    nutrientStore: { N: 0, P: 0, K: 0 },
    isAlive: true,
    rootDepth: 1,
    leafArea: 0.01,
    pollinationRate: 0,
    geneticTraits: defaultGeneticProfile(),
    harvestQuality: 80, // starts at reasonable default
    coldExposureTicks: 0,
  }
}

/**
 * Create optimal soil for a species.
 */
export function createOptimalSoil(speciesName: string): SoilState {
  const sp = getSpecies(speciesName)
  return {
    moisture: sp ? sp.waterProfile.optimalMoisture : 0.30,
    pH: 6.5,
    nitrogen: 60,
    phosphorus: 40,
    potassium: 50,
    organicMatter: 3,
    temperature: sp ? sp.temperatureProfile.Topt : 22,
    microbeHealth: 0.7,
  }
}

/**
 * Create optimal environment for a species.
 */
export function createOptimalEnvironment(speciesName: string): EnvironmentState {
  const sp = getSpecies(speciesName)
  return {
    airTemperature: sp ? sp.temperatureProfile.Topt : 22,
    lightIntensity: 0.7,
    co2: 410,
    humidity: 0.6,
    windSpeed: 2,
    rainfall: 2,
    isRaining: false,
    dayLength: 14,
    season: 'summer' as any,
    dayOfSeason: 45,
  }
}

/**
 * Create default ecosystem state.
 */
export function createDefaultEcosystem(): EcosystemState {
  return {
    pestPopulation: 0.05,
    beneficialInsects: 0.5,
    beePopulation: 0.6,
    biodiversityScore: 0.5,
    weedCoverage: 0,
  }
}

function createEmptyStress(): StressState {
  return {
    drought: 0,
    heat: 0,
    cold: 0,
    nitrogenDeficiency: 0,
    phosphorusDeficiency: 0,
    potassiumDeficiency: 0,
    nutrientToxicity: 0,
    pestDamage: 0,
    waterlog: 0,
    total: 0,
  }
}

function deepClonePlant(plant: PlantState): PlantState {
  return {
    ...plant,
    stressAccumulator: { ...plant.stressAccumulator },
    nutrientStore: { ...plant.nutrientStore },
    geneticTraits: {
      fruitColor: [...plant.geneticTraits.fruitColor] as [string, string],
      size: [...plant.geneticTraits.size] as [string, string],
      sweetness: [...plant.geneticTraits.sweetness] as [string, string],
      diseaseResistance: [...plant.geneticTraits.diseaseResistance] as [string, string],
      droughtTolerance: [...plant.geneticTraits.droughtTolerance] as [string, string],
    },
  }
}

// ── Helper for testing ─────────────────────────────────────────

/**
 * Run simulation for N ticks and return final state.
 */
export function simulateNTicks(
  speciesName: string,
  ticks: number,
  dt: number,
  envOverrides?: Partial<EnvironmentState>,
  soilOverrides?: Partial<SoilState>
): FullSimulationState {
  let plant = createPlant(speciesName)
  let soil = { ...createOptimalSoil(speciesName), ...soilOverrides }
  const env = { ...createOptimalEnvironment(speciesName), ...envOverrides }
  let ecosystem = createDefaultEcosystem()

  const species = getSpecies(speciesName)!

  for (let i = 0; i < ticks; i++) {
    // Maintain soil moisture at optimal for "optimal" simulation
    const result = tick(plant, soil, env, dt, ecosystem, species)
    plant = result.plant
    soil = result.soil
    if (result.ecosystem) ecosystem = result.ecosystem
  }

  return { plant, soil, environment: env, ecosystem }
}
