import { uid, chance, rand, choice, displayName, clamp } from './util.js'
import { formatDay } from './constants.js'
import { LIFE_EVENTS } from './names.js'
import { performance as playerPerf, narrateMatch, updateElo, gainSkill, matchupWeight, recordCharResult, recordH2H, seriesNoteFor } from './match.js'
import { getMatchup, remember, chronicle } from './model.js'
import { updateFeedFromTournament } from './socialmedia.js'
import { shiftRel, socialDelta, teamLog, getRel } from './social.js'
import { buildStream, personalityOf, elitePersonality } from './stream.js'
import { speak } from './dialogue.js'

const pName = (save, p) => displayName(p, save)

// ---------- Entrants (arcade players and EVO elites share one shape) ----------

function arcadeEntrant(save, player) {
  return { kind: 'arcade', id: player.id, name: pName(save, player), charId: player.mainCharId, ref: player }
}

function eliteEntrant(elite) {
  return { kind: 'elite', id: elite.id, name: `${elite.alias} [${elite.region}]`, charId: elite.mainCharId, ref: elite }
}

function entrantPerformance(save, e, context = 'tournament') {
  if (e.kind === 'arcade') {
    let perf = playerPerf(save, e.ref, e.charId)
    // Big-stage nerves: shaky composure bleeds performance under the lights,
    // and EVO is the brightest light there is. Varies set to set.
    const composure = e.ref.personal.composure ?? 5
    perf -= (10 - composure) * (context === 'evo' ? 0.7 : 0.35) * (0.5 + rand() * 0.5)
    return perf
  }
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

function entrantPersonality(e) {
  return e.kind === 'arcade' ? personalityOf(e.ref) : elitePersonality(e.ref)
}

function resolveEntrantMatch(save, a, b, { long = true, context = 'tournament' } = {}) {
  const perfA = entrantPerformance(save, a, context)
  const perfB = entrantPerformance(save, b, context)
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
  const bothArcade = winner.kind === 'arcade' && loser.kind === 'arcade'
  if (bothArcade) {
    shiftRel(loser.ref, winner.ref, socialDelta(loser.ref, winner.ref, { justLostTo: true }))
    recordH2H(winner.ref, loser.ref)
  }

  const charA = save.game.characters.find((c) => c.id === a.charId)
  const charB = save.game.characters.find((c) => c.id === b.charId)
  const nar = narrateMatch({
    aName: a.name, bName: b.name, charA, charB, probA, winnerIsA: aWins, long,
    winnerPhrase: winner.kind === 'arcade' ? winner.ref.catchphrase : '',
    seriesNote: bothArcade ? seriesNoteFor(a.ref, b.ref, a.name, b.name) : null,
    grudge: bothArcade && (getRel(a.ref, b.ref) < -40 || getRel(b.ref, a.ref) < -40),
    watcherCount: context === 'evo' ? 10 : 4, // tournaments always draw a rail
  })
  // Every tournament match goes out on the arcade's stream channel.
  const stream = buildStream(save, {
    level: (entrantSkill(a) + entrantSkill(b)) / 200,
    personality: (entrantPersonality(a) + entrantPersonality(b)) / 2,
    probA, aWins, narration: nar.lines, meta: nar.meta,
    aName: a.name, bName: b.name, winnerName: winner.name,
    context,
  })

  // Bracket sets end with words too — when both players are real people.
  const postMatch = []
  if (bothArcade) {
    if (chance(0.55)) {
      const wl = speak(winner.ref, 'ggWin', { t: loser.name, self: winner.name })
      if (wl) postMatch.push({ speaker: winner.name, text: wl })
    }
    if (chance(0.55)) {
      const goodSport = loser.ref.social.sportsmanship >= 6
      const ll = speak(loser.ref, goodSport ? 'ggLossGood' : 'ggLossBad', { t: winner.name, self: loser.name })
      if (ll) postMatch.push({ speaker: loser.name, text: ll })
    }
  }

  return {
    id: uid('m'),
    aId: a.id, bId: b.id,
    aName: a.name, bName: b.name,
    aChar: entrantCharName(save, a), bChar: entrantCharName(save, b),
    probA, winnerId: winner.id, winnerName: winner.name,
    narration: nar.lines, narrationMeta: nar.meta, setScore: nar.score,
    stream,
    postMatch,
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
function runBracket(save, entrants, { stopWhenNoArcade = false, context = 'tournament' } = {}) {
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
      const m = resolveEntrantMatch(save, a, b, { context })
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

// ---------- Invitations ----------

/**
 * Who deserves a slot: elo, discounted for unproven players (few games),
 * plus reputation — respect and glory. A fresh 1200 with 6 games shouldn't
 * bump a proven vet.
 */
export function invitationScore(p) {
  const games = p.wins + p.losses
  const proven = clamp(games / 40, 0.25, 1)
  return 1200 + (p.elo - 1200) * proven + p.respect * 6 + p.glory * 1.5
}

function dropoutChance(p) {
  let c = 0.05 + (5 - p.mood) * 0.01 + (5 - p.personal.spark) * 0.008
  return clamp(c, 0.01, 0.16)
}

/**
 * Fill `size` slots from the ranked invite list, narrating anyone whose life
 * gets in the way. Returns null (cancellation) if the bracket can't fill.
 */
function fillBracket(save, ranked, size, storylines) {
  if (ranked.length < size) return null
  const field = ranked.slice(0, size)
  const alternates = ranked.slice(size)
  for (let i = 0; i < field.length; i++) {
    const p = field[i]
    if (chance(dropoutChance(p))) {
      const sub = alternates.shift()
      if (sub) {
        storylines.push(`${pName(save, p)} dropped out — ${choice(LIFE_EVENTS)}. ${pName(save, sub)} slides into the bracket.`)
        field[i] = sub
      } else {
        storylines.push(`${pName(save, p)} dropped out — ${choice(LIFE_EVENTS)} — and there was no one left to take the slot.`)
        return null
      }
    }
  }
  return field
}

// ---------- Singles tournaments ----------

export function runSinglesTournament(save, scheduleEntry) {
  const size = scheduleEntry?.size || 8
  const name = scheduleEntry?.name || 'Tournament'
  const ranked = Object.values(save.players)
    .filter((p) => p.isRegular && p.mainCharId)
    .sort((a, b) => invitationScore(b) - invitationScore(a))
  if (ranked.length < size) {
    return { ok: false, reason: `${name} cancelled — only ${ranked.length} of ${size} slots could be filled.` }
  }
  const storylines = []
  const field = fillBracket(save, ranked, size, storylines)
  if (!field) {
    return { ok: false, reason: `${name} cancelled — too many dropouts left the bracket short of ${size}.` }
  }
  const entrants = field.map((p) => arcadeEntrant(save, p))
  const { rounds, placements, champion } = runBracket(save, entrants)

  // Baseline glory scales with field size AND how rare the event is — a
  // 64-man yearly major is legacy, a weekly 8-man is a good Tuesday. On top
  // of that, impact: how many people actually watched the finals, and
  // whether the win made history.
  const cadence = scheduleEntry?.cadence || 'yearly'
  const cadenceMult = cadence === 'yearly' ? 2 : cadence === 'monthly' ? 1.2 : 0.6
  const finalsViewers = rounds[rounds.length - 1]?.[0]?.stream?.viewers || 0
  const impact = Math.round(Math.min(25, finalsViewers / 40) * cadenceMult)
  const baseGlory = Math.max(2, Math.round(size * cadenceMult))
  for (const { entrant, place } of placements) {
    const p = entrant.ref
    if (place === 1) {
      p.glory += baseGlory + impact
      p.respect += Math.ceil(baseGlory * 0.75)
      p.tournamentWins += 1
      p.mood = clamp(p.mood + 2, 0, 10)
      // Weekly wins blur together; the big ones stick forever.
      if (size >= 16 || cadence !== 'weekly' || chance(0.3)) {
        remember(save, p, 'tournament', `winning ${name} (Year ${save.year})`)
      }
      if (p.tournamentWins === 1) {
        p.glory += 5
        chronicle(save, '🏆', `${entrant.name} won their first-ever title at ${name}`)
      } else if (size >= 16 || cadence === 'yearly') {
        chronicle(save, '🏆', `${entrant.name} won ${name} (${size} entrants${finalsViewers ? `, ${finalsViewers} watching the finals` : ''})`)
      }
    }
    else if (place === 2) { p.glory += Math.ceil(baseGlory / 2) + Math.ceil(impact / 2); p.respect += Math.ceil(baseGlory / 3) }
    else if (place <= 4) { p.glory += Math.ceil(baseGlory / 4); p.respect += 2 }
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
    name,
    day: save.day, year: save.year, dateLabel: formatDay(save.day, save.year),
    storylines,
    revealed: 0,
    rounds: rounds.map((ms, i) => ({ title: roundName(i, rounds.length), matches: ms })),
    placements: placements.slice(0, 8).map(({ entrant, place }) => ({ place, name: entrant.name })),
    champion: champion.name,
    entrantCount: entrants.length,
  }
  decorateStreamStats(save, record)
  updateFeedFromTournament(save, record)
  save.hallOfFame.push(summaryOf(record))
  save.lastTournament = record
  return { ok: true, record }
}

// ---------- Team battles ----------

export function runTeamTournament(save, scheduleEntry) {
  const allSquads = Object.values(save.teams)
    .filter((t) => t.memberIds.length >= 4)
    .map((t) => ({
      team: t,
      squad: t.memberIds.map((id) => save.players[id]).filter((p) => p && p.mainCharId)
        .sort((a, b) => b.elo - a.elo).slice(0, 4),
      avgScore: 0,
    }))
    .filter((s) => s.squad.length === 4)
  const minSize = Math.min(scheduleEntry?.size || 2, 8)
  if (allSquads.length < Math.max(2, minSize)) {
    return {
      ok: false,
      reason: `${scheduleEntry?.name || 'Team battle'} cancelled — only ${allSquads.length} full team${allSquads.length === 1 ? '' : 's'} (need ${Math.max(2, minSize)}).`,
    }
  }
  // Power-of-two field: the strongest teams by average invitation score.
  for (const s of allSquads) {
    s.avgScore = s.squad.reduce((sum, p) => sum + invitationScore(p), 0) / 4
  }
  allSquads.sort((a, b) => b.avgScore - a.avgScore)
  let fieldSize = 2
  while (fieldSize * 2 <= allSquads.length) fieldSize *= 2
  const squads = allSquads.slice(0, fieldSize)

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
  const teamCadence = scheduleEntry?.cadence || 'yearly'
  const teamGlory = Math.round(8 * (teamCadence === 'yearly' ? 2 : teamCadence === 'monthly' ? 1.2 : 0.6))
  for (const p of champion.squad) { p.glory += teamGlory; p.respect += 5; p.mood = clamp(p.mood + 1.5, 0, 10) }
  // Winning together bonds a team.
  for (const a of champion.squad) for (const b of champion.squad) if (a !== b) shiftRel(a, b, 4)
  teamLog(save, champion.team, `🏆 Won ${scheduleEntry?.name || 'a team battle'} (${entrants.length} teams)`)
  chronicle(save, '🛡', `${champion.name} won ${scheduleEntry?.name || 'the team battle'} as a crew`)

  const record = {
    id: uid('t'),
    type: 'teams',
    name: scheduleEntry?.name || 'Team Battle',
    day: save.day, year: save.year, dateLabel: formatDay(save.day, save.year),
    storylines: allSquads.length > fieldSize
      ? [`${allSquads.length - fieldSize} team${allSquads.length - fieldSize === 1 ? '' : 's'} missed the ${fieldSize}-team cut.`]
      : [],
    revealed: 0,
    rounds: rounds.map((ms, i) => ({ title: roundName(i, rounds.length), matches: ms })),
    placements: [{ place: 1, name: champion.name }],
    champion: champion.name,
    entrantCount: entrants.length,
  }
  decorateStreamStats(save, record)
  updateFeedFromTournament(save, record)
  save.hallOfFame.push(summaryOf(record))
  save.lastTournament = record
  return { ok: true, record }
}

// ---------- EVO ----------

export function runEvo(save) {
  const regulars = Object.values(save.players)
    .filter((p) => p.isRegular && p.mainCharId)
    .sort((a, b) => invitationScore(b) - invitationScore(a))
  const qualified = regulars.slice(0, 8)
  if (!qualified.length) return { ok: false, reason: 'No arcade players qualified for EVO this year.' }

  const elites = [...save.evoRoster].sort((a, b) => b.elo - a.elo).slice(0, 32 - qualified.length)
  const entrants = [
    ...qualified.map((p) => arcadeEntrant(save, p)),
    ...elites.map(eliteEntrant),
  ]
  const { rounds, placements, champion, abruptEndRound } = runBracket(save, entrants, { stopWhenNoArcade: true, context: 'evo' })

  const arcadePlacements = placements.filter((pl) => pl.entrant.kind === 'arcade')
  for (const { entrant, place } of arcadePlacements) {
    const p = entrant.ref
    const glory = place === 1 ? 100 : place === 2 ? 60 : place <= 4 ? 40 : place <= 8 ? 25 : place <= 16 ? 12 : 5
    p.glory += glory
    p.respect += Math.round(glory / 3)
    if (place === 1) { p.tournamentWins += 1; p.mood = 10; remember(save, p, 'evo', `WINNING EVO Year ${save.year}`) }
    else if (place <= 8) { p.mood = clamp(p.mood + 2, 0, 10); remember(save, p, 'evo', `the top-${place <= 4 ? 4 : 8} run at EVO Year ${save.year}`) }
  }
  if (champion.kind === 'elite') {
    champion.ref.titles = (champion.ref.titles || 0) + 1
  }
  const bestArcade = arcadePlacements[0]
  chronicle(save, '🌏', champion.kind === 'arcade'
    ? `${champion.name} WON EVO Year ${save.year}. From this arcade. Nothing will ever top this.`
    : `EVO Year ${save.year}: ${champion.name} took the crown${bestArcade ? `; ${bestArcade.entrant.name} carried the arcade to ${bestArcade.place === 1 ? 'victory' : `top ${bestArcade.place <= 4 ? 4 : bestArcade.place <= 8 ? 8 : 17}`}` : ''}`)
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
    storylines: [],
    revealed: 0,
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
  decorateStreamStats(save, record)
  updateFeedFromTournament(save, record)
  save.hallOfFame.push(summaryOf(record))
  save.lastTournament = record
  return { ok: true, record }
}

function decorateStreamStats(save, record) {
  let peak = 0
  for (const round of record.rounds) {
    for (const m of round.matches) {
      if (m.stream) peak = Math.max(peak, m.stream.viewers)
      for (const d of m.duels || []) if (d.stream) peak = Math.max(peak, d.stream.viewers)
    }
  }
  record.channelName = save.stream.channelName
  record.peakViewers = peak
  return record
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
