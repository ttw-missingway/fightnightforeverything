// Elite fragments — REVISION §0.4. Elites get NO journal. They get
// fragments: interview quotes, tweets, lines of VOD commentary, sentences
// out of guides. The asymmetry is the mythology — your people are diaries,
// the world's best are headlines. An elite's actual journal unlocks when
// they retire or when one of yours becomes a genuine rival of theirs; both
// arrive with P5, when elites live enough to have written one
// (`journalUnlockedAbs` is the hook, set here, filled there).
//
// Voice is the elite PERSONA (generate.js): loyalist, meta-chaser,
// lab-monster, showman, veteran.

import { choice } from './util.js'
import { absDayOf } from './constants.js'
import FRAGMENTS from '../content/fragments.json' with { type: 'json' }

const CAP = 16

export function addFragment(save, elite, kind, text) {
  elite.fragments ??= []
  elite.fragments.unshift({ absDay: absDayOf(save.day, save.year), kind, text })
  if (elite.fragments.length > CAP) elite.fragments.length = CAP
}

const fill = (t, data) => t.replace(/\{(\w+)\}/g, (_, k) => (data[k] != null ? String(data[k]) : '…'))

/**
 * Elite fragments live in `src/content/fragments.json`. Shape:
 * { situation: { persona: [ "kind|text", ... ] } } where kind is one of
 * interview / tweet / vod / guide. Interpolants: {alias}, {char}, {n},
 * {event}.
 */


/** Compose and attach one fragment. `data` fills {char}, {alias}, {n}. */
export function eliteFragment(save, elite, situation, data = {}) {
  const table = FRAGMENTS[situation]
  if (!table) return null
  const variants = table[elite.persona] || table.veteran
  const [kind, text] = choice(variants).split('|')
  addFragment(save, elite, kind, fill(text, { alias: elite.alias, ...data }))
  return elite.fragments[0]
}

/** The monthly drip: one line of world texture on a ranked name. */
export function fragmentsMonthly(save) {
  const pool = (save.evoRoster || []).slice(0, 24)
  if (!pool.length) return
  const elite = choice(pool)
  eliteFragment(save, elite, 'idle')
}
