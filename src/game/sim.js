import { clamp, chance, choice, shuffle, rand, randInt, displayName } from './util.js'
import { HOURS_PER_DAY, HOUR_LABELS, TOPICS, DAYS_PER_YEAR, EVO_DAY, formatDay } from './constants.js'
import { generatePlayer, driftEvoRoster } from './generate.js'
import { newInnovation } from './model.js'
import { resolveMatch, narrateMatch, winProbability, gainSkill } from './match.js'
import {
  getRel, shiftRel, socialDelta, applySocialMood, moodLabel,
  tryFoundTeam, tryJoinTeam, checkFallingOut, teamOf, dissolveTinyTeams,
} from './social.js'
import { TECHNIQUE_NAME_PARTS } from './names.js'

const pName = (save, p) => displayName(p, save)

// ---------- Main character selection ----------

function charAppeal(save, player, char) {
  let score = char.popularity * 1.1
  score -= char.difficulty * (1 - player.personal.aptitude / 14) * 0.9
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

function runInteraction(save, group, where, events) {
  const topic = choice(TOPICS)
  const feelings = []
  const outcomes = []
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
      if (!p.mainCharId) {
        p.mainCharId = pickMainChar(save, p)
        const char = save.game.characters.find((c) => c.id === p.mainCharId)
        if (char) events.push({ type: 'main', text: `${pName(save, p)} has been gravitating toward ${char.name}.` })
      }
    }
  }

  // How long each attendee sticks around (spark = stays longer).
  const staysUntil = {}
  for (const p of attendees) {
    staysUntil[p.id] = clamp(2 + Math.round(p.personal.spark * 0.45 + rand() * 2 - 1), 1, HOURS_PER_DAY)
  }

  save.hour = 0
  save.dayInProgress = {
    day: save.day,
    year: save.year,
    dateLabel: formatDay(save.day, save.year),
    attendeeIds: attendees.map((p) => p.id),
    newcomers,
    staysUntil,
    openingEvents: events,
    hours: [], // one entry per simulated hour: {label, events}
  }
}

/**
 * Simulates one hour of arcade time. Requires startDay to have run.
 */
export function simHour(save) {
  const dip = save.dayInProgress
  if (!dip || save.hour >= HOURS_PER_DAY) return
  const hourIdx = save.hour
  const events = []
  const attendees = dip.attendeeIds.map((id) => save.players[id]).filter(Boolean)
  const present = shuffle(attendees.filter((p) => (dip.staysUntil[p.id] || 0) > hourIdx))

  if (present.length > 0) {
    // Only some players are itching to play this hour; the rest hang out.
    const wantsToPlay = present.filter((p) =>
      chance(0.28 + p.personal.spark * 0.02 + p.personal.dominance * 0.015))
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
      const narration = narrateMatch({
        aName: pName(save, a), bName: pName(save, b),
        charA, charB, probA, winnerIsA: result.aWins,
        winnerPhrase: result.winner.catchphrase,
      })
      // Post-match social: loser's read on the winner is shaped by winner's sportsmanship.
      const loser = result.loser
      const winner = result.winner
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

      events.push({
        type: 'match',
        setupIndex: mi + 1,
        aId: a.id, bId: b.id,
        aName: pName(save, a), bName: pName(save, b),
        charAName: charA?.name || 'Random', charBName: charB?.name || 'Random',
        probA,
        winnerId: winner.id,
        winnerName: pName(save, winner),
        eloDelta: result.eloDelta,
        watcherIds: watcherGroup.map((w) => w.id),
        watcherNames: watcherGroup.map((w) => pName(save, w)),
        narration,
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
      runInteraction(save, g, where, events)
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
    maybeSwitchMain(save, p, events)
    checkFallingOut(save, p, events)
  }
  dissolveTinyTeams(save, events)

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

  // Mood drifts back toward each player's baseline overnight.
  for (const p of Object.values(save.players)) {
    p.mood = clamp(p.mood + (p.defaultMood - p.mood) * 0.25, 0, 10)
    p.respect = Math.round(p.respect * 10) / 10
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
  const t = save.arcade.schedule.find((s) => s.dayOfYear === save.day && !s.done)
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
