import { TemperatureProfile } from '../types.js'

/**
 * Beta function model for plant temperature response.
 * Produces an asymmetric bell curve normalized so f(Topt) = 1.0.
 *
 * f(T) = ((T - Tmin) / (Topt - Tmin))^a × ((Tmax - T) / (Tmax - Topt))^b
 *
 * Where a and b shape the asymmetry.
 * Normalized by dividing by f(Topt) which equals (a/(a+b))^a × (b/(a+b))^b
 *
 * Source: Yin et al. (1995) — Beta model for crop temperature response
 * Source: Yan & Hunt (1999) — bilinear and beta function models
 */
export function temperatureResponse(
  temp: number,
  profile: TemperatureProfile
): number {
  const { Tmin, Topt, Tmax } = profile

  // Outside growth range: no growth
  if (temp <= Tmin || temp >= Tmax) return 0

  // Beta function shape parameters
  // Using a = (Topt - Tmin) and b = (Tmax - Topt) gives natural asymmetry
  const a = Topt - Tmin
  const b = Tmax - Topt

  if (a <= 0 || b <= 0) return 0

  const numerator1 = (temp - Tmin) / a
  const numerator2 = (Tmax - temp) / b

  if (numerator1 <= 0 || numerator2 <= 0) return 0

  const result = Math.pow(numerator1, a) * Math.pow(numerator2, b)

  // Normalize so f(Topt) = 1.0
  // At Topt: numerator1 = 1, numerator2 = 1, so f(Topt) = 1 × 1 = 1
  // Wait — need proper normalization factor
  // f(Topt) = ((Topt-Tmin)/a)^a × ((Tmax-Topt)/b)^b = 1^a × 1^b = 1
  // So the function is already normalized!

  return Math.max(0, Math.min(1, result))
}

/**
 * Check if temperature is lethal for the plant.
 *
 * Source: Levitt (1980) Responses of Plants to Environmental Stresses
 * - Tomato: lethal below ~2°C (chilling injury), above ~42°C (protein denaturation)
 * - Lettuce: tolerates mild frost down to -2°C
 * - Corn: tropical origin, lethal below ~4°C
 */
export function isLethalTemperature(
  temp: number,
  profile: TemperatureProfile
): boolean {
  return temp <= profile.TlethalLow || temp >= profile.TlethalHigh
}

/**
 * Heat stress on pollen viability.
 * Tomato pollen becomes non-viable above 35°C.
 *
 * Source: Peet et al. (1998) Journal of Experimental Botany
 * Source: Sato et al. (2006) — pollen thermotolerance in tomato
 */
export function pollinationSuccess(
  temp: number,
  profile: TemperatureProfile
): number {
  const { Topt, TlethalHigh } = profile

  // Optimal pollination around Topt
  if (temp <= Topt + 2 && temp >= Topt - 8) return 1.0

  // Heat reduces pollen viability
  const heatThreshold = Topt + 5 // typically ~30–35°C for most crops
  if (temp > heatThreshold) {
    const damage = (temp - heatThreshold) / (TlethalHigh - heatThreshold)
    return Math.max(0, 1 - damage * 2) // rapid decline
  }

  // Cold also reduces pollination
  if (temp < Topt - 8) {
    const coldDamage = (Topt - 8 - temp) / (Topt - 8 - profile.Tmin)
    return Math.max(0, 1 - coldDamage)
  }

  return 1.0
}

/**
 * Temperature stress accumulation rate.
 * Returns heat/cold stress values for the stress accumulator.
 */
export function temperatureStress(
  temp: number,
  profile: TemperatureProfile
): { heat: number; cold: number } {
  let heat = 0
  let cold = 0

  // Heat stress
  if (temp > profile.Topt + 3) {
    heat = Math.min(1, (temp - profile.Topt - 3) / (profile.TlethalHigh - profile.Topt - 3))
  }

  // Cold stress
  if (temp < profile.Topt - 5) {
    cold = Math.min(1, (profile.Topt - 5 - temp) / (profile.Topt - 5 - profile.TlethalLow))
  }

  return { heat: Math.max(0, heat), cold: Math.max(0, cold) }
}

/**
 * Soil temperature update — soil temp lags behind air temp.
 *
 * Source: Campbell & Norman (1998) Environmental Biophysics
 * At 10cm depth, soil temp lags air temp by several hours
 * and has dampened amplitude.
 */
export function updateSoilTemperature(
  soilTemp: number,
  airTemp: number,
  lagCoefficient: number = 0.05
): number {
  return soilTemp + (airTemp - soilTemp) * lagCoefficient
}
