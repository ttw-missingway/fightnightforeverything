// Scenario fixtures for the dev suite — REVISION §3.
//
//   node tools/balance/fixtures.mjs
//
// The interesting states in this game are expensive to reach by playing: a
// toxic room takes a year of neglect, a dynasty takes five. This bakes them
// as committed JSON saves the dev suite loads in one click (always as a COPY
// — nothing in the dev suite writes to a real save). Regenerate whenever the
// save schema moves; the saves carry schemaVersion and are refused like any
// other save once they age out.
//
// Fixtures are seeded, so regenerating on unchanged code is a no-op diff.

import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { makeRun, playRun, isDead } from './policy.mjs'
import { CRISES } from './recovery.mjs'

const OUT = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')

// Keep fixtures lean enough to commit: replays are by far the heaviest
// payload and no fixture scenario is about watching tape. And the headless
// player never watches the opening cinematic, so clear the flag — a
// five-year-old arcade should not grand-open on load.
function strip(save) {
  save.vods = []
  if (save.lastTournament) save.lastTournament = null
  save.grandOpening = false
  return save
}

function bake(name, blurb, build) {
  const save = build()
  if (!save) {
    console.log(`✗ ${name}: run died before the scenario existed — pick a new seed`)
    return
  }
  save.saveName = `fixture: ${name}`
  strip(save)
  const payload = { format: 'fightnight-fixture', formatVersion: 1, name, blurb, save }
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify(payload))
  const kb = Math.round(JSON.stringify(payload).length / 1024)
  console.log(`✓ ${name} (${kb}KB) — ${blurb}`)
}

function runYears(seed, years) {
  const save = makeRun({ seed, difficulty: 'normal' })
  playRun(save, Math.round(years * 336))
  return isDead(save) ? null : save
}

mkdirSync(OUT, { recursive: true })

bake('year-2-established', 'a healthy scene, two years in — regulars, teams, a channel', () => runYears(501, 2))

bake('year-5-dynasty', 'five years survived on normal — the late-game state most testing never reaches', () => runYears(524, 5))

bake('toxic-room', 'the three most intense players at each other\'s throats, day ~400', () => {
  const save = runYears(502, 1.2)
  if (!save) return null
  CRISES.toxicity.inject(save)
  return save
})

bake('burnout-star', 'the best player in the building at passion 10 — retirement is armed', () => {
  const save = runYears(503, 1.5)
  if (!save) return null
  CRISES.burnout.inject(save)
  return save
})

bake('irrelevant', 'relevance cratered to 20 — the world stopped caring', () => {
  const save = runYears(504, 1.5)
  if (!save) return null
  CRISES.irrelevance.inject(save)
  return save
})

bake('plateau', 'the disease of §0 imposed: everyone 40–50 skill, 1450–1620 elo', () => {
  const save = runYears(505, 3)
  if (!save) return null
  CRISES.plateau.inject(save)
  return save
})

bake('broke', 'under $60 with rent coming — the economy guard rail, close up', () => {
  const save = runYears(506, 1.5)
  if (!save) return null
  save.economy.money = 55
  return save
})
