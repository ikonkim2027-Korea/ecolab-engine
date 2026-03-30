import { tick, createPlant, createOptimalSoil, createOptimalEnvironment, createDefaultEcosystem } from '../core/growth.js'
import { applyAmendment } from '../core/nutrients.js'
import { applyPesticide } from '../core/pests.js'
import { PlantState, SoilState, EnvironmentState, EcosystemState, GrowthStage, Season, AmendmentType } from '../types.js'

// ─── History point ────────────────────────────────────────────────────────────
interface HistPoint {
  tick: number
  health: number          // 0–100
  growth: number          // total growth pts (will be scaled on chart)
  nutFactor: number       // 0–1  (1 = no nutrient stress)
  waterFactor: number     // 0–1  (1 = no water stress)
  stage: GrowthStage
}

// ─── Stage order + display ────────────────────────────────────────────────────
const STAGE_ORDER = [
  GrowthStage.Seed,
  GrowthStage.Germination,
  GrowthStage.Seedling,
  GrowthStage.Vegetative,
  GrowthStage.Flowering,
  GrowthStage.Fruiting,
  GrowthStage.HarvestReady,
]

const STAGE_NAMES: Record<GrowthStage, string> = {
  [GrowthStage.Seed]: 'Seed',
  [GrowthStage.Germination]: 'Germinating',
  [GrowthStage.Seedling]: 'Seedling',
  [GrowthStage.Vegetative]: 'Vegetative',
  [GrowthStage.Flowering]: 'Flowering 🌸',
  [GrowthStage.Fruiting]: 'Fruiting',
  [GrowthStage.HarvestReady]: '🎉 Harvest Ready!',
  [GrowthStage.Dead]: '☠️ Dead',
}

// ─── Emoji map per species / stage ───────────────────────────────────────────
type EmojiMap = Partial<Record<GrowthStage, string>>

const PLANT_EMOJI: Record<string, EmojiMap> = {
  lettuce: {
    [GrowthStage.Seed]: '🌰', [GrowthStage.Germination]: '🌱',
    [GrowthStage.Seedling]: '🌿', [GrowthStage.Vegetative]: '🥬',
    [GrowthStage.Flowering]: '🌸', [GrowthStage.HarvestReady]: '🥬',
    [GrowthStage.Dead]: '🍂',
  },
  tomato: {
    [GrowthStage.Seed]: '🌰', [GrowthStage.Germination]: '🌱',
    [GrowthStage.Seedling]: '🌿', [GrowthStage.Vegetative]: '🍀',
    [GrowthStage.Flowering]: '🌸', [GrowthStage.Fruiting]: '🍅',
    [GrowthStage.HarvestReady]: '🍅', [GrowthStage.Dead]: '🍂',
  },
  corn: {
    [GrowthStage.Seed]: '🌰', [GrowthStage.Germination]: '🌱',
    [GrowthStage.Seedling]: '🌿', [GrowthStage.Vegetative]: '🌾',
    [GrowthStage.Flowering]: '🌻', [GrowthStage.Fruiting]: '🌽',
    [GrowthStage.HarvestReady]: '🌽', [GrowthStage.Dead]: '🍂',
  },
  grape: {
    [GrowthStage.Seed]: '🌰', [GrowthStage.Germination]: '🌱',
    [GrowthStage.Seedling]: '🌿', [GrowthStage.Vegetative]: '🍀',
    [GrowthStage.Flowering]: '🌸', [GrowthStage.Fruiting]: '🍇',
    [GrowthStage.HarvestReady]: '🍇', [GrowthStage.Dead]: '🍂',
  },
}

// ─── Mutable simulation state ─────────────────────────────────────────────────
let species = 'lettuce'
let plant: PlantState
let soil: SoilState
let env: EnvironmentState
let ecosystem: EcosystemState
let history: HistPoint[] = []
let tickCount = 0
let isRunning = true
let speed = 1          // ticks per second
let isRaining = false
let prevStage: GrowthStage = GrowthStage.Seed
let lastTickTime = 0   // rAF timestamp

