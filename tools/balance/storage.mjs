// WILL THIS SAVE STILL FIT IN A BROWSER?
//
// The worst failure this app has is silent: localStorage refuses the write,
// the game keeps playing, every screen looks right, and a reload throws away
// the session. It happened for real — a save on EVO day measured 4.13 MB
// against a ~5 MB quota, because the EVO record (~1.9 MB of per-line playback
// data) was serialised TWICE: `save.lastTournament` and `save.vods[0]` are
// deliberately the same object, and JSON.stringify does not know that.
//
// Two fixes came out of it, and both need a guard:
//   · the shared record is stored as a pointer (model.js toStorage/fromStorage)
//   · an oversized record sheds its pools' playback extras (compactRecord)
//
// This measures the save across a long run and asserts the pointer round-trips
// with its reference sharing intact — because if `lastTournament === vods[0]`
// ever stops being true after a load, the reveal cursor silently forks and a
// tournament you watched shows up unwatched.
//
//   node tools/balance/storage.mjs [years] [difficulty]

import { makeRun, playDay, DEFAULT_POLICY } from './policy.mjs'
import { toStorage, fromStorage } from '../../src/game/model.js'
import { DAYS_PER_YEAR } from '../../src/game/constants.js'

const years = Number(process.argv[2] || 6)
const difficulty = process.argv[3] || 'normal'

// Chrome/Safari/Firefox all land near 5 MB per origin for localStorage, and
// that budget is shared with every OTHER save the player has.
const QUOTA_MB = 5
const WARN_MB = 3.5

const save = makeRun({ seed: 5, difficulty, policy: DEFAULT_POLICY })
const sz = (v) => { try { return JSON.stringify(v ?? null).length } catch { return 0 } }
const storedMB = () => sz(toStorage(save)) / 1048576

console.log(`\nstorage · ${years}y · ${difficulty}   (quota ≈ ${QUOTA_MB} MB, shared across ALL saves)\n`)
let worst = 0
let worstAt = ''
for (let y = 1; y <= years; y++) {
  for (let d = 0; d < DAYS_PER_YEAR; d++) {
    playDay(save, DEFAULT_POLICY)
    const mb = storedMB()
    if (mb > worst) { worst = mb; worstAt = `y${y} d${save.day}` }
  }
  const mb = storedMB()
  const top = Object.entries(save).map(([k, v]) => [k, sz(v)])
    .sort((a, b) => b[1] - a[1]).slice(0, 4)
    .map(([k, n]) => `${k}:${(n / 1024).toFixed(0)}k`).join(' ')
  const flag = mb >= QUOTA_MB ? '❌' : mb >= WARN_MB ? '⚠️ ' : '  '
  console.log(`${flag} y${y}  ${mb.toFixed(2)} MB   ${top}`)
}
console.log(`\npeak ${worst.toFixed(2)} MB at ${worstAt} (the spike is whichever day EVO lands)`)

// Where the weight actually is, so the next person tuning this starts in the
// right place rather than guessing.
const per = {}
for (const p of Object.values(save.players)) for (const k of Object.keys(p)) per[k] = (per[k] || 0) + sz(p[k])
const cast = Object.values(save.players).filter((p) => !p.npc)
const filler = Object.values(save.players).filter((p) => p.npc)
console.log(`\nplayers — cast ${cast.length}: ${(sz(cast) / 1024).toFixed(0)}k · filler ${filler.length}: ${(sz(filler) / 1024).toFixed(0)}k`)
console.log('  ' + Object.entries(per).sort((a, b) => b[1] - a[1]).slice(0, 8)
  .map(([k, n]) => `${k}:${(n / 1024).toFixed(0)}k`).join('  '))

// ---------- The pointer contract ----------
const checks = []
const check = (name, ok) => { checks.push([name, ok]); }

const live = save.lastTournament
const wire = JSON.parse(JSON.stringify(toStorage(save)))
check('a shared record is stored as a pointer, not a second copy',
  live && save.vods.includes(live) ? (!wire.lastTournament && !!wire.lastTournamentId) : true)
const back = fromStorage(wire)
check('it comes back with identical content', JSON.stringify(back.lastTournament) === JSON.stringify(live))
check('it comes back as ONE object shared with vods[0] (the reveal cursor)',
  !live || !save.vods.includes(live) || back.lastTournament === back.vods.find((v) => v.id === live.id))
check('the pointer field is cleaned off the loaded save', back.lastTournamentId === undefined)
// A record that has rolled off the VOD list must be stored inline, not dangle.
const orphan = toStorage({ ...save, vods: [], lastTournament: live })
check('a record no longer in vods stays inline', !!orphan.lastTournament && !orphan.lastTournamentId)
check('and survives the round trip',
  fromStorage(JSON.parse(JSON.stringify(orphan))).lastTournament?.id === live?.id)

console.log('')
for (const [name, ok] of checks) console.log(`${ok ? '✅' : '❌'} ${name}`)
if (checks.some(([, ok]) => !ok)) process.exit(1)
if (worst >= QUOTA_MB) {
  console.log(`\n❌ peak ${worst.toFixed(2)} MB is over the ${QUOTA_MB} MB quota — this run would stop saving.`)
  process.exit(1)
}
