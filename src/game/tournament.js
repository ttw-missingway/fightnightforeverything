import { uid, chance, rand, displayName, clamp } from './util.js'
import { formatDay } from './constants.js'
import { performance as playerPerf, narrateMatch, updateElo, gainSkill, matchupWeight, recordCharResult } from './match.js'
import { getMatchup } from './model.js'
import { shiftRel, socialDelta, teamLog } from './social.js'

const pName = (save, p) => displayName(p, save)

// ---------- Entrants (arcade players and EVO elites share one shape) ----------

function arcadeEntrant(save, player) {
  return { kind: 'arcade', id: player.id, name: pName(save, player), charId: player.mainCharId, ref: player }
}

function eliteEntrant(elite) {
  return { kind: 'elite', id: elite.id, name: `${elite.alias} [${elite.region}]`, charId: elite.mainCharId, ref: elite }
}

function entrantPerformance(save, e) {
  if (e.kind === 'arcade') return playerPerf(save, e.ref, e.charId)
  return e.ref.skill * 0.78 + (e.ref.elo - 1200) / 40 + rand() * 6
}

function entrantCharName(save, e) {
  const c = save.game.characters.find((x) => x.id === e.charId)
  return c ? c.name : 'Random Select'
}

function entrantSkill(e) {
  if (e.kind === 'arcade') return e.ref.charSkill[e.charId] || 0
  return e.ref.skill
}

function resolveEntrantMatch(save, a, b, { long = true } = {}) {
  const perfA = entrantPerformance(save, a)
  const perfB = entrantPerformance(save, b)
  // Matchup chart only really bites at high-level play.
  const weight = matchupWeight(entrantSkill(a), entrantSkill(b))
  const matchupShift = a.charId && b.charId
    ? (getMatchup(save.game, a.charId, b.charId) - 50) * 0.35 * weight : 0
  const probA = 1 / (1 + Math.pow(10, -(perfA - perfB + matchupShift) / 22))
  const aWins = rand() < probA
  const winner = aWins ? a : b
  const loser = aWins ? b : a

  updateElo(winner.ref, loser.ref) // both kinds carry .elo

  if (winner.kind === 'arcade') {
    winner.ref.wins += 1
    winner.ref.mood = clamp(winner.ref.mood + 0.6, 0, 10)
    gainSkill(save, winner.ref, winner.ref.mainCharId, 0.15 + winner.ref.personal.dominance * 0.05)
    recordCharResult(winner.ref, winner.charId, true)
  }
  if (loser.kind === 'arcade') {
    loser.ref.losses += 1
    loser.ref.mood = clamp(loser.ref.mood - (10 - loser.ref.personal.temperance) * 0.2, 0, 10)
    gainSkill(save, loser.ref, loser.ref.mainCharId, 0.15 + loser.ref.personal.determination * 0.06)
    recordCharResult(loser.ref, loser.charId, false)
  }
  if (winner.kind === 'arcade' && loser.kind === 'arcade') {
    shiftRel(loser.ref, winner.ref, socialDelta(loser.ref, winner.ref, { justLostTo: true }))
  }

  const charA = save.game.characters.find((c) => c.id === a.charId)
  const charB = save.game.characters.find((c) => c.id === b.charId)
  const narration = narrateMatch({
    aName: a.name, bName: b.name, charA, charB, probA, winnerIsA: aWins, long,
    winnerPhrase: winner.kind === 'arcade' ? winner.ref.catchphrase : '',
  })
  return {
    id: uid('m'),
    aId: a.id, bId: b.id,
    aName: a.name, bName: b.name,
    aChar: entrantCharName(save, a), bChar: entrantCharName(save, b),
    probA, winnerId: winner.id, winnerName: winner.name, narration,
    bye: false,
  }
}

// ---------- Bracket machinery ----------

function seedPositions(n) {
  let pos = [1]
  while (pos.length < n) {
    const m = pos.length * 2 + 1
    const next = []
    for (const p of pos) next.push(p, m - p)
    pos = next
  }
  return pos
}

