// The eureka spine's report card — REVISION §1.11. What settles P1:
//
//   node tools/balance/eureka.mjs [runs] [difficulty]
//
//  - breakthroughs per player per year (metric 3): front-loaded, thinning,
//    never zero for a focused player; 8–11 over a six-year career
//  - the wound : edge selection ratio — if it collapses to one side, §1.3's
//    tension is fake and the system is a skill tree
//  - cross-row frequency and temperament-change rate (§1.5's inertia)
//  - forced-resolution rate (§1.4's deadline)
//  - the breakthrough : burnout split (metric 4) — neither ~0 nor ~1
//  - cap realisation — if most top out the ceilings are too low; if almost
//    none do the spirit layer is invisible and §1.6's steering never happens
//  - which axis tops FIRST vs the spirit's ordering — the narrative
//    attractor either shows up here or is not real

import { instrumentedRun, aggregate } from './metrics.mjs'

const n = Number(process.argv[2] || 12)
const difficulty = process.argv[3] || 'normal'

const t0 = Date.now()
const runs = []
for (let i = 0; i < n; i++) runs.push(instrumentedRun({ seed: 3000 + i, difficulty, years: 8 }))
const agg = aggregate(runs)
const e = agg.eureka

console.log(`eureka · ${n} runs × 8y · ${difficulty} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`)
console.log('metric 3 — breakthroughs/player/year by year (target: front-loaded, thinning):')
for (const y of agg.perYear) {
  console.log(`  y${String(y.year).padEnd(3)} ${String(y.breakthroughsPerPlayer).padStart(5)}  (alive ${y.runsAlive}/${agg.runs})`)
}
console.log(`\ncareers measured: ${e.careers} · mean career breakthroughs: ${e.meanCareerBreakthroughs} (target 8–11 over ~6y)`)
console.log(`chosen kinds w/e/i: ${e.chosenKinds.wound}/${e.chosenKinds.edge}/${e.chosenKinds.influence}`
  + ` · wound:edge ratio ${e.woundEdgeRatio} (collapse to either side = skill tree)`)
console.log(`forced-resolution share: ${e.forcedShare} · cross-row share: ${e.crossRowShare}`
  + ` · temperament changes: ${e.temperamentChanges} across ${e.careers} careers (should be RARE)`)
console.log(`\nmetric 4 — the wager, top adversity quartile: breakthrough ${e.breakthroughShare} vs burnout ${e.burnoutShare}`
  + ' (neither ~0 nor ~1)')
console.log(`\ncap realisation (share of careers reaching each ceiling):`, e.capRealisation)
console.log(`topped any axis: ${e.toppedAnyShare} · attractor match (first-topped axis = spirit primary): ${e.attractorMatch}`)
console.log('\nseparation check (metric 1 — the one that decides everything):')
const first = agg.perYear[0], last = agg.perYear.at(-1)
for (const y of agg.perYear) {
  console.log(`  y${y.year}: local ${y.separationLocalSkill}/${y.separationLocalElo} · world ${y.separationSkill}/${y.separationElo} · cast σ ${y.castSkillStddev}`)
}
if (first?.separationLocalSkill && last?.separationLocalSkill) {
  const a = first.separationLocalSkill, b = last.separationLocalSkill
  // Year 1's ratio is a startup artifact (newcomers at skill 8 inflate the
  // spread), so judge the mature scene from its TROUGH: the disease was
  // convergence that never re-stratifies; recovery is the turn after the dip.
  const troughIdx = agg.perYear.reduce((best, y, i) =>
    (y.separationLocalSkill != null && y.separationLocalSkill < agg.perYear[best].separationLocalSkill ? i : best), 0)
  const trough = agg.perYear[troughIdx]
  console.log(`  → y1→end: ${a} → ${b} · trough y${trough.year} ${trough.separationLocalSkill} → end ${b}`
    + ` · ${b > trough.separationLocalSkill * 1.05 ? 'RE-STRATIFYING after the trough ✅' : 'still flat past the trough ❌'}`)
}
