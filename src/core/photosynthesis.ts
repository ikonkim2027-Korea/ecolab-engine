import { PlantSpecies, EnvironmentState, PlantState } from '../types.js'
import { MAX_PAR } from '../constants.js'

/**
 * Non-rectangular hyperbola model for light response of photosynthesis.
 * Simplified from Farquhar et al. (1980) for educational context.
 *
 * A = (φ·I + Amax - √((φ·I + Amax)² - 4·θ·φ·I·Amax)) / (2·θ)
 *
 * All values in µmol CO₂ m⁻² s⁻¹ internally, output normalized to 0–1.
 *
 * Source: Thornley, J.H.M. (1976) Mathematical Models in Plant Physiology
 * Source: Johnson & Thornley (1984) Plant and Crop Modelling
 */
export function lightResponseCurve(
  lightIntensity: number,
  species: PlantSpecies
): number {
  // lightIntensity is 0–1 game scale, convert to PAR (µmol photons/m²/s)
  const I = Math.max(0, lightIntensity) * MAX_PAR
  const phi = species.quantumYield   // quantum yield (mol CO₂ / mol photons), ~0.05
  const Amax = species.Amax          // µmol CO₂ m⁻² s⁻¹ (real units: 18–40)
  const theta = species.curvatureFactor // curvature 0.7–0.9

  if (I <= 0 || Amax <= 0) return 0

  const phiI = phi * I
  const sum = phiI + Amax
  const discriminant = sum * sum - 4 * theta * phiI * Amax

  // Guard against floating point issues
  if (discriminant < 0) return 1.0

  const A = (sum - Math.sqrt(discriminant)) / (2 * theta)
  // Normalize to 0–1 by dividing by Amax
  return Math.min(1, Math.max(0, A / Amax))
}

/**
 * CO₂ response using Michaelis-Menten kinetics.
 *
 * C3 plants: Km ≈ 200 ppm — strongly respond to elevated CO₂
 * C4 plants: Km ≈ 30 ppm — already CO₂-saturated at ambient (~410 ppm)
 *
 * Source: Ainsworth & Long (2005) New Phytologist — FACE experiment meta-analysis
 * Source: von Caemmerer & Furbank (2003) — C4 photosynthesis model
 */
export function co2ResponseFactor(co2: number, species: PlantSpecies): number {
  if (co2 <= 0) return 0
  const Km = species.co2Km
  return co2 / (co2 + Km)
}

/**
 * Stomatal conductance modifier based on plant water status.
 * When water content drops, stomata close to conserve water,
 * which reduces CO₂ intake and thus photosynthesis.
 *
 * Source: Tardieu & Simonneau (1998) — stomatal regulation models
 */
export function stomatalConductance(waterContent: number): number {
  if (waterContent >= 0.6) return 1.0
  if (waterContent <= 0.1) return 0.05
  // Sigmoidal response between 0.1 and 0.6
  const normalized = (waterContent - 0.1) / 0.5
  return 0.05 + 0.95 * (normalized * normalized)
}

/**
 * Main photosynthesis rate calculation.
 * Integrates light response, CO₂ response, stomatal conductance, and leaf area.
 *
 * Returns normalized rate 0–1 representing fraction of maximum possible growth.
 */
export function photosynthesisRate(
  env: EnvironmentState,
  species: PlantSpecies,
  plant?: Partial<PlantState>
): number {
  const lightFactor = lightResponseCurve(env.lightIntensity, species)
  const co2Factor = co2ResponseFactor(env.co2, species)

  // Normalize CO₂ factor relative to ambient response
  // so that at ambient CO₂ (410 ppm), co2 contribution is ~1.0
  const ambientCo2Factor = co2ResponseFactor(410, species)
  const relativeCo2 = ambientCo2Factor > 0 ? co2Factor / ambientCo2Factor : 1

  const waterFactor = plant?.waterContent !== undefined
    ? stomatalConductance(plant.waterContent)
    : 1.0

  // Leaf area modifier: scales photosynthesis with canopy size
  // Minimum of 0.1 ensures seeds/seedlings can still grow (stored energy + cotyledons)
  const leafArea = plant?.leafArea !== undefined ? plant.leafArea : 1.0
  const leafModifier = Math.max(0.1, Math.min(1, leafArea / species.maxLeafArea))

  return lightFactor * Math.min(relativeCo2, 2.0) * waterFactor * leafModifier
}
