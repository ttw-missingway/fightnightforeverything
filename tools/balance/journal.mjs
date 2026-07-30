// Journal dump — a CONTENT tool, not a balance tool (docs/REVISION.md §2.4).
// The journal is the front of the game now; prose quality decides whether
// the eureka system sings or embarrasses. This dumps one player's career as
// their journal reads, threads and all, so entry quality can be judged
// without playing. THE P2 EXIT TEST: a year of this must read as a story.
//
//   node tools/balance/journal.mjs [playerIdx] [years] [seed] [difficulty]

import { formatDay } from '../../src/game/constants.js'
import { fullName } from '../../src/game/util.js'
import { makeRun, playRun } from './policy.mjs'

const idx = Number(process.argv[2] || 0)
const years = Number(process.argv[3] || 4)
const seed = Number(process.argv[4] || 7777)
const difficulty = process.argv[5] || 'normal'

const save = makeRun({ seed, difficulty })
playRun(save, years * 336)

const cast = Object.values(save.players).filter((p) => !p.npc && p.createdBy === 'user')
const p = cast[idx]
if (!p) {
  console.error(`no cast member at index ${idx} (cast size ${cast.length})`)
  process.exit(1)
}

const yearsPlayed = new Set((p.journal || []).map((e) => e.year)).size || 1
console.log(`${fullName(p)} — ${p.temperament || '?'} / ${p.socialTemperament || '?'} / ${p.spirit || '?'}`)
console.log(`elo ${Math.round(p.elo)} · ${p.wins}W/${p.losses}L · ${p.tournamentWins} brackets · passion ${Math.round(p.passion)}`
  + (p.retired ? ` · RETIRED ${formatDay(p.retiredDay, p.retiredYear)}` : ''))
console.log(`${p.journalWritten || 0} entries (${((p.journalWritten || 0) / yearsPlayed).toFixed(1)}/yr — metric 7 band is 15–30)`)

const threadName = Object.fromEntries((p.threads || []).map((t) => [t.id, t.kind]))
let lastYear = null
for (const e of p.journal || []) {
  if (e.year !== lastYear) {
    lastYear = e.year
    console.log(`\n───── Year ${e.year} ─────`)
  }
  const margin = [
    e.deltas?.map((d) => `${d.stat}${d.points > 0 ? '+' + d.points : ''}`).join(' '),
    e.thread ? `🧵${threadName[e.thread] || 'thread'}` : null,
  ].filter(Boolean).join(' · ')
  console.log(`${formatDay(e.day, e.year).padEnd(22)}${e.text}${margin ? `\n${' '.repeat(22)}⌊ ${margin}` : ''}`)
}
const open = (p.threads || []).filter((t) => !t.closedAbs)
console.log(`\nopen threads: ${open.map((t) => t.kind + (t.subjectId ? `(${save.players[t.subjectId]?.alias || '?'})` : '')).join(', ') || 'none'}`)
console.log(`cast index runs 0–${cast.length - 1}; pass a different idx to read another career.`)
