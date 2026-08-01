import { clamp, chance, choice, shuffle, rand, randInt, displayName, hash01, uid } from './util.js'
import { bindRng } from './rng.js'
import { HOURS_PER_DAY, HOUR_LABELS, DAYS_PER_YEAR, EVO_DAY, OPENING_DAYS, formatDay, weekdayOf, dayOfMonthOf, absDayOf, runAge, seasonOf, seasonFactor, statusOf, difficultyOf, statLevel } from './constants.js'
import { driftEvoRoster, topUpNpcs, worldMatchesDaily, gravitateElites } from './generate.js'
import { newInnovation, remember, witnessed, memoryAbout, chronicle, pushVod, awardMilestone, getMatchup, bumpPeak } from './model.js'
import { checkAchievements } from './achievements.js'
import { daysSincePatch, releasePatch, communityDemands } from './patch.js'
import { castScene, sceneBeats, SCENE_CHANCE } from './scenes.js'
import { metaAppeal, roleModelPicks, pickInterest, resultsWeight, INTEREST_DAYS, INTEREST_LABEL } from './interest.js'
import { maybeWriteGuide, resolveGuides } from './guides.js'
import { selectableChars } from './forms.js'
import { postPatchDemand, postPatchCountdown } from './socialmedia.js'
import { resolveMatch, winProbability, gainSkill, seriesNoteFor, upsetSeverityOf, pickMatchChar } from './match.js'
import { narrateSet } from './fight.js'
import { buildStream, canStream, personalityOf, applyStageReps } from './stream.js'
import { attractionDrawFactor } from './catalog.js'
import {
  staffDaily, playerSpending, settleRecurring, staffCounts,
  landlordDaily, tokenPlayShift, arcadeClosed, isStaffed,
  adAwarenessBoost, adHypePerDay, playerStaffAppeal,
} from './economy.js'
import { updateFeedFromDay, postMoneyMatchAnnouncement, postTierList, postCommunityDemand, worldFeedDaily, postWorldUpset } from './socialmedia.js'
import { speak, isFirstMeeting, noteMeeting } from './dialogue.js'
import { noteMatchOutcome, reconcileTakes, loudestTake, isConviction, takeKind, takeSubjectLabel, findTake, pushTake, disputeKind } from './takes.js'
import { generateTierList } from './balance.js'
import { rankedInTop, worldTalkExchange, worldRankings } from './world.js'
import {
  getRel, shiftRel, socialDelta, applySocialMood, moodLabel,
  tryFoundTeam, tryJoinTeam, checkFallingOut, teamOf, dailyTeamDynamics,
  sceneHealth, rivalOf, communityGameOpinion, arcadeOpinionOf, spreadFeuds, feudSource,
} from './social.js'
import { passionDaily, checkRetirement, passionAttendanceFactor, bumpPassion, ageYearly, ageWarnings, careerStageOf } from './career.js'
import { relevanceDaily } from './relevance.js'
import { processEurekaDaily, edge as eurekaEdge } from './eureka.js'
import { writeJournal } from './journal.js'
import { pushToast, pruneToasts } from './notify.js'
import { fragmentsMonthly } from './fragments.js'
import { travelDaily } from './travel.js'
import { circuitEventOn, driftRegionalField } from './circuit.js'
import { canBeginNewEra, beginNewEra, noteEraRelevance } from './era.js'
import { maybeProdigyArrives, prodigiesDrift, successionWarning } from './succession.js'
import { invasionDaily, currentVisitors, visitorExchange } from './invasion.js'
import { maybeWorldEvent } from './worldevents.js'
import { TECHNIQUE_NAME_PARTS } from './names.js'

const pName = (save, p) => displayName(p, save)

// How hard it is to draw a crowd, per difficulty. On master the arcade is an
// unknown quantity nobody's heard of; on easy the line's out the door. Sandbox
// is neutral. Feeds both attendance and how fast new faces discover the place.
function popularityFactor(save) {
  if (save.settings.mode === 'sandbox') return 1
  return difficultyOf(save).popularityMult
}

// ---------- Main character selection ----------

function charAppeal(save, player, char, models = null) {
  let score = char.popularity * 0.7
  score -= char.difficulty * (1 - player.personal.aptitude / 14) * 0.9
  // Personal taste: a stable per-player pull toward certain characters, so a
  // batch of players spreads across the roster instead of piling onto the
  // objectively "best" two or three picks.
  score += (hash01(`${player.id}:${char.id}:vibes`) - 0.5) * 11
  for (const t of char.tags || []) {
    if (player.attractedTags.includes(t)) score += 4
    if (player.repelledTags.includes(t)) score -= 5
  }
  score += (player.charSkill[char.id] || 0) * 0.15 // sunk cost is real
  // Nothing sells a character like winning with them — unless championing the
  // unloved IS the point, in which case losing with it is not an argument.
  const rec = player.charRecord?.[char.id]
  if (rec && rec.w + rec.l >= 8) {
    score += (rec.w / (rec.w + rec.l) - 0.5) * 14 * resultsWeight(player)
  }
  // Everything that is about the META rather than the character: the tier list
  // (chased by some, rebelled against by others), what the best players in the
  // room are winning with, a brand-new release, a fresh buff. This replaces a
  // lone `(charPower - 50) * analysis` term that could never do any work —
  // charPower spans about three points across a whole roster and analysis is
  // zero for most people under the point buy. See interest.js.
  score += metaAppeal(save, player, char, models)
  return score + rand() * 3
}

/** charAppeal over a list, with the role-model scan done once instead of per character. */
function appealScorer(save, player) {
  const models = roleModelPicks(save, player.id)
  return (char) => charAppeal(save, player, char, models)
}

export function pickMainChar(save, player) {
  // Forms are not on the character select screen — you reach one by pressing
  // a button mid-round, so nobody can main one.
  const chars = selectableChars(save.game)
  if (!chars.length) return null
  const appeal = appealScorer(save, player)
  let best = null
  let bestScore = -Infinity
  for (const c of chars) {
    const s = appeal(c)
    if (s > bestScore) { bestScore = s; best = c }
  }
  return best ? best.id : null
}

// ---------- The exploration phase ----------
// New players don't commit: they rotate through characters for a while,
// then settle on a main based on taste, results and their stats.

function explorationGames(player) {
  return Object.values(player.charRecord || {}).reduce((n, r) => n + r.w + r.l, 0)
}

// How many games it takes before they commit: loyal players settle fast.
function settleThreshold(player) {
  return Math.round(8 + (10 - statLevel(player.personal.loyalty)) * 2.2)
}

// Today's lab character: mostly something untried, sometimes a second look
// at one that's been working.
function pickExplorationChar(save, player) {
  const chars = selectableChars(save.game)
  if (!chars.length) return null
  const untried = chars.filter((c) => !player.exploredChars.includes(c.id))
  const pool = untried.length && chance(0.7) ? untried : chars
  const appeal = appealScorer(save, player)
  let best = null
  let bestScore = -Infinity
  for (const c of pool) {
    let s = appeal(c)
    if (c.id === player.mainCharId) s -= 3 // nudge toward variety day to day
    if (s > bestScore) { bestScore = s; best = c }
  }
  return best ? best.id : null
}

function startExplorationDay(save, player, events) {
  const charId = pickExplorationChar(save, player)
  if (!charId) return
  player.mainCharId = charId
  if (!player.exploredChars.includes(charId)) {
    player.exploredChars.push(charId)
    const char = save.game.characters.find((c) => c.id === charId)
    if (char) events.push({ type: 'main', text: `${pName(save, player)} is trying out ${char.name} today.` })
  }
}

function maybeSettleMain(save, player, events) {
  const games = explorationGames(player)
  const roster = save.game.characters.length
  const triedEnough = player.exploredChars.length >= Math.min(3, roster)
  const playedEnough = games >= settleThreshold(player)
  const forceSettle = player.daysAttended >= 45 // nobody labs forever
  if (!(triedEnough && playedEnough) && !forceSettle) return
  // Commit to the best fit among everything they've touched (or the roster,
  // if somehow nothing stuck).
  const candidates = player.exploredChars.length
    ? save.game.characters.filter((c) => player.exploredChars.includes(c.id))
    : save.game.characters
  const appeal = appealScorer(save, player)
  let best = null
  let bestScore = -Infinity
  for (const c of candidates) {
    const s = appeal(c) + (player.charSkill[c.id] || 0) * 0.2
    if (s > bestScore) { bestScore = s; best = c }
  }
  if (!best) return
  player.mainCharId = best.id
  player.settledMain = true
  // The couple of other characters they got a feel for during exploration
  // become their pocket picks — counterpick options for bad matchups.
  player.pocketPicks = player.exploredChars
    .filter((id) => id !== best.id)
    .sort((x, y) => (player.charSkill[y] || 0) - (player.charSkill[x] || 0))
    .slice(0, 2)
  events.push({
    type: 'main',
    text: `${pName(save, player)} has settled on ${best.name} as their main after trying ${player.exploredChars.length} character${player.exploredChars.length === 1 ? '' : 's'}.`,
  })
}

// A curious, adaptable player picks up a new pocket character now and then —
// something to fall back on when the meta turns against their main.
function maybePocketPickup(save, player) {
  if (!player.settledMain || !player.mainCharId) return
  if ((player.pocketPicks || []).length >= 3) return
  if (!chance(0.0004 * (player.personal.learning + player.personal.innovation) + (player.personal.adaptation ?? 5) * 0.0011)) return
  const options = selectableChars(save.game).filter(
    (ch) => ch.id !== player.mainCharId && !(player.pocketPicks || []).includes(ch.id))
  if (!options.length) return
  player.pocketPicks = [...(player.pocketPicks || []), choice(options).id]
}

/**
 * Move a settled player onto a new main, keeping the other two slots honest.
 *
 * A main that is also listed as a pocket pick reads as a bug to anyone looking
 * at the roster, and it happened whenever somebody switched onto a character
 * they already had in reserve. Nothing cleaned up after a switch because
 * nothing displayed the slots.
 */
function setMain(player, charId) {
  player.mainCharId = charId
  player.pocketPicks = (player.pocketPicks || []).filter((id) => id !== charId)
  if (player.currentInterest?.charId === charId) player.currentInterest = null
}

// How often a lab character actually gets run in a friendly. High enough that
// an interest resolves inside its window, low enough that the room doesn't
// look like everybody abandoned their main the week a patch landed.
const INTEREST_PLAY_RATE = 0.45

/** Swap in today's lab character for a casual set, if they have one. */
function interestRun(player, charId) {
  const ci = player.currentInterest
  if (!ci || charId !== player.mainCharId) return charId // never override a counterpick
  return chance(INTEREST_PLAY_RATE + player.personal.aptitude * 0.02) ? ci.charId : charId
}

// ---------- Current interest ----------
// The character somebody is CURRENTLY messing about with. Distinct from a main
// (what they are) and a pocket (what they fall back on): an interest is a
// reaction to something that happened in the game, and most of them come to
// nothing. That is the point — a scene where every new release permanently
// converts a third of the roster reads as fashion, not as people.

function maybeTakeInterest(save, player, events) {
  if (!player.settledMain || player.lockedMain) return
  if (player.currentInterest) return
  // Curiosity is cheap but not free — this fires on an attendee-day, so the
  // rate compounds with how often they actually turn up.
  if (!chance(0.05 + player.personal.aptitude * 0.012 + player.personal.learning * 0.01)) return
  const picked = pickInterest(save, player, selectableChars(save.game))
  if (!picked) return
  player.currentInterest = { ...picked, sinceAbs: absDayOf(save.day, save.year) }
  const char = save.game.characters.find((c) => c.id === picked.charId)
  if (char) {
    events.push({
      type: 'main',
      text: `${pName(save, player)} is messing about with ${char.name} — ${INTEREST_LABEL[picked.reason]}.`,
    })
  }
}

// An interest either earns the main slot, settles in as a pocket, or is
// quietly dropped. Reps AND results decide, so the character somebody labs for
// a month and keeps losing on does not get promoted for persistence alone.
function resolveInterest(save, player, events) {
  const ci = player.currentInterest
  if (!ci) return
  if (ci.charId === player.mainCharId) { player.currentInterest = null; return }
  const char = save.game.characters.find((c) => c.id === ci.charId)
  if (!char) { player.currentInterest = null; return } // deleted in a patch
  const rec = player.charRecord?.[ci.charId] || { w: 0, l: 0 }
  const games = rec.w + rec.l
  const skill = player.charSkill[ci.charId] || 0
  const age = absDayOf(save.day, save.year) - (ci.sinceAbs ?? 0)

  // Promotion: enough reps, a winning record, and it now beats the main on
  // their own taste. Loyalty is the brake — a loyal player has to be really
  // convinced to drop what they are known for.
  if (games >= 12 && rec.w > rec.l && skill >= 25) {
    const appeal = appealScorer(save, player)
    const mainChar = save.game.characters.find((c) => c.id === player.mainCharId)
    const margin = 2 + player.personal.loyalty * 0.9
    if (mainChar && appeal(char) > appeal(mainChar) + margin) {
      const old = mainChar.name
      setMain(player, ci.charId)
      // What they were known for is exactly the thing they still know best.
      if (!player.pocketPicks.includes(mainChar.id)) {
        player.pocketPicks = [mainChar.id, ...player.pocketPicks].slice(0, 3)
      }
      events.push({
        type: 'main',
        text: `${pName(save, player)} has switched mains — ${old} out, ${char.name} in after ${games} games.`,
      })
      return
    }
  }

  if (age < INTEREST_DAYS) return

  // Time is up. If they got decent with it, it stays on as a counterpick;
  // otherwise it was just a phase.
  player.currentInterest = null
  if (skill >= 20 && games >= 6 && (player.pocketPicks || []).length < 3 &&
      !player.pocketPicks.includes(ci.charId)) {
    player.pocketPicks = [...player.pocketPicks, ci.charId]
    events.push({
      type: 'main',
      text: `${pName(save, player)} is keeping ${char.name} in their back pocket.`,
    })
  }
}

