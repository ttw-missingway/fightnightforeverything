import { makeRun, playDay, isDead } from './policy.mjs'
const SRC = new URL('../../src/game', import.meta.url).pathname
const { runAge } = await import(`${SRC}/constants.js`)
const N = Number(process.argv[2] || 6), YEARS = Number(process.argv[3] || 5)
const diff = process.argv[4] || 'normal'
const deaths = [], funnels = {}
const relByYear = Array.from({ length: YEARS }, () => [])
const cashByYear = Array.from({ length: YEARS }, () => [])
for (let i = 0; i < N; i++) {
  const save = makeRun({ difficulty: diff })
  for (let d = 0; d < 336 * YEARS; d++) {
    playDay(save)
    const y = Math.floor(runAge(save) / 336)
    if (y < YEARS) { relByYear[y].push(save.relevance ?? 0); cashByYear[y].push(save.economy.money) }
    if (isDead(save)) break
  }
  if (isDead(save)) {
    deaths.push(runAge(save))
    const f = save.economy.foreclosed ? 'economy' : (save.gameOver?.funnel || '?')
    funnels[f] = (funnels[f] || 0) + 1
  } else deaths.push(null)
}
const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : '—')
console.log(`${diff}, ${N} runs to ${YEARS} years`)
console.log('  year   avg relevance   avg cash')
for (let y = 0; y < YEARS; y++) console.log(`   ${y + 1}   ${String(avg(relByYear[y])).padStart(11)}   ${String(avg(cashByYear[y])).padStart(9)}`)
const died = deaths.filter(d => d != null)
console.log(`  died ${died.length}/${N}`, died.length ? `at day ${died.map(d => Math.round(d / 336 * 10) / 10 + 'y').join(', ')}` : '', JSON.stringify(funnels))