function seedBracket(entrants) {
  const sorted = [...entrants].sort((a, b) => (b.ref.elo || 0) - (a.ref.elo || 0))
  let size = 2
  while (size < sorted.length) size *= 2
  return seedPositions(size).map((seed) => sorted[seed - 1] || null)
}

/**
 * Runs single elimination. Returns {rounds, placements, champion, abruptEndRound}.
 * stopWhenNoArcade: rounds after every arcade player is out are simulated
 * silently (so the wider world stays consistent) but flagged as off-screen.
 */
function runBracket(save, entrants, { stopWhenNoArcade = false } = {}) {
  let current = seedBracket(entrants)
  const rounds = []
  const exitRound = new Map()
  let roundIdx = 0
  let abruptEndRound = null

  while (current.length > 1) {
    const hasArcade = current.some((e) => e && e.kind === 'arcade')
    if (stopWhenNoArcade && !hasArcade && abruptEndRound === null) abruptEndRound = roundIdx

    const matches = []
    const next = []
    for (let i = 0; i < current.length; i += 2) {
      const a = current[i]
      const b = current[i + 1]
      if (a && !b) {
        next.push(a)
        matches.push({ id: uid('m'), bye: true, aName: a.name, winnerId: a.id, winnerName: a.name, narration: [] })
        continue
      }
      if (!a && b) {
        next.push(b)
        matches.push({ id: uid('m'), bye: true, aName: b.name, winnerId: b.id, winnerName: b.name, narration: [] })
        continue
      }
      if (!a && !b) { next.push(null); continue }
      const m = resolveEntrantMatch(save, a, b)
      const winner = m.winnerId === a.id ? a : b
      const loser = m.winnerId === a.id ? b : a
      exitRound.set(loser.id, { entrant: loser, round: roundIdx, remaining: current.filter(Boolean).length })
      matches.push(m)
      next.push(winner)
    }
    rounds.push(matches)
    current = next
    roundIdx += 1
  }

  const champion = current[0]
  const placements = [{ entrant: champion, place: 1 }]
  for (const { entrant, round } of exitRound.values()) {
    // Losing when 2^k players remain => tied for (2^(k-1) + 1)th.
    const remainingAtRound = Math.pow(2, rounds.length - round)
    const place = remainingAtRound / 2 + 1
    placements.push({ entrant, place })
  }
  placements.sort((a, b) => a.place - b.place)
  return { rounds, placements, champion, abruptEndRound }
}

const roundName = (idx, total) => {
  const remaining = Math.pow(2, total - idx)
  if (remaining === 2) return 'Grand Finals'
  if (remaining === 4) return 'Semifinals'
  if (remaining === 8) return 'Quarterfinals'
  return `Round of ${remaining}`
}

// ---------- Singles tournaments ----------

export function runSinglesTournament(save, scheduleEntry) {
  const regulars = Object.values(save.players).filter((p) => p.isRegular && p.mainCharId)
  // Nearly everyone shows for a tournament; very low spark players might skip.
  const entrantsPlayers = regulars.filter((p) => chance(clamp(0.6 + p.personal.spark * 0.05, 0, 0.98)))
  if (entrantsPlayers.length < 2) {
    return { ok: false, reason: 'Fewer than two players showed up — the tournament was cancelled.' }
  }
  const entrants = entrantsPlayers.map((p) => arcadeEntrant(save, p))
  const { rounds, placements, champion } = runBracket(save, entrants)

  for (const { entrant, place } of placements) {
    const p = entrant.ref
    if (place === 1) { p.glory += 15; p.respect += 10; p.tournamentWins += 1; p.mood = clamp(p.mood + 2, 0, 10) }
    else if (place === 2) { p.glory += 8; p.respect += 5 }
    else if (place <= 4) { p.glory += 4; p.respect += 2 }
  }
  if (champion.charId && save.charMilestones) {
    const c = save.game.characters.find((x) => x.id === champion.charId)
    if (c) {
      save.charMilestones.push({
        charId: c.id, day: save.day, year: save.year,
        text: `${champion.name} won ${scheduleEntry?.name || 'a tournament'} playing ${c.name}`,
      })
    }
  }

  const record = {
    id: uid('t'),
    type: 'singles',
    name: scheduleEntry?.name || 'Tournament',
    day: save.day, year: save.year, dateLabel: formatDay(save.day, save.year),
    rounds: rounds.map((ms, i) => ({ title: roundName(i, rounds.length), matches: ms })),
    placements: placements.slice(0, 8).map(({ entrant, place }) => ({ place, name: entrant.name })),
    champion: champion.name,
    entrantCount: entrants.length,
  }
  save.hallOfFame.push(summaryOf(record))
  save.lastTournament = record
  if (scheduleEntry && !scheduleEntry.repeats) scheduleEntry.done = true
  return { ok: true, record }
}