function maybeSwitchMain(save, player, events) {
  if (player.lockedMain || !player.mainCharId) return
  // Frustrated, disloyal players shop around. Winning keeps them anchored.
  const rec = player.charRecord?.[player.mainCharId]
  const winning = rec && rec.w + rec.l >= 8 && rec.w > rec.l
  const frustration = (player.mood < 4 ? 1.6 : 1) * (winning ? 0.4 : 1)
  if (!chance((10 - statLevel(player.personal.loyalty)) * 0.004 * frustration)) return
  const alt = pickMainChar(save, player)
  if (alt && alt !== player.mainCharId) {
    const oldChar = save.game.characters.find((c) => c.id === player.mainCharId)
    const newChar = save.game.characters.find((c) => c.id === alt)
    setMain(player, alt)
    events.push({
      type: 'main',
      text: `${pName(save, player)} is dropping ${oldChar?.name || '???'} and picking up ${newChar?.name || '???'}.`,
    })
  }
}

// ---------- Attendance ----------

function attendChance(save, player) {
  // Nobody goes to the arcade every single day — weekends are the draw,
  // weekdays are for the truly committed, and the habit builds slowly.
  // That's what makes "regular" mean something.
  // Mood swings turnout — unless they're temperate. The Stoic is the person
  // who turns up on the bad night, and that is what makes a scene durable:
  // measured, removing the whole row cost the scene nothing, because none of
  // temperance/loyalty/stamina reached anything anyone could see.
  const moodSwing = 0.02 * Math.max(0.25, 1 - (player.personal.temperance || 0) * 0.11)
  let p = 0.21 + player.personal.spark * 0.030 + (player.mood - 5) * moodSwing
  p += Math.min(0.12, player.daysAttended * 0.0015) // dedication compounds
  const wd = weekdayOf(save.day)
  // Weekends draw everyone; weekdays belong to the RELIABLE — the put-together
  // player is the one keeping your Tuesday room alive.
  p += wd === 0 || wd === 6 ? 0.16 : (-0.05 + statLevel(player.social?.reliability) * 0.006)
  // A hated (or beloved) patch changes how much anyone wants to play.
  if (save.settings.mode !== 'sandbox') p += (save.patchMorale || 0) * 0.004
  for (const f of player.foods) if (save.arcade.foods.includes(f)) p += 0.03
  for (const g of player.otherGames) if (save.arcade.otherGames.includes(g)) p += 0.03
  const main = save.game.characters.find((c) => c.id === player.mainCharId)
  if (main) {
    for (const t of main.tags || []) {
      if (player.attractedTags.includes(t)) p += 0.04
      if (player.repelledTags.includes(t)) p -= 0.05
    }
  }
  // A familiar face behind the counter is its own draw — regulars turn up to
  // hang out where their friend (or the local star) works. This is the payoff
  // for staffing a PLAYER instead of an anonymous outside hire.
  p += playerStaffAppeal(save) * 0.015
  // The people you created are this arcade's founding crew — this is their
  // place, and they turn up like it. Filler still has to be tempted in. Spark
  // still decides who's here nightly and who's here on weekends; this just
  // means a cast of three can't quietly evaporate into a room of strangers.
  if (!player.npc) p = p * 1.3 + 0.14
  // A brand-new arcade nobody's heard of is hard to DISCOVER: first-timers
  // barely trickle in until word spreads. Once someone's a regular, they come
  // regardless — so those early discoverers are what seeds the whole scene.
  // A one-note room converts almost none of them: scene variety gates
  // discovery (see sceneVariety in social.js — this is how the community pit
  // punishes a personality monoculture without inventing a fourth funnel).
  // The hinge is calibrated to the measured bands: a healthy world reads
  // 0.97–0.99 (×1.0, untouched), a world missing one whole row ~0.89 (×0.96,
  // felt but survivable), a monoculture 0.5 (×0.07 — the room simply stops
  // growing). A gentler ×(0.35+0.65v) was measured first and monocultures
  // shrugged it off: 2-year survival matched the full world, some at
  // relevance 98+.
  if (!player.isRegular) {
    const variety = save.scene?.variety ?? 1
    const oneNote = clamp(Math.pow((variety - 0.35) / 0.55, 2), 0.06, 1)
    p *= 0.55 * awarenessFactor(save) * oneNote
  }
  // THE SCHOOL YEAR. The cast are students, so the calendar they live on is
  // the one that decides how much of the week is theirs. Summer fills the
  // room; September empties it overnight. This is a straight multiplier
  // because it isn't a preference — it's whether they are free at all.
  p *= seasonFactor(save.day)
  // A hard-difficulty arcade is a struggling unknown — thinner crowds.
  p *= 0.45 + 0.55 * popularityFactor(save)
  // Passion: a player losing the fire for the game turns up less and less.
  p *= passionAttendanceFactor(player)
  // ---- The draw ----
  // Whether the room fills or empties comes down to two things, and both take
  // actually running the place to keep up. This is the early-game loop: manage
  // well and the room is full and pays the rent; coast and it quietly empties
  // until the thin crowd can't cover a bill that never shrinks.
  //
  // REPUTATION — is this a good place to be? arcadeOpinionOf folds it all in: a
  // clean floor, fair prices, snacks people like, and a healthy vibe (a toxic
  // scene tanks it). A well-run arcade is a genuine draw; a gross or hostile one
  // is where nobody wants to hang out.
  const reputation = arcadeOpinionOf(save, player) // 0..10
  p *= clamp(0.15 + reputation * 0.16, 0.15, 1.55)
  // WHAT ELSE IS IN THE BUILDING. A bowling alley or a laser tag arena is a
  // reason to come that has nothing to do with the fighting game, and it pulls
  // a crowd the fighting game never reaches — which is the entire argument for
  // spending rent money on floor space. Buying a SECOND room aimed at people
  // you already serve barely moves this (see audienceMix), so the question is
  // never "can I afford a room", it is "whose room is this".
  p *= attractionDrawFactor(save)
  // THE FAMOUS NAME (P5). A room that has actually produced champions is a
  // place people make a trip to stand in — the game already pays an EVO
  // winner's arcade for "sponsors & pilgrimage", and this is the same fact
  // on the attendance side rather than the cash side.
  //
  // Deliberately small and hard-capped. It is the one thing a fifteen-year
  // lineage carries that a first-year room cannot buy, which is exactly §0's
  // "recoverable at cost, with a famous name" — but a legendary room that
  // stops being run well must still empty, so this can never rescue a bad
  // one. Titles only: being briefly popular is not a landmark.
  p *= 1 + arcadeRenown(save)
  // FRESHNESS — is the game still worth showing up for? A hot, evolving scene
  // packs the room; one the world has moved on from empties it. Patches and a
  // living competitive scene keep this up; a stale build bleeds it away, and the
  // room with it. This is why a hands-off owner loses even a clean arcade.
  const relevance = save.relevance ?? 55
  p *= clamp(0.3 + (relevance / 100) * 1.35, 0.3, 1.45)
  // A hit patch opens a WINDOW: for a few weeks everyone wants to try the new
  // stuff, lapsed faces drift back, the room hums. The designer's payoff.
  if (absDayOf(save.day, save.year) < (save.freshMetaUntilAbs || 0)) p *= 1.18
  // Momentum: a golden-age room is the place to be; a slumping one, easy to skip.
  const mom = save.momentum?.state
  if (mom === 'golden') p *= 1.12
  else if (mom === 'slump') p *= 0.92
  return clamp(p, 0.02, 0.9)
}

/**
 * 0..0.35 — how much the building's HISTORY draws people on its own.
 *
 * Counts world and major titles won by this arcade's people, ever, across
 * eras. It is the only attendance term that survives a sequel intact, which
 * is what makes the second act of a long lineage feel different from the
 * first rather than merely later. Capped low on purpose: a landmark that is
 * dirty, overpriced and hostile still empties out, because every other term
 * in the product is about how the place is run right now.
 */
export function arcadeRenown(save) {
  const titles = Object.values(save.players || {})
    .filter((p) => !p.npc)
    .reduce((n, p) => n + (p.evoTitles || 0), 0)
  const majors = (save.hallOfFame || []).filter((r) => r.circuitKind === 'major'
    && (r.arcadeResults || []).some((a) => a.place === 1)).length
  return Math.min(0.35, titles * 0.09 + majors * 0.035)
}

// 0.3..1 — how well-known the arcade is. Low on opening day, climbs with days
// open, followers, and channel hype. Gates discovery (first-timers and new
// generated faces), not the loyalty of existing regulars. Resets on a fresh
// run (day and followers both reset).
function awarenessFactor(save) {
  const daysOpen = runAge(save) - 1
  const followers = save.stream?.followers || 0
  const hype = save.stream?.hype || 0
  // CHEAP PLAY IS ITS OWN ADVERTISING. "A quarter a game" is the thing people
  // actually tell each other about a room, and it is how every arcade the
  // player is picturing filled up. Without this the low end of the price curve
  // had no way to GROW a crowd — the goodwill it earned only made the regulars
  // it already had marginally fonder, which never outran the thinner margin,
  // so undercutting stayed a slow death no matter how the numbers were tuned.
  //
  // Deliberately placed in AWARENESS rather than in the loyalty term: it pulls
  // in people who have not been yet. That is what makes it a volume strategy —
  // more heads through the door, each spending less — and it is why the money
  // has to come back at the concession counter instead of the change machine.
  const price = save.arcade.prices?.token ?? 1
  const wordOfMouth = clamp((1.6 - price) * 0.42, 0, 0.55)
  return clamp(0.3 + daysOpen / 30 + followers / 1000 + hype / 100
    + adAwarenessBoost(save) + wordOfMouth, 0.3, 1.35)
}

// ---------- Innovations & techniques ----------

function generateInnovationName(save, charId) {
  const char = save.game.characters.find((c) => c.id === charId)
  const base = `${choice(TECHNIQUE_NAME_PARTS.prefix)} ${choice(TECHNIQUE_NAME_PARTS.suffix)}`
  if (char && char.moves.length && chance(0.6)) {
    return `${choice(char.moves).name} ${choice(TECHNIQUE_NAME_PARTS.suffix)}`
  }
  return base
}

// Per point of `innovation`, per attended day, before the frontier multiplier.
// This is a difficulty lever as well as a flavour one: every discovery is +1
// permanent performance through techniqueBonus (cap 12), which sits OUTSIDE
// skillCeiling, so it raises how strong a cultivated roster can get rather
// than just how fast it gets there.
const INNOVATION_RATE = 0.0028

/**
 * How fertile a character's tech is, relative to the rest of the roster.
 *
 * The low-hanging fruit gets picked first, so a character nobody has taken
 * apart still has all of it hanging there. The old form of this was an
 * absolute divisor — `1 / (1 + existing * 0.2)` — which pointed the right way
 * but was far too weak to matter: five people maining a character means five
 * rolls a day, and measured over 8 runs the correlation between how many
 * people mained a character and how much tech it had came out at +0.26, with
 * popular characters holding five times the tech of neglected ones. Discovery
 * was following the crowd, which is exactly backwards.
 *
 * Comparing against the roster average instead makes an untouched character
 * genuinely the frontier, and keeps it that way as the whole roster fills in.
 */
function techFrontier(save, charId) {
  const chars = selectableChars(save.game)
  if (!chars.length) return 1
  const counts = {}
  for (const i of save.innovations) if (i.charId) counts[i.charId] = (counts[i.charId] || 0) + 1
  const avgTech = chars.reduce((s, c) => s + (counts[c.id] || 0), 0) / chars.length
  const existing = charId ? (counts[charId] || 0) : save.innovations.filter((i) => !i.charId).length
  const byTech = Math.pow((1 + avgTech) / (1 + existing), 1.6)

  // Tech count alone cannot carry this. Measured over six 300-day runs, 71% of
  // characters finish with ZERO discovered tech and only 2% reach two — so for
  // three quarters of the roster the term above compares 0 against 0 and says
  // nothing. Meanwhile the FIRST discovery on a character is decided purely by
  // how many people are maining it and therefore rolling for it, which is why
  // tech was landing on popular characters at five times the rate.
  //
  // How many people already play it is the signal that actually varies, and it
  // says the same thing about the same fiction: with six people on a character
  // anything easy to find has been found and shared. One specialist alone on a
  // character the room has written off is the person who finds what it does.
  const mains = {}
  for (const p of Object.values(save.players)) {
    if (p.isRegular && !p.retired && p.mainCharId) mains[p.mainCharId] = (mains[p.mainCharId] || 0) + 1
  }
  const avgMains = chars.reduce((s, c) => s + (mains[c.id] || 0), 0) / chars.length
  const crowd = charId ? (mains[charId] || 0) : avgMains
  const byCrowd = Math.pow((1 + avgMains) / (1 + crowd), 0.9)

  // Clamped so a fresh roster isn't a discovery free-for-all and a well-mined
  // character never goes fully dead.
  return clamp(byTech * byCrowd, 0.25, 4)
}

