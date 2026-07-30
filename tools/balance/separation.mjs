// Separation — metric 1, THE metric (docs/REVISION.md §2.3). Top-5% ÷ median
// of skill and elo across the world (active cast + elites), per year. The
// revision works if this WIDENS across a run and fails if it converges.
//
//   node tools/balance/separation.mjs [runs] [years] [difficulty]

import { instrumentedRun, aggregate, mean } from './metrics.mjs'

const n = Number(process.argv[2] || 12)
const years = Number(process.argv[3] || 10)
const difficulty = process.argv[4] || 'normal'

const t0 = Date.now()
const runs = []
for (let i = 0; i < n; i++) runs.push(instrumentedRun({ seed: 2000 + i, difficulty, years }))
const agg = aggregate(runs)

console.log(`separation over ${years}y · ${n} runs · ${difficulty} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`)
console.log('year  alive  sep(skill)  sep(elo)  cast mean/top (σ)')
for (const y of agg.perYear) {
  console.log(`  y${String(y.year).padEnd(3)} ${String(y.runsAlive).padStart(2)}/${n}`
    + `   ${String(y.separationSkill ?? '—').padStart(6)}`
    + `    ${String(y.separationElo ?? '—').padStart(6)}`
    + `   ${y.castMeanSkill}/${y.castTopSkill} (σ${y.castSkillStddev})`)
}
const first = agg.perYear[0], last = agg.perYear.at(-1)
if (first && last && first.separationSkill && last.separationSkill) {
  const dir = last.separationSkill > first.separationSkill * 1.05 ? 'WIDENING'
    : last.separationSkill < first.separationSkill * 0.95 ? 'CONVERGING' : 'FLAT'
  console.log(`\nverdict: ${dir} (skill ${first.separationSkill} → ${last.separationSkill})`)
  console.log('the revision needs this to widen; flat or converging is the disease of §0')
}
console.log('\nmean retirements/run/year:', mean(agg.perYear.map((y) => y.retirements)).toFixed(1))
