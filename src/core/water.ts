import { SoilState, EnvironmentState, PlantSpecies, PlantState } from '../types.js'
import { EVAPORATION_BASE_RATE, WIND_EVAPORATION_FACTOR, RUNOFF_RATE, WATERLOG_THRESHOLD } from '../constants.js'

/**
 * Soil moisture dynamics model.
 *
 * moisture_new = moisture_old + rainfall - evaporation - plant_uptake - runoff
 *
 * Source: FAO Irrigation and Drainage Paper 56 (Penman-Monteith)
 * Source: Campbell & Norman (1998) Environmental Biophysics
 */

/**
 * Calculate evaporation rate from soil surface.
 * E = k × (1 - humidity) × temperature_factor × wind_factor
 *
 * Source: Allen et al. (1998) FAO-56 reference evapotranspiration
 */
export function evaporationRate(env: EnvironmentState): number {
  const humidityFactor = 1 - env.humidity
  // Temperature effect: evaporation roughly doubles per 10°C above 15°C
  const tempFactor = Math.max(0, 1 + (env.airTemperature - 15) * 0.03)
  const windFactor = 1 + env.windSpeed * WIND_EVAPORATION_FACTOR

  return EVAPORATION_BASE_RATE * humidityFactor * tempFactor * windFactor
}

/**
 * Calculate plant water uptake (simplified osmotic model).
 *
 * water_flow = hydraulic_conductivity × (soil_water_potential - plant_water_potential)
 *
 * Simplified: uptake is proportional to soil moisture above permanent wilt point,
 * scaled by root depth, leaf area (transpiration surface), and stomatal state.
 *
 * Source: Tardieu & Davies (1993) — root-to-shoot ABA signaling model
 * Source: Tyree & Sperry (1989) — vulnerability to xylem cavitation
 */
export function waterUptake(
  soil: SoilState,
  species: PlantSpecies,
  plant: PlantState
): number {
  const pwp = species.waterProfile.permanentWiltPoint

  // Below permanent wilt point: no uptake possible
  if (soil.moisture <= pwp) return 0

  // Available water fraction: 0 at PWP, 1 at field capacity
  const fc = species.waterProfile.fieldCapacity
  const availableWater = Math.min(1, (soil.moisture - pwp) / (fc - pwp))

  // Root development factor: deeper roots access more water
  // Minimum of 0.15 — even seedlings with shallow roots access surface moisture
  const rootFactor = Math.max(0.15, Math.min(1, plant.rootDepth / species.maxRootDepth))

  // Transpiration: more leaf area = more water loss
  const leafFactor = Math.min(1, plant.leafArea / species.maxLeafArea)

  // Stomatal regulation
  const stomatalFactor = stomatalOpenness(soil.moisture, species)

  return species.waterProfile.transpirationRate * availableWater * rootFactor * leafFactor * stomatalFactor
}

/**
 * Stomatal openness based on soil moisture.
 * Stomata close progressively as soil dries to conserve water.
 *
 * Source: Jarvis (1976) — multiplicative stomatal model
 */
export function stomatalOpenness(soilMoisture: number, species: PlantSpecies): number {
  const threshold = species.waterProfile.stomatalClosureThreshold
  const pwp = species.waterProfile.permanentWiltPoint

  if (soilMoisture >= threshold) return 1.0
  if (soilMoisture <= pwp) return 0.0

  const range = threshold - pwp
  const fraction = (soilMoisture - pwp) / range
  // Quadratic response — stomata close progressively faster
  return fraction * fraction
}

/**
 * Water stress modifier for growth calculations.
 * Returns 0–1 factor.
 */
export function waterStressModifier(soilMoisture: number, species: PlantSpecies): number {
  const optimal = species.waterProfile.optimalMoisture
  const pwp = species.waterProfile.permanentWiltPoint
  const fc = species.waterProfile.fieldCapacity

  if (soilMoisture <= pwp) return 0
  if (soilMoisture < optimal) {
    // Drought stress — linear reduction
    return (soilMoisture - pwp) / (optimal - pwp)
  }
  if (soilMoisture <= fc) return 1.0
  if (soilMoisture <= WATERLOG_THRESHOLD) {
    // Slight waterlog stress above field capacity
    return 1.0 - 0.3 * ((soilMoisture - fc) / (WATERLOG_THRESHOLD - fc))
  }
  // Severe waterlog — anaerobic conditions
  return 0.5
}

/**
 * Check if soil is waterlogged (anaerobic conditions).
 * Saturated soil has no oxygen, causing root rot.
 *
 * Source: Kozlowski (1984) Flooding and Plant Growth
 */
export function isWaterlogged(soilMoisture: number): boolean {
  return soilMoisture >= WATERLOG_THRESHOLD
}

/**
 * Convert rainfall (mm) to soil moisture change.
 * Assumes a simplified soil column of ~30cm depth.
 * 1mm rainfall ≈ 0.003 volumetric water content increase
 *
 * Source: Hillel (2004) Environmental Soil Physics
 */
export function rainfallToMoisture(rainfallMm: number): number {
  return rainfallMm * 0.003
}

/**
 * Update soil moisture for one tick.
 */
export function updateSoilMoisture(
  soil: SoilState,
  env: EnvironmentState,
  species: PlantSpecies,
  plant: PlantState,
  dt: number
): number {
  let moisture = soil.moisture

  // Add rainfall
  if (env.isRaining && env.rainfall > 0) {
    moisture += rainfallToMoisture(env.rainfall) * dt
  }

  // Subtract evaporation
  moisture -= evaporationRate(env) * dt

  // Subtract plant uptake
  const uptake = waterUptake({ ...soil, moisture }, species, plant)
  moisture -= uptake * dt

  // Runoff: excess above saturation (1.0) runs off
  if (moisture > 1.0) {
    moisture = 1.0
  }

  // Field capacity drainage
  const fc = species.waterProfile.fieldCapacity
  if (moisture > fc) {
    moisture -= (moisture - fc) * RUNOFF_RATE * dt
  }

  return Math.max(0, Math.min(1, moisture))
}

/**
 * Update plant internal water content based on soil moisture and transpiration.
 * Transpiration is regulated by stomatal openness — when water is scarce,
 * stomata close, reducing both CO₂ intake and water loss.
 *
 * Source: Jarvis (1976) — multiplicative stomatal model
 */
export function updatePlantWater(
  plant: PlantState,
  soil: SoilState,
  species: PlantSpecies,
  dt: number
): number {
  const uptake = waterUptake(soil, species, plant)

  // Transpiration is proportional to leaf area AND stomatal openness
  // When stomata close (drought), transpiration drops too — this is the
  // plant's primary defense against desiccation.
  // Transpiration cannot exceed uptake — water balance is constrained.
  const stomatal = stomatalOpenness(soil.moisture, species)
  const leafFraction = Math.min(1, plant.leafArea / species.maxLeafArea)
  const rawTranspiration = species.waterProfile.transpirationRate * leafFraction * stomatal * 0.15
  // Transpiration is bounded by uptake — plants lose at most what they absorb
  // plus a small buffer from stored water
  const transpiration = Math.min(rawTranspiration, uptake + 0.002)

  let waterContent = plant.waterContent + (uptake - transpiration) * dt
  return Math.max(0, Math.min(1, waterContent))
}
