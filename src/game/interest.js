// WHY A PLAYER WANTS TO PLAY A CHARACTER.
//
// Everyone used to want the same things: `charAppeal` scored popularity,
// difficulty, tags, a personal-taste hash, and one tier term that was
// effectively dead — `(charPower - 50) * analysis * 0.09`, where charPower
// clusters between 48 and 51 on a measured roster and `analysis` is 0 for most
// people under the temperament point buy. So nobody chased the meta, nobody
// rebelled against it, nobody copied the best player in the room, and a brand
// new character landed to complete indifference.
//
// This module is the taste layer that was missing. Four pulls, each belonging
// to a different kind of person:
//
//   TIER CHASERS      read the chart and want what wins        (analysis, dominance)
//   TIER CONTRARIANS  want the character nobody respects        (innovation)
//   EMULATORS         play what the best player in the room plays (learning)
//   NOVELTY           everybody tries the new thing             (broad, aptitude)
//   BUFF CHASERS      everybody reads a patch note              (broad, analysis)
//
// The last two are deliberately NOT gated behind a stat floor. New characters
// and buffs should move the whole room, because that is what actually happens
// when a patch drops — the stat only decides who gets there first.
//
// Perceived tier comes from the community TIER LIST, not from charPower. What
// makes someone pick up a character is the discourse, and the tier list is
// already built from perception (matchup average plus how many people main it
// plus what has won). Reading the hidden number instead would make every
// player a perfect analyst.

import { absDayOf } from './constants.js'
import { hash01 } from './util.js'

// How long a character stays "new" and how long a buff stays news. Both decay
// linearly over the window rather than switching off, so the room's interest
// tails away instead of evaporating on a fixed day.
export const NOVELTY_DAYS = 45
export const BUFF_DAYS = 28

// A tried character that never became anything lapses, and the player is free
// to be caught by the next thing.
export const INTEREST_DAYS = 35

/** S/A/B/C/D for a character on the newest community list, or null. */
export function perceivedTier(save, charId) {
  const list = save.tierLists?.[0]
  if (!list) return null
  for (const t of ['S', 'A', 'B', 'C', 'D']) {
    if ((list.tiers?.[t] || []).includes(charId)) return t
  }
  return null
}

/** 0 at the edge of the window, 1 the day it happened. */
const freshness = (save, sinceAbs, window) => {
  if (sinceAbs == null) return 0
  const age = absDayOf(save.day, save.year) - sinceAbs
  if (age < 0 || age > window) return 0
  return 1 - age / window
}

/** How new this character is to the roster, 1 → 0 over NOVELTY_DAYS. */
export function noveltyOf(save, char) {
  // Launch-roster characters have no debut stamp: the game shipped with them,
  // so they were never new to anybody.
  return freshness(save, char?.debutAbs, NOVELTY_DAYS)
}

/** How recently this character was buffed, 1 → 0 over BUFF_DAYS. */
export function buffHeatOf(save, charId) {
  let best = 0
  for (const p of save.patches || []) {
    if (!(p.buffedIds || []).includes(charId)) continue
    best = Math.max(best, freshness(save, absDayOf(p.day, p.year), BUFF_DAYS))
  }
  return best
}

/**
 * The mains of the players everyone looks up to, with how much clout each
 * carries. Computed once per call site rather than per character, because it
 * is a whole-roster scan and charAppeal runs it for every character.
 *
 * "Best" is elo, restricted to people who actually turn up and have settled on
 * something — nobody emulates a lurker, and nobody emulates a player who is
 * still labbing.
 */
export function roleModelPicks(save, exclude = null) {
  const regs = Object.values(save.players || {})
    .filter((p) => p.isRegular && !p.retired && !p.banished && p.settledMain && p.mainCharId && p.id !== exclude)
    .sort((a, b) => b.elo - a.elo)
  if (regs.length < 3) return {} // no pecking order worth copying yet
  const top = regs.slice(0, Math.max(2, Math.ceil(regs.length * 0.2)))
  const out = {}
  for (let i = 0; i < top.length; i++) {
    // The very best player is the one being copied; the pull tails off down
    // the list. Respect and glory sharpen it — a champion people TALK about
    // pulls harder than a quiet high-elo grinder.
    const rank = 1 - i / (top.length + 1)
    const fame = 1 + Math.min(1, ((top[i].respect || 0) + (top[i].glory || 0)) / 120)
    out[top[i].mainCharId] = (out[top[i].mainCharId] || 0) + rank * fame
  }
  return out
}

// Tier as a signed number: how strong the community thinks this is.
const TIER_PULL = { S: 1, A: 0.55, B: 0, C: -0.55, D: -1 }

