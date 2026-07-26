// HOW CLOSE IS THIS RUN TO ENDING?
//
// A run can end three ways, and every one of them is a COUNTER that has been
// ticking for days before it fires: days in the red, days with an empty room,
// days out of the national conversation. All three were already stored on the
// save and none of them were ever shown, so the first time an owner learned
// they were in trouble was the modal telling them the run was over.
//
// The landlord did send two letters, but they were recap events — one line in a
// day's feed, gone as soon as you clicked past it. The other two funnels sent
// nothing at all.
//
// This module is pure derivation over state that already exists: no schema, no
// migration, and it reads correctly on a save made before it existed.
//
// Imports only constants.js, so anything can use it.

import { difficultyOf } from './constants.js'

// Below this fraction of the grace period we say nothing. An owner who dips
// into the red for one night hasn't done anything wrong, and crying wolf on
// day one is how a warning system teaches people to ignore it.
const QUIET_UNTIL = 0.3
const CRITICAL_AT = 0.75
const WARNING_AT = 0.5

/** How many of the user's OWN players are still active. */
export function activeCast(save) {
  return Object.values(save.players || {})
    .filter((p) => !p.npc && !p.retired && !p.banished)
}

function severityOf(frac) {
  if (frac >= CRITICAL_AT) return 'critical'
  if (frac >= WARNING_AT) return 'warning'
  return 'watch'
}

/**
 * Every way this run is currently dying, worst first. Empty array means
 * nothing is wrong — which is the common case, and important: a banner that is
 * always on the screen is wallpaper.
 *
 * Each danger carries what is happening, how long is left, and what the owner
 * can actually DO about it. A countdown with no lever is just anxiety.
 */
export function runDangers(save) {
  if (!save || save.gameOver || save.settings?.mode === 'sandbox') return []
  const diff = difficultyOf(save)
  const out = []

  // ---- the bank ----
  const redDays = save.economy?.redDays || 0
  const redGrace = diff.foreclosureGrace ?? 21
  if (redDays > redGrace * QUIET_UNTIL) {
    const left = Math.max(0, redGrace - redDays + 1)
    out.push({
      key: 'economy',
      icon: '🔒',
      frac: redDays / redGrace,
      severity: severityOf(redDays / redGrace),
      title: left <= 3 ? 'The landlord is changing the locks' : 'The landlord is losing patience',
      detail: `${redDays} day${redDays === 1 ? '' : 's'} in the red. Foreclosure in ${left} day${left === 1 ? '' : 's'} if the account doesn't get back above zero.`,
      fix: 'Raise token or food prices, cut staff or advertising, or stock something people actually buy.',
      to: 'manage',
    })
  }

  // ---- the room ----
  const quietDays = save.quietDays || 0
  if (quietDays > diff.collapseGrace * QUIET_UNTIL) {
    const left = Math.max(0, diff.collapseGrace - quietDays)
    out.push({
      key: 'dynamics',
      icon: '🏁',
      frac: quietDays / diff.collapseGrace,
      severity: severityOf(quietDays / diff.collapseGrace),
      title: 'Nobody is coming in any more',
      detail: `${quietDays} night${quietDays === 1 ? '' : 's'} running with almost nobody on the floor. The scene is written off in ${left} day${left === 1 ? '' : 's'}.`,
      fix: 'Clean the place up, hire or pay staff, settle the feuds driving people off, and give the regulars something to show up for.',
      to: 'players',
    })
  }

  // The cast running out is instant — no counter to watch — so it warns on how
  // few are left instead. Losing the last one ends the run on the spot.
  const cast = activeCast(save)
  const tracked = Object.values(save.players || {}).filter((p) => !p.npc)
  if (tracked.length > 0 && cast.length > 0 && cast.length <= 2) {
    out.push({
      key: 'cast',
      icon: '👥',
      frac: cast.length === 1 ? 0.9 : 0.6,
      severity: cast.length === 1 ? 'critical' : 'warning',
      title: cast.length === 1 ? 'One player left' : 'The cast is nearly gone',
      detail: `Only ${cast.length} of the players you created ${cast.length === 1 ? 'is' : 'are'} still active. When the last one retires, the run is over.`,
      fix: 'Passion is what burns them out — tournament wins, money matches and fresh patches all refresh it.',
      to: 'players',
    })
  }

  // ---- the world ----
  const fadedDays = save.fadedDays || 0
  if (fadedDays > diff.fadeGrace * QUIET_UNTIL) {
    const left = Math.max(0, diff.fadeGrace - fadedDays)
    out.push({
      key: 'opinion',
      icon: '🪦',
      frac: fadedDays / diff.fadeGrace,
      severity: severityOf(fadedDays / diff.fadeGrace),
      title: 'The world has stopped paying attention',
      detail: `${fadedDays} day${fadedDays === 1 ? '' : 's'} out of the conversation. The game is forgotten for good in ${left} day${left === 1 ? '' : 's'}.`,
      fix: 'Ship a patch worth talking about, run a marquee event, and stream it.',
      to: 'studio',
    })
  }

  return out.sort((a, b) => b.frac - a.frac)
}

/** The single worst thing, for compact spots that only have room for one. */
export function worstDanger(save) {
  return runDangers(save)[0] || null
}