// ─── Canvas ───────────────────────────────────────────────────────────────────
const canvas = document.getElementById('chart-canvas') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!

// ─── DOM helpers ─────────────────────────────────────────────────────────────
function el(id: string): HTMLElement { return document.getElementById(id)! }
function setText(id: string, v: string) { el(id).textContent = v }
function setWidth(id: string, pct: number) { (el(id) as HTMLElement).style.width = `${Math.round(pct)}%` }
function setHeight(id: string, pct: number) { (el(id) as HTMLElement).style.height = `${Math.round(pct)}%` }

// ─── Init / reset ─────────────────────────────────────────────────────────────
function initSim(sp: string) {
  species = sp
  plant = createPlant(sp)
  soil = createOptimalSoil(sp)
  env = { ...createOptimalEnvironment(sp) }
  ecosystem = createDefaultEcosystem()
  history = []
  tickCount = 0
  prevStage = GrowthStage.Seed
  isRaining = false
  el('rain-toggle').classList.remove('on')

  // Sync sliders to optimal env values
  ;(el('temp-sl') as HTMLInputElement).value = String(env.airTemperature)
  ;(el('light-sl') as HTMLInputElement).value = String(Math.round(env.lightIntensity * 100))
  ;(el('co2-sl') as HTMLInputElement).value = String(env.co2)
  ;(el('hum-sl') as HTMLInputElement).value = String(Math.round(env.humidity * 100))
  syncSliderLabels()
}

// ─── Run one tick ─────────────────────────────────────────────────────────────
function runTick() {
  if (!plant.isAlive) return

  const result = tick(plant, soil, env, 1, ecosystem)
  plant = result.plant
  soil = result.soil
  if (result.ecosystem) ecosystem = result.ecosystem
  tickCount++

  // Compute factors for chart
  const stress = plant.stressAccumulator
  const nutFactor = 1 - Math.max(
    stress.nitrogenDeficiency,
    stress.phosphorusDeficiency,
    stress.potassiumDeficiency
  )
  const waterFactor = 1 - stress.drought

  history.push({
    tick: tickCount,
    health: plant.health,
    growth: plant.totalGrowthPoints,
    nutFactor,
    waterFactor,
    stage: plant.stage,
  })

  if (history.length > 600) history.shift()

  // Stage-change log
  if (plant.stage !== prevStage) {
    appendLog(`▸ Tick ${tickCount}: Advanced to ${plant.stage.toUpperCase()}`, 'log-stage')
    prevStage = plant.stage
  }
}

