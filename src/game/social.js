import { clamp, hash01, chance, choice } from './util.js'
import { newTeam, remember, chronicle, getMatchup } from './model.js'
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
    // Storming out of your crew is the kind of thing the arcade retells.
    chronicle(save, '💥', `${player.alias || player.firstName} stormed out of ${team.name} after a falling out`)
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
  chronicle(save, '🪦', `${team.name} [${team.acronym}] is no more — ${reason}`)
  delete save.teams[team.id]
}

/**
 * Betrayal: a low-loyalty player with a big ego — or a real friend on a
 * better crew — walks across the arcade and joins the other team. Rare.
 * Remembered forever, by everyone.
 */
function maybeBetrayal(save, events) {
  const teams = Object.values(save.teams)
  if (teams.length < 2) return
  const avgElo = (team) => {
    const ms = team.memberIds.map((id) => save.players[id]).filter(Boolean)
    return ms.length ? ms.reduce((s, p) => s + p.elo, 0) / ms.length : 0
  }
  for (const p of Object.values(save.players)) {
    const team = p.teamId ? save.teams[p.teamId] : null
    if (!team) continue
    // Who'd have them? A crew with room, where a friend vouches — or one
    // clearly winning more than home ever will.
    const suitors = teams.filter((t) =>
      t.id !== team.id && t.memberIds.length < 6 &&
      (t.memberIds.some((id) => {
        const m = save.players[id]
        return m && getRel(p, m) > 30 && getRel(m, p) > 20
      }) || avgElo(t) > avgElo(team) + 80))
    if (!suitors.length) continue
    let c = 0.0012 * Math.max(0.2, (10 - p.personal.loyalty) / 6)
    if (p.social.persona >= 7) c *= 1.5 // big egos chase bigger stages
    if (!chance(c)) continue

    const dest = suitors.reduce((a, b) => (avgElo(a) >= avgElo(b) ? a : b))
    const name = p.alias || p.firstName
    team.memberIds = team.memberIds.filter((id) => id !== p.id)
    dest.memberIds.push(p.id)
    p.teamId = dest.id
    dest.lastGrowth = (save.year - 1) * DAYS_PER_YEAR + save.day
    for (const id of team.memberIds) {
      const mate = save.players[id]
      if (!mate) continue
      shiftRel(mate, p, -35)
      mate.mood = clamp(mate.mood - 1, 0, 10)
    }
    teamLog(save, team, `${name} defected to ${dest.name}`)
    teamLog(save, dest, `${name} joined — walking out on ${team.name} to do it`)
    remember(save, p, 'team', `leaving ${team.name} for ${dest.name}`)
    events.push({
      type: 'team',
      text: `🗡 ${name} LEFT ${team.name} [${team.acronym}] for ${dest.name} [${dest.acronym}]. Mid-session. The room went silent.`,
    })
    chronicle(save, '🗡', `The day ${name} betrayed ${team.name} and walked across the arcade to join ${dest.name}`)
    return // one betrayal a day is plenty of drama
  }
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
  const regs = Object.values(save.players).filter((p) => p.isRegular && !p.retired && !p.banished)
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

  maybeBetrayal(save, events)
  dissolveTinyTeams(save, events)
}

// ---------- Opinions ----------
// What a player actually thinks — of the GAME (the thing you patch) and of
// the ARCADE (the room you run). Both are 0..10, derived live.

export function opinionLabel(v) {
  if (v >= 8.5) return 'obsessed'
  if (v >= 7) return 'loves it'
  if (v >= 5.5) return 'enjoying it'
  if (v >= 4) return 'lukewarm'
  if (v >= 2.5) return 'frustrated'
  return 'checked out'
}

export function gameOpinionOf(save, p) {
  let score = 5
  // Winning is fun. Getting farmed is not.
  if (p.wins + p.losses >= 10) score += (p.wins / (p.wins + p.losses) - 0.5) * 4
  const chars = save.game.characters
  const main = chars.find((c) => c.id === p.mainCharId)
  if (main) {
    const others = chars.filter((c) => c.id !== main.id)
    const power = others.length
      ? others.reduce((s, o) => s + getMatchup(save.game, main.id, o.id), 0) / others.length
      : 50
    if (power < 45) score -= 1.2 // maining a bottom-tier is a lifestyle of pain
    else if (power > 55) score += 0.6 // winning cheap is still winning
    for (const t of main.tags || []) if (p.attractedTags.includes(t)) score += 0.3
  }
  score += (save.patchMorale || 0) * 0.12
  const invested = Math.max(0, ...Object.values(p.charSkill || {}))
  score += Math.min(1, invested / 100) // sunk cost reads as love
  return clamp(score, 0, 10)
}

export function arcadeOpinionOf(save, p) {
  let score = 5
  score += save.arcade.foods.filter((f) => p.foods.includes(f)).length * 0.4
  score += save.arcade.otherGames.filter((g) => p.otherGames.includes(g)).length * 0.35
  const rels = Object.values(p.relationships || {})
  score += Math.min(2, rels.filter((v) => v >= 20).length * 0.35)
  score -= Math.min(1.5, rels.filter((v) => v <= -50).length * 0.4)
  score += ((save.arcade.cleanliness ?? 80) - 60) * 0.02
  score += ((save.staffing?.morale ?? 70) - 60) * 0.012
  const tokenPrice = save.arcade.prices?.token ?? 1
  score -= Math.max(0, tokenPrice - (0.6 + (p.social?.income ?? 5) * 0.16)) * 0.8
  // A room full of bad blood is miserable to be in — a toxic scene poisons how
  // everyone feels about the ARCADE itself, not just each other. This is what
  // makes the internet stop loving your place when the vibe curdles.
  score -= (save.scene?.toxicity || 0) * 4
  return clamp(score, 0, 10)
}

