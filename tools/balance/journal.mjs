// Journal dump — a CONTENT tool, not a balance tool (docs/REVISION.md §2.4).
// The journal is the front of the game from P2 on; prose quality decides
// whether the eureka system sings or embarrasses. This dumps one player's
// career as their memory feed reads today, so entry quality can be judged
// without playing. Until P2 promotes memories[] into the first-class journal,
// what this shows is the raw material.
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

console.log(`${fullName(p)} — ${p.temperament || '?'} / ${p.socialTemperament || '?'}`)
console.log(`elo ${Math.round(p.elo)} · ${p.wins}W/${p.losses}L · ${p.tournamentWins} brackets · passion ${Math.round(p.passion)}`
  + (p.retired ? ` · RETIRED ${formatDay(p.retiredDay, p.retiredYear)}` : ''))
console.log(`${p.memoriesWritten || 0} moments written over the career; the shelf keeps ${p.memories.length}:\n`)

const sorted = [...(p.memories || [])].sort((a, b) => (a.absDay ?? 0) - (b.absDay ?? 0))
for (const m of sorted) {
  console.log(`  ${formatDay(m.day, m.year).padEnd(22)} [${m.kind}] ${m.text}`)
}
if (!sorted.length) console.log('  (an empty shelf — nothing has happened to this person)')
console.log(`\ncast index runs 0–${cast.length - 1}; pass a different idx to read another career.`)
