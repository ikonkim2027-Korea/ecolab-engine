import { tick, createPlant, createOptimalSoil, createOptimalEnvironment, createDefaultEcosystem } from '../core/growth.js'
import { applyAmendment } from '../core/nutrients.js'
import { applyPesticide } from '../core/pests.js'
import type { PlantState, SoilState, EnvironmentState, EcosystemState, AmendmentType } from '../types.js'
import { GrowthStage } from '../types.js'

// ─── Types ───────────────────────────────────────────────────────────────────
interface HistPt { tick: number; health: number; growth: number; nut: number; water: number; stage: GrowthStage }

// ─── Pixel-art plant renderer ─────────────────────────────────────────────────
// Logical grid: 24 wide × 24 tall. Rendered at scale = floor(displayW / 24).
const PW = 24, PH = 24

// Short helper: fill a rect in logical pixel coordinates
function b(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string, s: number) {
  if (w <= 0 || h <= 0) return
  ctx.fillStyle = c
  ctx.fillRect(x * s, y * s, w * s, h * s)
}

function drawBackground(ctx: CanvasRenderingContext2D, s: number) {
  // Sky – 3 bands
  b(ctx, 0, 0,  PW, 5,  '#4a9abf', s)
  b(ctx, 0, 5,  PW, 5,  '#62afd4', s)
  b(ctx, 0, 10, PW, 3,  '#87ceeb', s)
  // Clouds (static decorations)
  b(ctx, 2,  2, 4, 2, '#c8e8f8', s); b(ctx, 3, 1, 2, 1, '#c8e8f8', s)
  b(ctx, 15, 4, 5, 2, '#c8e8f8', s); b(ctx, 16,3, 3, 1, '#c8e8f8', s)
  // Grass line
  b(ctx, 0, 13, PW, 1, '#56b83d', s)
  b(ctx, 0, 14, PW, 1, '#3d9a28', s)
  // Topsoil
  b(ctx, 0, 15, PW, 3, '#6d4c41', s)
  // Deep soil
  b(ctx, 0, 18, PW, PH - 18, '#4e342e', s)
  // Soil texture dots
  const dots: [number,number][] = [[3,16],[8,17],[14,16],[19,18],[5,19],[21,17],[11,19]]
  for (const [x,y] of dots) b(ctx, x, y, 1, 1, '#5d3d2a', s)
}

function drawSeedStage(ctx: CanvasRenderingContext2D, s: number) {
  b(ctx, 9,  14, 6, 1, '#a07850', s)
  b(ctx, 8,  15, 8, 2, '#8b6340', s)
  b(ctx, 9,  15, 6, 1, '#c49a60', s)
  b(ctx, 10, 15, 3, 1, '#d4aa70', s)
  b(ctx, 10, 16, 2, 1, '#9e7850', s)
}

function drawGerminationStage(ctx: CanvasRenderingContext2D, s: number, sw: number) {
  const x = sw
  b(ctx, 11+x, 9,  2, 5, '#6b8c42', s)
  b(ctx, 12+x, 9,  1, 4, '#7aa050', s)
  b(ctx, 8+x,  8,  3, 2, '#7ab950', s)
  b(ctx, 13+x, 8,  3, 2, '#52a040', s)
  b(ctx, 9+x,  7,  1, 1, '#95d064', s)
  b(ctx, 10,   15, 4, 2, '#8b6340', s)
}

function drawSeedlingStage(ctx: CanvasRenderingContext2D, s: number, sw: number) {
  const x = sw
  b(ctx, 11+x, 7, 2, 7, '#6b8c42', s)
  b(ctx, 7+x,  8, 4, 2, '#52c41a', s)
  b(ctx, 13+x, 8, 4, 2, '#52c41a', s)
  b(ctx, 6+x,  10,5, 2, '#389e0d', s)
  b(ctx, 13+x, 10,5, 2, '#389e0d', s)
  b(ctx, 7+x,  8, 1, 1, '#80e040', s)
  b(ctx, 14+x, 8, 1, 1, '#80e040', s)
}