function maybeInnovate(save, player, events) {
  const skill = player.charSkill[player.mainCharId] || 0
  // Unexplored characters are where the tech is. This is the payoff for the
  // player who mains what nobody else will: the contrarian picks the character
  // the room has written off, and the room has written it off precisely
  // because nobody has found what it can do yet.
  // 0.0008 put an innovation-8 specialist at roughly one discovery every two
  // in-game years — a signature stat the owner would essentially never see
  // pay off. See INNOVATION_RATE for what raising it does to the ladder.
  const p = player.personal.innovation * INNOVATION_RATE * (skill > 55 ? 1.5 : 1)
    * techFrontier(save, player.mainCharId || null)
  if (!chance(p)) return
  const isCharSpecific = chance(0.8) && player.mainCharId
  const innov = newInnovation({
    name: generateInnovationName(save, isCharSpecific ? player.mainCharId : null),
    charId: isCharSpecific ? player.mainCharId : null,
    creatorId: player.id,
    day: save.day,
    year: save.year,
    xp: randInt(4, 10),
    difficulty: randInt(3, 8),
  })
  save.innovations.push(innov)
  player.knownInnovations.push(innov.id)
  player.respect += 5
  // Created something (§1.2's edge table): invention pressures invention.
  eurekaEdge(save, player, { weight: 1.2, stats: ['innovation'], why: `"${innov.name}" is theirs` })
  writeJournal(save, player, 'innovation', { tech: innov.name, char: save.game.characters.find((c) => c.id === innov.charId)?.name })
  if (save.innovations.length === 1) {
    chronicle(save, '💡', `${pName(save, player)} discovered the scene's first original tech: "${innov.name}"`)
  }
  const leap = gainSkill(save, player, player.mainCharId, innov.xp)
  const char = save.game.characters.find((c) => c.id === innov.charId)
  if (char && save.charMilestones) {
    save.charMilestones.push({
      charId: char.id, day: save.day, year: save.year,
      text: `${pName(save, player)} discovered "${innov.name}"`,
    })
  }
  events.push({
    type: 'innovation',
    text: `${pName(save, player)} discovered a new technique: "${innov.name}"${char ? ` (${char.name} tech)` : ' (universal tech)'}! (+${leap.toFixed(1)} skill)`,
  })
}

function maybeLearnInnovation(save, learner, teacher, events, viaWatching = false) {
  const candidates = save.innovations.filter((i) =>
    teacher.knownInnovations.includes(i.id) &&
    !learner.knownInnovations.includes(i.id) &&
    (i.charId === null || i.charId === learner.mainCharId))
  if (!candidates.length) return
  const innov = choice(candidates)
  // You need real reps with the character before advanced tech clicks.
  const skill = learner.charSkill[learner.mainCharId] || 0
  if (innov.charId && skill < 30) return
  const p = learner.personal.learning * (viaWatching ? 0.005 : 0.011) * (1 - innov.difficulty * 0.05)
  if (!chance(p)) return
  learner.knownInnovations.push(innov.id)
  const leap = gainSkill(save, learner, learner.mainCharId, innov.xp)
  events.push({
    type: 'innovation',
    text: `${pName(save, learner)} learned "${innov.name}" from ${viaWatching ? 'watching' : ''} ${pName(save, teacher)}. (+${leap.toFixed(1)} skill)`,
  })
}

// ---------- Interactions ----------

/**
 * Small narrated social moments with real effects — jokes that land or
 * don't, compliments, trash talk, post-match afterglow and salt. Returns
 * display strings; mood/relationship changes are applied as they happen.
 */
/**
 * Is the arcade still new enough that the room itself is the subject?
 *
 * RUN AGE, not the calendar. A run opens on day 155, so `absDayOf` already
 * reads 155 on opening night and this was false from the very first hour —
 * every opening-weeks line in the game was unreachable. Anything asking "how
 * old is this arcade" wants runAge(); see the note on it in constants.js.
 */
function isOpeningWeeks(save) {
  return runAge(save) <= OPENING_DAYS
}

/**
 * One beat about the new place, chosen from what is ACTUALLY true of it and
 * of the speaker. This is the difference between immersion and filler: the
 * lines name the food that really is on the counter, the cabinet that really
 * is in the corner, and the number of setups the owner really did buy.
 *
 * Returns {kind, ctx} for `speak`, or null when there's nothing concrete to
 * say — better to fall through to ordinary chatter than to invent a detail.
 */
function openingTalk(save, p) {
  const a = save.arcade
  const options = []
  const favGame = choice(p.otherGames || [])
  const favFood = choice(p.foods || [])

  // Their taste, met or unmet by the room. The strongest beats, because they
  // are the ones that could only be said in THIS arcade by THIS person.
  if (favGame) {
    options.push((a.otherGames || []).includes(favGame)
      ? { kind: 'spotHere', ctx: { x: favGame }, weight: 4 }
      : { kind: chance(0.75) ? 'tasteGame' : 'spotMissing', ctx: { x: favGame }, weight: 3 })
  }
  if (favFood) {
    // Stocked → delight. Not stocked → either they simply say what they like,
    // or they note the gap; both are true things to say and alternating them
    // stops week one sounding like a single running complaint.
    options.push((a.foods || []).includes(favFood)
      ? { kind: 'spotHere', ctx: { x: favFood }, weight: 4 }
      : { kind: chance(0.5) ? 'tasteFood' : 'spotMissing', ctx: { x: favFood }, weight: 3 })
  }
  // A read on the room itself, and the fact everyone arrived at once.
  options.push({ kind: 'firstImpression', ctx: { n: save.settings?.setups ?? 1, x: a.name }, weight: 3 })
  options.push({ kind: 'newRoomBond', ctx: {}, weight: 2 })

  const total = options.reduce((n, o) => n + o.weight, 0)
  let roll = rand() * total
  for (const o of options) {
    roll -= o.weight
    if (roll <= 0) return o
  }
  return options[options.length - 1]
}

function makeBeats(save, group, where, results) {
  const beats = []
  // Speech beats carry a speaker and render as actual dialogue.
  const say = (p, kind, ctx = {}, note = null) => {
    const text = speak(p, kind, { self: pName(save, p), absDay: absDayOf(save.day, save.year), ...ctx })
    if (text) beats.push({ speaker: pName(save, p), text, note })
  }

  // Before anything else: has anyone in this circle never met before? People
  // introduce themselves ONCE, and it has to happen before any other line —
  // speak() records the meeting, so a joke firing first would quietly consume
  // the introduction.
  //
  // This is why it also outranks the scene corpus below. An introduction is
  // once per pair for the life of the run; a scene passed over tonight plays
  // another night. Casting first didn't DELAY the introduction, it deleted it —
  // scenes mark their whole cast as met. Measured on opening night: four people
  // who had never met, and the first thing any of them said was an authored
  // callback to a set they had never played together.
  let introduced = false
  if (group.length >= 2) {
    outer: for (const a of group) {
      for (const b of group) {
        if (a === b || !isFirstMeeting(a, b)) continue
        // In a brand-new room, introducing yourself IS talking about the
        // place — nobody's a regular yet and everyone knows it.
        const line = speak(a, isOpeningWeeks(save) ? 'openingIntro' : 'intro', {
          self: pName(save, a), t: pName(save, b), to: b, absDay: absDayOf(save.day, save.year),
        })
        if (line) {
          beats.push({ speaker: pName(save, a), text: line })
          // Both sides now know each other, whoever did the talking.
          noteMeeting(b, a, absDayOf(save.day, save.year))
          const reply = speak(b, isOpeningWeeks(save) ? 'openingGreet' : 'greet', {
            self: pName(save, b), t: pName(save, a), to: a, absDay: absDayOf(save.day, save.year),
          })
          if (reply) beats.push({ speaker: pName(save, b), text: reply })
          introduced = true
          break outer
        }
      }
    }
  }

  // A WRITTEN SCENE, if the room can cast one. This is the good stuff: an
  // exchange authored as a unit, so each turn actually answers the one before
  // it rather than being a line that happens to come next. It replaces the
  // whole rest of the chatter — a scene followed by three unrelated one-liners
  // reads worse than either alone.
  //
  // Not when somebody just introduced themselves, though: the corpus is written
  // for people who know each other, and a callback landing one beat after "I
  // don't think we've met" is the exact break this ordering exists to stop.
  if (!introduced && chance(SCENE_CHANCE)) {
    const scene = castScene(save, group, results, { tournamentToday: !!whatHappensToday(save) })
    if (scene) {
      for (const beat of sceneBeats(scene, (p) => pName(save, p))) beats.push(beat)
      if (beats.length) {
        // Talking to someone counts as meeting them, same as every other path.
        const cast = Object.values(scene.cast)
        for (const a of cast) for (const b of cast) if (a !== b) noteMeeting(a, b, absDayOf(save.day, save.year))
        return beats.slice(0, 4)
      }
    }
  }

  // OPENING WEEKS: the room is the subject. Fires high, right after the
  // introductions, so the first thing anyone says about anything is what they
  // make of the place they've just walked into — and often somebody answers,
  // because "what do you play?" is how strangers actually start.
  if (isOpeningWeeks(save) && chance(0.85)) {
    const speaker = choice(group)
    const talk = openingTalk(save, speaker)
    if (talk) {
      const other = group.find((x) => x !== speaker)
      say(speaker, talk.kind, { ...talk.ctx, t: other ? pName(save, other) : 'you', to: other })
      // A second voice chimes in with their OWN taste — two strangers
      // comparing notes reads as a conversation; one person narrating the
      // decor reads as a plaque on the wall.
      if (other && chance(0.55)) {
        const reply = openingTalk(save, other)
        if (reply) say(other, reply.kind, { ...reply.ctx, t: pName(save, speaker), to: speaker })
      }
    }
  }

  // Somebody airs a conviction. The more firmly it's held the more likely it
  // is to come out unprompted — that's what having an opinion looks like.
  // Quieter in the opening weeks: nobody has watched enough sets here to have
  // hardened into a position about the meta yet.
  if (group.length >= 2 && chance(isOpeningWeeks(save) ? 0.12 : 0.3)) {
    const holders = group.filter((p) => loudestTake(p))
    if (holders.length) {
      const p = choice(holders)
      const take = loudestTake(p)
      const kind = takeKind(take)
      const label = takeSubjectLabel(save, take, (x) => pName(save, x))
      // A conviction gets aired even when nobody asked; a mild opinion needs
      // a nudge.
      if (kind && (label || take.topic === 'arcade') && (isConviction(take) || chance(0.5))) {
        const other = group.find((x) => x !== p)
        const line = speak(p, kind, {
          self: pName(save, p), x: label, t: other ? pName(save, other) : 'you',
          to: other, absDay: absDayOf(save.day, save.year),
        })
        if (line) {
          beats.push({ speaker: pName(save, p), text: line })

          // ...and somebody answers. An opinion said into silence is a quote;
          // an opinion somebody argues with is a conversation. Who replies and
          // how depends on what THEY believe, so the argument is real.
          const responders = group.filter((x) => x !== p)
          const backer = responders.find((x) => findTake(x, take.topic, take.subject)?.stance === take.stance)
          const objector = responders.find((x) => {
            const t2 = findTake(x, take.topic, take.subject)
            if (t2 && t2.stance !== take.stance) return true
            // Defending your own main is the most natural objection there is.
            return take.topic === 'character' && x.mainCharId === take.subject
          })

          if (backer && chance(0.7)) {
            const reply = speak(backer, 'agreeTake', {
              self: pName(save, backer), t: pName(save, p), to: p, x: label, absDay: absDayOf(save.day, save.year),
            })
            if (reply) {
              beats.push({ speaker: pName(save, backer), text: reply })
              // Being agreed with is how an opinion hardens into a position.
              pushTake(p, take.topic, take.subject, take.stance, absDayOf(save.day, save.year), 5)
              pushTake(backer, take.topic, take.subject, take.stance, absDayOf(save.day, save.year), 5)
              shiftRel(backer, p, 2)
              shiftRel(p, backer, 2)
            }
          } else if (objector && chance(0.65)) {
            const reply = speak(objector, disputeKind(take), {
              self: pName(save, objector), t: pName(save, p), to: p, x: label, absDay: absDayOf(save.day, save.year),
            })
            if (reply) {
              beats.push({ speaker: pName(save, objector), text: reply })
              // Being argued with makes people dig in, not reconsider.
              pushTake(p, take.topic, take.subject, take.stance, absDayOf(save.day, save.year), 4)
              shiftRel(p, objector, -1.5)
            }
          }
        }
      }
    }
  }

  // People who've played each other a lot talk about the record.
  if (group.length >= 2 && chance(0.3)) {
    const pairs = []
    for (const a of group) {
      for (const b of group) {
        if (a === b) continue
        const h = a.h2h?.[b.id]
        const n = h ? (h.w || 0) + (h.l || 0) : 0
        if (n >= 4) pairs.push({ a, b, h, n })
      }
    }
    if (pairs.length) {
      const { a, b, h, n } = choice(pairs)
      const line = speak(a, 'callback', {
        self: pName(save, a), t: pName(save, b), to: b, absDay: absDayOf(save.day, save.year),
        w: h.w, l: h.l, n,
      })
      if (line) beats.push({ speaker: pName(save, a), text: line })
    }
  }

  const glow = group.find((p) => results[p.id] === 'won' && p.mood >= 6)
  const salty = group.find((p) => results[p.id] === 'lost' && p.mood <= 5.5)
  if (glow && chance(0.55)) say(glow, 'winGlow')
  else if (salty && chance(0.55)) say(salty, 'saltyLoss')

  // Someone cracks a joke. Whether it lands depends on the target.
  if (group.length >= 2 && chance(0.55)) {
    const joker = [...group].sort((x, y) =>
      (y.social.charisma + y.social.persona) - (x.social.charisma + x.social.persona))[0]
    const target = choice(group.filter((p) => p !== joker))
    const landChance = clamp(
      0.45 + joker.social.charisma * 0.04 + getRel(target, joker) * 0.003 +
      (target.mood - 5) * 0.03 - (results[target.id] === 'lost' ? 0.15 : 0),
      0.1, 0.92)
    say(joker, 'joke', { t: pName(save, target), to: target })
    // Sensitivity feels everything AT VOLUME — and it has to cut both ways.
    // The down coefficient was double the up one (0.12 vs 0.06) on top of a
    // bigger base, which made `sensitivity` a strictly losing stat: identical
    // social churn cost a dramatic player more than it ever paid them. Pair
    // that with `persona` polarising the room (which makes jokes bomb more
    // often) and the whole Dramatic row was a compounding mood tax — measured,
    // deleting the row cut the death rate from 80% to 60%.
    if (chance(landChance)) {
      const dm = 0.22 + target.social.sensitivity * 0.10
      target.mood = clamp(target.mood + dm, 0, 10)
      shiftRel(target, joker, 1.5)
      say(target, 'jokeLanded', { t: pName(save, joker), to: joker }, `(+${dm.toFixed(1)} mood)`)
    } else {
      const dm = 0.28 + target.social.sensitivity * 0.10
      target.mood = clamp(target.mood - dm, 0, 10)
      shiftRel(target, joker, -2.5)
      say(target, 'jokeBombed', { t: pName(save, joker), to: joker }, `(−${dm.toFixed(1)} mood)`)
    }
  }

  const kind = group.find((p) => p.social.politeness >= 4)
  if (kind && group.length >= 2 && chance(0.3)) {
    const target = choice(group.filter((p) => p !== kind))
    const dm = 0.15 + target.social.sensitivity * 0.05
    target.mood = clamp(target.mood + dm, 0, 10)
    shiftRel(target, kind, 1.2)
    const char = save.game.characters.find((c) => c.id === target.mainCharId)
    say(kind, 'compliment', { t: pName(save, target), to: target, c: char?.name }, `(+${dm.toFixed(1)} mood for ${pName(save, target)})`)
  }

  const loudmouth = group.find((p) => p.social.politeness === 0 && p.personal.dominance >= 4)
  if (loudmouth && group.length >= 2 && chance(0.3)) {
    const target = choice(group.filter((p) => p !== loudmouth))
    shiftRel(target, loudmouth, -1.5)
    say(loudmouth, 'trashTalk', { t: pName(save, target), to: target }, `(${pName(save, target)} files it away for later)`)
  }

  // Hygiene. Nobody says anything. Everybody notices.
  const ripe = group.find((p) => p.slob)
  if (ripe && group.length >= 2 && chance(0.25)) {
    beats.push(choice([
      `${pName(save, ripe)} joins the circle. The circle widens slightly.`,
      `Someone cracks the door for "air flow" shortly after ${pName(save, ripe)} sits down.`,
      `${pName(save, ripe)} is here. The concession stand's nacho smell is losing the battle.`,
    ]))
  }

  // Old war stories: defining moments get retold. Forever. Aloud. And if
  // somebody the story is ABOUT happens to be standing here, it gets told to
  // their face instead — which is the version that makes a room feel like it
  // has a history rather than a log.
  const presentIds = group.map((p) => p.id)
  const toFace = group
    .map((p) => ({ p, mem: memoryAbout(p, presentIds.filter((id) => id !== p.id)) }))
    .filter((x) => x.mem)
  if (toFace.length && group.length >= 2 && chance(0.35)) {
    const { p, mem } = choice(toFace)
    const subject = group.find((o) => o !== p && (mem.subjectIds || []).includes(o.id))
    // The memory names them, and they're standing right here — so say "you".
    // "watching CrossUp beat PopOff in that money match" told TO PopOff should
    // be "watching CrossUp beat you in that money match".
    const subjName = subject ? pName(save, subject) : null
    const memText = subjName ? mem.text.replaceAll(subjName, 'you') : mem.text
    say(p, 'memoryToFace', { mem: memText, t: subjName, to: subject })
    // And they answer for it — owning it or flatly disputing the retelling.
    if (subject && chance(0.6)) {
      const owns = (subject.social?.sportsmanship || 0) >= 2
      say(subject, owns ? 'memoryConfirm' : 'memoryDeny', { t: pName(save, p), to: p })
    }
  } else {
    const storyteller = group.find((p) => (p.memories || []).length > 0)
    if (storyteller && group.length >= 2 && chance(0.15)) {
      const mem = choice(storyteller.memories)
      say(storyteller, 'memoryRetell', { mem: mem.text })
    }
  }

  // A visiting crew is the loudest thing in the room. When one of them is in a
  // huddle, that exchange takes priority over the ordinary counter chatter —
  // the whole point of an invasion week is that the arcade feels different.
  const exchange = where === 'at the concession stand'
    ? visitorExchange(save, group, (p) => pName(save, p))
      // No visitors in the huddle? Sometimes the room talks about the people
      // it watches instead — the world top eight, and EVO when it's close.
      || worldTalkExchange(save, group, (p) => pName(save, p))
    : null
  if (exchange) beats.push(...exchange)

  // At the counter, the game falls away for a beat — someone says something
  // human. This is what makes the cast feel like people, not stat blocks.
  if (!exchange && where === 'at the concession stand' && chance(0.5)) {
    const talker = choice(group)
    const other = group.find((p) => p !== talker)
    const line = speak(talker, 'lifeChat', { self: pName(save, talker), to: other, absDay: absDayOf(save.day, save.year), t: other ? pName(save, other) : 'someone' })
    if (line) beats.push({ speaker: pName(save, talker), text: line })
  }

  if (where === 'at the concession stand' && save.arcade.foods.length && group.length >= 2 && chance(0.4)) {
    const food = choice(save.arcade.foods)
    const fans = group.filter((p) => p.foods.includes(food))
    for (const f of fans) f.mood = clamp(f.mood + 0.3, 0, 10)
    beats.push(`${pName(save, group[0])} splits ${food} with ${pName(save, group[1])}.` +
      (fans.length ? ` ${fans.map((f) => pName(save, f)).join(' and ')} approve${fans.length === 1 ? 's' : ''}. (+0.3 mood)` : ''))
  } else if (where.startsWith('playing') && group.length >= 2 && chance(0.4)) {
    beats.push(`${pName(save, group[0])} and ${pName(save, group[1])} trade high scores between rounds.`)
  }

  return beats.slice(0, 4)
}

