// The interest / relevance engine — the master variable of the late game.
// Relevance is how much the wider fighting-game world still CARES about your
// game and scene. A young, thriving scene builds national interest; an aging
// one bleeds it faster every year, until interest — and everything it
// supported — collapses. Patching is the great gamble here: a hit can revive a
// dying game, a miss buries it faster. The stakes rise the more fragile things
// get, so late-game balance changes are genuinely dangerous.

import { clamp, hash01, rand } from './util.js'
import { absDayOf, runAge, DAYS_PER_YEAR, difficultyOf } from './constants.js'
import { isUnlocked } from './achievements.js'
import { chronicle, awardMilestone } from './model.js'
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
  return (runAge(save) - 1) / DAYS_PER_YEAR
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
  // this clock; a hands-off owner lets it run and bleeds out. Every run's
  // community has its own PATIENCE for a stale build — some scenes grind one
  // patch for months happily, some get restless in weeks — so the same play
  // produces genuinely different timelines run to run.
  const patience = 0.82 + hash01(`${save.id}:patience`) * 0.36 // 0.82..1.18
  // You cannot be blamed for failing to patch a game you have no way to patch.
  // Staleness is the punishment for neglecting the build, so it only applies
  // once the Studio has been earned — otherwise a first run is killed by the
  // absence of the very tool it is trying to unlock, which is a trap and not a
  // difficulty. (Measured in Phase 7: with the Studio locked, EVERY normal run
  // died of the opinion funnel.) Age still bites regardless: the game gets old
  // on its own, you just aren't held responsible for it.
  const canPatch = isUnlocked(save, 'studio')
  const staleness = canPatch
    ? clamp((stale * patience - 55) * 0.0035, 0, 0.5) * (1 + age * 0.3)
    : 0
  const timeDecay = 0.045 + age * 0.043
  let decayMult = (difficultyOf(save).relevanceDecayMult ?? 1) * worldDecayMult(save, abs)
  // What holds it off is the QUALITY of the scene, not just its size: a room
  // people genuinely love (well-run, fair, healthy — high opinion) and a fresh,
  // frequently-patched game keep the world watching. A big but mediocre room
  // sustains far less than a smaller, beloved one, so this rewards running the
  // place well over merely running it big. Hype can't carry it alone (everyone
  // auto-streams), so it deliberately isn't the lever.
  const sustain = hype * 0.001 + Math.min(1, activeRegulars / 40) * 0.03 + (opinion - 5) * 0.055

  // The wider world's attention wanders on its own schedule: some months the
  // algorithm loves you, some months a new release eats every headline. Rolled
  // monthly so the drift comes in STREAKS — the difference between a lucky year
  // and an unlucky one, and a big part of why identical strategies diverge.
  save.attentionDrift ??= { untilAbs: 0, value: 0 }
  if (abs >= save.attentionDrift.untilAbs) {
    save.attentionDrift = { untilAbs: abs + 28, value: (rand() - 0.5) * 0.22 }
  }

  // Momentum compounds: a scene on a heater holds attention with less effort, a
  // scene in a rut has to fight for every eyeball (see updateMomentum below).
  const momentum = save.momentum?.state || 'steady'
  if (momentum === 'golden') decayMult *= 0.55
  else if (momentum === 'slump') decayMult *= 1.3

  const before = save.relevance
  save.relevance = clamp(
    before + sustain + save.attentionDrift.value - (timeDecay + staleness) * decayMult, 0, 100)
  updateMomentum(save, abs)
  markMilestones(save, before, save.relevance)
}

// ---------- Momentum: golden ages and slumps ----------
//
// Success and failure both compound. A championship (or a sustained run at the
// top of the conversation) tips the scene into a GOLDEN AGE — the room is the
// place to be, the world checks in on its own, and the clock runs slow. Let
// relevance rot and the scene tips into a SLUMP that takes real work (a hit
// patch, a champion) to climb out of. The hysteresis — hard to enter, hard to
// leave — is what stretches great runs and buries failing ones.
// How long the scene has to wait between golden ages.
const GOLDEN_COOLDOWN = 200

