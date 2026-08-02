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

const runs = Number(process.argv[2] || 8)
const years = Number(process.argv[3] || 6)
const difficulty = process.argv[4] || 'normal'

const offers = []
const t0 = Date.now()

for (let i = 0; i < runs; i++) {
  const save = makeRun({ seed: 3000 + i, difficulty, policy: DEFAULT_POLICY })
  for (let d = 0; d < years * DAYS_PER_YEAR; d++) playDay(save, DEFAULT_POLICY)
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