function drawVegetative(ctx: CanvasRenderingContext2D, s: number, species: string, sw: number) {
  const x = sw
  switch (species) {
    case 'lettuce':
      b(ctx, 3+x,  11, 17, 3, '#52c41a', s)
      b(ctx, 5+x,  9,  13, 4, '#7ee63a', s)
      b(ctx, 7+x,  7,  9,  4, '#a8f078', s)
      b(ctx, 9+x,  6,  5,  2, '#c8ff9a', s)
      b(ctx, 10+x, 11, 3,  3, '#3a7a28', s)
      break
    case 'tomato':
      b(ctx, 11+x, 3,  2, 11, '#6b8c42', s)
      b(ctx, 7+x,  5,  4,  1, '#6b8c42', s)
      b(ctx, 13+x, 8,  4,  1, '#6b8c42', s)
      b(ctx, 4+x,  4,  5,  2, '#52c41a', s)
      b(ctx, 14+x, 7,  5,  2, '#52c41a', s)
      b(ctx, 8+x,  2,  6,  2, '#52c41a', s)
      b(ctx, 4+x,  4,  1,  1, '#80e040', s)
      b(ctx, 8+x,  2,  1,  1, '#80e040', s)
      break
    case 'corn':
      b(ctx, 11+x, 1,  2, 13, '#6b8c42', s)
      b(ctx, 8+x,  3,  3,  1, '#52c41a', s)
      b(ctx, 5+x,  4,  3,  1, '#52c41a', s)
      b(ctx, 3+x,  5,  3,  1, '#389e0d', s)
      b(ctx, 14+x, 5,  3,  1, '#52c41a', s)
      b(ctx, 17+x, 6,  3,  1, '#52c41a', s)
      b(ctx, 19+x, 7,  3,  1, '#389e0d', s)
      b(ctx, 7+x,  7,  3,  1, '#52c41a', s)
      b(ctx, 4+x,  8,  3,  1, '#389e0d', s)
      b(ctx, 13+x, 9,  3,  1, '#52c41a', s)
      break
    case 'grape':
      b(ctx, 11+x, 4,  2,  9, '#6b8c42', s)
      b(ctx, 5+x,  6,  6,  1, '#6b8c42', s)
      b(ctx, 13+x, 8,  6,  1, '#6b8c42', s)
      b(ctx, 3+x,  4,  6,  5, '#52c41a', s)
      b(ctx, 8+x,  3,  6,  3, '#7ee63a', s)
      b(ctx, 14+x, 6,  6,  4, '#52c41a', s)
      break
  }
}

function drawFlowering(ctx: CanvasRenderingContext2D, s: number, species: string, sw: number) {
  const x = sw
  switch (species) {
    case 'lettuce':
      b(ctx, 4+x,  11, 15, 3, '#52c41a', s)
      b(ctx, 6+x,  9,  11, 3, '#7ee63a', s)
      b(ctx, 11+x, 2,  2, 10, '#8baa42', s)
      b(ctx, 9+x,  2,  2,  2, '#f5d742', s)
      b(ctx, 13+x, 3,  2,  2, '#f5d742', s)
      b(ctx, 11+x, 1,  2,  2, '#ffe86a', s)
      break
    case 'tomato':
      b(ctx, 11+x, 2,  2, 12, '#6b8c42', s)
      b(ctx, 7+x,  4,  4,  1, '#6b8c42', s)
      b(ctx, 13+x, 7,  4,  1, '#6b8c42', s)
      b(ctx, 4+x,  3,  5,  2, '#52c41a', s)
      b(ctx, 14+x, 6,  5,  2, '#52c41a', s)
      b(ctx, 8+x,  2,  5,  2, '#52c41a', s)
      b(ctx, 6+x,  4,  2,  2, '#f5d742', s); b(ctx, 6+x, 4, 1, 1, '#ffe86a', s)
      b(ctx, 14+x, 7,  2,  2, '#f5d742', s); b(ctx, 14+x,7, 1, 1, '#ffe86a', s)
      b(ctx, 7+x,  5,  1,  1, '#ff6b00', s)
      b(ctx, 15+x, 8,  1,  1, '#ff6b00', s)
      break
    case 'corn':
      b(ctx, 11+x, 0,  2, 14, '#6b8c42', s)
      b(ctx, 7+x,  2,  4,  1, '#52c41a', s)
      b(ctx, 3+x,  4,  4,  1, '#52c41a', s)
      b(ctx, 14+x, 4,  4,  1, '#52c41a', s)
      b(ctx, 17+x, 6,  4,  1, '#52c41a', s)
      b(ctx, 9+x,  0,  6,  2, '#c8a840', s)
      b(ctx, 10+x, 0,  4,  1, '#f0d870', s)
      b(ctx, 8+x,  0,  1,  1, '#e0c060', s)
      b(ctx, 15+x, 0,  1,  1, '#e0c060', s)
      break
    case 'grape':
      b(ctx, 11+x, 3,  2, 10, '#6b8c42', s)
      b(ctx, 4+x,  5,  7,  1, '#6b8c42', s)
      b(ctx, 13+x, 7,  7,  1, '#6b8c42', s)
      b(ctx, 2+x,  3,  7,  5, '#52c41a', s)
      b(ctx, 14+x, 5,  7,  4, '#52c41a', s)
      for (const [fx,fy] of [[5,6],[8,5],[10,7],[15,8],[18,9]]) {
        b(ctx, fx+x, fy, 2, 2, '#fff8dc', s)
        b(ctx, fx+1+x, fy, 1, 1, '#f0e88a', s)
      }
      break
  }
}