function updateMomentum(save, abs) {
  save.momentum ??= { state: 'steady', untilAbs: 0 }
  const m = save.momentum
  const rel = save.relevance ?? 55
  if (m.state === 'golden') {
    if (abs >= m.untilAbs || rel < 55) {
      // A golden age can't roll straight into the next one. Without this the
      // 88-point entry bar re-armed the day it expired, and since a golden age
      // halves relevance decay, anything that once crossed 88 stayed there for
      // good — the single biggest reason a well-run scene became immortal.
      save.momentum = { state: 'steady', untilAbs: 0, nextGoldenAbs: abs + GOLDEN_COOLDOWN }
      chronicle(save, '🌇', `The golden age of ${save.game.name} has cooled into something quieter. What a stretch it was.`)
    }
  } else if (m.state === 'slump') {
    if (rel > 45) {
      save.momentum = { state: 'steady', untilAbs: 0 }
      chronicle(save, '🌅', `${save.game.name} has pulled out of its slump — people are coming back.`)
    }
  } else {
    if (rel >= 88 && abs >= (m.nextGoldenAbs || 0)) {
      save.momentum = { state: 'golden', untilAbs: abs + 75 }
      chronicle(save, '🌟', `A GOLDEN AGE: ${save.game.name} is the center of the fighting-game world right now.`)
    } else if (rel < 20) {
      save.momentum = { state: 'slump', untilAbs: 0 }
      chronicle(save, '🕳', `${save.game.name} has slid into a real slump — the room feels it every night.`)
    }
  }
}

// Active world-event modifier on the decay clock (see worldevents.js) — e.g. a
// rival game's launch window eating everyone's attention.
function worldDecayMult(save, abs) {
  let mult = 1
  for (const fx of save.worldEffects || []) {
    if (fx.untilAbs > abs && fx.decayMult) mult *= fx.decayMult
  }
  return mult
}

/**
 * THE CHAMPION DIVIDEND. One of ours winning EVO is the biggest thing that can
 * happen to a scene: the game is suddenly a story the whole world is telling,
 * the arcade is a landmark, and the run gets a real extension. The more
 * forgotten the game was, the bigger the resurrection — a champion out of a
 * dying arcade is the stuff of documentaries. Also tips the scene straight
 * into a golden age.
 */
export function applyChampionDividend(save) {
  if (save.relevance == null) save.relevance = 55
  const abs = absDayOf(save.day, save.year)
  const before = save.relevance
  // Scaled ENTIRELY by headroom, with no flat floor. A world title out of your
  // arcade makes the game roar back into the conversation — but at relevance 98
  // there is no conversation to roar back into, and a flat +14 there simply
  // pinned a thriving scene to 100 forever. This is the same shape the patch
  // gamble already uses (see `stakes`): the lower you are, the more a title is
  // worth. A fading scene at 30 gets a +31 revival; a scene at 95 gets +2.
  const gain = Math.round((100 - before) * 0.45)
  save.relevance = clamp(before + gain, 0, 100)
  save.momentum = { state: 'golden', untilAbs: abs + 100 }
  chronicle(save, '🌟', `A world champion, from THIS arcade. ${save.game.name} is back in every conversation — a golden age begins.`)
  markMilestones(save, before, save.relevance)
  return save.relevance - before
}

function markMilestones(save, before, after) {
  const name = save.game.name
  const crossedDown = (th) => before >= th && after < th
  const crossedUp = (th) => before < th && after >= th
  if (crossedUp(82)) {
    chronicle(save, '📈', `${name} has become a national phenomenon — the whole scene is buzzing`)
    if (save.settings?.mode !== 'sandbox') awardMilestone(save, 'phenomenon', 3, `${name} became a national phenomenon`)
  }
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