// ─── Science fact generator ───────────────────────────────────────────────────
function scienceFact(): { title: string; body: string } {
  if (!plant.isAlive)
    return { title: '☠️ Plant died', body: 'Accumulated stress exceeded recovery. Reset and try adjusting temperature, water, and nutrients.' }

  const s = plant.stressAccumulator

  if (s.drought > 0.5)
    return { title: '🌵 Drought Stress', body: 'Stomata close to conserve water, blocking CO₂ intake and halting photosynthesis — a trade-off between water loss and carbon gain (Jarvis 1976).' }
  if (s.waterlog > 0.3)
    return { title: '💧 Waterlogging', body: 'Saturated soil has zero oxygen for roots. Anaerobic conditions trigger root rot within days. Reduce rainfall! (Kozlowski 1984).' }
  if (s.heat > 0.5)
    return { title: '🔥 Heat Stress', body: 'Proteins denature above Tmax. Pollen becomes non-viable above 35°C — heat destroys the next generation (Sato et al. 2006).' }
  if (s.cold > 0.5)
    return { title: '❄️ Cold Stress', body: 'Enzyme reactions slow exponentially below Tmin. Membrane lipids solidify, rupturing cells (Levitt 1980).' }
  if (s.nitrogenDeficiency > 0.5)
    return { title: '🟩 N Deficiency (Liebig)', body: 'Nitrogen is in every chlorophyll molecule and amino acid. Without it, leaves yellow (chlorosis). Liebig\'s Law: N is now the limiting nutrient.' }
  if (s.phosphorusDeficiency > 0.5)
    return { title: '🦴 P Deficiency', body: 'Phosphorus powers ATP — the cell\'s energy currency. Low P stunts root growth. Soil pH 6–7 maximizes P availability (Truog 1946).' }
  if (s.potassiumDeficiency > 0.5)
    return { title: '🍌 K Deficiency', body: 'Potassium regulates stomatal opening and sugar transport to fruits. Low K directly reduces harvest quality (Marschner 2012).' }
  if (s.nutrientToxicity > 0.3)
    return { title: '⚗️ Nutrient Toxicity', body: 'Excess salts create osmotic stress — roots lose water by reverse osmosis. Over-fertilizing is as harmful as deficiency.' }
  if (s.pestDamage > 0.3)
    return { title: '🐛 Pest Damage', body: 'Pest populations follow logistic growth: dP/dt = r·P·(1-P/K). Beneficial insects limit them naturally — Lotka-Volterra predator-prey dynamics.' }
  if (soil.pH < 5.5)
    return { title: `⚗️ Acidic Soil (pH ${soil.pH.toFixed(1)})`, body: 'Below pH 5.5, phosphorus bonds to Fe³⁺ and Al³⁺ ions and locks up. Add lime (CaCO₃) to raise pH and unlock nutrients (Truog 1946).' }
  if (soil.pH > 7.5)
    return { title: `⚗️ Alkaline Soil (pH ${soil.pH.toFixed(1)})`, body: 'Above pH 7.5, micronutrients like Fe, Mn, and Zn precipitate out of solution. Add sulfur (→ H₂SO₄) to lower pH.' }

  if (plant.stage === GrowthStage.Seed)
    return { title: '🌰 Seed Bootstrap', body: 'Seeds use cotyledon energy reserves to bootstrap growth before leaf area is large enough to photosynthesize efficiently.' }
  if (plant.stage === GrowthStage.Flowering && species === 'tomato')
    return { title: '🐝 Buzz Pollination', body: 'Bumblebees vibrate at 400 Hz to release tomato pollen (sonication). Heat above 35°C makes pollen non-viable — no fruit set.' }
  if (plant.stage === GrowthStage.Flowering && species === 'grape')
    return { title: '🍇 Vernalization', body: 'Grapes require cold exposure (vernalization) to trigger flowering. The gene FLC is epigenetically silenced by cold (Chouard 1960).' }
  if (plant.stage === GrowthStage.HarvestReady)
    return { title: '🎉 Harvest Ready!', body: `Harvest quality: ${Math.round(plant.harvestQuality)}/100. Potassium drives sugar transport to fruit — K-rich soil = sweeter, higher-quality harvest.` }

  return { title: '☀️ Photosynthesis', body: `Non-rectangular hyperbola model: A = (φI + Amax − √((φI + Amax)² − 4θφI·Amax)) / 2θ. Currently at ${Math.round(plant.totalGrowthPoints)} total growth pts.` }
}