function drawFruiting(ctx: CanvasRenderingContext2D, s: number, species: string, sw: number) {
  const x = sw
  switch (species) {
    case 'tomato':
      b(ctx, 11+x, 1,  2, 13, '#6b8c42', s)
      b(ctx, 7+x,  3,  4,  1, '#6b8c42', s)
      b(ctx, 13+x, 6,  4,  1, '#6b8c42', s)
      b(ctx, 4+x,  2,  6,  2, '#52c41a', s)
      b(ctx, 14+x, 5,  6,  2, '#52c41a', s)
      b(ctx, 5+x,  4,  4,  4, '#e84040', s); b(ctx, 6+x,4, 2,2, '#ff7070', s)
      b(ctx, 14+x, 7,  4,  4, '#e84040', s); b(ctx, 15+x,7, 2,2, '#ff7070', s)
      b(ctx, 6+x,  3,  2,  1, '#52c41a', s)
      b(ctx, 15+x, 6,  2,  1, '#52c41a', s)
      break
    case 'corn':
      b(ctx, 11+x, 0,  2, 14, '#6b8c42', s)
      b(ctx, 7+x,  2,  4,  1, '#52c41a', s)
      b(ctx, 3+x,  4,  4,  1, '#52c41a', s)
      b(ctx, 14+x, 4,  4,  1, '#52c41a', s)
      b(ctx, 13+x, 6,  4,  6, '#f5c833', s)
      b(ctx, 14+x, 6,  2,  6, '#f5d855', s)
      b(ctx, 13+x, 5,  4,  1, '#fff5a0', s)
      b(ctx, 14+x, 4,  2,  2, '#fff5a0', s)
      b(ctx, 12+x, 7,  1,  5, '#4a8c28', s)
      b(ctx, 17+x, 7,  1,  5, '#3a7020', s)
      b(ctx, 9+x,  0,  6,  2, '#c8a840', s)
      b(ctx, 10+x, 0,  4,  1, '#f0d870', s)
      break
    case 'grape':
      b(ctx, 11+x, 2,  2, 12, '#6b8c42', s)
      b(ctx, 4+x,  4,  7,  1, '#6b8c42', s)
      b(ctx, 13+x, 6,  7,  1, '#6b8c42', s)
      b(ctx, 2+x,  2,  7,  5, '#52c41a', s)
      b(ctx, 14+x, 4,  7,  4, '#52c41a', s)
      for (const [fx,fy] of [[4,5],[6,6],[5,7],[7,8],[5,9],[15,7],[17,8],[16,9],[18,10]]) {
        b(ctx, fx+x, fy, 2, 2, '#7b2fbe', s)
        b(ctx, fx+x, fy, 1, 1, '#a060d8', s)
      }
      break
    default: drawVegetative(ctx, s, species, sw)
  }
}

