import { clamp, chance, choice, shuffle, rand, randInt, displayName, hash01, uid } from './util.js'
import { HOURS_PER_DAY, HOUR_LABELS, TOPICS, GOSSIP_TOPICS, DAYS_PER_YEAR, EVO_DAY, formatDay, weekdayOf, dayOfMonthOf, absDayOf, statusOf, difficultyOf } from './constants.js'
import { driftEvoRoster } from './generate.js'
import { newInnovation, remember, chronicle, pushVod } from './model.js'
import { daysSincePatch, releasePatch, communityDemands } from './patch.js'
import { postPatchDemand, postPatchCountdown } from './socialmedia.js'
import { resolveMatch, winProbability, gainSkill, seriesNoteFor, upsetSeverityOf, pickMatchChar } from './match.js'
import { narrateSet } from './fight.js'
import { buildStream, personalityOf, applyStageReps } from './stream.js'
import {
  staffDaily, playerSpending, settleRecurring,
  landlordDaily, tokenDeterrence, arcadeClosed, isStaffed,
  adAwarenessBoost, adHypePerDay, playerStaffAppeal,
} from './economy.js'
import { updateFeedFromDay, postMoneyMatchAnnouncement, postTierList, postCommunityDemand } from './socialmedia.js'
import { speak } from './dialogue.js'
import { generateTierList } from './balance.js'
import {
  getRel, shiftRel, socialDelta, applySocialMood, moodLabel,
  tryFoundTeam, tryJoinTeam, checkFallingOut, teamOf, dailyTeamDynamics,
  sceneHealth, rivalOf,
} from './social.js'
import { passionDaily, checkRetirement, passionAttendanceFactor, bumpPassion } from './career.js'
import { areSeparated, pruneSeparations } from './discipline.js'
import { relevanceDaily } from './relevance.js'
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

function charAppeal(save, player, char) {
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
  // Nothing sells a character like winning with them.
  const rec = player.charRecord?.[char.id]
  if (rec && rec.w + rec.l >= 8) {
    score += (rec.w / (rec.w + rec.l) - 0.5) * 14
  }
  return score + rand() * 3
}