// ---------- Money matches ----------
// No wallets, no ledgers — pure in-world stakes. Two people with history
// call their shot, the arcade circles the date, and everybody shows up.

export function scheduledMoneyMatch(save) {
  return (save.moneyMatches || []).find((m) => m.status === 'scheduled')
}

function moneyMatchToday(save) {
  const mm = scheduledMoneyMatch(save)
  return mm && mm.year === save.year && mm.dayOfYear === save.day ? mm : null
}

function maybeScheduleMoneyMatch(save, events) {
  if (!save.moneyMatches || scheduledMoneyMatch(save)) return
  if (!chance(0.07)) return
  const regs = Object.values(save.players).filter((p) => p.isRegular && p.mainCharId && !p.retired && !p.banished)
  const pairs = []
  for (const a of regs) {
    for (const b of regs) {
      if (a.id >= b.id) continue
      const h = a.h2h?.[b.id]
      const games = h ? h.w + h.l : 0
      const badBlood = getRel(a, b) < -30 && getRel(b, a) < -30
      const heatedRivalry = games >= 8 && Math.abs(a.elo - b.elo) < 150 &&
        (getRel(a, b) < 0 || getRel(b, a) < 0)
      if (badBlood || heatedRivalry) pairs.push([a, b])
    }
  }
  if (!pairs.length) return
  const [x, y] = choice(pairs)
  // The bigger personality does the calling out.
  const challenger = (x.social.persona + x.personal.dominance) >= (y.social.persona + y.personal.dominance) ? x : y
  const target = challenger === x ? y : x
  const days = randInt(2, 4)
  let dayOfYear = save.day + days
  let year = save.year
  if (dayOfYear > DAYS_PER_YEAR) { dayOfYear -= DAYS_PER_YEAR; year += 1 }
  save.moneyMatches.push({
    id: uid('mm'), aId: challenger.id, bId: target.id, dayOfYear, year, status: 'scheduled', winnerId: null,
  })
  events.push({
    type: 'moneymatch_announce',
    text: `💸 ${pName(save, challenger)} calls out ${pName(save, target)} — MONEY MATCH in ${days} days! The whole arcade is buzzing.`,
  })
  postMoneyMatchAnnouncement(save, pName(save, challenger), pName(save, target), days)
}

function runMoneyMatch(save, mm, present, events) {
  const a = save.players[mm.aId]
  const b = save.players[mm.bId]
  if (!a || !b || !a.mainCharId || !b.mainCharId) { mm.status = 'done'; return }
  const watchers = present.filter((p) => p.id !== a.id && p.id !== b.id)
  // Money is on the line — both scout the matchup and counterpick if their main
  // is at a disadvantage and they've got a pocket that swings it.
  const aCharId = pickMatchChar(save, a, b.mainCharId)
  const bCharId = pickMatchChar(save, b, a.mainCharId)
  const probA = winProbability(save, a, aCharId, b, bCharId)
  const result = resolveMatch(save, a, b, aCharId, bCharId)
  const winner = result.winner
  const loser = result.loser
  const charA = save.game.characters.find((c) => c.id === aCharId)
  const charB = save.game.characters.find((c) => c.id === bCharId)
  const mmStage = save.game.stages.length ? choice(save.game.stages) : null
  // Money matches are marquee: several seeds, keep the most dramatic cut.
  const nar = narrateSet({
    aName: pName(save, a), bName: pName(save, b),
    charA, charB, probA, winnerIsA: result.aWins, long: true,
    skillA: a.charSkill[aCharId] || 0, skillB: b.charSkill[bCharId] || 0,
    statsA: a.personal, statsB: b.personal,
    stageName: mmStage?.name,
    winnerPhrase: winner.catchphrase,
    seriesNote: seriesNoteFor(a, b, pName(save, a), pName(save, b)),
    grudge: true,
    watcherCount: watchers.length,
    marquee: true, spice: 3,
    rules: save.game.rules,
    game: save.game, // the engine needs the cast to resolve form changes
    seed: randInt(1, 2147483646),
  })
  // The stare-down before the sticks are even plugged in.
  const preMatch = []
  for (const p of [a, b]) {
    const opp = p === a ? b : a
    const line = speak(p, 'mmPre', { t: pName(save, opp), to: opp, self: pName(save, p), absDay: absDayOf(save.day, save.year) })
    if (line) preMatch.push({ speaker: pName(save, p), text: line })
  }
  // And the words after — a money match always ends with words.
  const postMatch = []
  const wl = speak(winner, 'ggWin', { t: pName(save, loser), to: loser, self: pName(save, winner), absDay: absDayOf(save.day, save.year) })
  if (wl) postMatch.push({ speaker: pName(save, winner), text: wl })
  const goodSport = loser.social.sportsmanship >= 4
  const ll = speak(loser, goodSport ? 'ggLossGood' : 'ggLossBad', { t: pName(save, winner), to: winner, self: pName(save, loser), absDay: absDayOf(save.day, save.year) })
  if (ll) postMatch.push({ speaker: pName(save, loser), text: ll })

  const ev = {
    type: 'match',
    moneyMatch: true,
    setupIndex: 1,
    aId: a.id, bId: b.id,
    aName: pName(save, a), bName: pName(save, b),
    charAName: charA?.name || 'Random', charBName: charB?.name || 'Random',
    charAId: charA?.id || null, charBId: charB?.id || null,
    stageName: mmStage?.name,
    probA,
    winnerId: winner.id, winnerName: pName(save, winner),
    eloDelta: result.eloDelta,
    watcherIds: watchers.map((w) => w.id),
    watcherNames: watchers.map((w) => pName(save, w)),
    narration: nar.lines, narrationMeta: nar.meta, setScore: nar.score,
    setLoserGames: nar.loserGames,
    narrationHud: nar.hud, ftTarget: nar.target, narrationSeed: nar.seed,
    preMatch, postMatch,
  }
  // A money match is an event: it goes on stream automatically and the
  // stakes juice the broadcast.
  ev.stream = buildStream(save, {
    level: ((a.charSkill[aCharId] || 0) + (b.charSkill[bCharId] || 0)) / 200,
    personality: Math.min(1, (personalityOf(a) + personalityOf(b)) / 2 + 0.25),
    probA, aWins: result.aWins, narration: nar.lines, meta: nar.meta,
    aName: ev.aName, bName: ev.bName, winnerName: ev.winnerName,
    context: 'daily',
  })
  // A money match under the lights is real stage experience for both principals.
  applyStageReps(save, [a, b], ev.stream, 'moneymatch', 1, {
    probA, aWins: result.aWins, target: nar.target, loserGames: nar.loserGames,
  })
  // Stakes: pride, glory, and the story everyone will tell.
  winner.respect += 6
  winner.glory += 3
  winner.mood = clamp(winner.mood + 1.5, 0, 10)
  loser.mood = clamp(loser.mood - 1.5, 0, 10)
  bumpPassion(winner, 8) // a marquee win reminds you why you play
  bumpPassion(loser, 2) // even losing one this big is a story worth staying for
  remember(save, winner, 'moneymatch', `winning the money match against ${pName(save, loser)}`, { subjectIds: [loser.id] })
  remember(save, loser, 'moneymatch', `losing the money match to ${pName(save, winner)}`, { subjectIds: [winner.id] })
  writeJournal(save, winner, 'moneyWin', { opp: loser.alias || loser.firstName })
  writeJournal(save, loser, 'moneyLoss', { opp: winner.alias || winner.firstName })
  // A money match is the whole arcade's memory, not just the two principals'.
  witnessed(save, watchers, 'moneymatch',
    `watching ${pName(save, winner)} beat ${pName(save, loser)} in that money match`,
    { subjectIds: [winner.id, loser.id] })
  chronicle(save, '💸', `${pName(save, winner)} beat ${pName(save, loser)} ${nar.score} in the money match everyone still talks about`)
  if (chance(0.3)) {
    shiftRel(winner, loser, 12)
    shiftRel(loser, winner, 12)
    events.push({ type: 'moneymatch_announce', text: `🤝 The handshake after says it all — ${ev.aName} and ${ev.bName} settled something today.` })
  } else {
    shiftRel(loser, winner, -4)
  }
  for (const w of watchers) {
    gainSkill(save, w, w.mainCharId, 0.02 + w.personal.analysis * 0.045)
    applySocialMood(w, 0.8)
  }
  mm.status = 'done'
  mm.winnerId = winner.id
  events.push(ev)
  // Money matches are broadcast events — they get a VOD like any tournament,
  // spoiler-free until played back.
  pushVod(save, {
    id: uid('vod'),
    type: 'moneymatch',
    name: `Money Match: ${ev.aName} vs ${ev.bName}`,
    day: save.day,
    year: save.year,
    dateLabel: formatDay(save.day, save.year),
    champion: ev.winnerName,
    entrantCount: 2,
    channelName: save.stream.channelName,
    peakViewers: ev.stream?.viewers || 0,
    revealed: 0,
    match: ev,
  })
}