function drawHarvest(ctx: CanvasRenderingContext2D, s: number, species: string, sw: number) {
  const x = sw
  switch (species) {
    case 'lettuce':
      b(ctx, 2+x,  11, 19, 3, '#52c41a', s)
      b(ctx, 4+x,  9,  15, 4, '#7ee63a', s)
      b(ctx, 6+x,  7,  11, 4, '#a8f078', s)
      b(ctx, 8+x,  5,  7,  4, '#c8ff9a', s)
      b(ctx, 10+x, 4,  4,  2, '#e0ffb8', s)
      b(ctx, 2+x,  12, 2,  1, '#3a8a20', s)
      b(ctx, 19+x, 12, 2,  1, '#3a8a20', s)
      break
    case 'tomato':
      b(ctx, 11+x, 1,  2, 13, '#6b8c42', s)
      b(ctx, 6+x,  3,  5,  1, '#6b8c42', s)
      b(ctx, 13+x, 5,  5,  1, '#6b8c42', s)
      b(ctx, 3+x,  2,  6,  2, '#52c41a', s)
      b(ctx, 14+x, 4,  6,  2, '#52c41a', s)
      b(ctx, 3+x,  4,  6,  6, '#e84040', s); b(ctx, 4+x,4, 3,3, '#ff7070', s)
      b(ctx, 14+x, 6,  6,  6, '#e84040', s); b(ctx, 15+x,6, 3,3, '#ff7070', s)
      b(ctx, 5+x,  3,  2,  1, '#52c41a', s)
      b(ctx, 15+x, 5,  2,  1, '#52c41a', s)
      break
    case 'corn':
      b(ctx, 11+x, 0,  2, 14, '#6b8c42', s)
      b(ctx, 6+x,  2,  5,  1, '#52c41a', s)
      b(ctx, 2+x,  4,  5,  1, '#52c41a', s)
      b(ctx, 14+x, 3,  5,  1, '#52c41a', s)
      b(ctx, 13+x, 5,  5,  7, '#f5c833', s)
      b(ctx, 14+x, 5,  3,  7, '#f5d855', s)
      b(ctx, 13+x, 6,  1,  5, '#e0a820', s)
      for (const [fx,fy] of [[13,6],[15,6],[13,8],[15,8],[13,10],[15,10]]) b(ctx,fx+x,fy,1,1,'#d4a020',s)
      b(ctx, 12+x, 6,  1,  6, '#4a8c28', s)
      b(ctx, 18+x, 6,  1,  6, '#3a7020', s)
      b(ctx, 9+x,  0,  6,  2, '#c8a840', s)
      b(ctx, 10+x, 0,  4,  1, '#f0d870', s)
      break
    case 'grape':
      b(ctx, 11+x, 1,  2, 13, '#6b8c42', s)
      b(ctx, 3+x,  3,  8,  1, '#6b8c42', s)
      b(ctx, 13+x, 5,  8,  1, '#6b8c42', s)
      b(ctx, 1+x,  1,  8,  5, '#52c41a', s)
      b(ctx, 14+x, 3,  8,  5, '#52c41a', s)
      for (const [fx,fy] of [
        [3,4],[5,4],[4,5],[6,5],[3,6],[5,6],[4,7],[6,7],[4,8],
        [15,6],[17,6],[16,7],[18,7],[15,8],[17,8],[16,9],[18,9],[16,10]
      ]) {
        b(ctx, fx+x, fy, 2, 2, '#7b2fbe', s)
        b(ctx, fx+x, fy, 1, 1, '#a060d8', s)
      }
      break
  }
}

function drawDead(ctx: CanvasRenderingContext2D, s: number) {
  b(ctx, 11, 8,  2, 6,  '#6b4c2a', s)
  b(ctx, 10, 7,  2, 1,  '#6b4c2a', s)
  b(ctx, 8,  5,  3, 2,  '#6b4c2a', s)
  b(ctx, 9,  6,  5, 2,  '#7a5c38', s)
  b(ctx, 6,  7,  4, 1,  '#6b4c2a', s)
  b(ctx, 14, 9,  4, 1,  '#5a3c28', s)
  b(ctx, 4,  13, 3, 1,  '#7a5c38', s)
  b(ctx, 16, 13, 4, 1,  '#6b4c2a', s)
}

function renderPlant(canvas: HTMLCanvasElement, stage: GrowthStage, species: string, frame: number, health: number) {
  const dw = canvas.offsetWidth || 192
  canvas.width  = dw
  canvas.height = Math.round(dw * PH / PW)

  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.imageSmoothingEnabled = false

  const s = Math.floor(dw / PW)

  drawBackground(ctx, s)

  const sw = frame === 1 ? 1 : 0

  if (!health || health <= 0 || stage === GrowthStage.Dead) { drawDead(ctx, s); return }

  switch (stage) {
    case GrowthStage.Seed:        drawSeedStage(ctx, s); break
    case GrowthStage.Germination: drawGerminationStage(ctx, s, sw); break
    case GrowthStage.Seedling:    drawSeedlingStage(ctx, s, sw); break
    case GrowthStage.Vegetative:  drawVegetative(ctx, s, species, sw); break
    case GrowthStage.Flowering:   drawFlowering(ctx, s, species, sw); break
    case GrowthStage.Fruiting:    drawFruiting(ctx, s, species, sw); break
    case GrowthStage.HarvestReady:drawHarvest(ctx, s, species, sw); break
  }
}

// ─── Stage meta ───────────────────────────────────────────────────────────────
const STAGE_ORDER = [
  GrowthStage.Seed, GrowthStage.Germination, GrowthStage.Seedling,
  GrowthStage.Vegetative, GrowthStage.Flowering, GrowthStage.Fruiting,
  GrowthStage.HarvestReady,
]
const STAGE_NAMES: Record<GrowthStage, string> = {
  [GrowthStage.Seed]: 'SEED', [GrowthStage.Germination]: 'GERMINATING',
  [GrowthStage.Seedling]: 'SEEDLING', [GrowthStage.Vegetative]: 'VEGETATIVE',
  [GrowthStage.Flowering]: 'FLOWERING', [GrowthStage.Fruiting]: 'FRUITING',
  [GrowthStage.HarvestReady]: 'HARVEST READY!', [GrowthStage.Dead]: 'DEAD',
}