// ─── Render ───────────────────────────────────────────────────────────────────
function render() {
  // Tick counter
  setText('tick-num', String(tickCount))

  // Plant emoji + size
  const emojiMap = PLANT_EMOJI[species] ?? PLANT_EMOJI.lettuce
  const emoji = emojiMap[plant.stage] ?? '🌱'
  const emojiEl = el('plant-emoji')
  if (emojiEl.textContent !== emoji) emojiEl.textContent = emoji
  emojiEl.classList.toggle('big', plant.stage === GrowthStage.HarvestReady)

  // Dead overlay
  el('dead-overlay').classList.toggle('show', !plant.isAlive)

  // Stage progress bar
  const pips = el('stage-bar').querySelectorAll('.stage-pip')
  const stageIdx = STAGE_ORDER.indexOf(plant.stage)
  pips.forEach((pip, i) => {
    pip.classList.toggle('done', i < stageIdx)
    pip.classList.toggle('now', i === stageIdx)
  })

  // Stage label colour
  const stageLbl = el('stage-lbl')
  stageLbl.textContent = STAGE_NAMES[plant.stage] ?? plant.stage
  stageLbl.style.color = plant.stage === GrowthStage.HarvestReady ? '#2d6a4f'
    : plant.stage === GrowthStage.Dead ? '#e63946' : '#1b4332'

  // Health bar
  const hp = plant.health
  setText('health-num', String(Math.round(hp)))
  setWidth('health-fill', hp)
  const hf = el('health-fill')
  hf.style.background = hp < 35 ? '#e63946' : hp < 65 ? '#f9c74f' : '#40916c'

  // Water bar
  const wc = plant.waterContent * 100
  setText('water-num', `${Math.round(wc)}%`)
  setWidth('water-fill', wc)

  // Stats
  setText('growth-num', Math.round(plant.totalGrowthPoints).toString())
  setText('quality-num', Math.round(plant.harvestQuality).toString())
  setText('age-num', `${tickCount} ticks`)

  // Pollination (tomato + corn during flowering)
  const showPoll = plant.stage === GrowthStage.Flowering
  el('poll-row') // exists as stat-row
  if (showPoll) {
    setText('poll-num', `${Math.round(plant.pollinationRate * 100)}%`)
  }

  // Vernalization (grape)
  const sp = species === 'grape'
  el('vern-row').style.display = sp ? 'flex' : 'none'
  if (sp) {
    setText('vern-num', `${plant.coldExposureTicks} / 15 cold ticks`)
  }

  // Science callout
  const fact = scienceFact()
  setText('sc-title', fact.title)
  setText('sc-body', fact.body)

  // Soil status
  const moistPct = soil.moisture * 100
  setText('moist-v', `${Math.round(moistPct)}%`)
  setWidth('moist-fill', moistPct)
  setText('ph-v', soil.pH.toFixed(1))
  setText('n-v', Math.round(soil.nitrogen).toString())
  setText('p-v', Math.round(soil.phosphorus).toString())
  setText('k-v', Math.round(soil.potassium).toString())
  setText('om-v', `${soil.organicMatter.toFixed(1)}%`)
  setText('mb-v', soil.microbeHealth.toFixed(2))

  // Stress indicators
  const st = plant.stressAccumulator
  const ss = (id: string, v: number) => setHeight(id, v * 100)
  ss('s-drought', st.drought)
  ss('s-heat', st.heat)
  ss('s-cold', st.cold)
  ss('s-waterlog', st.waterlog)
  ss('s-n', st.nitrogenDeficiency)
  ss('s-p', st.phosphorusDeficiency)
  ss('s-k', st.potassiumDeficiency)
  ss('s-tox', st.nutrientToxicity)
  ss('s-pest', st.pestDamage)
  ss('s-total', st.total)

  // Ecosystem bars
  const ecosPct = (v: number) => `${Math.round(v * 100)}%`
  setWidth('eco-pests', ecosystem.pestPopulation * 100)
  setText('eco-pests-v', ecosPct(ecosystem.pestPopulation))
  setWidth('eco-bees', ecosystem.beePopulation * 100)
  setText('eco-bees-v', ecosPct(ecosystem.beePopulation))
  setWidth('eco-ben', ecosystem.beneficialInsects * 100)
  setText('eco-ben-v', ecosPct(ecosystem.beneficialInsects))
  setWidth('eco-bio', ecosystem.biodiversityScore * 100)
  setText('eco-bio-v', ecosPct(ecosystem.biodiversityScore))

  drawChart()
}

