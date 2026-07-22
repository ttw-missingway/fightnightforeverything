import { clamp, chance, choice, shuffle, rand, randInt, displayName, hash01, uid } from './util.js'
import { HOURS_PER_DAY, HOUR_LABELS, TOPICS, GOSSIP_TOPICS, DAYS_PER_YEAR, EVO_DAY, formatDay, weekdayOf, dayOfMonthOf } from './constants.js'
import { generatePlayer, driftEvoRoster } from './generate.js'
import { newInnovation, remember } from './model.js'
import { resolveMatch, narrateMatch, winProbability, gainSkill, seriesNoteFor, upsetSeverityOf } from './match.js'
import { buildStream, personalityOf, matchQuality } from './stream.js'
import { econLog, weeklyRent } from './economy.js'
import { updateFeedFromDay, postMoneyMatchAnnouncement } from './socialmedia.js'
import { speak } from './dialogue.js'
import {
  getRel, shiftRel, socialDelta, applySocialMood, moodLabel,
  tryFoundTeam, tryJoinTeam, checkFallingOut, teamOf, dissolveTinyTeams,
} from './social.js'
import { TECHNIQUE_NAME_PARTS } from './names.js'

const pName = (save, p) => displayName(p, save)

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
  events.push({
    type: 'main',
    text: `${pName(save, player)} has settled on ${best.name} as their main after trying ${player.exploredChars.length} character${player.exploredChars.length === 1 ? '' : 's'}.`,
  })
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
  let p = 0.2 + player.personal.spark * 0.055 + (player.mood - 5) * 0.02
  for (const f of player.foods) if (save.arcade.foods.includes(f)) p += 0.03
  for (const g of player.otherGames) if (save.arcade.otherGames.includes(g)) p += 0.03
  const main = save.game.characters.find((c) => c.id === player.mainCharId)
  if (main) {
    for (const t of main.tags || []) {
      if (player.attractedTags.includes(t)) p += 0.04
      if (player.repelledTags.includes(t)) p -= 0.05
    }
  }
  return clamp(p, 0.05, 0.95)
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