// ─── Science facts ────────────────────────────────────────────────────────────
function scienceFact(plant: PlantState, soil: SoilState, species: string): { title: string; body: string } {
  if (!plant.isAlive)
    return { title: '☠️ PLANT DIED', body: 'Stress exceeded recovery. Lower temp or add water and nutrients, then reset.' }

  const st = plant.stressAccumulator
  if (st.drought > 0.5)        return { title: '🌵 DROUGHT STRESS', body: 'Stomata close to conserve water, blocking CO₂ intake. Stomatal conductance model (Jarvis 1976).' }
  if (st.waterlog > 0.3)       return { title: '💧 WATERLOGGING', body: 'No O₂ for roots in saturated soil → anaerobic root rot. Reduce rainfall! (Kozlowski 1984).' }
  if (st.heat > 0.5)           return { title: '🔥 HEAT STRESS', body: 'Pollen non-viable >35°C; proteins denature >Tmax. Beta function temperature model.' }
  if (st.cold > 0.5)           return { title: '❄️ COLD STRESS', body: 'Enzyme reactions slow exponentially below Tmin. Membrane lipids solidify (Levitt 1980).' }
  if (st.nitrogenDeficiency > 0.5)   return { title: '🟩 N DEFICIENCY', body: 'N is in every chlorophyll + amino acid. Liebig\'s Law: N is now the minimum factor.' }
  if (st.phosphorusDeficiency > 0.5) return { title: '🦴 P DEFICIENCY', body: 'P powers ATP. Low P stunts roots. pH 6–7 maximises P solubility (Truog 1946).' }
  if (st.potassiumDeficiency > 0.5)  return { title: '🍌 K DEFICIENCY', body: 'K drives stomatal movement and sugar transport to fruit (Marschner 2012).' }
  if (st.nutrientToxicity > 0.3) return { title: '⚗️ TOXICITY', body: 'Excess salts cause osmotic stress — roots lose water in reverse (plasmolysis).' }
  if (st.pestDamage > 0.3)     return { title: '🐛 PEST DAMAGE', body: 'Logistic growth: dP/dt = r·P·(1−P/K) minus predation. Beneficial insects are key.' }
  if (soil.pH < 5.5)           return { title: `⚗️ ACID SOIL pH ${soil.pH.toFixed(1)}`, body: 'P bonds to Al³⁺/Fe³⁺ below pH 5.5 and locks up. Add lime to raise pH (Truog 1946).' }
  if (soil.pH > 7.5)           return { title: `⚗️ ALKALINE pH ${soil.pH.toFixed(1)}`, body: 'Micronutrients Fe/Mn/Zn precipitate above pH 7.5. Add sulfur to lower pH.' }
  if (plant.stage === GrowthStage.Seed)        return { title: '🌰 SEED ENERGY', body: 'Cotyledon reserves bootstrap growth before leaf area supports photosynthesis.' }
  if (plant.stage === GrowthStage.Flowering && species === 'tomato') return { title: '🐝 BUZZ POLLINATION', body: 'Bumblebees vibrate at 400 Hz to release pollen (sonication). Heat kills pollen >35°C.' }
  if (plant.stage === GrowthStage.Flowering && species === 'grape')  return { title: '❄️ VERNALIZATION', body: 'Grapes need cold exposure to flower — FLC gene silenced epigenetically (Chouard 1960).' }
  if (plant.stage === GrowthStage.HarvestReady) return { title: '🎉 HARVEST READY', body: `Quality: ${Math.round(plant.harvestQuality)}/100. K drives sugar to fruit — more K = sweeter harvest.` }
  return { title: '☀️ PHOTOSYNTHESIS', body: `A = (φI + Amax − √((φI+Amax)²−4θφI·Amax)) / 2θ. Total growth: ${Math.round(plant.totalGrowthPoints)} pts. (Thornley 1976)` }
}

// ─── Game state ───────────────────────────────────────────────────────────────
let species = 'lettuce'
let plant: PlantState, soil: SoilState, env: EnvironmentState, ecosystem: EcosystemState
let history: HistPt[] = []
let tickCount = 0
let isRunning = true
let speed = 1
let isRaining = false
let animFrame = 0
let animTimer = 0
let prevStage: GrowthStage = GrowthStage.Seed
let accumulated = 0
let lastRAF = 0

