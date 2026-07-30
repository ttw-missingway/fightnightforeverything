// Attention cost — metric 6 (docs/REVISION.md §2.5): MUTATING decisions per
// in-game week, by year. Depth may grow; clicks may not. Target shape is
// ~flat from year 1 to year 10.
//
//   node tools/balance/attention.mjs [runs] [difficulty]
//
// Reads the same counters the browser writes (save.attention, bumped at the
// store boundary; the headless competent player notes its decisions as it
// makes them). Steady-state excludes creation and run setup by definition.

import { instrumentedRun, aggregate } from './metrics.mjs'

const n = Number(process.argv[2] || 8)
const difficulty = process.argv[3] || 'normal'

const t0 = Date.now()
const runs = []
for (let i = 0; i < n; i++) runs.push(instrumentedRun({ seed: 4000 + i, difficulty, years: 10 }))
const agg = aggregate(runs)

console.log(`attention · ${n} runs × 10y · ${difficulty} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`)
console.log('year  alive  steady decisions/week')
for (const y of agg.perYear) {
  console.log(`  y${String(y.year).padEnd(3)} ${String(y.runsAlive).padStart(2)}/${n}    ${y.attentionPerWeek}`)
}
const totals = runs.map((r) => r.final)
console.log('\nmean per run — total:', Math.round(totals.reduce((s, f) => s + f.attentionTotal, 0) / n),
  '· steady:', Math.round(totals.reduce((s, f) => s + f.attentionSteady, 0) / n),
  '(the gap is creation + run setup, excluded from steady by §2.5)')
console.log('\ndecision kinds, first run:', runs[0].save?.attention?.byKind ?? '(run save not kept)')