function runInteraction(save, group, where, events, results = {}) {
  const feelings = []
  const outcomes = []
  const beats = makeBeats(save, group, where, results)
  // The concession stand is where people decompress: warm food, low stakes.
  if (where === 'at the concession stand') {
    for (const p of group) p.mood = clamp(p.mood + 0.1, 0, 10)
  }
  for (const a of group) {
    let totalDelta = 0
    for (const b of group) {
      if (a.id === b.id) continue
      const before = getRel(a, b)
      const delta = socialDelta(a, b)
      shiftRel(a, b, delta)
      totalDelta += delta
      const after = getRel(a, b)
      if (before < 20 && after >= 20) outcomes.push(`${pName(save, a)} and ${pName(save, b)} are becoming real friends.`)
      if (before > -50 && after <= -50) outcomes.push(`${pName(save, a)} now considers ${pName(save, b)} an enemy.`)
      if (before > -80 && after <= -80 && getRel(b, a) <= -50) {
        outcomes.push(`${pName(save, a)} and ${pName(save, b)} are past rivalry now. This is a feud.`)
        chronicle(save, '⚔️', `${pName(save, a)} and ${pName(save, b)} became mortal enemies — the arcade quietly picks sides`)
      }
      // Innovations spread through conversation.
      maybeLearnInnovation(save, a, b, events)
    }
    applySocialMood(a, totalDelta)
    feelings.push({
      id: a.id,
      name: pName(save, a),
      mood: a.mood,
      note: totalDelta > 1.5 ? 'having a great time' : totalDelta < -1.5 ? 'getting irritated' : 'hanging out',
    })
    if (totalDelta > 0) a.respect += 0.2
  }

  // Mentorship: a strong community-minded player takes a weaker one under wing.
  const sorted = [...group].sort((x, y) => y.elo - x.elo)
  const mentor = sorted[0]
  const student = sorted[sorted.length - 1]
  if (mentor !== student && mentor.elo - student.elo > 120 && getRel(mentor, student) > 15 &&
      !save.mentorships.some((m) => m.studentId === student.id) &&
      // Floor + slope, not bare multiplication: under the sparse point buy an
      // unspent stat is 0, so `chance(community * 0.02)` was chance(0) for
      // most of the roster and mentorships could never form at all. The gating
      // conditions above are already the rare part.
      chance(0.02 + mentor.social.community * 0.02)) {
    save.mentorships.push({ mentorId: mentor.id, studentId: student.id, startedDay: save.day, startedYear: save.year })
    mentor.respect += 4
    writeJournal(save, mentor, 'mentor', { opp: student.alias || student.firstName })
    outcomes.push(`${pName(save, mentor)} started mentoring ${pName(save, student)}!`)
  }

  // Team formation & recruitment. FULL teams inspire rivals to raise their
  // own banner; a pile of struggling two-man crews does the opposite — and
  // nobody founds a team when there aren't enough free agents to fill one.
  const allTeams = Object.values(save.teams)
  const fullTeams = allTeams.filter((t) => t.memberIds.length >= 4).length
  const struggling = allTeams.filter((t) => t.memberIds.length < 4).length
  const foundingPressure = Math.max(0.25, 1 + fullTeams * 0.5 - struggling * 0.35)
  const freeAgents = Object.values(save.players).filter((p) => p.isRegular && !p.teamId && !p.retired && !p.banished).length
  for (const a of group) {
    const team = teamOf(save, a)
    if (team) {
      // THE CAST COMES FIRST (P6). This scanned `group` in attendance order
      // and took the first relationship-qualifying body, and in a room where
      // filler outnumbers the cast ten to one that meant roster slots went to
      // strangers on nothing but arrival order. Teams are a CAST institution:
      // your people get the seat whenever one of them qualifies.
      const eligible = group.filter((b) => b.id !== a.id && !b.teamId
        && getRel(a, b) > 25 && getRel(b, a) > 15)
      eligible.sort((x, y) => (x.npc ? 1 : 0) - (y.npc ? 1 : 0))
      for (const b of eligible) {
        if (tryJoinTeam(save, team, b, a, events)) break
      }
    } else if (freeAgents >= 5 && chance((0.01 + a.social.community * 0.015) * foundingPressure)) {
      // Your co-founder is your FRIEND, not whoever happened to be standing in
      // this particular huddle. Searching only `group` meant the roll and the
      // friendship had to coincide inside one small conversation, and measured
      // over two years that produced 0 teams in a 66-person scene with 19
      // eligible pairs — the whole team subsystem was effectively off.
      const here = (save.dayInProgress?.attendeeIds || [])
        .map((id) => save.players[id])
        .filter((p) => p && !p.retired && !p.banished)
      const pool = here.length ? here : group
      // The bar is what a real friendship in THIS sim looks like, not what 40
      // sounds like. Measured over a two-year run: mutual 40/30 pairs do not
      // exist at all until day ~336 and reach only 11 by day 672, so the old
      // gate made founding a team impossible for a whole year and vanishingly
      // rare after — 0 teams in eight two-year runs. At 28/18 the first pairs
      // appear mid-year-one, which is when a scene should start forming crews.
      const buddy = pool
        .filter((b) => b.id !== a.id && !b.teamId && getRel(a, b) > 28 && getRel(b, a) > 18)
        .sort((x, y) => (x.npc ? 1 : 0) - (y.npc ? 1 : 0))[0]
      if (buddy) tryFoundTeam(save, a, buddy, save.day, save.year, events)
    }
  }

  events.push({
    type: 'interaction',
    where,
    memberIds: group.map((p) => p.id),
    memberNames: group.map((p) => pName(save, p)),
    beats,
    feelings,
    outcomes,
  })
}

// ---------- The day, hour by hour ----------

/**
 * Opens the arcade for the day: who shows up, who's new, who picked a main.
 * Populates save.dayInProgress; hours are then simulated one at a time.
 */
export function startDay(save) {
  bindRng(save)
  const events = []

  // A scheduled patch ships the morning its date arrives — whatever the
  // draft looks like at that moment. Countdown posts fire on the way there.
  if (save.scheduledPatch) {
    const todayAbs = absDayOf(save.day, save.year)
    if (todayAbs >= save.scheduledPatch.absDay) {
      if (save.gameDraft) {
        const patch = releasePatch(save)
        events.push({
          type: 'patch',
          text: `🛠 Patch v${patch.version} went live this morning, right on schedule — ${patch.reception}.`,
        })
      } else {
        save.scheduledPatch = null // draft was discarded; the date quietly dies
      }
    } else {
      const left = save.scheduledPatch.absDay - todayAbs
      if ([7, 3, 1].includes(left)) postPatchCountdown(save, save.scheduledPatch.version, left)
    }
  }

  // Shut down by the health department: the doors stay locked, the day
  // still passes. (EVO and the patch pipeline don't care about your mop.)
  if (arcadeClosed(save)) {
    events.push({
      type: 'economy',
      text: '🚧 The arcade is shuttered by health-department order. A few regulars press their faces to the glass and leave.',
    })
    save.hour = 0
    save.dayInProgress = {
      day: save.day, year: save.year, dateLabel: formatDay(save.day, save.year),
      attendeeIds: [], newcomers: [], staysUntil: {}, results: {}, gamesToday: {}, charToday: {},
      openingEvents: events, hours: [], closed: true,
    }
    return
  }

  // Read the scene's competitive temperature once, up front — it feeds
  // attendance (toxicity thins the crowd) and the day's rivalry development.
  save.scene = sceneHealth(save)

  // Refresh the filler pool: strangers drift into the arcade's orbit and back
  // out of it. They're candidates, not attendees — every one of them still has
  // to pass the same attendance check as the cast the user built, so a scene
  // nobody wants to be part of stays empty no matter how many exist.
  topUpNpcs(save, absDayOf(save.day, save.year))

  const everyone = Object.values(save.players)
  const attendees = []
  const newcomers = []
  for (const p of everyone) {
    if (p.retired || p.banished) continue // hung up the sticks for good
    if (isStaffed(save, p.id)) continue // on shift — can't work and play
    if (chance(attendChance(save, p))) {
      const prevStatus = statusOf(p)?.key
      attendees.push(p)
      p.daysAttended += 1
      if (p.npc) p.npcLastSeenAbs = absDayOf(save.day, save.year)
      if (!p.isRegular) {
        p.isRegular = true
        newcomers.push(p.id)
        // Filler arrives without an announcement — the room just has people in
        // it. Only the cast the user built gets a first-night beat.
        if (!p.npc) events.push({ type: 'arrival', text: `${p.firstName} "${p.alias || '—'}" ${p.lastName} came to ${save.arcade.name} for the first time.` })
      }
      // Climbing the status ladder is an event — being a regular here
      // MEANS something now.
      const nowStatus = statusOf(p)
      if (!p.npc && nowStatus && nowStatus.key !== prevStatus && prevStatus != null) {
        const line = {
          casual: `${pName(save, p)} keeps finding excuses to come back — a casual now.`,
          regular: `${pName(save, p)} is officially a regular. They have a spot, and everyone knows it's theirs.`,
          veteran: `${pName(save, p)} hit veteran status — they've seen metas come and go.`,
          star: `⭐ ${pName(save, p)} is a star of ${save.arcade.name}. People come just to watch them.`,
          legend: `👑 ${pName(save, p)} is an arcade LEGEND. Their name is basically on the building.`,
        }[nowStatus.key]
        if (line) events.push({ type: 'arrival', text: line })
        if (nowStatus.key === 'star') {
          chronicle(save, '⭐', `${pName(save, p)} became a star of ${save.arcade.name}`)
          awardMilestone(save, 'first-star', 2, `${save.arcade.name} produced its first star`)
        }
        if (nowStatus.key === 'legend') {
          chronicle(save, '👑', `${pName(save, p)} reached legend status at ${save.arcade.name}`)
          awardMilestone(save, 'first-legend', 5, 'An arcade LEGEND came up under this roof')
        }
      }
      if (p.mainCharId && (p.lockedMain || p.exploredChars.length === 0)) {
        // A main chosen at creation counts as already settled.
        p.settledMain = true
        if (!p.exploredChars.includes(p.mainCharId)) p.exploredChars.push(p.mainCharId)
      }
      if (!p.settledMain) startExplorationDay(save, p, events)
    }
  }

  // A money match whose date slipped past (tournament day, etc.) happens today.
  const pending = scheduledMoneyMatch(save)
  if (pending && (pending.year < save.year || (pending.year === save.year && pending.dayOfYear < save.day))) {
    pending.dayOfYear = save.day
    pending.year = save.year
  }
  const mmToday = moneyMatchToday(save)
  if (mmToday) {
    // Nobody misses their own money match — or the chance to watch one.
    for (const id of [mmToday.aId, mmToday.bId]) {
      const p = save.players[id]
      if (p && !attendees.includes(p)) { attendees.push(p); p.daysAttended += 1 }
    }
    const an = save.players[mmToday.aId]
    const bn = save.players[mmToday.bId]
    if (an && bn) {
      events.push({ type: 'moneymatch_announce', text: `💸 It's money match day. ${pName(save, an)} vs ${pName(save, bn)} at 7 PM. The room already feels different.` })
    }
  }

  // How long each attendee sticks around (spark = stays longer).
  const staysUntil = {}
  for (const p of attendees) {
    staysUntil[p.id] = clamp(2 + Math.round(2 + p.personal.spark * 0.32 + rand() * 2 - 1), 1, HOURS_PER_DAY)
  }
  if (mmToday) {
    // The principals (and their audience) stay through the 7 PM showdown.
    if (staysUntil[mmToday.aId] != null || save.players[mmToday.aId]) staysUntil[mmToday.aId] = HOURS_PER_DAY
    if (staysUntil[mmToday.bId] != null || save.players[mmToday.bId]) staysUntil[mmToday.bId] = HOURS_PER_DAY
  }

  save.hour = 0
  save.dayInProgress = {
    day: save.day,
    year: save.year,
    dateLabel: formatDay(save.day, save.year),
    attendeeIds: attendees.map((p) => p.id),
    newcomers,
    staysUntil,
    results: {}, // playerId -> 'won' | 'lost' (latest result today, feeds social beats)
    gamesToday: {}, // playerId -> games played today (fatigue)
    charToday: {}, // playerId -> charId they last brought today (feeds pocket-pick scenes)
    openingEvents: events,
    hours: [], // one entry per simulated hour: {label, events, streamedSetup}
  }
}

/**
 * Simulates one hour of arcade time. Requires startDay to have run.
 */
