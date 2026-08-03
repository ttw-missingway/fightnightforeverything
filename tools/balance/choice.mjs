// METRIC: IS A BREAKTHROUGH A CHOICE?
//
// §1.3 says the choice between fixing the flaw and sharpening the blade IS the
// eureka system. Nothing ever measured whether that choice existed, and mostly
// it did not. Two causes, both arithmetic:
//
//   · talentBreadth clamped to 1–4, so a specialist was offered one option;
//   · GLOW_FRAC 0.35 against the meter threshold meant at most three same-row
//     stats — or ONE cross-row stat — could clear the glow line at once, while
//     an evenly-spread month cleared none at all and fell through to
//     candidatesFor's single-most-pressured-stat fallback.
//
// Both tails of the distribution therefore produced the same screen: one
// button. This reads the offer recorded on each breakthrough (eureka.js writes
// `offered` / `offeredReady` / `offeredKinds` into the log) and reports what
// the panel actually put in front of the player.
//
//   node tools/balance/choice.mjs [runs] [years] [difficulty]

import { makeRun, playDay, DEFAULT_POLICY } from './policy.mjs'
import { DAYS_PER_YEAR } from '../../src/game/constants.js'
import { candidatesFor } from '../../src/game/eureka.js'

const runs = Number(process.argv[2] || 8)
const years = Number(process.argv[3] || 6)
const difficulty = process.argv[4] || 'normal'

const offers = []
// THE WAIT. Only glowing stats are ever offered, so a meter can fill with
// nothing lit and the panel simply holds. That is the right call — being asked
// to pick between things that haven't happened is worse than being asked
// nothing — but it is only defensible if the wait is SHORT, which is what
// meterRelief is for. This counts the days between a meter filling and a
// choice actually arriving.
const waits = []
const t0 = Date.now()

for (let i = 0; i < runs; i++) {
  const save = makeRun({ seed: 3000 + i, difficulty, policy: DEFAULT_POLICY })
  const fullSince = new Map() // playerId → absDay the meter first went full
  for (let d = 0; d < years * DAYS_PER_YEAR; d++) {
    playDay(save, DEFAULT_POLICY)
    const abs = (save.year - 1) * DAYS_PER_YEAR + save.day
    for (const p of Object.values(save.players)) {
      if (p.npc || p.createdBy !== 'user' || !p.eureka) continue
      const e = p.eureka
      const meter = Object.values(e.pressure).reduce((s, v) => s + v, 0)
      const full = meter >= e.threshold
      if (!full) { fullSince.delete(p.id); continue }
      if (!fullSince.has(p.id)) fullSince.set(p.id, abs)
      // The moment a choice is actually on the table, bank how long it took.
      if (candidatesFor(p).length) {
        waits.push(abs - fullSince.get(p.id))
        fullSince.delete(p.id)
      }
    }
  }
  for (const p of Object.values(save.players)) {
    if (p.npc || p.createdBy !== 'user') continue
    for (const l of p.eureka?.log || []) {
      if (l.offered == null) continue // NPC-style auto-resolve, or a veteran output
      offers.push(l)
    }
  }
}

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
const hist = (xs) => {
  const h = {}
  for (const x of xs) h[x] = (h[x] || 0) + 1
  return Object.entries(h).sort((a, b) => a[0] - b[0])
    .map(([k, v]) => `${k}:${v} (${Math.round((v / xs.length) * 100)}%)`).join('  ')
}

if (!offers.length) {
  console.log('no breakthroughs were offered to a player in this sample.')
  process.exit(0)
}
const ns = offers.map((o) => o.offered)
const readys = offers.map((o) => o.offeredReady)
const kinds = offers.map((o) => o.offeredKinds)

console.log(`\nchoice · ${runs} runs × ${years}y · ${difficulty} · ${Math.round((Date.now() - t0) / 1000)}s`)
console.log(`breakthroughs offered to the player: ${offers.length}\n`)
console.log(`options per breakthrough — mean ${mean(ns).toFixed(2)}`)
console.log(`  ${hist(ns)}`)
console.log(`  ONLY ONE OPTION: ${(ns.filter((n) => n <= 1).length / ns.length * 100).toFixed(1)}%   ← the failure mode; target 0%`)
console.log(`\ngenuinely ready (not a half-formed stand-in) — mean ${mean(readys).toFixed(2)}`)
console.log(`  ${hist(readys)}`)
console.log(`\ndistinct kinds on offer (wound/edge/influence) — mean ${mean(kinds).toFixed(2)}`)
console.log(`  ${hist(kinds)}`)
console.log(`  every option the same kind: ${(kinds.filter((k) => k <= 1).length / kinds.length * 100).toFixed(1)}%`)

if (waits.length) {
  const sorted = [...waits].sort((a, b) => a - b)
  const p = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]
  console.log(`\ndays from METER FULL to a choice being on the table — mean ${mean(waits).toFixed(2)}`)
  console.log(`  median ${p(0.5)} · p90 ${p(0.9)} · worst ${sorted[sorted.length - 1]}`)
  console.log(`  same-day: ${(waits.filter((w) => w === 0).length / waits.length * 100).toFixed(1)}%  ·  over a week: ${(waits.filter((w) => w > 7).length / waits.length * 100).toFixed(1)}%`)
}
