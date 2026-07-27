// TAKES: the opinions people hold and won't let go of.
//
// A player's stats say what they can do; their takes say what they THINK. This
// is the difference between a stat block and a person — the guy who has called
// one character broken since March and is still saying it two patches after
// the nerf, because he lost to it once in a tournament and decided.
//
// The whole point is STICKINESS. A take formed from a real experience does not
// quietly update when the numbers change. Reality erodes it slowly, and only
// sustained contradiction ever kills it. An opinion that tracked the patch
// notes perfectly would just be a readout of the balance engine, which nobody
// would mistake for a person.
//
// Imports only util/constants — sim.js, dialogue and the feed all read it.

import { clamp, choice, chance, randInt, uid } from './util.js'
import { absDayOf, statLevel } from './constants.js'
import { selectableChars } from './forms.js'

// What a take can be about, and the stances available for each.
export const TAKE_STANCES = {
  character: ['broken', 'weak', 'overrated', 'underrated', 'boring', 'beloved'],
  game: ['thriving', 'stale', 'ruined', 'best it has ever been'],
  arcade: ['home', 'a ripoff', 'filthy', 'the best room in town'],
  player: ['the best here', 'overrated', 'a cheat', 'the one to beat'],
  food: ['the only good thing here', 'inedible'],
}

// How firmly something is held, and what it takes to shift it.
const START_STRENGTH = [34, 62]
const CONVICTION = 78 // at or above this, they will not be told otherwise
// Erosion per day when reality flatly disagrees. Deliberately tiny: at 0.55 a
// full-strength take survives roughly four months of being wrong.
const CONTRADICTION_DECAY = 0.55
const IDLE_DECAY = 0.06 // opinions you never revisit fade, very slowly

export function newTake(topic, subject, stance, absDay, strength = null) {
  return {
    id: uid('take'),
    topic,
    subject, // a charId / playerId / food name — resolved to a label at speak time
    stance,
    strength: strength ?? randInt(START_STRENGTH[0], START_STRENGTH[1]),
    formedAbs: absDay,
  }
}

export function takesOf(player) {
  return player.takes || []
}

export function findTake(player, topic, subject) {
  return takesOf(player).find((t) => t.topic === topic && t.subject === subject) || null
}

/** The take they'd lead with — strongest, ties broken by most recent. */
export function loudestTake(player) {
  const ts = takesOf(player)
  if (!ts.length) return null
  return ts.reduce((best, t) => (
    t.strength > best.strength || (t.strength === best.strength && t.formedAbs > best.formedAbs) ? t : best
  ))
}

export function isConviction(take) {
  return (take?.strength ?? 0) >= CONVICTION
}

/**
 * Push an opinion in some direction. Forms it if it doesn't exist yet, and
 * caps the list so nobody becomes a walking manifesto.
 */
export function pushTake(player, topic, subject, stance, absDay, delta = 12) {
  if (!player.takes) player.takes = []
  const existing = findTake(player, topic, subject)
  if (existing) {
    if (existing.stance === stance) {
      existing.strength = clamp(existing.strength + delta, 0, 100)
    } else {
      // A rival opinion has to tear the old one down before it can replace it.
      existing.strength -= delta
      if (existing.strength <= 0) {
        existing.stance = stance
        existing.strength = randInt(20, 34)
        existing.formedAbs = absDay
      }
    }
    return existing
  }
  const take = newTake(topic, subject, stance, absDay)
  player.takes.push(take)
  // Keep the loudest handful; a person has a few strong opinions, not thirty.
  if (player.takes.length > 5) {
    player.takes.sort((a, b) => b.strength - a.strength)
    player.takes.length = 5
  }
  return take
}

/**
 * Opening opinions, so a fresh roster already has things to argue about
 * rather than spending a month forming its first thought.
 */
export function seedTakes(save, player) {
  const absDay = absDayOf(save.day, save.year)
  player.takes = []
  const chars = selectableChars(save.game)
  if (chars.length) {
    // Nearly everyone has a character they've decided about.
    const c = choice(chars)
    pushTake(player, 'character', c.id,
      choice(chance(0.55) ? ['broken', 'overrated'] : ['underrated', 'beloved']), absDay)
    if (chance(0.5) && chars.length > 1) {
      const other = choice(chars.filter((x) => x.id !== c.id))
      pushTake(player, 'character', other.id, choice(['boring', 'weak', 'beloved']), absDay)
    }
  }
  if (chance(0.45)) {
    pushTake(player, 'arcade', 'here',
      (player.social?.politeness || 0) >= 4 ? choice(['home', 'the best room in town'])
        : choice(['a ripoff', 'filthy']), absDay)
  }
  if (chance(0.35) && (player.foods || []).length) {
    pushTake(player, 'food', choice(player.foods), 'the only good thing here', absDay)
  }
  return player.takes
}

/**
 * A loss is where most real opinions come from. Losing to a character often
 * enough turns into a conviction that it's broken; beating it chips away at
 * that, but slowly — winning doesn't feel like evidence the way losing does.
 */