// ---------- Team battles ----------

export function runTeamTournament(save, scheduleEntry) {
  const squads = Object.values(save.teams)
    .filter((t) => t.memberIds.length >= 4)
    .map((t) => ({
      team: t,
      squad: t.memberIds.map((id) => save.players[id]).filter((p) => p && p.mainCharId)
        .sort((a, b) => b.elo - a.elo).slice(0, 4),
    }))
    .filter((s) => s.squad.length === 4)
  if (squads.length < 2) {
    return { ok: false, reason: 'Fewer than two full teams (4+ members) exist — team battle cancelled.' }
  }

  // Team bracket: each "entrant" wraps a squad; team elo = average.
  const entrants = squads.map((s) => ({
    kind: 'arcade-team',
    id: s.team.id,
    name: `${s.team.name} [${s.team.acronym}]`,
    ref: { elo: s.squad.reduce((sum, p) => sum + p.elo, 0) / 4 },
    squad: s.squad,
    team: s.team,
  }))

  let current = seedBracket(entrants)
  const rounds = []
  const exitRound = new Map()
  let roundIdx = 0
  while (current.length > 1) {
    const matches = []
    const next = []
    for (let i = 0; i < current.length; i += 2) {
      const A = current[i]
      const B = current[i + 1]
      if (A && !B) { next.push(A); matches.push({ id: uid('m'), bye: true, aName: A.name, winnerName: A.name, duels: [], narration: [] }); continue }
      if (!A && B) { next.push(B); matches.push({ id: uid('m'), bye: true, aName: B.name, winnerName: B.name, duels: [], narration: [] }); continue }
      if (!A && !B) { next.push(null); continue }

      let aScore = 0
      let bScore = 0
      const duels = []
      for (let seat = 0; seat < 4; seat++) {
        const ea = arcadeEntrant(save, A.squad[seat])
        const eb = arcadeEntrant(save, B.squad[seat])
        const d = resolveEntrantMatch(save, ea, eb, { long: false })
        if (d.winnerId === ea.id) aScore += 1
        else bScore += 1
        duels.push(d)
      }
      if (aScore === bScore) {
        // Aces run it back to break the tie.
        const d = resolveEntrantMatch(save, arcadeEntrant(save, A.squad[0]), arcadeEntrant(save, B.squad[0]), { long: false })
        if (d.winnerId === A.squad[0].id) aScore += 1
        else bScore += 1
        d.tiebreaker = true
        duels.push(d)
      }
      const winner = aScore > bScore ? A : B
      const loser = winner === A ? B : A
      exitRound.set(loser.id, { entrant: loser, round: roundIdx })
      matches.push({
        id: uid('m'), bye: false,
        aName: A.name, bName: B.name,
        winnerId: winner.id, winnerName: winner.name,
        score: `${aScore}–${bScore}`,
        duels,
        narration: [`${A.name} vs ${B.name} — crew battle, four duels.`, `${winner.name} takes the set ${Math.max(aScore, bScore)}–${Math.min(aScore, bScore)}.`],
      })
      next.push(winner)
    }
    rounds.push(matches)
    current = next
    roundIdx += 1
  }

  const champion = current[0]
  for (const p of champion.squad) { p.glory += 8; p.respect += 5; p.mood = clamp(p.mood + 1.5, 0, 10) }
  // Winning together bonds a team.
  for (const a of champion.squad) for (const b of champion.squad) if (a !== b) shiftRel(a, b, 4)
  teamLog(save, champion.team, `🏆 Won ${scheduleEntry?.name || 'a team battle'} (${entrants.length} teams)`)

  const record = {
    id: uid('t'),
    type: 'teams',
    name: scheduleEntry?.name || 'Team Battle',
    day: save.day, year: save.year, dateLabel: formatDay(save.day, save.year),
    rounds: rounds.map((ms, i) => ({ title: roundName(i, rounds.length), matches: ms })),
    placements: [{ place: 1, name: champion.name }],
    champion: champion.name,
    entrantCount: entrants.length,
  }
  save.hallOfFame.push(summaryOf(record))
  save.lastTournament = record
  if (scheduleEntry && !scheduleEntry.repeats) scheduleEntry.done = true
  return { ok: true, record }
}

