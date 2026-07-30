// Eureka cadence and the breakthrough : burnout split — metrics 3 and 4
// (docs/REVISION.md §1.11, §2.3).
//
//   node tools/balance/eureka.mjs [runs] [difficulty]
//
// P0 note, on purpose: the eureka spine does not exist yet, so metric 3 is an
// honest zero and metric 4 has only its burnout half — the share of the cast
// that retires with nothing to show for their adversity, which is the current
// game's whole answer to pressure. P1 fills in: breakthroughs per player per
// year, the wound:edge selection ratio, cross-row breakthrough frequency,
// forced resolutions, and cap realisation against the spirit ceilings.

import { instrumentedRun, aggregate } from './metrics.mjs'

const n = Number(process.argv[2] || 12)
const difficulty = process.argv[3] || 'normal'

const t0 = Date.now()
const runs = []
for (let i = 0; i < n; i++) runs.push(instrumentedRun({ seed: 3000 + i, difficulty, years: 8 }))
const agg = aggregate(runs)

console.log(`eureka metrics · ${n} runs × 8y · ${difficulty} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`)
console.log('metric 3 — breakthroughs per player per year:', agg.eureka.breakthroughsPerPlayerYear,
  '(no eureka system; P1 target: front-loaded, thinning, never zero for a focused player)')
console.log('metric 4 — breakthrough share:', agg.eureka.breakthroughShare,
  '· burnout share (cast retired by run end):', agg.eureka.burnoutShare)
console.log('\nretirement dispersion (metric 5): stddev of retirement day =',
  agg.retirementDispersion.meanStddevDays, `days (n=${agg.retirementDispersion.runsMeasured} runs with ≥2 retirements)`)
console.log('\nP1 exit needs: metric 3 in the 10–12/career band, metric 4 neither ~0 nor ~1,')
console.log('a genuinely split wound:edge ratio, and separation (metric 1) widening.')