export function noteMatchOutcome(save, player, oppCharId, won) {
  // Recent form, newest first, capped at 8. Lifetime W/L says who somebody IS;
  // this says how the last few nights have gone, which is what people actually
  // talk about and what a losing streak means.
  player.form = [won ? 'w' : 'l', ...(player.form || [])].slice(0, 8)
  if (!oppCharId) return
  const absDay = absDayOf(save.day, save.year)
  if (!won) {
    // Salt scales with how badly they take things.
    const salt = 0.18 + (10 - statLevel(player.personal?.composure)) * 0.022
    if (chance(salt)) {
      // Confirmation bias: losing to something you ALREADY distrust confirms
      // it far harder than the first loss suggested it. This is what turns a
      // grumble into a conviction somebody will defend for months.
      const held = findTake(player, 'character', oppCharId)
      const delta = held && held.stance === 'broken' ? 15 : 9
      pushTake(player, 'character', oppCharId, 'broken', absDay, delta)
    }
  } else if (chance(0.1)) {
    const t = findTake(player, 'character', oppCharId)
    if (t && t.stance === 'broken') t.strength = clamp(t.strength - 6, 0, 100)
  }
}

/**
 * The daily reality check. This is the load-bearing part of the whole system:
 * a take that the game flatly disagrees with loses a sliver of strength per
 * day and nothing more. Somebody who decided a character was broken keeps
 * saying so for months after the nerf — which is the behaviour we want,
 * because that is what people actually do.
 */
export function reconcileTakes(save, player, powerOf) {
  const ts = takesOf(player)
  if (!ts.length) return
  const survivors = []
  for (const t of ts) {
    let contradicted = false
    if (t.topic === 'character' && powerOf) {
      const power = powerOf(t.subject)
      // Only CLEAR disagreement counts. The old thresholds sat at the average
      // (52 against a cast that averages 50), so most opinions were being
      // eroded every single day by a character being merely ordinary — and
      // nobody in the arcade ever built a conviction they'd defend.
      if (power != null) {
        if (t.stance === 'broken' && power < 46) contradicted = true
        if (t.stance === 'weak' && power > 58) contradicted = true
        if (t.stance === 'overrated' && power > 60) contradicted = true
        if (t.stance === 'underrated' && power < 40) contradicted = true
      }
    }
    t.strength -= contradicted ? CONTRADICTION_DECAY : IDLE_DECAY
    // A conviction doesn't erode below the point where they'd still say it —
    // it just stops being the first thing out of their mouth.
    if (t.strength > 0) survivors.push(t)
  }
  player.takes = survivors
}

/** Everyone who holds this exact opinion — the raw material for a consensus. */
export function whoThinks(save, topic, subject, stance) {
  return Object.values(save.players || {})
    .filter((p) => p.isRegular && !p.retired && !p.banished)
    .filter((p) => findTake(p, topic, subject)?.stance === stance)
}

// Which line pool voices this opinion. Kept here so the mapping lives with the
// stances themselves rather than being guessed at the call site.
const STANCE_KIND = {
  broken: 'takeBroken',
  weak: 'takeWeak',
  overrated: 'takeOverrated',
  underrated: 'takeUnderrated',
  boring: 'takeBoring',
  beloved: 'takeBeloved',
}

/**
 * Which rebuttal fits. A dispute has to answer the claim that was actually
 * made — "you lost to it twice" is no answer at all to "this arcade is home",
 * and telling somebody their beloved main got nerfed doesn't address anything
 * they said.
 */
export function disputeKind(take) {
  if (!take) return null
  if (take.topic === 'arcade') {
    const praise = take.stance === 'home' || take.stance === 'the best room in town'
    return praise ? 'disputeArcadePraise' : 'disputeArcadeComplaint'
  }
  if (take.topic === 'food') return 'disputeTaste'
  if (take.topic === 'player') return 'disputePlayer'
  if (take.stance === 'broken' || take.stance === 'overrated') return 'disputeBroken'
  if (take.stance === 'weak' || take.stance === 'underrated') return 'disputeWeak'
  return 'disputeTaste' // boring / beloved — an argument about taste, not power
}

export function takeKind(take) {
  if (!take) return null
  if (take.topic === 'arcade') return 'takeArcade'
  if (take.topic === 'food') return 'takeFood'
  if (take.topic === 'player') return 'takePlayer'
  return STANCE_KIND[take.stance] || null
}

/** The label a take is ABOUT, for {x}. */
export function takeSubjectLabel(save, take, nameOf) {
  if (!take) return null
  if (take.topic === 'character') {
    return save.game?.characters?.find((c) => c.id === take.subject)?.name || null
  }
  if (take.topic === 'player') {
    const p = save.players?.[take.subject]
    return p && nameOf ? nameOf(p) : null
  }
  if (take.topic === 'food') return take.subject
  return 'here'
}
