import { makeRun, playDay, isDead } from './policy.mjs'
const SRC = new URL('../../src/game', import.meta.url).pathname
const { runAge, seasonOf } = await import(`${SRC}/constants.js`)
const eco = await import(`${SRC}/economy.js`)
const { relevanceFactor } = await import(`${SRC}/relevance.js`)

const diff = process.argv[2] || 'normal'
const save = makeRun({ difficulty: diff })
const rows = []
let prevCash = save.economy.money
for (let d = 0; d < 336; d++) {
  playDay(save)
  const cash = save.economy.money
  const active = Object.values(save.players).filter(p => p.isRegular && !p.retired && !p.banished)
  rows.push({
    day: runAge(save), season: seasonOf(save.day).key,
    net: cash - prevCash, cash,
    att: save.economy.history.at(-1)?.attendance ?? null,
    rel: save.relevance ?? 0, relF: relevanceFactor(save),
    passion: active.length ? active.reduce((a, p) => a + (p.passion ?? 80), 0) / active.length : 0,
    regs: active.length, retired: Object.values(save.players).filter(p => p.retired).length,
    clean: save.arcade.cleanliness ?? 0,
    staff: eco.staffCounts(save).employees + eco.staffCounts(save).managers,
  })
  prevCash = cash
  if (isDead(save)) break
}
console.log(`${diff}`)
console.log('month  att  net/day    cash   rel relF  passion  regs ret clean staff  season')
for (let i = 0; i < rows.length; i += 28) {
  const b = rows.slice(i, i + 28)
  const att = b.filter(x => x.att != null)
  const avg = (f) => b.reduce((a, x) => a + f(x), 0) / b.length
  console.log(
    String(Math.ceil(b[0].day / 28)).padStart(5),
    (att.length ? (att.reduce((a, x) => a + x.att, 0) / att.length).toFixed(1) : ' —').padStart(5),
    avg(x => x.net).toFixed(1).padStart(8),
    String(Math.round(b.at(-1).cash)).padStart(7),
    String(Math.round(avg(x => x.rel))).padStart(5),
    avg(x => x.relF).toFixed(2).padStart(5),
    avg(x => x.passion).toFixed(0).padStart(8),
    String(Math.round(avg(x => x.regs))).padStart(5),
    String(b.at(-1).retired).padStart(4),
    String(Math.round(avg(x => x.clean))).padStart(6),
    String(b.at(-1).staff).padStart(5),
    ' ' + b[Math.floor(b.length / 2)].season)
}
console.log('died:', isDead(save), save.economy.foreclosed ? 'economy' : save.gameOver?.funnel || '', 'day', runAge(save))