/**
 * Everything about a character that is about the META rather than about the
 * character itself, as a single score to add to charAppeal.
 *
 * `models` is the result of roleModelPicks — pass it in so a full-roster scan
 * doesn't run once per character.
 */
export function metaAppeal(save, player, char, models = null) {
  const per = player.personal
  let score = 0

  // ---- the chart ----
  const tier = perceivedTier(save, char.id)
  if (tier != null) {
    const pull = TIER_PULL[tier]
    // Chasing: reading the chart (analysis) and wanting to win (dominance).
    const chase = per.analysis * 0.55 + per.dominance * 0.35
    score += pull * chase
    // Rebelling: the specialist who wants the character nobody respects. Not
    // the inverse of chasing — a contrarian is not "bad at reading the chart",
    // they read it and pick the other way, which is why this reads off its own
    // stat and can coexist with a little analysis.
    //
    // Measured at 0.5 this produced a mean main of B tier: a rebel who wasn't
    // rebelling. It has to out-argue the popularity term and the personal
    // taste hash to actually land somebody on a character the room has written
    // off, so it is worth more than the chase per point.
    score -= pull * per.innovation * 0.85
  }

  // ---- who's winning with what ----
  if (models && per.learning > 0) {
    const clout = models[char.id] || 0
    if (clout > 0) score += clout * per.learning * 0.9
  }

  // ---- the new thing ----
  // A high floor on purpose: a new character should move the whole room, and
  // the stat only decides who gets there first. Personal taste still applies,
  // so people converge on different new characters rather than all one.
  const novelty = noveltyOf(save, char)
  if (novelty > 0) score += novelty * (5 + per.aptitude * 0.45)

  // ---- the patch note ----
  const heat = buffHeatOf(save, char.id)
  if (heat > 0) score += heat * (3.5 + per.analysis * 0.5)

  return score
}

/**
 * Should this settled player pick up a new CURRENT INTEREST, and in what?
 *
 * An interest is the character someone is messing about with — the new release
 * everybody is trying, the thing that just got buffed, the pick the best
 * player in the room keeps winning with. It is explicitly NOT their main:
 * tournaments read `mainCharId`, so a toy never follows anyone into bracket
 * unless it earns the main slot first.
 *
 * Returns { charId, reason } or null.
 */
export function pickInterest(save, player, selectable) {
  if (!player.settledMain || !player.mainCharId) return null
  const models = roleModelPicks(save, player.id)
  const options = []
  for (const c of selectable) {
    if (c.id === player.mainCharId) continue
    if ((player.pocketPicks || []).includes(c.id)) continue
    // Only things that are interesting for a REASON get picked up. Ordinary
    // preference is what mains and pocket picks are for; an interest is a
    // reaction to something happening in the game.
    const novelty = noveltyOf(save, c)
    const heat = buffHeatOf(save, c.id)
    const clout = models[c.id] || 0
    const tier = perceivedTier(save, c.id)
    const topTier = tier === 'S' || tier === 'A'
    const lowTier = tier === 'C' || tier === 'D'
    let reason = null
    if (novelty > 0.15) reason = 'new'
    else if (heat > 0.2) reason = 'buffed'
    else if (clout > 0.4 && player.personal.learning >= 4) reason = 'emulating'
    else if (topTier && player.personal.analysis >= 4) reason = 'tier'
    else if (lowTier && player.personal.innovation >= 4) reason = 'contrarian'
    if (!reason) continue
    const score = metaAppeal(save, player, c, models)
      // Their own taste still gates it — nobody labs a character they hate
      // just because it is new.
      + (hash01(`${player.id}:${c.id}:vibes`) - 0.5) * 6
    options.push({ charId: c.id, reason, score })
  }
  if (!options.length) return null
  options.sort((a, b) => b.score - a.score)
  const best = options[0]
  return best.score > 2 ? { charId: best.charId, reason: best.reason } : null
}

/**
 * How much a character's win/loss record should move THIS player.
 *
 * The low-tier specialist is defined by not caring: dropping a character
 * because it loses is the opposite of championing it. Without this, the
 * results term in charAppeal quietly undid the contrarian pull every time
 * their pick did what a low tier does.
 */
export function resultsWeight(player) {
  return Math.max(0.25, 1 - (player.personal?.innovation || 0) * 0.09)
}

/** Human-readable why, for the UI and for recap lines. */
export const INTEREST_LABEL = {
  new: 'trying the new character',
  buffed: 'checking out the buffs',
  emulating: 'copying the top players',
  tier: 'chasing the top of the tier list',
  contrarian: 'championing a low tier',
}