// ─── DOM helpers ──────────────────────────────────────────────────────────────
const G = (id: string) => document.getElementById(id) as HTMLElement
const setText = (id: string, v: string) => { G(id).textContent = v }
const setW    = (id: string, pct: number) => { (G(id) as HTMLElement).style.width  = `${Math.min(100, Math.max(0, pct)).toFixed(1)}%` }
const setH    = (id: string, pct: number) => { (G(id) as HTMLElement).style.height = `${Math.min(100, Math.max(0, pct)).toFixed(1)}%` }

// ─── Init ─────────────────────────────────────────────────────────────────────
function initSim(sp: string) {
  species = sp
  plant     = createPlant(sp)
  soil      = createOptimalSoil(sp)
  env       = { ...createOptimalEnvironment(sp) }
  ecosystem = createDefaultEcosystem()
  history   = []
  tickCount = 0
  accumulated = 0
  prevStage   = GrowthStage.Seed
  isRaining   = false
  G('rain-toggle').classList.remove('on')

  // Sync sliders to the new species' optimal env
  ;(G('sl-temp')  as HTMLInputElement).value = String(env.airTemperature)
  ;(G('sl-light') as HTMLInputElement).value = String(Math.round(env.lightIntensity * 100))
  ;(G('sl-co2')   as HTMLInputElement).value = String(env.co2)
  ;(G('sl-hum')   as HTMLInputElement).value = String(Math.round(env.humidity * 100))
  syncSliders()
}

// ─── Tick ─────────────────────────────────────────────────────────────────────
function runTick() {
  if (!plant.isAlive) return
  const result = tick(plant, soil, env, 1, ecosystem)
  plant     = result.plant
  soil      = result.soil
  if (result.ecosystem) ecosystem = result.ecosystem
  tickCount++

  const st = plant.stressAccumulator
  history.push({
    tick: tickCount,
    health: plant.health,
    growth: plant.totalGrowthPoints,
    nut:    1 - Math.max(st.nitrogenDeficiency, st.phosphorusDeficiency, st.potassiumDeficiency),
    water:  1 - st.drought,
    stage:  plant.stage,
  })
  if (history.length > 600) history.shift()

  if (plant.stage !== prevStage) {
    appendLog(`▸ TICK ${tickCount}: ${STAGE_NAMES[plant.stage]}`, 'stage')
    prevStage = plant.stage
  }
}