export function pickMainChar(save, player) {
  const chars = save.game.characters
  if (!chars.length) return null
  let best = null
  let bestScore = -Infinity
  for (const c of chars) {
    const s = charAppeal(save, player, c)
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
  return Math.round(8 + (10 - player.personal.loyalty) * 2.2)
}

// Today's lab character: mostly something untried, sometimes a second look
// at one that's been working.
function pickExplorationChar(save, player) {
  const chars = save.game.characters
  if (!chars.length) return null
  const untried = chars.filter((c) => !player.exploredChars.includes(c.id))
  const pool = untried.length && chance(0.7) ? untried : chars
  let best = null
  let bestScore = -Infinity
  for (const c of pool) {
    let s = charAppeal(save, player, c)
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
  let best = null
  let bestScore = -Infinity
  for (const c of candidates) {
    const s = charAppeal(save, player, c) + (player.charSkill[c.id] || 0) * 0.2
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
  if (!chance(0.0008 * (player.personal.learning + player.personal.innovation))) return
  const options = save.game.characters.filter(
    (ch) => ch.id !== player.mainCharId && !(player.pocketPicks || []).includes(ch.id))
  if (!options.length) return
  player.pocketPicks = [...(player.pocketPicks || []), choice(options).id]
}

function maybeSwitchMain(save, player, events) {
  if (player.lockedMain || !player.mainCharId) return
  // Frustrated, disloyal players shop around. Winning keeps them anchored.
  const rec = player.charRecord?.[player.mainCharId]
  const winning = rec && rec.w + rec.l >= 8 && rec.w > rec.l
  const frustration = (player.mood < 4 ? 1.6 : 1) * (winning ? 0.4 : 1)
  if (!chance((10 - player.personal.loyalty) * 0.004 * frustration)) return
  const alt = pickMainChar(save, player)
  if (alt && alt !== player.mainCharId) {
    const oldChar = save.game.characters.find((c) => c.id === player.mainCharId)
    const newChar = save.game.characters.find((c) => c.id === alt)
    player.mainCharId = alt
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
  let p = 0.08 + player.personal.spark * 0.038 + (player.mood - 5) * 0.02
  p += Math.min(0.12, player.daysAttended * 0.0015) // dedication compounds
  const wd = weekdayOf(save.day)
  p += wd === 0 || wd === 6 ? 0.16 : -0.02
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
  // A grimy floor and miserable staff make the whole place unpleasant to be
  // in — a real drag on turnout. A spotless, well-run room is a genuine draw.
  // (This is what makes staffing pay off once you're busy enough to need it.)
  p *= clamp(0.68 + (save.arcade.cleanliness ?? 80) / 250, 0.68, 1.1)
  p *= clamp(0.86 + (save.staffing?.morale ?? 70) / 500, 0.86, 1.08)
  // A familiar face behind the counter is its own draw — regulars turn up to
  // hang out where their friend (or the local star) works. This is the payoff
  // for staffing a PLAYER instead of an anonymous outside hire.
  p += playerStaffAppeal(save) * 0.015
  // A brand-new arcade nobody's heard of is hard to DISCOVER: first-timers
  // barely trickle in until word spreads. Once someone's a regular, they come
  // regardless — so those early discoverers are what seeds the whole scene.
  if (!player.isRegular) p *= 0.55 * awarenessFactor(save)
  // A hard-difficulty arcade is a struggling unknown — thinner crowds.
  p *= 0.45 + 0.55 * popularityFactor(save)
  // Passion: a player losing the fire for the game turns up less and less.
  p *= passionAttendanceFactor(player)
  // Relevance: a game the world has moved on from empties the room over time.
  p *= clamp(0.65 + (save.relevance ?? 55) / 100 * 0.45, 0.65, 1.05)
  // Toxicity: a scene full of bad blood empties a room. A great venue (clean,
  // well-staffed) softens it, but only so much — left unchecked, toxicity drives
  // attendance into the floor, and with a finite cast that never refills, that's
  // a death spiral: fewer people → the bad blood among who's left dominates →
  // fewer still → the scene collapses and you lose. Warn/separate/ban is the way out.
  const tox = save.scene?.toxicity || 0
  if (tox > 0) {
    const comfort = clamp((((save.arcade.cleanliness ?? 80) + (save.staffing?.morale ?? 70)) / 200), 0, 1)
    p *= clamp(1 - tox * 0.85 * (1 - comfort * 0.35), 0.22, 1)
  }
  return clamp(p, 0.02, 0.9)
}

// 0.3..1 — how well-known the arcade is. Low on opening day, climbs with days
// open, followers, and channel hype. Gates discovery (first-timers and new
// generated faces), not the loyalty of existing regulars. Resets on a fresh
// run (day and followers both reset).
function awarenessFactor(save) {
  const daysOpen = absDayOf(save.day, save.year) - 1
  const followers = save.stream?.followers || 0
  const hype = save.stream?.hype || 0
  // Advertising is the deliberate lever here — the main way to fill the room
  // early, before there's a scene or a following to speak of.
  return clamp(0.3 + daysOpen / 30 + followers / 1000 + hype / 100 + adAwarenessBoost(save), 0.3, 1)
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

function maybeInnovate(save, player, events) {
  const skill = player.charSkill[player.mainCharId] || 0
  // Rarer as the pool of discovered tech for that character grows — the
  // low-hanging fruit gets picked first.
  const existing = save.innovations.filter((i) => i.charId === (player.mainCharId || null)).length
  const p = (player.personal.innovation * 0.0008 * (skill > 55 ? 1.5 : 1)) / (1 + existing * 0.2)
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
function makeBeats(save, group, where, results) {
  const beats = []
  // Speech beats carry a speaker and render as actual dialogue.
  const say = (p, kind, ctx = {}, note = null) => {
    const text = speak(p, kind, { self: pName(save, p), ...ctx })
    if (text) beats.push({ speaker: pName(save, p), text, note })
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
    say(joker, 'joke', { t: pName(save, target) })
    if (chance(landChance)) {
      const dm = 0.2 + target.social.sensitivity * 0.06
      target.mood = clamp(target.mood + dm, 0, 10)
      shiftRel(target, joker, 1.5)
      say(target, 'jokeLanded', { t: pName(save, joker) }, `(+${dm.toFixed(1)} mood)`)
    } else {
      const dm = 0.3 + target.social.sensitivity * 0.12
      target.mood = clamp(target.mood - dm, 0, 10)
      shiftRel(target, joker, -2.5)
      say(target, 'jokeBombed', { t: pName(save, joker) }, `(−${dm.toFixed(1)} mood)`)
    }
  }

  const kind = group.find((p) => p.social.politeness >= 7)
  if (kind && group.length >= 2 && chance(0.3)) {
    const target = choice(group.filter((p) => p !== kind))
    const dm = 0.15 + target.social.sensitivity * 0.05
    target.mood = clamp(target.mood + dm, 0, 10)
    shiftRel(target, kind, 1.2)
    const char = save.game.characters.find((c) => c.id === target.mainCharId)
    say(kind, 'compliment', { t: pName(save, target), c: char?.name }, `(+${dm.toFixed(1)} mood for ${pName(save, target)})`)
  }

  const loudmouth = group.find((p) => p.social.politeness <= 3 && p.personal.dominance >= 6)
  if (loudmouth && group.length >= 2 && chance(0.3)) {
    const target = choice(group.filter((p) => p !== loudmouth))
    shiftRel(target, loudmouth, -1.5)
    say(loudmouth, 'trashTalk', { t: pName(save, target) }, `(${pName(save, target)} files it away for later)`)
  }

  // Hygiene. Nobody says anything. Everybody notices.
  const ripe = group.find((p) => (p.social.hygiene ?? 5) <= 2)
  if (ripe && group.length >= 2 && chance(0.25)) {
    beats.push(choice([
      `${pName(save, ripe)} joins the circle. The circle widens slightly.`,
      `Someone cracks the door for "air flow" shortly after ${pName(save, ripe)} sits down.`,
      `${pName(save, ripe)} is here. The concession stand's nacho smell is losing the battle.`,
    ]))
  }

  // Old war stories: defining moments get retold. Forever. Aloud.
  const storyteller = group.find((p) => (p.memories || []).length > 0)
  if (storyteller && group.length >= 2 && chance(0.15)) {
    const mem = choice(storyteller.memories)
    say(storyteller, 'memoryRetell', { mem: mem.text })
  }

  // At the counter, the game falls away for a beat — someone says something
  // human. This is what makes the cast feel like people, not stat blocks.
  if (where === 'at the concession stand' && chance(0.5)) {
    const talker = choice(group)
    const other = group.find((p) => p !== talker)
    const line = speak(talker, 'lifeChat', { self: pName(save, talker), t: other ? pName(save, other) : 'someone' })
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
    seed: randInt(1, 2147483646),
  })
  // The stare-down before the sticks are even plugged in.
  const preMatch = []
  for (const p of [a, b]) {
    const opp = p === a ? b : a
    const line = speak(p, 'mmPre', { t: pName(save, opp), self: pName(save, p) })
    if (line) preMatch.push({ speaker: pName(save, p), text: line })
  }
  // And the words after — a money match always ends with words.
  const postMatch = []
  const wl = speak(winner, 'ggWin', { t: pName(save, loser), self: pName(save, winner) })
  if (wl) postMatch.push({ speaker: pName(save, winner), text: wl })
  const goodSport = loser.social.sportsmanship >= 6
  const ll = speak(loser, goodSport ? 'ggLossGood' : 'ggLossBad', { t: pName(save, winner), self: pName(save, loser) })
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
  applyStageReps(save, [a, b], ev.stream, 'moneymatch')
  // Stakes: pride, glory, and the story everyone will tell.
  winner.respect += 6
  winner.glory += 3
  winner.mood = clamp(winner.mood + 1.5, 0, 10)
  loser.mood = clamp(loser.mood - 1.5, 0, 10)
  bumpPassion(winner, 8) // a marquee win reminds you why you play
  bumpPassion(loser, 2) // even losing one this big is a story worth staying for
  remember(save, winner, 'moneymatch', `winning the money match against ${pName(save, loser)}`)
  remember(save, loser, 'moneymatch', `losing the money match to ${pName(save, winner)}`)
  chronicle(save, '💸', `${pName(save, winner)} beat ${pName(save, loser)} ${nar.score} in the money match everyone still talks about`)
  if (chance(0.3)) {
    shiftRel(winner, loser, 12)
    shiftRel(loser, winner, 12)
    events.push({ type: 'moneymatch_announce', text: `🤝 The handshake after says it all — ${ev.aName} and ${ev.bName} settled something today.` })
  } else {
    shiftRel(loser, winner, -4)
  }
  for (const w of watchers) {
    gainSkill(save, w, w.mainCharId, 0.03 + w.personal.analysis * 0.018)
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

function pickTopic(save, where) {
  // Concession-stand talk is about people; floor talk is about games.
  const atConcession = where === 'at the concession stand'
  const pool = atConcession ? GOSSIP_TOPICS : TOPICS
  // An upcoming money match dominates conversation everywhere.
  const mm = scheduledMoneyMatch(save)
  if (mm && chance(0.35)) {
    const a = save.players[mm.aId]
    const b = save.players[mm.bId]
    if (a && b) return `the upcoming ${pName(save, a)} vs ${pName(save, b)} money match`
  }
  // Sometimes the gossip is about an actual person.
  if (atConcession && chance(0.25)) {
    const regulars = Object.values(save.players).filter((p) => p.isRegular)
    if (regulars.length) {
      const top = [...regulars].sort((x, y) => y.elo - x.elo)[0]
      return choice([
        `whether ${pName(save, top)} can actually be beaten`,
        `what ${pName(save, choice(regulars))} said after their last set`,
        `how good ${pName(save, choice(regulars))} is getting lately`,
      ])
    }
  }
  return choice(pool)
}

function runInteraction(save, group, where, events, results = {}) {
  const topic = pickTopic(save, where)
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
      if (areSeparated(save, a.id, b.id)) continue // kept apart — they don't engage
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
      chance(mentor.social.community * 0.02)) {
    save.mentorships.push({ mentorId: mentor.id, studentId: student.id, startedDay: save.day, startedYear: save.year })
    mentor.respect += 4
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
      for (const b of group) {
        if (b.id !== a.id && !b.teamId && getRel(a, b) > 25 && getRel(b, a) > 15) {
          if (tryJoinTeam(save, team, b, a, events)) break
        }
      }
    } else if (freeAgents >= 5 && chance(a.social.community * 0.012 * foundingPressure)) {
      const buddy = group.find((b) => b.id !== a.id && !b.teamId && getRel(a, b) > 40 && getRel(b, a) > 30)
      if (buddy) tryFoundTeam(save, a, buddy, save.day, save.year, events)
    }
  }

  events.push({
    type: 'interaction',
    where,
    memberIds: group.map((p) => p.id),
    memberNames: group.map((p) => pName(save, p)),
    topic,
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
      attendeeIds: [], newcomers: [], staysUntil: {}, results: {}, gamesToday: {},
      openingEvents: events, hours: [], closed: true,
    }
    return
  }

  // Read the scene's competitive temperature once, up front — it feeds
  // attendance (toxicity thins the crowd) and the day's rivalry development.
  save.scene = sceneHealth(save)

  // The cast is FINITE and fixed: the whole roster was seeded at save start and
  // discovers the arcade over time (below). Nobody new is ever generated — once
  // these people retire, they're gone, and running out of them ends the run.

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
      if (!p.isRegular) {
        p.isRegular = true
        newcomers.push(p.id)
        events.push({ type: 'arrival', text: `${p.firstName} "${p.alias || '—'}" ${p.lastName} came to ${save.arcade.name} for the first time.` })
      }
      // Climbing the status ladder is an event — being a regular here
      // MEANS something now.
      const nowStatus = statusOf(p)
      if (nowStatus && nowStatus.key !== prevStatus && prevStatus != null) {
        const line = {
          casual: `${pName(save, p)} keeps finding excuses to come back — a casual now.`,
          regular: `${pName(save, p)} is officially a regular. They have a spot, and everyone knows it's theirs.`,
          veteran: `${pName(save, p)} hit veteran status — they've seen metas come and go.`,
          star: `⭐ ${pName(save, p)} is a star of ${save.arcade.name}. People come just to watch them.`,
          legend: `👑 ${pName(save, p)} is an arcade LEGEND. Their name is basically on the building.`,
        }[nowStatus.key]
        if (line) events.push({ type: 'arrival', text: line })
        if (nowStatus.key === 'star') chronicle(save, '⭐', `${pName(save, p)} became a star of ${save.arcade.name}`)
        if (nowStatus.key === 'legend') chronicle(save, '👑', `${pName(save, p)} reached legend status at ${save.arcade.name}`)
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
    staysUntil[p.id] = clamp(2 + Math.round(p.personal.spark * 0.45 + rand() * 2 - 1), 1, HOURS_PER_DAY)
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
    openingEvents: events,
    hours: [], // one entry per simulated hour: {label, events, streamedSetup}
  }
}

/**
 * Simulates one hour of arcade time. Requires startDay to have run.
 */
export function simHour(save) {
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
      const fatigue = played * Math.max(0.02, 0.16 - p.personal.stamina * 0.013)
      const priceHesitation = tokenDeterrence(save, p)
      return chance(clamp(0.3 + p.personal.spark * 0.012 + p.personal.dominance * 0.012 - fatigue - priceHesitation, 0.02, 0.9))
    })
    const matches = []
    const pool = [...wantsToPlay]
    const setupsCount = Math.max(1, save.settings.setups)
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
        if (areSeparated(save, a.id, b.id)) s -= 1000 // owner is keeping these two apart
        if (s > bestScore) { bestScore = s; bIdx = i }
      }
      const b = pool.splice(bIdx, 1)[0]
      matches.push([a, b])
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
      const probA = winProbability(save, a, aCharId, b, bCharId)
      const result = resolveMatch(save, a, b, aCharId, bCharId)
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
      // Shock results become part of both players' personal legends.
      if (upsetSeverityOf(probA, result.aWins) === 'severe' && chance(0.5)) {
        remember(save, winner, 'upset', `the upset win over ${pName(save, loser)}`)
        remember(save, loser, 'upset', `that loss to ${pName(save, winner)}`)
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
        gainSkill(save, w, w.mainCharId, 0.03 + w.personal.analysis * 0.018)
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
        const wl = speak(winner, 'ggWin', { t: pName(save, loser), self: pName(save, winner) })
        if (wl) postMatch.push({ speaker: pName(save, winner), text: wl })
      }
      if (chance(0.55)) {
        const goodSport = loser.social.sportsmanship >= 6 || (loser.social.sportsmanship >= 4 && loser.mood >= 6)
        const ll = speak(loser, goodSport ? 'ggLossGood' : 'ggLossBad', { t: pName(save, winner), self: pName(save, loser) })
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
export function endDay(save) {
  const dip = save.dayInProgress
  if (!dip) return
  const events = []
  const attendees = dip.attendeeIds.map((id) => save.players[id]).filter(Boolean)

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
    if (p.settledMain) { maybeSwitchMain(save, p, events); maybePocketPickup(save, p) }
    else maybeSettleMain(save, p, events)
    checkFallingOut(save, p, events)
  }
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
    checkRetirement(save, p, events)
  }

  // The finite cast never refills. When the last of the 48 has retired or been
  // banished, there's no scene left to run — the whole enterprise has run its
  // course. (Only fires once the roster genuinely existed, so a fresh save with
  // everyone still a stranger can't trip it.)
  const roster = Object.values(save.players)
  if (roster.length > 0 && !roster.some((p) => !p.retired && !p.banished)) {
    save.rosterCollapsed = true
  }

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
  if (save.stream) {
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

// What fires today: 'evo' | schedule entry | null. A health-department
// shutdown cancels your local events — EVO is the world's stage, not yours.
export function whatHappensToday(save) {
  if (save.day === EVO_DAY) return 'evo'
  if (arcadeClosed(save)) return null
  const t = save.arcade.schedule.find((s) => {
    if (s.done) return false
    if (s.cadence === 'weekly') return weekdayOf(save.day) === (s.weekday || 0)
    if (s.cadence === 'monthly') return dayOfMonthOf(save.day) === (s.dayOfMonth || 1)
    return s.dayOfYear === save.day // yearly (and pre-cadence saves)
  })
  return t || null
}

export function advanceDay(save) {
  // Settle recurring bills AND drift national relevance for the day now
  // closing — BEFORE the calendar ticks. This is the one path every day flows
  // through (normal, tournament, EVO, idle catch-up), so neither can be skipped
  // by a tournament day. Both are guarded against running twice in a day.
  settleRecurring(save)
  pruneSeparations(save)
  relevanceDaily(save)
  // Daily economic snapshot for the Manage-tab income graph and foot-traffic
  // count: net cash change and how many people came through the door. Recorded
  // here — the single tick EVERY day flows through (normal, tournament, EVO,
  // idle catch-up) — so no day is ever missed. absDayOf reads the day that's
  // closing, before the calendar ticks below.
  if (save.economy) {
    const money = Math.round(save.economy.money * 100) / 100
    const prev = save.economy.lastDayMoney ?? money
    save.economy.history ??= []
    save.economy.history.push({
      absDay: absDayOf(save.day, save.year),
      money,
      net: Math.round((money - prev) * 100) / 100,
      attendance: save.economy.todayAttendance ?? null, // null on tournament/EVO days
    })
    if (save.economy.history.length > 180) save.economy.history.shift()
    save.economy.lastDayMoney = money
    save.economy.todayAttendance = null
  }
  save.day += 1
  if (save.day > DAYS_PER_YEAR) {
    save.day = 1
    save.year += 1
    driftEvoRoster(save)
  }
}

export { moodLabel }