// The room's consensus: averaged over everyone who actually shows up.
function communityAvg(save, fn) {
  const regs = Object.values(save.players).filter((p) => p.isRegular && !p.retired && !p.banished)
  if (!regs.length) return null
  return regs.reduce((s, p) => s + fn(save, p), 0) / regs.length
}

export function communityGameOpinion(save) {
  const avg = communityAvg(save, gameOpinionOf)
  if (avg == null) return null
  return clamp(avg + (save.patchMorale || 0) * 0.1, 0, 10)
}

export function communityArcadeOpinion(save) {
  const avg = communityAvg(save, arcadeOpinionOf)
  if (avg == null) return null
  return clamp(avg + Math.min(1, (save.stream?.hype || 0) / 100), 0, 10)
}

// How the room feels about a player — averaged over what everyone ELSE thinks
// of them (incoming relationships). The fast read on who's beloved and, more
// usefully, who's the problem: a deeply-negative standing is a player souring
// the scene around them.
export function standingOf(save, p) {
  let sum = 0
  let n = 0
  for (const other of Object.values(save.players)) {
    if (other.id === p.id || !other.isRegular || other.retired || other.banished) continue
    const v = other.relationships?.[p.id]
    if (v == null) continue
    sum += v
    n += 1
  }
  return n ? sum / n : 0
}

export function standingLabel(v) {
  if (v >= 28) return { label: 'beloved', color: 'var(--green)' }
  if (v >= 8) return { label: 'well-liked', color: 'var(--green)' }
  if (v > -8) return { label: 'neutral', color: 'var(--dim)' }
  if (v > -28) return { label: 'disliked', color: 'var(--gold)' }
  return { label: 'resented', color: 'var(--red)' }
}

// ---------- Scene health: rivalry vs toxicity ----------
// The mid-game's central tension. A fierce rivalry — two players close in
// skill who've traded blows many times, with a competitive edge but not open
// hatred — pushes both to improve ("iron sharpens iron"). A scene of all
// friends plateaus; a scene of mutual hatred turns toxic and empties out. The
// owner's job is to cultivate the competition without letting it curdle.

const RIVAL_MIN_GAMES = 6

// Are these two an active rivalry? Close in elo, real head-to-head history,
// and a relationship in the competitive band — spiky, but short of hatred.
export function areRivals(save, a, b) {
  if (!a || !b || a.id === b.id) return false
  const h = a.h2h?.[b.id]
  const games = h ? h.w + h.l : 0
  if (games < RIVAL_MIN_GAMES) return false
  if (Math.abs(a.elo - b.elo) > 170) return false
  const rel = Math.min(getRel(a, b), getRel(b, a))
  return rel <= 10 && rel > -50 // competitive tension, short of real hostility
}

// The first active rival this player has among the regulars (or null).
export function rivalOf(save, player) {
  if (!player.isRegular || player.retired || player.banished) return null
  for (const p of Object.values(save.players)) {
    if (!p.isRegular || p.retired || p.id === player.id) continue
    if (areRivals(save, player, p)) return p
  }
  return null
}

// A read on the whole scene: how many productive rivalries burn, how many
// relationships have curdled into mutual hatred, normalized to scene size.
export function sceneHealth(save) {
  const regs = Object.values(save.players).filter((p) => p.isRegular && !p.retired && !p.banished)
  let rivalries = 0
  let toxic = 0
  // Normalize by how many PEOPLE are caught up in rivalries / feuds, not raw
  // pair counts — a scene feels competitive or poisonous based on how much of
  // the room is involved, and this stays stable as the scene grows.
  const inRivalry = new Set()
  const inFeud = new Set()
  for (let i = 0; i < regs.length; i++) {
    for (let j = i + 1; j < regs.length; j++) {
      const a = regs[i]
      const b = regs[j]
      const rel = Math.min(getRel(a, b), getRel(b, a))
      if (rel <= -60) { toxic++; inFeud.add(a.id); inFeud.add(b.id) }
      else if (areRivals(save, a, b)) { rivalries++; inRivalry.add(a.id); inRivalry.add(b.id) }
    }
  }
  const n = Math.max(1, regs.length)
  return {
    rivalries,
    toxic,
    regulars: regs.length,
    rivalryIndex: clamp((inRivalry.size / n) * 1.15, 0, 1), // share of the room with a rival
    toxicity: clamp((inFeud.size / n) * 1.4, 0, 1), // share of the room caught in real bad blood
    rivalIds: [...inRivalry], // who currently has an active rival — read by skillCeiling (cheap lookup)
    feudIds: [...inFeud], // who's caught in real bad blood — read by discipline/reputation
  }
}

export function sceneVerdict(scene) {
  if (!scene || scene.regulars < 6) return { label: 'the scene is still forming', color: 'dim' }
  if (scene.toxicity >= 0.5) return { label: 'turning toxic — regulars are drifting away', color: 'red' }
  if (scene.toxicity >= 0.25) return { label: 'bad blood is brewing', color: 'gold' }
  if (scene.rivalryIndex >= 0.4) return { label: 'a fierce, healthy competitive scene', color: 'green' }
  if (scene.rivalryIndex >= 0.18) return { label: 'rivalries are taking shape', color: 'cyan' }
  return { label: 'too friendly — players are plateauing', color: 'gold' }
}
