import { clamp, hash01, chance, choice } from './util.js'
import { newTeam } from './model.js'
import { TEAM_WORDS } from './names.js'

export function getRel(a, b) {
  return a.relationships[b.id] || 0
}

export function shiftRel(a, b, delta) {
  a.relationships[b.id] = clamp((a.relationships[b.id] || 0) + delta, -100, 100)
}

export function relLabel(v) {
  if (v >= 80) return 'lifelong friends'
  if (v >= 50) return 'close friends'
  if (v >= 20) return 'friends'
  if (v > -20) return 'acquaintances'
  if (v > -50) return 'rivals'
  if (v > -80) return 'enemies'
  return 'mortal enemies'
}

export function moodLabel(m) {
  if (m >= 9) return 'ecstatic'
  if (m >= 7) return 'happy'
  if (m >= 5) return 'content'
  if (m >= 3) return 'gloomy'
  if (m >= 1) return 'miserable'
  return 'terribly unhappy'
}

/**
 * One social exchange between a and b. Returns {delta, note} from a's view of b
 * — the caller applies the symmetric pass for b as well.
 *
 * Persona is polarizing: a stable per-pair hash decides whether b's persona
 * amplifies affection or grates on a — the same pair always polarizes the
 * same direction, so grudges and bromances are consistent.
 */
export function socialDelta(a, b, context = {}) {
  let delta = 0
  delta += (b.social.politeness - 4.5) * 0.35
  const rel = getRel(a, b)
  if (Math.abs(rel) < 10) delta += (b.social.charisma - 4) * 0.5 // first impressions
  else delta += (b.social.charisma - 5) * 0.15

  const polarity = hash01(`${a.id}:${b.id}:persona`) < 0.5 ? -1 : 1
  delta += polarity * b.social.persona * 0.35

  // Shared interests smooth everything over.
  const sharedGames = a.otherGames.filter((g) => b.otherGames.includes(g)).length
  const sharedFoods = a.foods.filter((f) => b.foods.includes(f)).length
  delta += (sharedGames + sharedFoods) * 0.4

  // Player-tag chemistry: a is drawn to or put off by b's vibe.
  for (const t of b.playerTags || []) {
    if ((a.attractedPlayerTags || []).includes(t)) delta += 1.2
    if ((a.repelledPlayerTags || []).includes(t)) delta -= 1.5
  }

  if (context.justLostTo) {
    // b beat a recently; b's sportsmanship decides how it lands.
    delta += (b.social.sportsmanship - 5) * 0.6
  }
  delta += (Math.random() - 0.45) * 2 // day-to-day noise
  return delta
}

export function applySocialMood(player, delta) {
  // Sensitivity scales how much social outcomes move mood.
  const moodShift = delta * 0.06 * player.social.sensitivity
  player.mood = clamp(player.mood + moodShift, 0, 10)
}

// ---------- Teams ----------

export function generateTeamName(existing) {
  for (let i = 0; i < 40; i++) {
    const name = `${choice(TEAM_WORDS[0])} ${choice(TEAM_WORDS[1])}`
    const acronym = name.split(' ').map((w) => w[0]).join('').toUpperCase()
    if (!existing.some((t) => t.name === name || t.acronym === acronym)) {
      return { name, acronym }
    }
  }
  return { name: 'The Crew', acronym: `TC${existing.length}` }
}

export function teamOf(save, player) {
  return player.teamId ? save.teams[player.teamId] : null
}

export function teamLog(save, team, text) {
  if (!team.history) team.history = []
  team.history.push({ day: save.day, year: save.year, text })
}

/**
 * Team appetite for a new member drops hard past 4 players.
 */
export function teamRecruitChance(team) {
  const n = team.memberIds.length
  if (n < 4) return 0.5
  return 0.5 * Math.pow(0.15, n - 3)
}

export function tryFoundTeam(save, founder, cofounder, day, year, events) {
  if (founder.teamId || cofounder.teamId) return null
  const { name, acronym } = generateTeamName(Object.values(save.teams))
  const team = newTeam({
    name, acronym,
    founderId: founder.id,
    memberIds: [founder.id, cofounder.id],
    foundedDay: day + (year - 1) * 1000,
  })
  save.teams[team.id] = team
  founder.teamId = team.id
  cofounder.teamId = team.id
  founder.respect += 3
  teamLog(save, team, `Founded by ${founder.alias || founder.firstName} and ${cofounder.alias || cofounder.firstName}`)
  events.push({
    type: 'team',
    text: `${founder.alias || founder.firstName} and ${cofounder.alias || cofounder.firstName} founded a new team: ${name} [${acronym}]!`,
  })
  return team
}

export function tryJoinTeam(save, team, player, inviter, events) {
  if (player.teamId) return false
  if (!chance(teamRecruitChance(team))) return false
  team.memberIds.push(player.id)
  player.teamId = team.id
  teamLog(save, team, `${player.alias || player.firstName} joined, recruited by ${inviter.alias || inviter.firstName}`)
  events.push({
    type: 'team',
    text: `${inviter.alias || inviter.firstName} brought ${player.alias || player.firstName} into ${team.name} [${team.acronym}].`,
  })
  return true
}

/**
 * A member whose average relationship with teammates has soured may storm out.
 */
export function checkFallingOut(save, player, events) {
  const team = teamOf(save, player)
  if (!team || team.memberIds.length <= 1) return
  const others = team.memberIds.filter((id) => id !== player.id)
  const avg = others.reduce((s, id) => s + getRel(player, save.players[id]), 0) / others.length
  if (avg < -15 && chance(0.3)) {
    team.memberIds = team.memberIds.filter((id) => id !== player.id)
    player.teamId = null
    player.mood = clamp(player.mood - 1.5, 0, 10)
    teamLog(save, team, `${player.alias || player.firstName} left after a falling out`)
    events.push({
      type: 'team',
      text: `${player.alias || player.firstName} had a falling out with ${team.name} and left the team.`,
    })
  }
}

// A team can't be a team of one — lone survivors quietly fold the banner.
export function dissolveTinyTeams(save, events) {
  for (const team of Object.values(save.teams)) {
    if (team.memberIds.length <= 1) {
      const last = team.memberIds[0] ? save.players[team.memberIds[0]] : null
      if (last) {
        last.teamId = null
        last.mood = clamp(last.mood - 1, 0, 10)
        events.push({
          type: 'team',
          text: `${team.name} [${team.acronym}] disbanded — ${last.alias || last.firstName} was the only member left.`,
        })
      } else {
        events.push({ type: 'team', text: `${team.name} [${team.acronym}] quietly disbanded.` })
      }
      delete save.teams[team.id]
    }
  }
}