// ─── Chart drawing ────────────────────────────────────────────────────────────
function drawChart() {
  if (!ctx || history.length < 2) return

  const w = canvas.offsetWidth || 400
  const h = 170
  if (canvas.width !== w) canvas.width = w
  canvas.height = h

  ctx.clearRect(0, 0, w, h)

  // Background
  ctx.fillStyle = '#f8fbf5'
  ctx.fillRect(0, 0, w, h)

  // Grid lines (4 horizontal)
  ctx.strokeStyle = '#e8f0e0'
  ctx.lineWidth = 1
  for (let i = 1; i <= 3; i++) {
    const y = (h / 4) * i
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
  }

  // Y-axis labels
  ctx.fillStyle = '#aaa'
  ctx.font = '9px Inter, sans-serif'
  ctx.fillText('100', 2, 11)
  ctx.fillText('50', 2, h / 2 + 4)
  ctx.fillText('0', 2, h - 3)

  const maxGrowth = Math.max(10, ...history.map(p => p.growth))
  const n = history.length

  // Stage change vertical markers
  ctx.setLineDash([3, 4])
  ctx.strokeStyle = 'rgba(100,120,100,0.25)'
  ctx.lineWidth = 1
  let prev = history[0].stage
  for (let i = 1; i < n; i++) {
    if (history[i].stage !== prev) {
      const x = Math.round((i / (n - 1)) * w)
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
      // Stage label
      ctx.fillStyle = 'rgba(60,100,60,0.5)'
      ctx.font = '8px Inter, sans-serif'
      ctx.fillText(history[i].stage.slice(0, 4), x + 2, 10)
      prev = history[i].stage
    }
  }
  ctx.setLineDash([])

  // Helper to draw a 0-1 scaled line
  function drawLine(
    getData: (p: HistPoint) => number,
    maxVal: number,
    color: string,
    lw = 1.5
  ) {
    ctx.strokeStyle = color
    ctx.lineWidth = lw
    ctx.beginPath()
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * w
      const val = Math.max(0, Math.min(maxVal, getData(history[i])))
      const y = h - (val / maxVal) * (h - 4) - 2
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  // Draw lines: growth (scaled to 100%), health, nut factor, water factor
  drawLine(p => (p.growth / maxGrowth) * 100, 100, '#40916c', 2)   // green
  drawLine(p => p.health,                       100, '#e63946', 1.5) // red
  drawLine(p => p.nutFactor * 100,              100, '#4895ef', 1.5) // blue
  drawLine(p => p.waterFactor * 100,            100, '#f4a261', 1.5) // orange

  // Current growth value on right edge
  if (n > 0) {
    const last = history[n - 1]
    ctx.fillStyle = '#40916c'
    ctx.font = 'bold 10px Inter, sans-serif'
    ctx.fillText(Math.round(last.growth).toString(), w - 38, 12)
  }
}

// ─── Slider sync ─────────────────────────────────────────────────────────────
function syncSliderLabels() {
  const temp = parseFloat((el('temp-sl') as HTMLInputElement).value)
  const light = parseFloat((el('light-sl') as HTMLInputElement).value)
  const co2 = parseFloat((el('co2-sl') as HTMLInputElement).value)
  const hum = parseFloat((el('hum-sl') as HTMLInputElement).value)

  setText('temp-v', `${temp}°C`)
  setText('light-v', `${light}%`)
  setText('co2-v', `${co2} ppm`)
  setText('hum-v', `${hum}%`)

  env.airTemperature = temp
  env.lightIntensity = light / 100
  env.co2 = co2
  env.humidity = hum / 100
}

// ─── Science log helper ───────────────────────────────────────────────────────
function appendLog(msg: string, cls = '') {
  const log = el('science-log')
  const p = document.createElement('p')
  p.textContent = msg
  if (cls) p.className = cls
  log.appendChild(p)
  if (log.children.length > 60) log.removeChild(log.children[0])
  log.scrollTop = log.scrollHeight
}

// ─── Event wiring ─────────────────────────────────────────────────────────────

// Sliders
;['temp-sl', 'light-sl', 'co2-sl', 'hum-sl'].forEach(id => {
  el(id).addEventListener('input', syncSliderLabels)
})

// Species buttons
document.querySelectorAll('.species-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.species-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    const sp = (btn as HTMLElement).dataset.species!
    initSim(sp)
    isRunning = true
    el('pause-btn').textContent = '⏸ Pause'
    const log = el('science-log')
    log.innerHTML = `<p>▸ Started ${sp} simulation. Watch it grow!</p>`
  })
})