// ─── Render ───────────────────────────────────────────────────────────────────
function render(deltaMs: number) {
  // Animation frame (sway every 800ms)
  animTimer += deltaMs
  if (animTimer > 800) { animFrame = 1 - animFrame; animTimer = 0 }

  // Plant canvas
  const plantCanvas = G('plant-canvas') as HTMLCanvasElement
  renderPlant(plantCanvas, plant.stage, species, animFrame, plant.health)

  // Tick
  setText('tick-num', String(tickCount))

  // Stage pips
  const pips = G('stage-bar').querySelectorAll('.stg-pip')
  const idx  = STAGE_ORDER.indexOf(plant.stage)
  pips.forEach((p, i) => {
    p.classList.toggle('done', i < idx)
    p.classList.toggle('now',  i === idx)
  })

  // Stage label
  const sl = G('stage-lbl')
  sl.textContent = STAGE_NAMES[plant.stage] ?? plant.stage
  sl.style.color = plant.stage === GrowthStage.HarvestReady ? '#f0c840'
    : plant.stage === GrowthStage.Dead ? '#d84040' : '#80e880'

  // Health bar
  const hp = plant.health
  setText('health-num', Math.round(hp).toString())
  setW('health-fill', hp)
  const hfill = G('health-fill')
  hfill.style.setProperty('--bar-color', hp < 35 ? '#d84040' : hp < 65 ? '#f0c840' : '#50c050')

  // Water bar
  const wc = plant.waterContent * 100
  setText('water-num', `${Math.round(wc)}%`)
  setW('water-fill', wc)

  // Stats
  setText('growth-num',  Math.round(plant.totalGrowthPoints).toString())
  setText('quality-num', Math.round(plant.harvestQuality).toString())
  setText('age-num',     `${tickCount} TICKS`)

  // Pollination (show during flowering for species that need it)
  const needsPoll = plant.stage === GrowthStage.Flowering
  G('poll-row').style.display = needsPoll ? 'flex' : 'none'
  if (needsPoll) setText('poll-num', `${Math.round(plant.pollinationRate * 100)}%`)

  // Vernalization (grape only)
  const isGrape = species === 'grape'
  G('vern-row').style.display = isGrape ? 'flex' : 'none'
  if (isGrape) setText('vern-num', `${plant.coldExposureTicks}/15`)

  // Science callout
  const { title, body } = scienceFact(plant, soil, species)
  setText('sc-title', title)
  setText('sc-body',  body)

  // Soil status
  setText('v-moist', `${Math.round(soil.moisture * 100)}%`)
  setW('moist-fill', soil.moisture * 100)
  setText('v-ph', soil.pH.toFixed(1))
  setText('v-n',  Math.round(soil.nitrogen).toString())
  setText('v-p',  Math.round(soil.phosphorus).toString())
  setText('v-k',  Math.round(soil.potassium).toString())
  setText('v-om', `${soil.organicMatter.toFixed(1)}%`)
  setText('v-mb', soil.microbeHealth.toFixed(2))

  // Stress bars
  const st = plant.stressAccumulator
  setH('s-drought', st.drought * 100)
  setH('s-heat',    st.heat    * 100)
  setH('s-cold',    st.cold    * 100)
  setH('s-wlog',    st.waterlog * 100)
  setH('s-n',       st.nitrogenDeficiency   * 100)
  setH('s-p',       st.phosphorusDeficiency * 100)
  setH('s-k',       st.potassiumDeficiency  * 100)
  setH('s-tox',     st.nutrientToxicity * 100)
  setH('s-pest',    st.pestDamage  * 100)
  setH('s-total',   st.total       * 100)

  // Ecosystem bars
  const ep = (v: number) => `${Math.round(v * 100)}%`
  setW('eco-pests', ecosystem.pestPopulation    * 100); setText('eco-pests-v', ep(ecosystem.pestPopulation))
  setW('eco-bees',  ecosystem.beePopulation     * 100); setText('eco-bees-v',  ep(ecosystem.beePopulation))
  setW('eco-ben',   ecosystem.beneficialInsects * 100); setText('eco-ben-v',   ep(ecosystem.beneficialInsects))
  setW('eco-bio',   ecosystem.biodiversityScore * 100); setText('eco-bio-v',   ep(ecosystem.biodiversityScore))

  drawChart()
}

// ─── Chart ────────────────────────────────────────────────────────────────────
function drawChart() {
  const canvas = G('chart-canvas') as HTMLCanvasElement
  const ctx = canvas.getContext('2d')
  if (!ctx || history.length < 2) return

  const dw = canvas.offsetWidth || 300
  canvas.width  = dw
  canvas.height = 160
  const W = dw, H = 160

  ctx.fillStyle = '#0f1e0f'; ctx.fillRect(0, 0, W, H)

  // Grid
  ctx.strokeStyle = '#1e3a1e'; ctx.lineWidth = 1
  for (let i = 1; i <= 3; i++) {
    const y = (H / 4) * i
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }

  const maxG = Math.max(10, ...history.map(p => p.growth))
  const n = history.length

  // Stage markers
  ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(80,192,80,0.2)'; ctx.lineWidth = 1
  let ps = history[0].stage
  for (let i = 1; i < n; i++) {
    if (history[i].stage !== ps) {
      const x = (i / (n - 1)) * W
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      ps = history[i].stage
    }
  }
  ctx.setLineDash([])

  function line(get: (p: HistPt) => number, max: number, color: string, lw = 1.5) {
    ctx!.strokeStyle = color; ctx!.lineWidth = lw
    ctx!.beginPath()
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * W
      const y = H - (Math.min(max, Math.max(0, get(history[i]))) / max) * (H - 4) - 2
      i === 0 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y)
    }
    ctx!.stroke()
  }

  line(p => (p.growth / maxG) * 100, 100, '#50c050', 2)
  line(p => p.health,                100, '#d84040', 1.5)
  line(p => p.nut   * 100,           100, '#4888d0', 1.5)
  line(p => p.water * 100,           100, '#f0c840', 1.5)

  // Current growth label
  if (n > 0) {
    ctx.fillStyle = '#50c050'; ctx.font = 'bold 9px monospace'
    ctx.fillText(Math.round(history[n - 1].growth).toString(), W - 36, 12)
  }
}

// ─── Slider sync ──────────────────────────────────────────────────────────────
function syncSliders() {
  const temp  = parseFloat((G('sl-temp')  as HTMLInputElement).value)
  const light = parseFloat((G('sl-light') as HTMLInputElement).value)
  const co2   = parseFloat((G('sl-co2')   as HTMLInputElement).value)
  const hum   = parseFloat((G('sl-hum')   as HTMLInputElement).value)
  setText('v-temp',  `${temp}°C`)
  setText('v-light', `${light}%`)
  setText('v-co2',   `${co2} PPM`)
  setText('v-hum',   `${hum}%`)
  env.airTemperature = temp
  env.lightIntensity = light / 100
  env.co2            = co2
  env.humidity       = hum / 100
}

