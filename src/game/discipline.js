// Discipline — the owner's one lever against a scene going toxic: warn a
// problem player, keep two apart, or (last resort) ban someone for good.
//
// The catch, per design: warnings CAN BACKFIRE. A coachable player takes it to
// heart and cleans up; a proud, prickly one resents being called out and gets
// WORSE. Whether it lands is decided by their SOCIAL stats, so warning your
// temperamental star is a genuine gamble — and doing nothing lets toxicity
// spiral. Pure engine, node-runnable.

import { clamp, randInt, displayName } from './util.js'
import { absDayOf } from './constants.js'
import { chronicle } from './model.js'
import { getRel, shiftRel } from './social.js'
import { bumpPassion } from './career.js'

// ---------- Who's the problem ----------

// How much a player is dragging the scene down. Feeds "who to warn/ban" —
// counts the feuds they're tangled in, how hostile their own relationships run,
// and a polarizing/low-sportsmanship temperament that makes bad blood spread.
export function toxicityBlame(save, player) {
  if (!player.isRegular || player.retired || player.banished) return 0
  let blame = 0
  const rels = Object.values(player.relationships || {})
  blame += rels.filter((v) => v <= -60).length * 3 // active feuds
  blame += rels.filter((v) => v <= -30 && v > -60).length * 1 // simmering
  const soc = player.social
  blame += Math.max(0, soc.persona - 6) * 0.6 // polarizing
  blame += Math.max(0, 5 - soc.sportsmanship) * 0.5 // sore about losses
  blame += Math.max(0, 5 - soc.politeness) * 0.4
  return blame
}

// The single biggest problem in the room right now (or null).
export function chiefInstigator(save) {
  let worst = null
  let worstBlame = 4 // a floor — below this nobody's really a "problem"
  for (const p of Object.values(save.players)) {
    const b = toxicityBlame(save, p)
    if (b > worstBlame) { worstBlame = b; worst = p }
  }
  return worst
}

export function isUnhygienic(player) {
  return (player.social?.hygiene ?? 5) <= 3
}

// What, if anything, is this player warnable FOR right now?
export function warnableBehaviors(save, player) {
  const out = []
  if (toxicityBlame(save, player) >= 4) out.push('toxicity')
  if (isUnhygienic(player)) out.push('hygiene')
  return out
}

// ---------- Warnings ----------

// How likely a warning lands well vs blows up — both read straight off social
// stats. Coachable = sportsmanlike, polite, even-keeled, community-minded.
// Prideful = big polarizing persona, thin skin, a dominant streak.
function receptiveness(p) {
  const s = p.social
  return clamp((s.sportsmanship + s.politeness + (p.personal.temperance ?? 5) + s.community) / 40, 0, 1)
}
function pride(p) {
  const s = p.social
  return clamp((s.persona + (10 - s.politeness) + (10 - s.sportsmanship) + p.personal.dominance) / 40, 0, 1)
}

/**
 * Issue a warning. Returns { outcome: 'reform' | 'noted' | 'backfire', text }.
 * `reform` fixes the behavior a bit; `backfire` makes it worse and sours them on
 * the arcade. Repeat warnings for the same thing get harder to land and easier
 * to blow up — nobody likes being nagged.
 */
export function warnPlayer(save, player, behavior) {
  player.warnings ??= []
  const priorSame = player.warnings.filter((w) => w.behavior === behavior).length
  const reformChance = clamp(0.6 * receptiveness(player) - priorSame * 0.12, 0.05, 0.85)
  const backfireChance = clamp(0.45 * pride(player) + priorSame * 0.12, 0.03, 0.85)
  const roll = Math.random()
  let outcome
  if (roll < reformChance) outcome = 'reform'
  else if (roll > 1 - backfireChance) outcome = 'backfire'
  else outcome = 'noted'

  const name = displayName(player, save)
  let text
  if (outcome === 'reform') {
    if (behavior === 'hygiene') {
      player.social.hygiene = clamp((player.social.hygiene ?? 5) + randInt(2, 4), 1, 10)
      text = `${name} took the hint — showed up clean the next day. Nobody's edging away from the circle anymore.`
    } else {
      // Dial back the hostility: their worst grudges soften.
      for (const id in player.relationships) {
        if (player.relationships[id] < -20) player.relationships[id] = Math.min(player.relationships[id] + 20, -10)
      }
      player.mood = clamp(player.mood - 0.5, 0, 10) // a little chastened
      text = `${name} owned it. They've dialed the attitude back — the room feels lighter already.`
    }
  } else if (outcome === 'backfire') {
    player.mood = clamp(player.mood - 1.5, 0, 10)
    bumpPassion(player, -6) // resentment saps their love for the place
    if (behavior === 'toxicity') {
      // They lash out — relationships with everyone present sour a notch.
      for (const other of Object.values(save.players)) {
        if (other.id === player.id || !other.isRegular || other.retired || other.banished) continue
        if (getRel(player, other) < 30) shiftRel(player, other, -6)
      }
      text = `${name} did NOT take it well. "Who are you to tell me anything?" They're worse now, and they've got a chip on their shoulder.`
    } else {
      text = `${name} was humiliated by the callout. They're sulking, and they made a point of not changing a thing.`
    }
    chronicle(save, '⚠️', `A warning to ${name} blew up in everyone's face — they resent it and it shows`)
  } else {
    text = `${name} nodded along and said the right things. Whether it sticks is anyone's guess.`
  }

  player.warnings.push({ absDay: absDayOf(save.day, save.year), behavior, outcome })
  return { outcome, text }
}

// ---------- Separation (the patient lever) ----------
// Keep two players apart so the sim stops throwing them together. With no fresh
// friction, the natural grudge-fade heals the relationship over the weeks.

const sepKey = (aId, bId) => (aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`)

export function separate(save, aId, bId, days = 21) {
  save.separations ??= []
  const key = sepKey(aId, bId)
  const untilAbs = absDayOf(save.day, save.year) + days
  const ex = save.separations.find((s) => s.key === key)
  if (ex) ex.untilAbs = untilAbs
  else save.separations.push({ key, aId, bId, untilAbs })
}

export function areSeparated(save, aId, bId) {
  const s = (save.separations || []).find((x) => x.key === sepKey(aId, bId))
  return !!s && absDayOf(save.day, save.year) < s.untilAbs
}

export function pruneSeparations(save) {
  if (!save.separations?.length) return
  const abs = absDayOf(save.day, save.year)
  save.separations = save.separations.filter((s) => abs < s.untilAbs)
}

// ---------- Banishment (the nuclear option) ----------
// Gone for good. Frees the room of a poison — but it's one of your finite 48,
// and you might just have banished a title contender.

export function banish(save, player, events) {
  if (player.banished) return
  player.banished = true
  player.banishedDay = save.day
  player.banishedYear = save.year
  const name = displayName(player, save)
  // Vacate their team seat, like a retirement.
  if (player.teamId && save.teams[player.teamId]) {
    const team = save.teams[player.teamId]
    team.memberIds = team.memberIds.filter((id) => id !== player.id)
    player.teamId = null
  }
  if (events) events.push({ type: 'staff', text: `🚫 ${name} has been banned from ${save.arcade.name}. The room is quieter — for better or worse.` })
  chronicle(save, '🚫', `${name} was banned from ${save.arcade.name}`)
}
