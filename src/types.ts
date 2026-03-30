// ── Growth Stages ──────────────────────────────────────────────────
export enum GrowthStage {
  Seed = 'seed',
  Germination = 'germination',
  Seedling = 'seedling',
  Vegetative = 'vegetative',
  Flowering = 'flowering',
  Fruiting = 'fruiting',
  HarvestReady = 'harvest_ready',
  Dead = 'dead',
}

// ── Seasons ────────────────────────────────────────────────────────
export enum Season {
  Spring = 'spring',
  Summer = 'summer',
  Autumn = 'autumn',
  Winter = 'winter',
}

// ── Photosynthesis Pathway ─────────────────────────────────────────
export type PhotosynthesisPathway = 'C3' | 'C4'

// ── Difficulty ─────────────────────────────────────────────────────
export type Difficulty = 'easy' | 'normal' | 'hard'

// ── Genetic Allele ─────────────────────────────────────────────────
export type Allele = string // Single character like 'R', 'r', 'S', 's'

export interface GeneticProfile {
  fruitColor: [Allele, Allele]
  size: [Allele, Allele]
  sweetness: [Allele, Allele]
  diseaseResistance: [Allele, Allele]
  droughtTolerance: [Allele, Allele]
}

// ── Stress State ───────────────────────────────────────────────────
export interface StressState {
  drought: number            // 0–1
  heat: number               // 0–1
  cold: number               // 0–1
  nitrogenDeficiency: number // 0–1
  phosphorusDeficiency: number // 0–1
  potassiumDeficiency: number  // 0–1
  nutrientToxicity: number   // 0–1
  pestDamage: number         // 0–1
  waterlog: number           // 0–1
  total: number              // computed sum capped at 1
}

// ── Plant State ────────────────────────────────────────────────────
export interface PlantState {
  species: string
  stage: GrowthStage
  growthPoints: number           // accumulated toward next stage
  totalGrowthPoints: number      // lifetime total
  health: number                 // 0–100
  stressAccumulator: StressState
  age: number                    // ticks since planting
  waterContent: number           // internal hydration 0–1
  nutrientStore: { N: number; P: number; K: number }
  isAlive: boolean
  rootDepth: number              // cm, grows over time
  leafArea: number               // m², grows over time
  pollinationRate: number        // 0–1, relevant in flowering stage
  geneticTraits: GeneticProfile
  harvestQuality: number         // 0–100
  coldExposureTicks: number      // for vernalization tracking
}

// ── Soil State ─────────────────────────────────────────────────────
export interface SoilState {
  moisture: number        // 0–1
  pH: number              // realistic range 4–9
  nitrogen: number        // ppm
  phosphorus: number      // ppm
  potassium: number       // ppm
  organicMatter: number   // percentage 0–10
  temperature: number     // °C (soil temp, lags air temp)
  microbeHealth: number   // 0–1 (affects decomposition rate)
}

// ── Environment State ──────────────────────────────────────────────
export interface EnvironmentState {
  airTemperature: number   // °C
  lightIntensity: number   // 0–1 (0 = night, 1 = full noon sun)
  co2: number              // ppm (default 410)
  humidity: number         // 0–1
  windSpeed: number        // m/s
  rainfall: number         // mm per tick
  isRaining: boolean
  dayLength: number        // hours of light (varies by season)
  season: Season
  dayOfSeason: number
}

// ── Temperature Profile (per species) ──────────────────────────────
export interface TemperatureProfile {
  Tmin: number        // °C, growth stops below
  Topt: number        // °C, maximum growth
  Tmax: number        // °C, growth stops above
  TlethalLow: number  // °C, plant dies below
  TlethalHigh: number // °C, plant dies above
}

// ── Stage Threshold ────────────────────────────────────────────────
export interface StageThreshold {
  stage: GrowthStage
  threshold: number   // growth points needed to advance past this stage
}

// ── Nutrient Demand (per stage) ────────────────────────────────────
export interface NutrientDemand {
  N: number  // ppm required for optimal growth
  P: number
  K: number
}