export function simHour(save) {
  bindRng(save)
  const dip = save.dayInProgress
  if (!dip || save.hour >= HOURS_PER_DAY) return
  dip.results ??= {} // days started before this field existed
  const hourIdx = save.hour
  const events = []
  const attendees = dip.attendeeIds.map((id) => save.players[id]).filter(Boolean)
  const present = shuffle(attendees.filter((p) => (dip.staysUntil[p.id] || 0) > hourIdx))

  dip.gamesToday ??= {}

  // 7 PM: money match time. The whole arcade stops to watch — no other
  // matches happen this hour.
  const mm = moneyMatchToday(save)
  if (mm && mm.status === 'scheduled' && hourIdx === 3 && present.length > 0) {
    runMoneyMatch(save, mm, present, events)
    dip.hours.push({
      label: HOUR_LABELS[hourIdx],
      presentIds: present.map((p) => p.id),
      presentNames: present.map((p) => pName(save, p)),
      streamedSetup: 1, // the money match owns the stream this hour
      events,
    })
    save.hour = hourIdx + 1
    return
  }

  if (present.length > 0) {
    // Only some players are itching to play this hour — and fatigue builds
    // with every game played today. Stamina is how long the tank lasts,
    // and steep token prices make the wallet-conscious sit a few out.
    const wantsToPlay = present.filter((p) => {
      const played = dip.gamesToday[p.id] || 0
      const fatigue = played * Math.max(0.015, 0.12 - p.personal.stamina * 0.0105)
      // SIGNED: a dear token makes them sit one out, a cheap one buys "go on
      // then, one more". The volume half is why a quarter arcade can work.
      const priceShift = tokenPlayShift(save, p)
      return chance(clamp(0.38 + p.personal.spark * 0.012 + p.personal.dominance * 0.012 - fatigue + priceShift, 0.02, 0.9))
    })
    const matches = []
    const pool = [...wantsToPlay]
    const setupsCount = Math.max(1, save.settings.setups)
    // Queue pressure: everyone left in the pool when the cabs are full is a
    // player holding a token with nowhere to put it. Tallied for the day and
    // folded into the arcade's reputation (endDay) — "you can never get a
    // game there" is exactly the complaint that makes expansion worth it.
    dip.demandTurns = (dip.demandTurns || 0) + wantsToPlay.length
    while (matches.length < setupsCount && pool.length >= 2) {
      const a = pool.shift()
      // Prefer an opponent near their elo, or a rival they want to run it back with.
      let bIdx = 0
      let bestScore = -Infinity
      for (let i = 0; i < Math.min(pool.length, 6); i++) {
        const b = pool[i]
        let s = -Math.abs(a.elo - b.elo) / 100 + rand() * 3
        const rel = getRel(a, b)
        if (rel < -40) s += 2 // grudge matches happen
        if (rel > 40) s += 1.5 // friendlies too
        if (s > bestScore) { bestScore = s; bIdx = i }
      }
      const b = pool.splice(bIdx, 1)[0]
      matches.push([a, b])
      dip.servedTurns = (dip.servedTurns || 0) + 2
    }

    // Everyone else: concession, other games, or watching.
    const playing = new Set(matches.flat().map((p) => p.id))
    const bystanders = present.filter((p) => !playing.has(p.id))
    const watchers = []
    const socializers = []
    for (const p of bystanders) {
      if (matches.length && chance(0.35 + p.personal.analysis * 0.03)) watchers.push(p)
      else socializers.push(p)
    }

    // Resolve matches with watchers attached.
    matches.forEach(([a, b], mi) => {
      const watcherGroup = watchers.filter((_, wi) => wi % matches.length === mi)
      // Each brings a character to the set: their main, a counterpick vs a bad
      // matchup, or (settled players) an occasional pocket run to keep it sharp.
      let aCharId = pickMatchChar(save, a, b.mainCharId)
      let bCharId = pickMatchChar(save, b, a.mainCharId)
      if (aCharId === a.mainCharId && a.settledMain && (a.pocketPicks || []).length && chance(0.08)) aCharId = choice(a.pocketPicks)
      if (bCharId === b.mainCharId && b.settledMain && (b.pocketPicks || []).length && chance(0.08)) bCharId = choice(b.pocketPicks)
      // Whatever they're currently messing about with gets run in CASUALS —
      // this is the only place an interest accrues the reps and results that
      // could earn it the main slot. Tournaments build their entrants from
      // mainCharId, so a toy never follows anyone into bracket.
      aCharId = interestRun(a, aCharId)
      bCharId = interestRun(b, bCharId)
      const probA = winProbability(save, a, aCharId, b, bCharId)
      const result = resolveMatch(save, a, b, aCharId, bCharId)
      // Losing to something is where most real opinions come from.
      noteMatchOutcome(save, a, bCharId, result.aWins)
      noteMatchOutcome(save, b, aCharId, !result.aWins)
      const charA = save.game.characters.find((c) => c.id === aCharId)
      const charB = save.game.characters.find((c) => c.id === bCharId)
      const grudge = getRel(a, b) < -40 || getRel(b, a) < -40
      const stage = save.game.stages.length ? choice(save.game.stages) : null
      const nar = narrateSet({
        aName: pName(save, a), bName: pName(save, b),
        charA, charB, probA, winnerIsA: result.aWins,
        skillA: a.charSkill[aCharId] || 0, skillB: b.charSkill[bCharId] || 0,
        statsA: a.personal, statsB: b.personal,
        winnerPhrase: result.winner.catchphrase,
        seriesNote: seriesNoteFor(a, b, pName(save, a), pName(save, b)),
        grudge,
        watcherCount: watcherGroup.length,
        stageName: stage?.name,
        spice: grudge ? 2 : 1,
        rules: save.game.rules,
        game: save.game,
        seed: randInt(1, 2147483646),
      })
      const narration = nar.lines
      // Post-match social: loser's read on the winner is shaped by winner's sportsmanship.
      const loser = result.loser
      const winner = result.winner
      dip.results[winner.id] = 'won'
      dip.results[loser.id] = 'lost'
      dip.gamesToday[a.id] = (dip.gamesToday[a.id] || 0) + 1
      dip.gamesToday[b.id] = (dip.gamesToday[b.id] || 0) + 1
      // What they actually brought, not what they main — the difference is the
      // whole subject of a pocket-pick conversation.
      dip.charToday[a.id] = aCharId
      dip.charToday[b.id] = bCharId
      // Shock results become part of both players' personal legends.
      if (upsetSeverityOf(probA, result.aWins) === 'severe' && chance(0.5)) {
        remember(save, winner, 'upset', `the upset win over ${pName(save, loser)}`, { subjectIds: [loser.id] })
        remember(save, loser, 'upset', `that loss to ${pName(save, winner)}`, { subjectIds: [winner.id] })
        witnessed(save, watcherGroup, 'upset',
          `${pName(save, winner)} taking that one off ${pName(save, loser)}`,
          { subjectIds: [winner.id, loser.id], exclude: [winner.id, loser.id] })
      }
      // A frustrating, unbalanced meta makes every loss feel unfair — bad
      // blood spreads, and a healthy rivalry can curdle into real toxicity.
      // Keeping the game balanced (patch morale up) is how the owner keeps the
      // competition productive instead of poisonous.
      const frustration = save.settings.mode !== 'sandbox' ? clamp(-(save.patchMorale || 0) * 0.26, 0, 2.2) : 0
      const d = socialDelta(loser, winner, { justLostTo: true }) - frustration
      shiftRel(loser, winner, d)
      shiftRel(winner, loser, socialDelta(winner, loser) * 0.6)

      // Watchers learn by analysis, and can pick up tech by observation.
      for (const w of watcherGroup) {
        gainSkill(save, w, w.mainCharId, 0.02 + w.personal.analysis * 0.045)
        maybeLearnInnovation(save, w, winner, events, true)
        shiftRel(w, winner, 0.5)
        applySocialMood(w, 0.5)
      }

      // Railbirds talk during the match — reacting to the actual moments.
      const chatter = []
      for (const w of watcherGroup.slice(0, 2)) {
        if (!chance(0.5)) continue
        const spots = nar.meta
          .map((m2, i) => ({ m: m2, i }))
          .filter((x) => ((x.m.kind === 'game' || x.m.kind === 'beat') && x.m.move) || x.m.kind === 'struggle')
        if (!spots.length) continue
        const spot = choice(spots)
        const line = speak(w, spot.m.kind === 'struggle' ? 'watcherWince' : 'watcherHype',
          { t: spot.m.actor, m: spot.m.move, self: pName(save, w) })
        if (line) chatter.push({ at: spot.i, speaker: pName(save, w), text: line })
      }
      chatter.sort((x, y) => x.at - y.at)

      // The set ends; sometimes words are exchanged.
      const postMatch = []
      if (chance(0.55)) {
        const wl = speak(winner, 'ggWin', { t: pName(save, loser), to: loser, self: pName(save, winner), absDay: absDayOf(save.day, save.year) })
        if (wl) postMatch.push({ speaker: pName(save, winner), text: wl })
      }
      if (chance(0.55)) {
        const goodSport = loser.social.sportsmanship >= 4 || (loser.social.sportsmanship >= 2 && loser.mood >= 6)
        const ll = speak(loser, goodSport ? 'ggLossGood' : 'ggLossBad', { t: pName(save, winner), to: winner, self: pName(save, loser), absDay: absDayOf(save.day, save.year) })
        if (ll) postMatch.push({ speaker: pName(save, loser), text: ll })
      }

      // What makes this match look promising as a broadcast — observations,
      // not verdicts. A tagged match can still flop; an untagged one can
      // still deliver. The risk is the game.
      const skillAvg = ((a.charSkill[aCharId] || 0) + (b.charSkill[bCharId] || 0)) / 2
      const fameA = personalityOf(a)
      const fameB = personalityOf(b)
      const series = a.h2h?.[b.id]
      const seriesGames = series ? series.w + series.l : 0
      const streamTags = []
      if (skillAvg >= 50) streamTags.push('a high-level matchup')
      if (grudge) streamTags.push('a heated rivalry')
      else if (seriesGames >= 8) streamTags.push('a long-running series')
      if (Math.abs(probA - 0.5) <= 0.12) streamTags.push('could be razor close')
      if (fameA >= 0.35 && fameB >= 0.35) streamTags.push('two big personalities')
      else if (Math.max(fameA, fameB) >= 0.45) streamTags.push('a crowd favorite on the sticks')
      if (a.wins + a.losses < 15 || b.wins + b.losses < 15) streamTags.push('an unknown quantity')

      events.push({
        type: 'match',
        setupIndex: mi + 1,
        aId: a.id, bId: b.id,
        aName: pName(save, a), bName: pName(save, b),
        charAName: charA?.name || 'Random', charBName: charB?.name || 'Random',
        charAId: charA?.id || null, charBId: charB?.id || null,
        stageName: stage?.name,
        streamTags: shuffle(streamTags).slice(0, 2),
        probA,
        winnerId: winner.id,
        winnerName: pName(save, winner),
        eloDelta: result.eloDelta,
        watcherIds: watcherGroup.map((w) => w.id),
        watcherNames: watcherGroup.map((w) => pName(save, w)),
        narration,
        narrationMeta: nar.meta,
        setScore: nar.score,
        setLoserGames: nar.loserGames,
        narrationHud: nar.hud,
        ftTarget: nar.target,
        narrationSeed: nar.seed,
        chatter,
        postMatch,
      })
    })

    // Socializers gather in small groups at the concession stand / other cabinets.
    const groups = []
    const socPool = shuffle(socializers)
    while (socPool.length >= 2) {
      const size = Math.min(socPool.length, randInt(2, 4))
      groups.push(socPool.splice(0, size))
    }
    for (const g of groups) {
      const where = chance(0.5) && save.arcade.otherGames.length
        ? `playing ${choice(save.arcade.otherGames)}`
        : 'at the concession stand'
      runInteraction(save, g, where, events, dip.results)
      // Side cabinets have their own stakes: high-score battles.
      if (where.startsWith('playing') && g.length >= 2 && chance(0.3)) {
        const game = where.replace('playing ', '')
        const [x, y] = shuffle(g)
        const winner = chance(0.5 + (x.otherGames.includes(game) ? 0.2 : 0) - (y.otherGames.includes(game) ? 0.2 : 0)) ? x : y
        const runnerUp = winner === x ? y : x
        winner.mood = clamp(winner.mood + 0.4, 0, 10)
        winner.respect += 0.3
        runnerUp.mood = clamp(runnerUp.mood + 0.1, 0, 10) // still fun
        events.push({
          type: 'minigame',
          text: `${pName(save, winner)} sets a new high score on ${game} — ${pName(save, runnerUp)} demands one more credit.`,
        })
      }
    }
    if (socPool.length === 1) {
      events.push({
        type: 'idle',
        text: `${pName(save, socPool[0])} nurses a drink alone at the concession stand.`,
      })
    }
  }

  dip.hours.push({
    label: HOUR_LABELS[hourIdx],
    presentIds: present.map((p) => p.id),
    presentNames: present.map((p) => pName(save, p)),
    streamedSetup: null, // setupIndex the user chose to stream this hour
    events,
  })
  save.hour = hourIdx + 1
}

/**
 * Closes up for the night: end-of-day checks, the daily recap, calendar tick.
 */
/**
 * End a run down a named funnel. Every ending records WHICH pressure killed it,
 * because that's the whole lesson: the books, the room, or the world.
 */
export function endRun(save, funnel, title, text) {
  if (save.gameOver) return
  save.gameOver = { funnel, title, text, day: save.day, year: save.year }
  if (funnel === 'dynamics') save.rosterCollapsed = true // legacy mirror
  chronicle(save, funnel === 'economy' ? '🔒' : funnel === 'dynamics' ? '🏁' : '🪦', text)
}

/**
 * The two funnels that aren't the bank.
 *
 * MID GAME — arcade dynamics. A scene is people, and people leave: burnt out,
 * driven off by bad blood, or just never given a reason to come back. Once the
 * room is empty night after night there's nothing left to run. This is the
 * failure the toxicity/passion/venue systems all drain into.
 *
 * LATE GAME — community opinion. You can keep a clean, solvent, friendly arcade
 * and still lose, because the world outside moved on to something else. Letting
 * the game go stale is a decision, and this is its bill.
 */