function maybeUnlockTechnique(save, player, events) {
  const skill = player.charSkill[player.mainCharId] || 0
  const candidates = save.game.techniques.filter((t) =>
    !player.knownTechniques.includes(t.id) &&
    (t.charId === null || t.charId === player.mainCharId))
  for (const t of candidates) {
    const p = clamp(0.015 + (skill - t.difficulty * 8) / 500, 0, 0.12)
    if (chance(p)) {
      player.knownTechniques.push(t.id)
      const leap = gainSkill(save, player, player.mainCharId, t.xp)
      events.push({
        type: 'technique',
        text: `${pName(save, player)} unlocked ${t.name}! (+${leap.toFixed(1)} skill)`,
      })
      break
    }
  }
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
  const regs = Object.values(save.players).filter((p) => p.isRegular && p.mainCharId)
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
  const probA = winProbability(save, a, a.mainCharId, b, b.mainCharId)
  const result = resolveMatch(save, a, b)
  const winner = result.winner
  const loser = result.loser
  const charA = save.game.characters.find((c) => c.id === a.mainCharId)
  const charB = save.game.characters.find((c) => c.id === b.mainCharId)
  const nar = narrateMatch({
    aName: pName(save, a), bName: pName(save, b),
    charA, charB, probA, winnerIsA: result.aWins, long: true,
    winnerPhrase: winner.catchphrase,
    seriesNote: seriesNoteFor(a, b, pName(save, a), pName(save, b)),
    grudge: true,
    watcherCount: watchers.length,
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
    probA,
    winnerId: winner.id, winnerName: pName(save, winner),
    eloDelta: result.eloDelta,
    watcherIds: watchers.map((w) => w.id),
    watcherNames: watchers.map((w) => pName(save, w)),
    narration: nar.lines, narrationMeta: nar.meta, setScore: nar.score,
    preMatch, postMatch,
  }
  // A money match is an event: it goes on stream automatically and the
  // stakes juice the broadcast.
  ev.stream = buildStream(save, {
    level: ((a.charSkill[a.mainCharId] || 0) + (b.charSkill[b.mainCharId] || 0)) / 200,
    personality: Math.min(1, (personalityOf(a) + personalityOf(b)) / 2 + 0.25),
    probA, aWins: result.aWins, narration: nar.lines, meta: nar.meta,
    aName: ev.aName, bName: ev.bName, winnerName: ev.winnerName,
    context: 'daily',
  })
  // Stakes: pride, glory, and the story everyone will tell.
  winner.respect += 6
  winner.glory += 3
  winner.mood = clamp(winner.mood + 1.5, 0, 10)
  loser.mood = clamp(loser.mood - 1.5, 0, 10)
  remember(save, winner, 'moneymatch', `winning the money match against ${pName(save, loser)}`)
  remember(save, loser, 'moneymatch', `losing the money match to ${pName(save, winner)}`)
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
      const before = getRel(a, b)
      const delta = socialDelta(a, b)
      shiftRel(a, b, delta)
      totalDelta += delta
      const after = getRel(a, b)
      if (before < 20 && after >= 20) outcomes.push(`${pName(save, a)} and ${pName(save, b)} are becoming real friends.`)
      if (before > -50 && after <= -50) outcomes.push(`${pName(save, a)} now considers ${pName(save, b)} an enemy.`)
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

  // Team formation & recruitment. Existing teams make outsiders want their
  // own banner — rivalry breeds rivalry.
  const teamCount = Object.keys(save.teams).length
  const foundingPressure = 1 + Math.min(teamCount, 3) * 0.6
  for (const a of group) {
    const team = teamOf(save, a)
    if (team) {
      for (const b of group) {
        if (b.id !== a.id && !b.teamId && getRel(a, b) > 35 && getRel(b, a) > 25) {
          if (tryJoinTeam(save, team, b, a, events)) break
        }
      }
    } else if (chance(a.social.community * 0.012 * foundingPressure)) {
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

  // A new generated player may wander in.
  const cpuCount = Object.values(save.players).filter((p) => p.createdBy === 'cpu').length
  if (save.settings.allowGeneratedPlayers && cpuCount < save.settings.maxGeneratedPlayers && chance(0.12)) {
    const p = generatePlayer(save)
    save.players[p.id] = p
    events.push({ type: 'arrival', text: `A new face walks in: ${p.firstName} "${p.alias}" ${p.lastName}.` })
  }

  const everyone = Object.values(save.players)
  const attendees = []
  const newcomers = []
  for (const p of everyone) {
    if (chance(attendChance(save, p))) {
      attendees.push(p)
      p.daysAttended += 1
      if (!p.isRegular) {
        p.isRegular = true
        newcomers.push(p.id)
        events.push({ type: 'arrival', text: `${p.firstName} "${p.alias || '—'}" ${p.lastName} came to ${save.arcade.name} for the first time.` })
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
    // with every game played today. Stamina is how long the tank lasts.
    const wantsToPlay = present.filter((p) => {
      const played = dip.gamesToday[p.id] || 0
      const fatigue = played * Math.max(0.02, 0.16 - p.personal.stamina * 0.013)
      return chance(clamp(0.3 + p.personal.spark * 0.012 + p.personal.dominance * 0.012 - fatigue, 0.02, 0.9))
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
      const probA = winProbability(save, a, a.mainCharId, b, b.mainCharId)
      const result = resolveMatch(save, a, b)
      const charA = save.game.characters.find((c) => c.id === a.mainCharId)
      const charB = save.game.characters.find((c) => c.id === b.mainCharId)
      const grudge = getRel(a, b) < -40 || getRel(b, a) < -40
      const nar = narrateMatch({
        aName: pName(save, a), bName: pName(save, b),
        charA, charB, probA, winnerIsA: result.aWins,
        winnerPhrase: result.winner.catchphrase,
        seriesNote: seriesNoteFor(a, b, pName(save, a), pName(save, b)),
        grudge,
        watcherCount: watcherGroup.length,
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
      const d = socialDelta(loser, winner, { justLostTo: true })
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
          .filter((x) => (x.m.kind === 'game' && x.m.move) || x.m.kind === 'struggle')
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

      // How promising this match looks as a broadcast, judged BEFORE the
      // result — so the streaming choice is informed, not psychic.
      const preQuality = matchQuality({
        level: ((a.charSkill[a.mainCharId] || 0) + (b.charSkill[b.mainCharId] || 0)) / 200,
        personality: (personalityOf(a) + personalityOf(b)) / 2,
        probA,
        upset: false,
      })
      events.push({
        type: 'match',
        setupIndex: mi + 1,
        aId: a.id, bId: b.id,
        aName: pName(save, a), bName: pName(save, b),
        charAName: charA?.name || 'Random', charBName: charB?.name || 'Random',
        streamHint: preQuality >= 50 ? 'hot' : preQuality >= 35 ? 'solid' : 'cold',
        probA,
        winnerId: winner.id,
        winnerName: pName(save, winner),
        eloDelta: result.eloDelta,
        watcherIds: watcherGroup.map((w) => w.id),
        watcherNames: watcherGroup.map((w) => pName(save, w)),
        narration,
        narrationMeta: nar.meta,
        setScore: nar.score,
        chatter,
        postMatch,
      })

      maybeUnlockTechnique(save, winner, events)
      maybeUnlockTechnique(save, loser, events)
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

  // Once-per-day per attendee checks.
  for (const p of attendees) {
    maybeInnovate(save, p, events)
    if (p.settledMain) maybeSwitchMain(save, p, events)
    else maybeSettleMain(save, p, events)
    checkFallingOut(save, p, events)
  }
  dissolveTinyTeams(save, events)
  maybeScheduleMoneyMatch(save, events)

  // The books: door quarters, concession sales, weekly rent.
  if (save.economy) {
    const totalGames = Object.values(dip.gamesToday || {}).reduce((s, n) => s + n, 0) / 2
    let income = attendees.length * 1.5 + totalGames * 0.4
    if (save.arcade.foods.length) income += attendees.length * 1.2
    if (income > 0) econLog(save, income, 'daily takings')
    if (weekdayOf(dip.day) === 6) {
      const rent = weeklyRent(save)
      econLog(save, -rent, 'weekly rent')
      if (save.economy.money < 0) {
        events.push({ type: 'economy', text: `💸 Rent cleared the account — you're $${Math.abs(Math.round(save.economy.money))} in the red. The landlord "checked in."` })
      }
    }
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
  }
  if (save.stream) {
    save.stream.hype = clamp(save.stream.hype - 0.08, 0, 100)
    // Word of mouth: a channel with real hype picks up followers organically
    // even on days nothing was streamed. Saturates like stream growth does.
    if (save.stream.hype > 8) {
      const saturation = Math.max(0.05, 1 - save.stream.followers / 20000)
      save.stream.followers += Math.round(save.stream.hype * 0.06 * saturation)
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

// What fires today: 'evo' | schedule entry | null.
export function whatHappensToday(save) {
  if (save.day === EVO_DAY) return 'evo'
  const t = save.arcade.schedule.find((s) => {
    if (s.done) return false
    if (s.cadence === 'weekly') return weekdayOf(save.day) === (s.weekday || 0)
    if (s.cadence === 'monthly') return dayOfMonthOf(save.day) === (s.dayOfMonth || 1)
    return s.dayOfYear === save.day // yearly (and pre-cadence saves)
  })
  return t || null
}

export function advanceDay(save) {
  save.day += 1
  if (save.day > DAYS_PER_YEAR) {
    save.day = 1
    save.year += 1
    driftEvoRoster(save)
  }
}

export { moodLabel }