// ---------- EVO ----------

export function runEvo(save) {
  const regulars = Object.values(save.players)
    .filter((p) => p.isRegular && p.mainCharId)
    .sort((a, b) => b.elo - a.elo)
  const qualified = regulars.slice(0, 8)
  if (!qualified.length) return { ok: false, reason: 'No arcade players qualified for EVO this year.' }

  const elites = [...save.evoRoster].sort((a, b) => b.elo - a.elo).slice(0, 32 - qualified.length)
  const entrants = [
    ...qualified.map((p) => arcadeEntrant(save, p)),
    ...elites.map(eliteEntrant),
  ]
  const { rounds, placements, champion, abruptEndRound } = runBracket(save, entrants, { stopWhenNoArcade: true })

  const arcadePlacements = placements.filter((pl) => pl.entrant.kind === 'arcade')
  for (const { entrant, place } of arcadePlacements) {
    const p = entrant.ref
    const glory = place === 1 ? 100 : place === 2 ? 60 : place <= 4 ? 40 : place <= 8 ? 25 : place <= 16 ? 12 : 5
    p.glory += glory
    p.respect += Math.round(glory / 3)
    if (place === 1) { p.tournamentWins += 1; p.mood = 10 }
    else if (place <= 8) p.mood = clamp(p.mood + 2, 0, 10)
  }
  if (champion.kind === 'elite') {
    champion.ref.titles = (champion.ref.titles || 0) + 1
  }
  if (champion.charId && save.charMilestones) {
    const c = save.game.characters.find((x) => x.id === champion.charId)
    if (c) {
      save.charMilestones.push({
        charId: c.id, day: save.day, year: save.year,
        text: `${champion.name} won EVO Year ${save.year} playing ${c.name}`,
      })
    }
  }
  for (const { entrant, place } of arcadePlacements) {
    if (place <= 8 && entrant.charId && save.charMilestones) {
      const c = save.game.characters.find((x) => x.id === entrant.charId)
      if (c) {
        save.charMilestones.push({
          charId: c.id, day: save.day, year: save.year,
          text: `${entrant.name} took ${c.name} to top 8 at EVO Year ${save.year}`,
        })
      }
    }
    const p = save.players[entrant.id]
    if (p && p.teamId && place <= 8) {
      teamLog(save, save.teams[p.teamId], `${entrant.name} placed top 8 at EVO Year ${save.year}`)
    }
  }

  const record = {
    id: uid('t'),
    type: 'evo',
    name: `EVO — Year ${save.year}`,
    day: save.day, year: save.year, dateLabel: formatDay(save.day, save.year),
    rounds: rounds.map((ms, i) => ({
      title: roundName(i, rounds.length),
      matches: ms,
      offScreen: abruptEndRound !== null && i >= abruptEndRound,
    })),
    placements: placements.slice(0, 8).map(({ entrant, place }) => ({ place, name: entrant.name, arcade: entrant.kind === 'arcade' })),
    arcadeResults: arcadePlacements.map(({ entrant, place }) => ({ place, name: entrant.name })),
    champion: champion.name,
    abrupt: abruptEndRound !== null,
    entrantCount: entrants.length,
  }
  save.hallOfFame.push(summaryOf(record))
  save.lastTournament = record
  return { ok: true, record }
}

function summaryOf(record) {
  return {
    id: record.id,
    type: record.type,
    name: record.name,
    dateLabel: record.dateLabel,
    year: record.year,
    champion: record.champion,
    placements: record.placements,
    arcadeResults: record.arcadeResults || null,
    entrantCount: record.entrantCount,
  }
}
