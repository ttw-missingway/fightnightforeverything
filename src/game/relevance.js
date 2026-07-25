// The interest / relevance engine — the master variable of the late game.
// Relevance is how much the wider fighting-game world still CARES about your
// game and scene. A young, thriving scene builds national interest; an aging
// one bleeds it faster every year, until interest — and everything it
// supported — collapses. Patching is the great gamble here: a hit can revive a
// dying game, a miss buries it faster. The stakes rise the more fragile things
// get, so late-game balance changes are genuinely dangerous.

import { clamp } from './util.js'
import { absDayOf, DAYS_PER_YEAR, difficultyOf } from './constants.js'
import { chronicle } from './model.js'
import { communityGameOpinion } from './social.js'

export function relevanceLabel(v) {
  if (v >= 82) return 'a national phenomenon'
  if (v >= 62) return 'thriving'
  if (v >= 42) return 'holding on'
  if (v >= 24) return 'fading'
  if (v >= 9) return 'nearly forgotten'
  return 'dead'
}

// Age of the game/scene in years — the run's own calendar (resets on a fresh
// run). This is what accelerates the decline: an old franchise is hard to keep
// alive no matter how good the game is.
export function gameAgeYears(save) {
  return (absDayOf(save.day, save.year) - 1) / DAYS_PER_YEAR
}

const staleDaysOf = (save) =>
  (save.year - save.lastPatch.year) * DAYS_PER_YEAR + (save.day - save.lastPatch.day)

// A multiplier on turnout and (especially) new-player arrivals: a game the
// world has moved on from draws no new blood and thins its crowds.
export function relevanceFactor(save) {
  return clamp(0.5 + (save.relevance ?? 55) / 100 * 0.7, 0.5, 1.1)
}

/**
 * One day of relevance drift, run from advanceDay (guarded to once per day so
 * tournament/EVO days count too). A lively, well-liked, streamed, FULL scene
 * builds national interest; a quiet, stale, shrinking one bleeds it — and the
 * bleed accelerates every year the game has been around. Turning-point beats
 * land in the chronicle.
 */
export function relevanceDaily(save) {
  const abs = absDayOf(save.day, save.year)
  if (save.lastRelevanceAbs === abs) return // already drifted today
  save.lastRelevanceAbs = abs
  if (save.relevance == null) save.relevance = 55

  const age = gameAgeYears(save)
  const activeRegulars = Object.values(save.players).filter((p) => p.isRegular && !p.retired && !p.banished).length
  const hype = save.stream?.hype || 0
  const opinion = communityGameOpinion(save) ?? 5
  const stale = staleDaysOf(save)

  // A game stays relevant while it's FRESH. The dominant force is the content
  // treadmill: the longer it's been since a patch, the more the scene drifts to
  // whatever's new — and an older game is more fragile. Shipping a patch resets
  // this clock, which is how an active owner keeps the game (and the room, since
  // attendance rides on relevance) alive, while a hands-off one lets it go stale
  // and bleed out.
  // Interest bleeds away, and FASTER every year the game has been around — this
  // is the accelerating clock that ultimately ends every run. Even a perfectly
  // run scene can only hold it off for so long; a mediocre one loses the fight
  // in a couple of years, and a neglected one in months. Difficulty scales how
  // relentless the bleed is.
  const staleness = clamp((stale - 55) * 0.0035, 0, 0.5) * (1 + age * 0.3)
  const timeDecay = 0.045 + age * 0.043
  const decayMult = difficultyOf(save).relevanceDecayMult ?? 1
  // What holds it off is the QUALITY of the scene, not just its size: a room
  // people genuinely love (well-run, fair, healthy — high opinion) and a fresh,
  // frequently-patched game keep the world watching. A big but mediocre room
  // sustains far less than a smaller, beloved one, so this rewards running the
  // place well over merely running it big. Hype can't carry it alone (everyone
  // auto-streams), so it deliberately isn't the lever.
  const sustain = hype * 0.001 + Math.min(1, activeRegulars / 40) * 0.03 + (opinion - 5) * 0.055

  const before = save.relevance
  save.relevance = clamp(before + sustain - (timeDecay + staleness) * decayMult, 0, 100)
  markMilestones(save, before, save.relevance)
}

function markMilestones(save, before, after) {
  const name = save.game.name
  const crossedDown = (th) => before >= th && after < th
  const crossedUp = (th) => before < th && after >= th
  if (crossedUp(82)) chronicle(save, '📈', `${name} has become a national phenomenon — the whole scene is buzzing`)
  else if (crossedUp(62)) chronicle(save, '📈', `${name} is thriving again — interest is on the rise`)
  if (crossedDown(42)) chronicle(save, '📉', `${name} is slipping out of the national conversation`)
  else if (crossedDown(24)) chronicle(save, '📉', `Interest in ${name} is fading fast — the golden age is ending`)
  else if (crossedDown(9)) chronicle(save, '🪦', `${name} is nearly forgotten. What was once a scene is now a handful of holdouts.`)
}

/**
 * The patch gamble. A release is a huge relevance EVENT: its swing scales with
 * the STAKES — the older and more fragile the game, the bigger the move in
 * BOTH directions. A well-received patch revives dying interest; a poorly
 * received one buries it faster. `receptionScore` is the patch's community
 * reception (already computed, and never fully knowable in advance). Returns
 * the relevance delta so the caller can report it.
 */
export function applyPatchRelevance(save, receptionScore, divisive) {
  if (save.relevance == null) save.relevance = 55
  const age = gameAgeYears(save)
  const rel = save.relevance
  const stakes = 1 + age * 0.28 + (1 - rel / 100) * 0.7
  // Shipping fresh content is what keeps a game relevant, full stop — the
  // staleness clock resets in relevanceDaily every time you patch, so a regular
  // patch cadence is the backbone of a long run. Reception only decides how much
  // a patch BOOSTS on top: a hit revives interest, a middling one just doesn't
  // add much (it never actively buries you — "there's something new to play" is
  // the point). Only a genuine disaster still stings.
  let delta = Math.max(0, receptionScore) * 0.5 * stakes
  if (receptionScore < -12) delta += (receptionScore + 12) * 0.3 * stakes // a true bomb still hurts
  if (divisive) delta -= 1.5 * stakes // controversy alienates as much as it engages
  const before = save.relevance
  save.relevance = clamp(rel + delta, 0, 100)
  markMilestones(save, before, save.relevance)
  return Math.round(save.relevance - before)
}

/**
 * Franchise fatigue: the same patch that would've thrilled a young community
 * lands harder on a jaded, years-old one. Added to the reception bias so late
 * patches are genuinely tougher to land — which is exactly what makes the
 * gamble real.
 */
export function franchiseFatigue(save) {
  return Math.min(12, Math.max(0, gameAgeYears(save) - 2) * 5)
}
