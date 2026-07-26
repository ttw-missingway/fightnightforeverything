// FORMS: one character that becomes another mid-round.
//
// A form is a complete character — its own movelist, body, archetype, art —
// that nobody can pick. It exists only as the far side of a `form change`
// move, and the bell puts the origin back. That's the whole rule: forms are
// reached through play, never through character select.
//
// THE LINK LIVES IN ONE PLACE. `char.formOf` on the FORM holds its origin's
// id, and origin-ness is DERIVED from that — never stored on the origin. A
// two-sided link would let the halves drift, and the drifted state (a
// character advertising a form that was deleted last month, a form whose
// origin forgot about it) is the exact bug this shape cannot have.
//
// Forms are one level deep. A form cannot itself have forms — see
// `canBeFormOf` — because a transformation chain is a nesting problem in the
// balance model and the fight engine both, and no fighting game needs one.

import { FORM_MOVE_TYPE } from './constants.js'

export { FORM_MOVE_TYPE }

export function isForm(char) {
  return !!char?.formOf
}

/**
 * The pool a player can actually pick from. Everything that reads "the cast"
 * for the purpose of someone CHOOSING — mains, pocket picks, exploration, the
 * tier list, the matchup chart — goes through here. Everything that reads the
 * cast to DISPLAY it (the codex, the studio roster) shows forms too.
 */
export function selectableChars(game) {
  return (game?.characters || []).filter((c) => !c.formOf)
}

/** The forms belonging to an origin, in roster order. */
export function formsOf(game, charId) {
  if (!charId) return []
  return (game?.characters || []).filter((c) => c.formOf === charId)
}

export function originOf(game, char) {
  if (!char?.formOf) return null
  return (game?.characters || []).find((c) => c.id === char.formOf) || null
}

export function isFormOrigin(game, charId) {
  return formsOf(game, charId).length > 0
}

/**
 * Who this character is allowed to be a form of. Excludes itself (a character
 * cannot transform into itself), anything that is already a form (no chains),
 * and — if this character already has forms of its own — everything, because
 * an origin becoming a form would make exactly the chain we just ruled out.
 */
export function canBeFormOf(game, char) {
  if (!char) return []
  if (isFormOrigin(game, char.id)) return []
  return (game?.characters || []).filter((c) => c.id !== char.id && !c.formOf)
}

/**
 * How a character should be NAMED anywhere the reader might not know what
 * they're looking at — patch notes, the codex, the studio roster. A form on
 * its own is a name nobody recognises, because nobody has ever picked it.
 */
export function charLabel(game, char) {
  const origin = originOf(game, char)
  return origin ? `${origin.name} ▸ ${char.name}` : (char?.name ?? '???')
}

// ---------- The switch move ----------

/**
 * Everything this character is allowed to turn INTO.
 *
 * An origin reaches its own forms. A FORM reaches exactly one thing — the
 * origin it came from — so a transformation can be dropped on purpose instead
 * of only expiring at the bell. That's the whole graph: one hop out, one hop
 * home, and no route from a form to a sibling form (which would be a
 * transformation chain by another name).
 */
export function switchTargetsOf(game, char) {
  if (!char) return []
  if (char.formOf) {
    const origin = originOf(game, char)
    return origin ? [origin] : []
  }
  return formsOf(game, char.id)
}

/** Every `form change` move on this character that points somewhere real. */
export function formSwitchMoves(game, char) {
  const ids = new Set(switchTargetsOf(game, char).map((t) => t.id))
  return (char?.moves || []).filter((m) => m.type === FORM_MOVE_TYPE && ids.has(m.d?.becomes))
}

/** What a given move switches into, or null if it points nowhere valid. */
export function targetFormOf(game, char, move) {
  if (move?.type !== FORM_MOVE_TYPE || !move.d?.becomes) return null
  return switchTargetsOf(game, char).find((t) => t.id === move.d.becomes) || null
}

/**
 * The move a FORM uses to drop back to its origin, if it has one. Reverting is
 * opt-in per form: a one-way transformation is a real design (commit and live
 * with it), so a form only comes home if the designer gave it a way to.
 */
export function revertMoveOf(game, form) {
  if (!form?.formOf) return null
  return (form.moves || []).find((m) => m.type === FORM_MOVE_TYPE && m.d?.becomes === form.formOf) || null
}

// How readily the origin can actually GET to the form. This is the price of
// the transformation, and it's the only thing standing between "my form is a
// monster" and "my character is a monster" — see `formPower` below.
//
// Meter is the heaviest lever because it's the one a player has to earn
// during the round; speed and safety matter because a switch you can be
// punished for is a switch you only get to make when you've already won the
// exchange.
const ACCESS_COST = { none: 1, light: 0.9, 'half bar': 0.7, 'full bar': 0.48 }
const ACCESS_SPEED = { instant: 1, fast: 0.98, average: 0.92, slow: 0.82, 'very slow': 0.7 }
const ACCESS_SAFETY = { 'plus-big': 1, plus: 1, even: 0.98, minus: 0.94, punishable: 0.84, 'very punishable': 0.72 }

/** 0..1 — how much of a form's power the origin genuinely has access to. */
export function accessOf(move) {
  const d = move?.d || {}
  return (ACCESS_COST[d.cost] ?? 0.9)
    * (ACCESS_SPEED[d.startup] ?? 0.92)
    * (ACCESS_SAFETY[d.onBlock] ?? 0.94)
}

/**
 * Every form this character can reach, with the best route to each. More than
 * one way into the same form doesn't stack — you still end up in one form —
 * but the EASIEST route is the one that counts, because that's the one a
 * player will use.
 */
export function reachableForms(game, char) {
  const best = new Map()
  for (const m of formSwitchMoves(game, char)) {
    const form = targetFormOf(game, char, m)
    if (!form) continue
    const access = accessOf(m)
    const prev = best.get(form.id)
    if (!prev || access > prev.access) best.set(form.id, { form, move: m, access })
  }
  return [...best.values()]
}

/**
 * Drop any dangling links. Called after a character is deleted: a form whose
 * origin is gone becomes an ordinary character again (it's a complete design
 * — deleting it silently would throw away real work), and a switch move
 * pointing at a form that no longer belongs here forgets its target.
 */
export function pruneForms(game) {
  const ids = new Set((game?.characters || []).map((c) => c.id))
  for (const c of game?.characters || []) {
    if (c.formOf && !ids.has(c.formOf)) c.formOf = null
  }
  for (const c of game?.characters || []) {
    // Valid targets, not just "my forms" — a form's legitimate target is the
    // origin it returns to, and reading this as formsOf would quietly wipe
    // every revert move on load.
    const allowed = new Set(switchTargetsOf(game, c).map((t) => t.id))
    for (const m of c.moves || []) {
      if (m.type === FORM_MOVE_TYPE && m.d?.becomes && !allowed.has(m.d.becomes)) {
        m.d = { ...m.d, becomes: null }
      }
    }
  }
  return game
}