// Speed buttons
document.querySelectorAll('.speed-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    speed = parseInt((btn as HTMLElement).dataset.speed!)
  })
})

// Pause / Resume
el('pause-btn').addEventListener('click', () => {
  isRunning = !isRunning
  el('pause-btn').textContent = isRunning ? '⏸ Pause' : '▶ Resume'
})

// Reset
el('reset-btn').addEventListener('click', () => {
  initSim(species)
  isRunning = true
  el('pause-btn').textContent = '⏸ Pause'
  const log = el('science-log')
  log.innerHTML = `<p>▸ Reset. Growing ${species}...</p>`
  el('dead-overlay').classList.remove('show')
})

// Rain toggle
el('rain-toggle').addEventListener('click', () => {
  isRaining = !isRaining
  env.isRaining = isRaining
  env.rainfall = isRaining ? 5 : 0
  el('rain-toggle').classList.toggle('on', isRaining)
  appendLog(isRaining ? '▸ Rain started. Soil moisture rising.' : '▸ Rain stopped.', isRaining ? 'log-stage' : '')
})

// Amendments
document.querySelectorAll('.amend-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const amend = (btn as HTMLElement).dataset.amend!

    if (amend === 'water') {
      soil.moisture = Math.min(1.0, soil.moisture + 0.10)
      appendLog('▸ Watered: +10% soil moisture.', 'log-stage')
    } else if (amend === 'pesticide') {
      ecosystem = applyPesticide(ecosystem, 'targeted')
      appendLog('▸ Targeted pesticide applied. Some beneficial insects affected.', 'log-warn')
    } else {
      soil = applyAmendment(soil, amend as AmendmentType, 50)
      const names: Record<string, string> = {
        compost: 'Compost added: slow NPK release + microbe boost.',
        ammonium_nitrate: 'Ammonium nitrate (NH₄NO₃): +N, slight pH drop.',
        bone_meal: 'Bone meal (Ca₃(PO₄)₂): +P, slight pH rise.',
        potash: 'Potash (KCl): +K, pH neutral.',
        lime: 'Lime (CaCO₃) applied: pH raised via neutralisation.',
        sulfur: 'Elemental sulfur: bacteria oxidise S → H₂SO₄, pH drops.',
      }
      appendLog(`▸ ${names[amend] ?? amend}`, 'log-stage')
    }

    // Visual flash
    const b = btn as HTMLElement
    b.classList.add('flash')
    setTimeout(() => b.classList.remove('flash'), 350)
  })
})

// ─── Game loop ────────────────────────────────────────────────────────────────
function gameLoop(ts: number) {
  if (isRunning && plant.isAlive) {
    const interval = 1000 / speed
    if (ts - lastTickTime >= interval) {
      // Run multiple ticks for high speeds to smooth things out
      const burst = speed >= 10 ? 3 : 1
      for (let i = 0; i < burst; i++) runTick()
      lastTickTime = ts
    }
  }
  render()
  requestAnimationFrame(gameLoop)
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
initSim('lettuce')
syncSliderLabels()
requestAnimationFrame(gameLoop)
