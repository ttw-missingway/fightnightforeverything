import { makeRun, playDay, isDead } from './policy.mjs'
const SRC = new URL('../../src/game', import.meta.url).pathname
const { runAge } = await import(`${SRC}/constants.js`)
const eco = await import(`${SRC}/economy.js`)

// Read the day's ledger lines by date, so the 40-entry cap can't confuse us.
function linesFor(save, day, year) {
  return save.economy.log.filter((l) => l.day === day && l.year === year)
}
const diff = process.argv[2] || 'normal'
const save = makeRun({ difficulty: diff })
const agg = {}
let attSum = 0, attN = 0, days = 0
for (let d = 0; d < 200; d++) {
  const day = save.day, year = save.year
  playDay(save)
  for (const l of linesFor(save, day, year)) {
    const k = l.label.replace(/\d+/g, 'N')
    agg[k] ??= { total: 0, n: 0 }
    agg[k].total += l.amount; agg[k].n++
  }
  const a = save.economy.history.at(-1)?.attendance
  if (a != null) { attSum += a; attN++ }
  days++
  if (isDead(save)) break
}
const att = attSum / Math.max(1, attN)
console.log(`${diff}: ${days} days · avg attendance ${att.toFixed(1)} · staff ${JSON.stringify(eco.staffCounts(save))}`)
console.log('  per-day averages:')
const rows = Object.entries(agg).sort((a, b) => a[1].total - b[1].total)
let inTot = 0, outTot = 0
for (const [k, v] of rows) {
  const perDay = v.total / days
  if (v.total > 0) inTot += v.total; else outTot += v.total
  console.log(`    ${k.padEnd(36)} $${perDay.toFixed(2).padStart(8)}/day  (${v.n}×)`)
}
console.log(`  income $${(inTot/days).toFixed(2)}/day · costs $${(outTot/days).toFixed(2)}/day · net $${((inTot+outTot)/days).toFixed(2)}/day`)
console.log(`  revenue per head: $${(inTot/days/Math.max(0.1,att)).toFixed(2)}`)
