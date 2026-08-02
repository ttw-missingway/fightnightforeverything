// CONTENT LINT — does every authored line survive contact with the game?
//
// The prose moved out of the engine into src/content/*.json. That is a good
// trade (see that directory's README) with one new failure mode: a key can be
// renamed or a placeholder misspelled, and neither throws — the line simply
// prints `[missing line: …]` or grows an ellipsis where a name should be.
// Both are invisible in a build and obvious to a player, which is the worst
// combination. So: play some real runs and read everything they printed.
//
//   node tools/balance/content.mjs [runs] [years]

import { readFileSync } from 'node:fs'
import { makeRun, playDay, DEFAULT_POLICY } from './policy.mjs'
import { DAYS_PER_YEAR } from '../../src/game/constants.js'

const runs = Number(process.argv[2] || 3)
const years = Number(process.argv[3] || 4)

const CHRONICLE = JSON.parse(readFileSync('src/content/chronicle.json', 'utf8'))
const chronicleKeys = Object.keys(CHRONICLE).filter((k) => !k.startsWith('_'))

// To tell which authored lines actually appeared, match on each template's
// LONGEST literal run — the stretch between placeholders. Splitting on the
// first `{` doesn't work: most of these lines open with a name, so the stem
// before the first placeholder is the empty string and matches nothing, which
// made the coverage number read as 14/82 when it wasn't.
const fingerprints = Object.fromEntries(chronicleKeys.map((k) => [
  k,
  (CHRONICLE[k] || '').split(/\{\w+\}/).map((s) => s.trim())
    .sort((a, b) => b.length - a.length)[0] || '',
]))

const seenKeys = new Set()
const problems = []
let checked = 0

const check = (where, text) => {
  if (typeof text !== 'string' || !text) return
  checked += 1
  if (text.includes('[missing line:')) problems.push(`${where}: ${text}`)
  // A literal `{word}` means a placeholder nothing filled — the template and
  // the call site disagree about a name.
  const raw = text.match(/\{(\w+)\}/)
  if (raw) problems.push(`${where}: unfilled {${raw[1]}} — "${text.slice(0, 90)}"`)
  // A leading or doubled ellipsis is `fill` papering over a missing key.
  if (/^…|… …|\(…\)|: …$/.test(text)) problems.push(`${where}: hole — "${text.slice(0, 90)}"`)
}

for (let i = 0; i < runs; i++) {
  const save = makeRun({ seed: 7000 + i, difficulty: 'normal', policy: DEFAULT_POLICY })
  for (let d = 0; d < years * DAYS_PER_YEAR; d++) playDay(save, DEFAULT_POLICY)

  for (const c of save.chronicle || []) {
    check('chronicle', c.text)
    for (const k of chronicleKeys) {
      const fp = fingerprints[k]
      if (fp.length > 12 && c.text.includes(fp)) seenKeys.add(k)
    }
  }
  for (const p of Object.values(save.players)) {
    for (const e of p.journal || []) check('journal', e.text)
    for (const m of p.memories || []) check('memory', m.text || m.what)
  }
  for (const post of save.socialFeed?.posts || []) check('feed', post.text)
  for (const e of save.evoRoster || []) {
    for (const f of e.fragments || []) check('fragment', f.text)
  }
  for (const g of save.guides || []) check('guide', g.charName)
}

console.log(`\ncontent lint · ${runs} runs × ${years}y · ${checked} authored strings rendered`)
if (!problems.length) {
  console.log('✅ no missing keys, no unfilled placeholders, no holes')
} else {
  console.log(`❌ ${problems.length} problem${problems.length === 1 ? '' : 's'}:`)
  for (const p of [...new Set(problems)].slice(0, 40)) console.log('  ', p)
}

// Coverage is a HINT, not an assertion. A line whose longest literal run is
// under twelve characters ("released —", " won ") is too short to match on
// without false positives, so it can never be counted; and plenty of these are
// genuinely rare (foreclosure, a ban, one of yours winning EVO). Read a name
// on this list as "go and check that one by hand", never as "this is broken".
const unmatchable = chronicleKeys.filter((k) => fingerprints[k].length <= 12)
const unseen = chronicleKeys.filter((k) => !seenKeys.has(k) && !unmatchable.includes(k))
console.log(`\nchronicle keys exercised: ${seenKeys.size}/${chronicleKeys.length - unmatchable.length} matchable`)
if (unmatchable.length) console.log(`  (${unmatchable.length} too short to fingerprint — not counted either way)`)
if (unseen.length) {
  console.log('  not seen in this sample (rare events, or dead keys):')
  console.log('  ', unseen.join(', '))
}