// ─── Science log ──────────────────────────────────────────────────────────────
function appendLog(msg: string, cls = '') {
  const log = G('science-log')
  const span = document.createElement('span')
  span.className = cls
  span.textContent = msg
  log.appendChild(document.createTextNode('\n'))
  log.appendChild(span)
  if (log.children.length > 80) log.removeChild(log.children[0])
  log.scrollTop = log.scrollHeight
}

// ─── Events ───────────────────────────────────────────────────────────────────

// Sliders
;['sl-temp','sl-light','sl-co2','sl-hum'].forEach(id => G(id).addEventListener('input', syncSliders))

// Species buttons
document.querySelectorAll('.sp-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sp-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    const sp = (btn as HTMLElement).dataset.sp ?? 'lettuce'
    initSim(sp)
    isRunning = true
    G('pause-btn').textContent = '⏸ PAUSE'
    G('science-log').innerHTML = `<span class="stage">▸ STARTED ${sp.toUpperCase()} — GOOD LUCK!</span>`
  })
})

// Speed
document.querySelectorAll('.spd-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.spd-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    speed = parseInt((btn as HTMLElement).dataset.speed ?? '1')
  })
})

// Pause
G('pause-btn').addEventListener('click', () => {
  isRunning = !isRunning
  G('pause-btn').textContent = isRunning ? '⏸ PAUSE' : '▶ RESUME'
})

// Reset
G('reset-btn').addEventListener('click', () => {
  initSim(species)
  isRunning = true
  G('pause-btn').textContent = '⏸ PAUSE'
  G('science-log').innerHTML = `<span class="stage">▸ RESET. GROWING ${species.toUpperCase()}...</span>`
})

// Rain toggle
G('rain-toggle').addEventListener('click', () => {
  isRaining = !isRaining
  env.isRaining = isRaining
  env.rainfall  = isRaining ? 5 : 0
  G('rain-toggle').classList.toggle('on', isRaining)
  appendLog(isRaining ? '▸ RAIN STARTED.' : '▸ RAIN STOPPED.', isRaining ? 'stage' : '')
})

// Amendments
const AMEND_LABELS: Record<string, string> = {
  water:            'WATERED +10% MOISTURE.',
  compost:          'COMPOST: SLOW NPK + MICROBE BOOST.',
  ammonium_nitrate: 'NH₄NO₃: +N, SLIGHT pH DROP.',
  bone_meal:        'BONE MEAL: +P, SLIGHT pH RISE.',
  potash:           'POTASH (KCl): +K, pH NEUTRAL.',
  lime:             'LIME (CaCO₃): pH RAISED VIA NEUTRALISATION.',
  sulfur:           'SULFUR → H₂SO₄: pH LOWERED.',
  pesticide:        'TARGETED PESTICIDE: 60% PEST KILL, 15% BENEFICIAL LOSS.',
}

document.querySelectorAll('.amend-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const amend = (btn as HTMLElement).dataset.amend ?? ''
    if (amend === 'water') {
      soil.moisture = Math.min(1.0, soil.moisture + 0.10)
    } else if (amend === 'pesticide') {
      ecosystem = applyPesticide(ecosystem, 'targeted')
    } else if (amend) {
      soil = applyAmendment(soil, amend as AmendmentType, 50)
    }
    appendLog(`▸ ${AMEND_LABELS[amend] ?? amend}`, 'stage')

    btn.classList.add('lit')
    setTimeout(() => btn.classList.remove('lit'), 400)
  })
})

// Mobile tab navigation
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = (btn as HTMLElement).dataset.tab ?? 'plant'
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('show'))
    const pane = document.getElementById(`pane-${tab}`)
    if (pane) pane.classList.add('show')
  })
})

// ─── Game loop ────────────────────────────────────────────────────────────────
function gameLoop(ts: number) {
  const delta = ts - lastRAF
  lastRAF = ts

  if (isRunning && plant.isAlive) {
    const interval = 1000 / speed
    accumulated += delta
    while (accumulated >= interval) {
      runTick()
      accumulated -= interval
    }
  }

  render(delta)
  requestAnimationFrame(gameLoop)
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
initSim('lettuce')
syncSliders()
requestAnimationFrame((ts) => { lastRAF = ts; requestAnimationFrame(gameLoop) })