export function checkSceneCollapse(save, attendanceToday, events = null) {
  if (save.gameOver || save.settings.mode === 'sandbox') return
  const diff = difficultyOf(save)

  // The cast the user actually built. Filler doesn't count — a floor of
  // strangers isn't a scene, and losing your last real player IS the ending.
  const tracked = Object.values(save.players).filter((p) => !p.npc)
  if (tracked.length > 0 && !tracked.some((p) => !p.retired && !p.banished)) {
    endRun(save, 'dynamics', 'The scene has run its course',
      `Every player you brought into ${save.arcade.name} has hung it up. The cabinets still hum, but the people who made this place are gone.`)
    return
  }

  // A room that's stopped filling. Only counts once the arcade HAD a crowd —
  // a quiet opening month is an economy problem, not a dead scene.
  save.peakAttendance = Math.max(save.peakAttendance || 0, attendanceToday)
  const established = (save.peakAttendance || 0) >= 8
  // Dying is relative: a room that used to pull twenty and now pulls four has
  // died, even though four isn't zero. Measuring against the crowd the arcade
  // once drew is what makes the decline legible instead of a cliff at empty.
  const quiet = established && attendanceToday <= Math.max(2, Math.round(save.peakAttendance * 0.22))
  save.quietDays = quiet ? (save.quietDays || 0) + 1 : 0
  // Say something on the way down. This funnel used to fire with no warning
  // whatsoever — the room emptied for weeks and the first word about it was
  // the modal ending the run.
  if (events) {
    const half = Math.round(diff.collapseGrace * 0.5)
    const late = Math.round(diff.collapseGrace * 0.8)
    if (save.quietDays === half) {
      events.push({ type: 'economy', text: `🪑 ${save.quietDays} quiet nights in a row now. The regulars have started asking where everybody went.` })
    } else if (save.quietDays === late) {
      events.push({ type: 'economy', text: `🚪 Another dead night. People are saying this place is finished — ${diff.collapseGrace - save.quietDays} more like this and they'll be right.` })
    }
  }
  if (save.quietDays >= diff.collapseGrace) {
    // WHY the room emptied decides whether this is an ending or a chapter.
    // A quiet floor while the game is still relevant is a room you mismanaged
    // — that stays a death. A quiet floor while the game itself is in the
    // basement is the same Act 3 story the fade funnel tells, arriving
    // through a different door: relevance collapses, attendance follows it
    // down, and the room empties before the fade counter has finished
    // counting. Measured, that race is why competent runs kept dying to
    // 'dynamics' with a full cast and nothing they could have done.
    if ((save.relevance ?? 55) <= 25 && canBeginNewEra(save)) {
      beginNewEra(save)
      save.quietDays = 0
      return
    }
    endRun(save, 'dynamics', 'The scene has run its course',
      `${save.arcade.name} has sat all but empty for ${save.quietDays} days straight. Word gets around that nobody goes there anymore, and that's the kind of thing a scene doesn't come back from.`)
    return
  }

  // Nobody outside is watching any more. Relevance is the slow one — it takes
  // sustained neglect, which is exactly why it's the ending that catches the
  // owner who set everything up perfectly and then stopped playing.
  const forgotten = (save.relevance ?? 55) <= 12 && communityGameOpinion(save) < 5.6
  save.fadedDays = forgotten ? (save.fadedDays || 0) + 1 : 0
  if (events) {
    const half = Math.round(diff.fadeGrace * 0.5)
    const late = Math.round(diff.fadeGrace * 0.8)
    if (save.fadedDays === half) {
      events.push({ type: 'economy', text: `📉 ${save.game.name} hasn't been mentioned anywhere in ${save.fadedDays} days. The channel is quiet and nobody new is turning up.` })
    } else if (save.fadedDays === late) {
      events.push({ type: 'economy', text: `🪦 Still nothing. ${diff.fadeGrace - save.fadedDays} more days out of the conversation and the game is done for good.` })
    }
  }
  if (save.fadedDays >= diff.fadeGrace) {
    // ACT 3, AND THE ONE DOOR OUT OF IT (REVISION §0, P5). The world losing
    // interest in the game is not negotiable — nothing in this file softens
    // that slope. What a famous name buys is a SEQUEL: the game ends, the
    // arcade doesn't, and everyone starts again with your room already known.
    // A scene that never achieved anything gets no such offer and dies here,
    // because Act 1 failure has to stay real for the early game to mean
    // anything. See era.js for the full argument.
    if (canBeginNewEra(save)) {
      beginNewEra(save)
      return
    }
    endRun(save, 'opinion', 'The world moved on',
      `${save.game.name} has been out of the conversation for ${save.fadedDays} days. No new blood, no coverage, no reason for anyone to care — the scene didn't blow up, it just faded out.`)
  }
}

export function endDay(save) {
  bindRng(save)
  const dip = save.dayInProgress
  if (!dip) return
  const events = []
  const attendees = dip.attendeeIds.map((id) => save.players[id]).filter(Boolean)

  // THE STREAMING LEVER AS AFFECT (REVISION §0): whoever was on the screen
  // tonight sets the room's temperature. A radiant winner lifts the place; a
  // tilted star on blast sours it. Weighted by how many were actually
  // watching — an empty channel infects nobody. (The other half of the lever
  // — whose example the room LEARNS from — runs through eureka's company
  // channel, amplified for the recently streamed.)
  {
    let streamed = null, viewers = 0
    for (const hour of dip.hours || []) {
      if (hour.streamedSetup == null) continue
      const ev = (hour.events || []).find((e) => e.type === 'match' && e.setupIndex === hour.streamedSetup)
      if (ev?.stream && ev.stream.viewers >= viewers) { streamed = ev; viewers = ev.stream.viewers }
    }
    if (streamed) {
      const a = save.players[streamed.aId]
      const b = save.players[streamed.bId]
      const screenMood = ((a?.mood ?? 5) + (b?.mood ?? 5)) / 2
      const reach = clamp(viewers / 250, 0, 1)
      const drift = clamp((screenMood - 5) * 0.06, -0.3, 0.3) * reach
      if (drift !== 0) {
        for (const p of attendees) {
          if (p.id === streamed.aId || p.id === streamed.bId) continue
          p.mood = clamp(p.mood + drift, 0, 10)
        }
      }
    }
  }

  // Opinions meet reality — very gently. A take the game disagrees with loses
  // a sliver a day and nothing more, so somebody who decided a character was
  // broken is still saying it long after the patch that fixed it.
  const powerOf = (charId) => {
    const others = save.game.characters.filter((c) => c.id !== charId)
    if (!others.length) return null
    return others.reduce((sum, o) => sum + getMatchup(save.game, charId, o.id), 0) / others.length
  }
  for (const p of Object.values(save.players)) reconcileTakes(save, p, powerOf)

  // How pleasant the venue itself is today — a clean floor and happy staff
  // are part of why people enjoy being here (or don't). Nudges every
  // attendee's mood, so a well-run arcade keeps its regulars in good spirits.
  const venueVibe = (((save.arcade.cleanliness ?? 80) - 65) / 100 + ((save.staffing?.morale ?? 70) - 60) / 160) * 0.35

  // Once-per-day per attendee checks.
  for (const p of attendees) {
    if (venueVibe) p.mood = clamp(p.mood + venueVibe, 0, 10)
    // A player with a rival hits the lab harder — chasing (or holding) the edge
    // is what turns a comfortable regular into a real competitor. A scene of
    // only friends never gets this push and quietly plateaus.
    if (p.mainCharId && rivalOf(save, p)) {
      gainSkill(save, p, p.mainCharId, 0.07 + p.personal.determination * 0.012)
    }
    maybeInnovate(save, p, events)
    if (p.settledMain) {
      maybeSwitchMain(save, p, events)
      maybePocketPickup(save, p)
      resolveInterest(save, p, events) // graduate or drop before taking a new one
      maybeTakeInterest(save, p, events)
      // The other direction from all that character-hopping: the person who
      // stayed put and went deep writes the book on it.
      const g = maybeWriteGuide(save, p, events, chance)
      if (g) {
        events.push({ type: 'guide',
          text: `${pName(save, p)} has written a ${g.charName} guide — the room's first real document on the character.` })
        pushToast(save, { icon: '📖', text: `${pName(save, p)} wrote the room's ${g.charName} guide.`, see: { screen: 'codex' } })
      }
    } else maybeSettleMain(save, p, events)
    checkFallingOut(save, p, events)
  }
  resolveGuides(save, events, chance, (pl) => pName(save, pl))
  dailyTeamDynamics(save, events)
  maybeScheduleMoneyMatch(save, events)

  // Careers: passion drifts for every active regular (attendees get the day's
  // refreshers), then anyone truly burnt out may retire. This is the slow
  // engine of the late game — the veterans you built up start moving on.
  const attendeeIdSet = new Set(dip.attendeeIds)
  const staleDays = daysSincePatch(save)
  for (const p of Object.values(save.players)) {
    if (p.retired || p.banished || !p.isRegular) continue
    passionDaily(save, p, {
      attendedToday: attendeeIdSet.has(p.id),
      wonToday: dip.results?.[p.id] === 'won',
      staleDays,
    })
    // The eureka spine's daily pass (REVISION §1): character demands, the
    // weekly company/plateau/rupture sweep, the community meter, and the
    // meter check that arms a breakthrough. Runs BEFORE the retirement check
    // on purpose — a breakthrough today can be the thing that keeps them.
    processEurekaDaily(save, p, { attendedToday: attendeeIdSet.has(p.id) })
    checkRetirement(save, p, events)
  }

  // Crowding: what share of would-be players got turned away from a cab today.
  // Rolls slowly so one packed Saturday isn't a crisis but a packed MONTH is —
  // and the fix (more setups) is exactly the expansion decision.
  {
    const demand = dip.demandTurns || 0
    const served = dip.servedTurns || 0
    const turnedAway = demand > 0 ? Math.max(0, demand - served) / demand : 0
    save.arcade.crowding = (save.arcade.crowding ?? 0) * 0.75 + turnedAway * 0.25
  }

  checkSceneCollapse(save, attendees.length, events)

  // The books: tokens and food the players actually bought, then payroll and
  // cleaning (daily). Weekly upkeep and monthly rent are settled from a ledger
  // in advanceDay (so a tournament landing on the due day can't skip them) —
  // here we just surface any resulting "in the red" note in the recap.
  if (save.economy) {
    const totalGames = Object.values(dip.gamesToday || {}).reduce((s, n) => s + n, 0) / 2
    playerSpending(save, attendees, dip.gamesToday || {}, events)
    staffDaily(save, attendees.length, totalGames, events)
    settleRecurring(save, events)
    landlordDaily(save, events)
    // How many came through the door today — read by the Manage-tab foot-traffic
    // count. advanceDay folds it into the daily economy history and clears it.
    save.economy.todayAttendance = attendees.length
    // (A staffer used to occasionally "quit the counter to become a player" —
    // retired now, since the cast is finite and never grows past the seed.)
  }

  // Active mentorships pay out when both parties attended.
  const attendeeIds = new Set(attendees.map((p) => p.id))
  save.mentorships = save.mentorships.filter((m) => {
    const mentor = save.players[m.mentorId]
    const student = save.players[m.studentId]
    if (!mentor || !student) return false
    if (getRel(student, mentor) < 0 || getRel(mentor, student) < 0) {
      events.push({ type: 'mentorship', text: `The mentorship between ${pName(save, mentor)} and ${pName(save, student)} fizzled out.` })
      return false
    }
    if (attendeeIds.has(mentor.id) && attendeeIds.has(student.id)) {
      const g = gainSkill(save, student, student.mainCharId, 0.15 + mentor.social.community * 0.05)
      if (g > 0 && chance(0.25)) {
        events.push({ type: 'mentorship', text: `${pName(save, mentor)} ran drills with ${pName(save, student)}. (+${g.toFixed(1)} skill)` })
      }
      shiftRel(student, mentor, 0.8)
      mentor.respect += 0.3
      // Students graduate once they close the gap.
      if (student.elo > mentor.elo - 40) {
        events.push({ type: 'mentorship', text: `${pName(save, student)} has surpassed their mentor ${pName(save, mentor)} — the mentorship ends with a handshake.` })
        return false
      }
    }
    return true
  })

  // Mood drifts back toward each player's baseline overnight, and channel
  // hype fades a touch without fresh content.
  for (const p of Object.values(save.players)) {
    p.mood = clamp(p.mood + (p.defaultMood - p.mood) * 0.25, 0, 10)
    p.respect = Math.round(p.respect * 10) / 10
    // Fame fades: a public profile slips a little every day it isn't fed by the
    // spotlight, so keeping a star relevant means keeping the camera on them.
    // (Belief doesn't fade — earned stage composure is yours for good.)
    if (p.popularity) p.popularity = Math.max(0, p.popularity * 0.996 - 0.05)
    // Dormant grudges soften with time — bad blood fades toward mere rivalry
    // unless the players keep clashing (an active feud loses to fresh losses).
    // This is what lets a scene HEAL: ease the friction and toxicity recedes.
    for (const id in p.relationships) {
      const v = p.relationships[id]
      if (v < -30) p.relationships[id] = Math.min(v + 0.22, -30)
    }
  }
  // NO RIG, NO CHANNEL — hype or followers.
  //
  // This block used to run unconditionally, and ad spend feeds `adHypePerDay`
  // whether or not you own a camera. So an arcade with no rig quietly climbed
  // past the hype > 8 line and then accrued followers every single night for a
  // channel that does not exist: measured at 129 followers over one year with
  // the rig never bought, and 291 on easy. That contradicted the gate outright
  // and made the 150-follower exhibition requirement reachable without ever
  // buying the thing it is supposed to reward.
  //
  // The store card is the spec here — "Without one there is no channel this
  // run — no followers, no hype" — so both are gated, not just followers.
  // Advertising still pulls people through the door: attendance reads
  // `adAwarenessBoost` separately from hype (see discoveryChance above).
  if (save.stream && canStream(save)) {
    // Audience fatigue recovers overnight — yesterday's overexposure fades, so
    // the follower penalty only bites while you're actively flooding the channel.
    save.stream.fatigue = (save.stream.fatigue || 0) * 0.5
    // Advertising steers public opinion: active channels push channel hype up
    // daily, offsetting (or reversing) the natural fade.
    save.stream.hype = clamp(save.stream.hype - 0.08 + adHypePerDay(save), 0, 100)
    // Word of mouth: a channel with real hype picks up followers organically
    // even on days nothing was streamed. Saturates like stream growth does.
    if (save.stream.hype > 8) {
      const saturation = Math.max(0.05, 1 - save.stream.followers / 20000)
      save.stream.followers += Math.round(save.stream.hype * 0.06 * saturation)
    }
  }

  // Community tier lists drop about a week after each patch (and once the
  // launch build has had a week of games).
  const absDay = (save.year - 1) * DAYS_PER_YEAR + save.day
  const duePending = save.pendingTierList && absDay >= save.pendingTierList.dueAbs
  const launchListDue = !save.tierLists?.length && !save.pendingTierList && daysSincePatch(save) >= 7
  if ((duePending || launchListDue) && save.game.characters.length >= 2) {
    const list = generateTierList(save)
    if (list) {
      if (duePending) list.version = save.pendingTierList.version
      save.tierLists.unshift(list)
      if (save.tierLists.length > 30) save.tierLists.pop()
      save.pendingTierList = null
      const topNames = list.tiers.S
        .map((id) => save.game.characters.find((c) => c.id === id)?.name)
        .filter(Boolean)
      events.push({
        type: 'arrival',
        text: `📊 The community tier list for v${list.version} dropped${topNames.length ? ` — ${topNames.join(' and ')} crowned S tier` : ''}. Arguments immediately.`,
      })
      postTierList(save, list, topNames)
    }
  }

  // The community voices what it wants patched — nerf this, buff that — and the
  // occasional trap demand (a loud complaint about a character who isn't really
  // strong). Reading these is how you decide what to change; caving to the trap
  // is a lose/lose. Fires sparingly so the feed stays varied.
  if (save.settings.mode !== 'sandbox' && chance(0.06)) {
    const demands = communityDemands(save)
    if (demands.length) postCommunityDemand(save, choice(demands.slice(0, 3)))
  }

  // Patch pressure: morale drifts back to neutral, but a fossilized meta
  // curdles it — and the internet starts asking questions.
  save.patchMorale = (save.patchMorale || 0) * 0.92
  if (save.settings.mode !== 'sandbox') {
    const staleDays = daysSincePatch(save)
    if (staleDays > 150) {
      save.patchMorale = Math.max(save.patchMorale - 0.08, -6)
      if (chance(0.05)) postPatchDemand(save, staleDays)
    }
  }

  save.lastDayReport = {
    day: dip.day,
    year: dip.year,
    dateLabel: dip.dateLabel,
    attendeeIds: dip.attendeeIds,
    attendeeNames: attendees.map((p) => pName(save, p)),
    newcomers: dip.newcomers,
    events: [...dip.openingEvents, ...dip.hours.flatMap((h) => h.events), ...events],
  }
  updateFeedFromDay(save, save.lastDayReport.events)
  save.dayInProgress = null
  save.hour = 0
  advanceDay(save)
}

