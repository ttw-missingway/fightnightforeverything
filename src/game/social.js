import { clamp, hash01, chance, choice } from './util.js'
import { newTeam, remember } from './model.js'
import { TEAM_WORDS } from './names.js'
import { DAYS_PER_YEAR } from './constants.js'

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

  // Hygiene. The arcade is a small room in summer. People notice.
  const hyg = b.social.hygiene ?? 5
  if (hyg <= 3) delta -= (4 - hyg) * 0.5
  else if (hyg >= 9) delta += 0.2

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
  remember(save, founder, 'team', `founding ${name}`)
  remember(save, cofounder, 'team', `founding ${name}`)
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
  team.lastGrowth = (save.year - 1) * DAYS_PER_YEAR + save.day
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

function disbandTeam(save, team, events, reason) {
  for (const id of team.memberIds) {
    const p = save.players[id]
    if (p) { p.teamId = null; p.mood = clamp(p.mood - 0.5, 0, 10) }
  }
  events.push({ type: 'team', text: `${team.name} [${team.acronym}] ${reason}` })
  delete save.teams[team.id]
}

/**
 * Once-per-day team ecosystem pass, so rosters actually MOVE:
 *  - understrength teams actively recruit free agents (not just whoever
 *    happens to be in their chat circle)
 *  - crews stuck below four for weeks fizzle out
 *  - even happy members drift away sometimes — restlessness, ambition,
 *    or a team that's clearly going nowhere
 */
export function dailyTeamDynamics(save, events) {
  const abs = (save.year - 1) * DAYS_PER_YEAR + save.day
  const regs = Object.values(save.players).filter((p) => p.isRegular)
  const teamless = regs.filter((p) => !p.teamId)

  for (const team of Object.values(save.teams)) {
    team.lastGrowth ??= abs
    const members = team.memberIds.map((id) => save.players[id]).filter(Boolean)
    if (!members.length) continue

    // Active recruiting: the most community-minded member works the room.
    if (members.length < 4 && teamless.length && chance(0.18)) {
      const recruiter = [...members].sort((x, y) => y.social.community - x.social.community)[0]
      const candidates = teamless.filter((p) => getRel(recruiter, p) > 20 && getRel(p, recruiter) > 10)
      if (candidates.length) {
        const target = choice(candidates)
        if (chance(0.45 + target.social.community * 0.03)) {
          team.memberIds.push(target.id)
          target.teamId = team.id
          team.lastGrowth = abs
          teamless.splice(teamless.indexOf(target), 1)
          teamLog(save, team, `${target.alias || target.firstName} joined after ${recruiter.alias || recruiter.firstName} kept asking`)
          events.push({
            type: 'team',
            text: `${recruiter.alias || recruiter.firstName} finally talked ${target.alias || target.firstName} into joining ${team.name} [${team.acronym}].`,
          })
        }
      }
    }

    // Fizzle: a crew that can't hit four eventually stops pretending.
    if (team.memberIds.length < 4 && abs - team.lastGrowth > 35 && chance(0.12)) {
      disbandTeam(save, team, events, `fizzled out — never found a fourth, and the group chat went quiet.`)
      continue
    }
  }

  // Churn: even solid teams lose people. Loyalty resists it; a stalled
  // team or a big ego accelerates it.
  for (const p of regs) {
    const team = p.teamId ? save.teams[p.teamId] : null
    if (!team) continue
    let c = 0.003
    if (team.memberIds.length < 4) c += 0.008
    if (p.social.persona >= 8) c += 0.004
    c *= Math.max(0.3, 1.3 - p.personal.loyalty * 0.09)
    if (chance(c)) {
      team.memberIds = team.memberIds.filter((id) => id !== p.id)
      p.teamId = null
      teamLog(save, team, `${p.alias || p.firstName} left on good terms`)
      events.push({
        type: 'team',
        text: `${p.alias || p.firstName} left ${team.name} [${team.acronym}] on good terms — just time for something new.`,
      })
    }
  }

  dissolveTinyTeams(save, events)
}