// ── Water Profile (per species) ────────────────────────────────────
export interface WaterProfile {
  fieldCapacity: number             // soil moisture where drainage stops (~0.35)
  permanentWiltPoint: number        // below this, plant cannot extract water (~0.15)
  stomatalClosureThreshold: number  // moisture level where stomata close
  optimalMoisture: number           // ideal soil moisture for this species
  transpirationRate: number         // base transpiration coefficient
}

// ── Plant Species Definition ───────────────────────────────────────
export interface PlantSpecies {
  name: string
  tier: 1 | 2 | 3 | 4
  pathway: PhotosynthesisPathway
  stages: StageThreshold[]
  temperatureProfile: TemperatureProfile
  waterProfile: WaterProfile
  nutrientDemand: Record<GrowthStage, NutrientDemand>

  // Photosynthesis parameters
  quantumYield: number     // φ (mol/mol), ~0.05 for C3, ~0.065 for C4
  Amax: number             // light-saturated rate (normalized 0–1 scale)
  curvatureFactor: number  // θ (0.7–0.9)
  co2Km: number            // Michaelis constant for CO₂ (ppm)

  // Nutrient uptake kinetics
  nutrientVmax: { N: number; P: number; K: number }  // max uptake rates
  nutrientKm: { N: number; P: number; K: number }    // half-saturation constants

  // Growth parameters
  maxLeafArea: number      // m² at maturity
  maxRootDepth: number     // cm at maturity
  leafGrowthRate: number   // m²/tick during vegetative stage
  rootGrowthRate: number   // cm/tick during vegetative/seedling

  // Pollination
  requiresPollination: boolean
  selfPollinationRate: number  // 0–1, rate if no external pollinators

  // Vernalization (cold requirement for flowering)
  vernalizationRequired: boolean
  vernalizationTicks: number    // cold ticks needed
  vernalizationTempMax: number  // max temp that counts as cold

  // Toxicity thresholds
  nutrientToxicityThreshold: { N: number; P: number; K: number } // ppm above which toxicity occurs
}

// ── Pest/Ecosystem State ───────────────────────────────────────────
export interface EcosystemState {
  pestPopulation: number       // 0–1 normalized
  beneficialInsects: number    // 0–1
  beePopulation: number        // 0–1
  biodiversityScore: number    // 0–1
  weedCoverage: number         // 0–1
}

// ── Full Simulation State ──────────────────────────────────────────
export interface FullSimulationState {
  plant: PlantState
  soil: SoilState
  environment: EnvironmentState
  ecosystem: EcosystemState
}

// ── Neglect Report ─────────────────────────────────────────────────
export interface NeglectEvent {
  what: string
  why: string
  science: string
  recovery: string
}

export interface NeglectReport {
  hoursOffline: number
  events: NeglectEvent[]
  plantsLost: string[]
  plantsRecoverable: string[]
}

// ── Experiment Types ───────────────────────────────────────────────
export interface DataPoint {
  tick: number
  controlValue: number
  experimentValue: number
}

export interface Experiment {
  hypothesis: string
  controlGroup: { plant: PlantState; soil: SoilState; env: EnvironmentState }
  experimentalGroup: { plant: PlantState; soil: SoilState; env: EnvironmentState }
  changedVariable: string
  dataLog: DataPoint[]
}

// ── Amendment Types ────────────────────────────────────────────────
export type AmendmentType =
  | 'ammonium_nitrate'
  | 'bone_meal'
  | 'potash'
  | 'lime'
  | 'sulfur'
  | 'compost'

export type PesticideType = 'broad_spectrum' | 'targeted' | 'organic'

// ── Seeded RNG ─────────────────────────────────────────────────────
export interface SeededRNG {
  next(): number  // returns 0–1
}

// ── Nutrient Name ──────────────────────────────────────────────────
export type MacroNutrient = 'nitrogen' | 'phosphorus' | 'potassium'
export type MicroNutrient = 'iron' | 'manganese' | 'zinc'
export type NutrientName = MacroNutrient | MicroNutrient