// Whole day at once — used by headless testing and "skip day" convenience.
export function simDay(save) {
  startDay(save)
  while (save.hour < HOURS_PER_DAY) simHour(save)
  endDay(save)
}

// What fires today: 'evo' | {circuit} | schedule entry | null. The circuit is
// the world's calendar — it runs whether your doors are open or shut, and it
// owns its Sundays: a local event scheduled against a circuit date simply
// doesn't run that week. A health-department shutdown likewise cancels your
// local events only — EVO and the circuit are the world's stage, not yours.
export function whatHappensToday(save) {
  if (save.day === EVO_DAY) return 'evo'
  const circuit = circuitEventOn(save.day)
  if (circuit) return { circuit }
  if (arcadeClosed(save)) return null
  const hits = save.arcade.schedule.filter((s) => {
    if (s.done) return false
    if (s.cadence === 'weekly') return weekdayOf(save.day) === (s.weekday || 0)
    if (s.cadence === 'monthly') return dayOfMonthOf(save.day) === (s.dayOfMonth || 1)
    return s.dayOfYear === save.day // yearly (and pre-cadence saves)
  })
  if (!hits.length) return null
  // THE SUNDAY COLLISION, fixed: every 1st is a Sunday (day 1 is a Sunday and
  // 28-day months keep the week aligned), so a Sunday weekly and a 1st-of-the-
  // month monthly used to race on array order and one of them silently never
  // ran. Overlaps now resolve by rarity — the big event wins the date — and
  // deterministically, so the loser is at least the same loser every time.
  const rarity = { yearly: 3, monthly: 2, weekly: 1 }
  return hits.sort((a, b) => (rarity[b.cadence] ?? 3) - (rarity[a.cadence] ?? 3))[0]
}

export function advanceDay(save) {
  bindRng(save)
  // Settle recurring bills AND drift national relevance for the day now
  // closing — BEFORE the calendar ticks. This is the one path every day flows
  // through (normal, tournament, EVO, idle catch-up), so neither can be skipped
  // by a tournament day. Both are guarded against running twice in a day.
  settleRecurring(save)
  relevanceDaily(save)
  noteEraRelevance(save) // this era's own high-water mark — it buys its own sequel
  maybeWorldEvent(save)
  pruneToasts(save)
  // The road: away events rise, your people ask, trips resolve (travel.js).
  travelDaily(save)
  // A monthly line of world texture — an interview quote, a tweet, a guide
  // sentence — attached to a ranked name. The fragment layer's idle drip.
  if (dayOfMonthOf(save.day) === 14) fragmentsMonthly(save)
  // THE MYTHOLOGY BANNERS (REVISION §6): the world's summit changing hands is
  // a moment whatever screen you're on. Checked on the universal tick so a
  // coup during EVO week still lands.
  {
    const top = worldRankings(save)[0]
    if (top && top.id !== save.lastWorldNo1) {
      if (save.lastWorldNo1 != null) {
        pushToast(save, {
          icon: '🌍',
          text: top.yours
            ? `${top.name} is the best player in the world. Yours. From this arcade.`
            : `There's a new best player in the world: ${top.name}.`,
          see: { screen: 'world' },
        })
      }
      save.lastWorldNo1 = top.id
    }
  }
  // Daily economic snapshot for the Manage-tab income graph and foot-traffic
  // count: net cash change and how many people came through the door. Recorded
  // here — the single tick EVERY day flows through (normal, tournament, EVO,
  // idle catch-up) — so no day is ever missed. absDayOf reads the day that's
  // closing, before the calendar ticks below.
  let todayNet = 0
  if (save.economy) {
    const money = Math.round(save.economy.money * 100) / 100
    const prev = save.economy.lastDayMoney ?? money
    todayNet = Math.round((money - prev) * 100) / 100
    save.economy.history ??= []
    save.economy.history.push({
      absDay: absDayOf(save.day, save.year),
      money,
      net: todayNet,
      attendance: save.economy.todayAttendance ?? null, // null on tournament/EVO days
    })
    if (save.economy.history.length > 180) save.economy.history.shift()
    save.economy.lastDayMoney = money
    save.economy.todayAttendance = null
  }
  // Achievement counters. Read off the day that just closed, because most of
  // what the ladder asks is "did you do it the whole way through" — a claim no
  // snapshot of the current state can answer. Observed here rather than at the
  // call sites so idle catch-up days count exactly like played ones.
  if (save.tally) {
    if ((save.arcade?.ads || []).length) save.tally.usedAds = true
    bumpPeak(save, 'peakToxicity', save.scene?.toxicity || 0)
    bumpPeak(save, 'peakHype', save.stream?.hype || 0)
    bumpPeak(save, 'peakRelevance', save.relevance || 0)
    // Three streaks, all reset by a single bad day, because that is what makes
    // them worth anything. "Alone and in the black" isn't a good Tuesday with
    // nobody on the payroll — it's every day for half a year.
    const staff = staffCounts(save)
    save.tally.soloBlackDays = staff.employees + staff.managers === 0 && todayNet > 0
      ? (save.tally.soloBlackDays || 0) + 1
      : 0
    save.tally.blackStreak = todayNet >= 0 && (save.economy?.money ?? 0) >= 0
      ? (save.tally.blackStreak || 0) + 1
      : 0
    save.tally.fullFloorDays = (save.arcade?.otherGames || []).length >= 4
      ? (save.tally.fullFloorDays || 0) + 1
      : 0
  }
  // The world keeps talking whether or not it has heard of you.
  worldFeedDaily(save)
  // The world's own results, and the shocks that make the feed.
  for (const upset of worldMatchesDaily(save)) {
    if (chance(0.5)) postWorldUpset(save, upset)
  }
  // A fresh patch re-shuffles who the pros play — the meta-chasers first.
  if (daysSincePatch(save) === 0) gravitateElites(save)
  // Bad blood recruits: an unattended feud becomes a faction (social.js).
  spreadFeuds(save)
  // NAME THE SOURCE. The one nuclear option only works if you can tell WHO to
  // use it on, and after a feud spreads the person with the most enemies is
  // the target rather than the author. Once the room is genuinely poisoned,
  // the counter tells you who keeps starting it — once, so it reads as the
  // room finally saying out loud what everyone already knew.
  {
    const tox = save.scene?.toxicity ?? 0
    if (tox >= 0.3 && !save.feudSourceNamed) {
      const src = feudSource(save)
      if (src) {
        save.feudSourceNamed = src.player.id
        pushToast(save, {
          icon: '🔥',
          text: `It keeps coming back to ${pName(save, src.player)}. They've talked ${src.seeded} different people into somebody else's fight.`,
          see: { screen: 'players', params: { playerId: src.player.id } },
          sticky: true,
          key: 'feud_source',
        })
      }
    }
    if (tox < 0.15) save.feudSourceNamed = null // the room settled; re-arm
  }
  // A visiting crew arrives, or goes home.
  invasionDaily(save)
  // SUCCESSION (P5): the rare kid who could be somebody walks in, the one
  // nobody took on drifts away, and once a year the room is told out loud
  // that it has nobody coming up behind it.
  maybeProdigyArrives(save)
  prodigiesDrift(save)
  successionWarning(save)
  // Legacy milestones: making it matters, growing matters — existing doesn't.
  if (save.settings.mode !== 'sandbox') {
    if ((save.stream?.followers || 0) >= 1000) awardMilestone(save, 'followers-1k', 2, 'A thousand people follow the channel now')
    if ((save.economy?.money ?? 0) >= 3000) awardMilestone(save, 'bank-3k', 2, 'Three grand in the register — the arcade is a real business')

    // The bootstrap rungs went to the deprecation lane with prestige-as-power
    // (docs/DEPRECATED.md): they existed to fund a stronger cast on the hard
    // tiers, and banked points no longer buy stats.
    // Permanent unlocks. Milestones above pay the RUN's pot and bank at reset;
    // these are lineage facts and land the moment they are proved. Announced
    // through the chronicle, like every other legacy award — advanceDay is the
    // universal tick and has no day report to write into (tournament, EVO and
    // idle catch-up days all come through here too).
    checkAchievements(save)
  }
  // The September cliff, said out loud once a year. Everyone goes back at the
  // same time, so this is a thing that HAPPENS rather than a slope you notice
  // three weeks late in a graph.
  const season = seasonOf(save.day)
  if (save.seasonFlagged !== `${season.key}:${save.year}`) {
    save.seasonFlagged = `${season.key}:${save.year}`
    // Chronicle only: advanceDay is the universal tick and has no day report
    // to write into (tournament, EVO and idle catch-up days come through here).
    if (season.key === 'backtoschool') {
      chronicle(save, '🎒', `School went back. ${save.arcade.name} is going to feel empty for a while.`)
    } else if (season.key === 'summer' && runAge(save) > 30) {
      chronicle(save, '☀️', `School is out. ${save.arcade.name} is about to get busy.`)
    }
  }
  save.day += 1
  if (save.day > DAYS_PER_YEAR) {
    save.day = 1
    save.year += 1
    driftEvoRoster(save)
    driftRegionalField(save) // the national board regresses and churns too
    // EVERYBODY HAS A BIRTHDAY (P5). The one tick a year where the clock that
    // nobody can top back up moves — and the succession problem gets one year
    // closer whether or not the owner has been thinking about it.
    {
      const declined = ageYearly(save)
      for (const p of ageWarnings(save)) {
        const stage = careerStageOf(p)
        pushToast(save, {
          icon: '⏳',
          text: `${pName(save, p)} is ${stage.label} now. ${stage.blurb}`,
          see: { screen: 'players', params: { playerId: p.id } },
        })
      }
      if (declined.length >= 2) {
        chronicle(save, '⏳', `The core of ${save.arcade.name} is getting older. ${declined.slice(0, 2).map((p) => pName(save, p)).join(' and ')}${declined.length > 2 ? ' and others' : ''} aren't quite what they were, and everybody can see it.`)
      }
    }
    if (save.settings.mode !== 'sandbox' && save.year >= 2 && save.year <= 6) {
      awardMilestone(save, `year-${save.year}`, save.year, `${save.arcade.name} made it to Year ${save.year}`)
    }
    // The climb up the world list is the clearest "somewhere new" a lineage can
    // reach, so it is the backbone of the legacy economy: five rungs, each one
    // worth more than the last, and every one of them a headline.
    if (save.settings.mode !== 'sandbox') {
      const ranked = rankedInTop(save, 64)
      if (ranked.length) {
        const top = ranked.reduce((a, r) => (r.rank < a.rank ? r : a))
        const who = top.name || 'somebody here'
        if (top.rank <= 64 && awardMilestone(save, 'world-64', 3, `${who} is ranked in the world top 64`)) {
          pushToast(save, { icon: '🌏', text: `${who} cracked the world top 64. The list has your arcade on it now.`, see: { screen: 'world' } })
        }
        if (top.rank <= 32) awardMilestone(save, 'world-32', 4, `${who} cracked the world top 32`)
        if (top.rank <= 16) awardMilestone(save, 'world-16', 6, `${who} is one of the sixteen best players alive`)
        if (top.rank <= 8) awardMilestone(save, 'world-8', 8, `${who} made the world top 8`)
        if (top.rank === 1) awardMilestone(save, 'world-1', 12, `${who} is the number one ranked player in the world`)
      }
    }
  }
}

export { moodLabel }

// Exported for the calibration harness only — the discovery multiplier is
// worth being able to assert on directly rather than inferring from run noise.
export const __techFrontier = techFrontier
