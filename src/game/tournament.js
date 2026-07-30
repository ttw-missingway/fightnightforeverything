import { uid, chance, rand, randInt, choice, displayName, clamp } from './util.js'
import { bindRng } from './rng.js'
import { formatDay, statLevel } from './constants.js'
import { LIFE_EVENTS } from './names.js'
import { performance as playerPerf, updateElo, gainSkill, matchupWeight, recordCharResult, recordH2H, seriesNoteFor } from './match.js'
import { narrateSet } from './fight.js'
import { getMatchup, remember, chronicle, pushVod, awardMilestone } from './model.js'
import { updateFeedFromTournament } from './socialmedia.js'
import { shiftRel, socialDelta, teamLog, getRel } from './social.js'
import { bumpPassion } from './career.js'
import { applyChampionDividend } from './relevance.js'
import { econLog, trySpend } from './economy.js'
import { regionFlag, arcadeFlag } from './flags.js'
import { rankedWorld } from './world.js'
import { tournamentMess } from './bandwidth.js'
import { buildStream, personalityOf, elitePersonality, applyStageReps, addHype } from './stream.js'
import { speak } from './dialogue.js'

const pName = (save, p) => displayName(p, save)

// ---------- Entrants (arcade players and EVO elites share one shape) ----------

export function arcadeEntrant(save, player) {
  // Your people compete under YOUR flag — whatever country the arcade is in.
  const flag = arcadeFlag(save)
  const name = pName(save, player)
  return {
    kind: 'arcade',
    id: player.id,
    name: flag ? `${flag} ${name}` : name,
    charId: player.mainCharId,
    ref: player,
  }
}

function eliteEntrant(elite) {
  // The flag rides along in the NAME because a match record only ever carries
  // strings — narration, pool tables and brackets all read `aName`, so this is
  // the one place that can put a nationality on every screen at once.
  const flag = regionFlag(elite.region)
  return {
    kind: 'elite',
    id: elite.id,
    name: flag ? `${flag} ${elite.alias}` : elite.alias,
    charId: elite.mainCharId,
    ref: elite,
  }
}

function entrantPerformance(save, e, context = 'tournament') {
  if (e.kind === 'arcade') {
    let perf = playerPerf(save, e.ref, e.charId)
    // The choke. On the big stage, how much of your practice-room level you
    // actually bring down is decided by your NERVE — innate composure PLUS the
    // earned belief that only comes from being battle-tested under the lights
    // (streamed sets, deep tournament runs). A monster who's never performed in
    // front of a crowd leaves a huge chunk of their skill in the lab; a
    // seasoned competitor barely flinches. EVO is the brightest light there is.
    const composure = statLevel(e.ref.personal.composure)
    const belief = e.ref.belief ?? 0
    const nerve = composure * 0.6 + belief * 0.06 // ~0..12
    const stageWeight = context === 'evo' ? 1.4 : 0.55
    perf -= Math.max(0, 11 - nerve) * stageWeight * (0.5 + rand() * 0.5)
    // Peak or burnt out: a fired-up player overperforms, a checked-out one folds.
    perf += ((e.ref.passion ?? 80) - 60) * (context === 'evo' ? 0.08 : 0.04)
    return perf
  }
  // The elite field is genuinely elite — the best players on the planet. Beating
  // them takes a fully cultivated champion, not just the best kid in your arcade.
  //
  // These weights MIRROR performance() exactly, and they have to. They used to
  // read `skill * 0.72 + elo / 70`, which quietly discounted an elite's rating
  // to a bit over half of what your own player's was worth — and your arcade is
  // a CLOSED elo pool. Your cast farms rating off your own regulars, who sink
  // to pay for it, so a local hero can show up at 2000 having never played
  // anybody outside the building. Weighting that inflated number MORE than a
  // world number one's was the single reason a skill-65 kid could win EVO.
  //
  // The rand() term stands in for the x-factor an elite has no stat block for,
  // scaled to the same average person performance() assumes: 0..6.
  return e.ref.skill * 0.75 + (e.ref.elo - 1200) / 40 + rand() * 6
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

export function resolveEntrantMatch(save, a, b, { long = true, context = 'tournament' } = {}) {
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
    gainSkill(save, winner.ref, winner.ref.mainCharId, 0.15 + statLevel(winner.ref.personal.dominance) * 0.05)
    recordCharResult(winner.ref, winner.charId, true)
  }
  if (loser.kind === 'arcade') {
    loser.ref.losses += 1
    loser.ref.mood = clamp(loser.ref.mood - (10 - statLevel(loser.ref.personal.temperance)) * 0.2, 0, 10)
    gainSkill(save, loser.ref, loser.ref.mainCharId, 0.15 + statLevel(loser.ref.personal.determination) * 0.06)
    recordCharResult(loser.ref, loser.charId, false)
  }
  const bothArcade = winner.kind === 'arcade' && loser.kind === 'arcade'
  if (bothArcade) {
    shiftRel(loser.ref, winner.ref, socialDelta(loser.ref, winner.ref, { justLostTo: true }))
    recordH2H(winner.ref, loser.ref)
  }
  save.patchGames = (save.patchGames || 0) + 1 // tournament sets are balance data too

  const charA = save.game.characters.find((c) => c.id === a.charId)
  const charB = save.game.characters.find((c) => c.id === b.charId)
  const stage = save.game.stages.length ? choice(save.game.stages) : null
  // Finals and EVO are marquee broadcasts: extra seeds, keep the best cut.
  const marquee = long || context === 'evo'
  const nar = narrateSet({
    aName: a.name, bName: b.name, charA, charB, probA, winnerIsA: aWins, long,
    skillA: entrantSkill(a), skillB: entrantSkill(b),
    // Elites carry real stat blocks now — their x-factor spikes and composure
    // reads are THEIRS, not the seasoned-pro default.
    statsA: a.ref.personal || null,
    statsB: b.ref.personal || null,
    stageName: stage?.name,
    winnerPhrase: winner.kind === 'arcade' ? winner.ref.catchphrase : '',
    seriesNote: bothArcade ? seriesNoteFor(a.ref, b.ref, a.name, b.name) : null,
    grudge: bothArcade && (getRel(a.ref, b.ref) < -40 || getRel(b.ref, a.ref) < -40),
    watcherCount: context === 'evo' ? 10 : 4, // tournaments always draw a rail
    marquee, spice: marquee ? 3 : 2,
    rules: save.game.rules,
    game: save.game,
    seed: randInt(1, 2147483646),
  })
  // Every tournament match goes out on the arcade's stream channel.
  const stream = buildStream(save, {
    level: (entrantSkill(a) + entrantSkill(b)) / 200,
    personality: (entrantPersonality(a) + entrantPersonality(b)) / 2,
    probA, aWins, narration: nar.lines, meta: nar.meta,
    aName: a.name, bName: b.name, winnerName: winner.name,
    context,
  })
  // Competing on the big stage is how a player gets battle-tested — arcade
  // entrants earn belief/popularity from every set, and the marquee sets (finals,
  // EVO) forge the most. This is what makes deep runs and big brackets worth it.
  applyStageReps(save, [a, b], stream, context === 'evo' ? 'evo' : 'tournament', marquee ? 1.6 : 1, {
    probA, aWins, target: nar.target, loserGames: nar.loserGames,
  })

  // Bracket sets end with words too — when both players are real people.
  const postMatch = []
  if (bothArcade) {
    if (chance(0.55)) {
      const wl = speak(winner.ref, 'ggWin', { t: loser.name, to: loser.ref, self: winner.name })
      if (wl) postMatch.push({ speaker: winner.name, text: wl })
    }
    if (chance(0.55)) {
      const goodSport = loser.ref.social.sportsmanship >= 4
      const ll = speak(loser.ref, goodSport ? 'ggLossGood' : 'ggLossBad', { t: winner.name, to: winner.ref, self: loser.name })
      if (ll) postMatch.push({ speaker: loser.name, text: ll })
    }
  }

  return {
    id: uid('m'),
    aId: a.id, bId: b.id,
    aName: a.name, bName: b.name,
    aChar: entrantCharName(save, a), bChar: entrantCharName(save, b),
    charAId: a.charId || null, charBId: b.charId || null,
    stageName: stage?.name,
    probA, winnerId: winner.id, winnerName: winner.name,
    narration: nar.lines, narrationMeta: nar.meta, setScore: nar.score,
    setLoserGames: nar.loserGames, // pool tables need games-for/against
    narrationHud: nar.hud, ftTarget: nar.target, narrationSeed: nar.seed,
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

// ---------- Round robin ----------
// Everyone plays everyone (circle method); standings by wins, tiebreak elo.
// Returns pre-titled rounds so the record builder can use them as-is.
function roundRobinBracket(save, entrants, { context = 'tournament' } = {}) {
  const arr = [...entrants]
  if (arr.length % 2 === 1) arr.push(null) // a rotating bye
  const n = arr.length
  const half = n / 2
  const wins = new Map(entrants.map((e) => [e.id, 0]))
  const rounds = []
  const order = [...arr]
  for (let r = 0; r < n - 1; r++) {
    const matches = []
    for (let i = 0; i < half; i++) {
      const a = order[i]
      const b = order[n - 1 - i]
      if (!a || !b) continue // the bye sits out
      const m = resolveEntrantMatch(save, a, b, { context })
      const winner = m.winnerId === a.id ? a : b
      wins.set(winner.id, wins.get(winner.id) + 1)
      matches.push(m)
    }
    rounds.push({ title: `Round ${r + 1}`, matches })
    // rotate everyone but the first
    const fixed = order[0]
    const rest = order.slice(1)
    rest.unshift(rest.pop())
    order.splice(0, order.length, fixed, ...rest)
  }
  const ranked = [...entrants].sort((a, b) => (wins.get(b.id) - wins.get(a.id)) || ((b.ref.elo || 0) - (a.ref.elo || 0)))
  const placements = ranked.map((e, i) => ({ entrant: e, place: i + 1 }))
  return { rounds, placements, champion: ranked[0] }
}

// ---------- Double elimination ----------
// Two lives: lose in winners, drop to losers; lose again, out. WB champ meets
// LB champ in the grand finals (with a bracket reset if the LB player takes the
// first set). Requires a power-of-two field (fillBracket delivers exactly the
// scheduled size; the runner trims to the nearest power of two just in case).
function doubleElimBracket(save, entrants, { context = 'tournament' } = {}) {
  let pow = 1
  while (pow * 2 <= entrants.length) pow *= 2
  const seeded = seedBracket(entrants.slice(0, pow)).filter(Boolean)
  const N = seeded.length
  const k = Math.log2(N)
  const rounds = []
  const place = new Map()
  let nextPlace = N
  const pairsOf = (list) => { const p = []; for (let i = 0; i < list.length; i += 2) p.push([list[i], list[i + 1]]); return p }
  const playRound = (pairs, bracket, title) => {
    const matches = []; const winners = []; const losers = []
    for (const [a, b] of pairs) {
      const m = resolveEntrantMatch(save, a, b, { context })
      const w = m.winnerId === a.id ? a : b
      matches.push(m); winners.push(w); losers.push(w === a ? b : a)
    }
    rounds.push({ title, matches, bracket })
    return { winners, losers }
  }

  // Winners bracket, collecting each round's losers.
  let wb = seeded
  const wbLosers = []
  for (let r = 0; r < k; r++) {
    const { winners, losers } = playRound(pairsOf(wb), 'wb', wb.length === 2 ? 'Winners Final' : `Winners Round ${r + 1}`)
    wbLosers.push(losers)
    wb = winners
  }
  const wbChamp = wb[0]

  // Losers bracket: alternate a "minor" round (LB survivors play each other)
  // with a "major" round (LB survivors meet the next batch of WB losers).
  let lb = wbLosers[0]
  let feed = 1
  let lbNum = 1
  while (!(feed >= k && lb.length === 1)) {
    if (lb.length > 1) {
      const { winners, losers } = playRound(pairsOf(lb), 'lb', `Losers Round ${lbNum++}`)
      for (const l of losers) place.set(l.id, nextPlace--)
      lb = winners
    }
    if (feed < k) {
      const merged = []
      for (let i = 0; i < lb.length; i++) { merged.push(lb[i]); merged.push(wbLosers[feed][i]) }
      const { winners, losers } = playRound(pairsOf(merged), 'lb', `Losers Round ${lbNum++}`)
      for (const l of losers) place.set(l.id, nextPlace--)
      lb = winners
      feed++
    }
    if (lb.length === 0) break
  }
  const lbChamp = lb[0]

  // Grand finals — WB champ has one life in hand.
  const gf = playRound([[wbChamp, lbChamp]], 'gf', 'Grand Finals')
  let champion
  if (gf.winners[0] === wbChamp) {
    place.set(lbChamp.id, 2); place.set(wbChamp.id, 1); champion = wbChamp
  } else {
    const reset = playRound([[wbChamp, lbChamp]], 'gf', 'Grand Finals (Reset)')
    champion = reset.winners[0]
    place.set(reset.losers[0].id, 2); place.set(champion.id, 1)
  }

  const placements = [...place.entries()]
    .map(([id, p]) => ({ entrant: seeded.find((e) => e.id === id), place: p }))
    .filter((x) => x.entrant)
    .sort((a, b) => a.place - b.place)
  return { rounds, placements, champion }
}

// Pick the bracket runner for a scheduled format.
function runFormat(save, entrants, format) {
  if (format === 'roundrobin') return roundRobinBracket(save, entrants, {})
  if (format === 'doubleelim') return doubleElimBracket(save, entrants, {})
  return runBracket(save, entrants)
}

// ---------- Invitations ----------

/**
 * Who deserves a slot: elo, discounted for unproven players (few games),
 * plus reputation — respect and glory. A fresh 1200 with 6 games shouldn't
 * bump a proven vet.
 */
// The seeding law of the whole calendar: the user's players are first-class
// citizens. Filler only enters a bracket when there aren't enough cast members
// to fill it — and because alternates use the same order, a dropout's slot goes
// to another cast member first, every time. EVO most of all.
export const castFirst = (a, b) => (a.npc ? 1 : 0) - (b.npc ? 1 : 0) || invitationScore(b) - invitationScore(a)

export function invitationScore(p) {
  const games = p.wins + p.losses
  const proven = clamp(games / 40, 0.25, 1)
  return 1200 + (p.elo - 1200) * proven + p.respect * 6 + p.glory * 1.5
}

// Staged exhibitions were CUT by the revision — see docs/DEPRECATED.md and
// src/game/deprecated/exhibition.js. Streaming already showcases; the P4
// calendar generates the low-stakes matches. (EVO Media Day below is a
// different thing and stays.)

/**
 * THE POT. Staging a bracket costs the house real money — somebody pays for
 * the trophies, the pot, and the night. Before this, a bracket was strictly
 * free upside (hype, opinion, glory, relevance) and the styles that lived on
 * events had no sacrifice anywhere on the books: measured at n=8/336d/normal,
 * competition-first banked $3,727 while the two styles that skip events banked
 * under $300 — running MORE events was also the best way to hold money, which
 * is backwards. A pot puts the sacrifice where the identity is: an event-heavy
 * calendar is now a real line item, and skipping events is what it always
 * claimed to be — thrift.
 *
 * SIZED LIKE THE REAL THING. A weekly's pot is mostly entry fees; the house
 * tops it up a dollar a head (a $3/head house stake measured ~$1,150/yr on the
 * default weekly-8 — a third of a healthy normal run's annual banking, and the
 * ladder regressed to 50% deaths). Monthlies and yearly majors are the events
 * a venue genuinely stakes, which is where the event-heavy identity pays.
 */
export const TOURNAMENT_POT_PER_HEAD = { weekly: 1, monthly: 4, yearly: 6 }
export const tournamentPot = (entrants, cadence) =>
  Math.round(entrants * (TOURNAMENT_POT_PER_HEAD[cadence] ?? 4))

function dropoutChance(p) {
  // Life gets in the way of the UNRELIABLE. The put-together player has never
  // missed a bracket in their life; the flake no-shows their own grudge match.
  let c = 0.035 + (5 - p.mood) * 0.008 + Math.max(0, 8 - statLevel(p.social?.reliability)) * 0.011
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
  bindRng(save)
  const name = scheduleEntry?.name || 'Tournament'
  // Consequential worlds hold a real tournament to a minimum of 8 entrants —
  // no dinky 2- or 4-player brackets. Sandbox honors the scheduled size.
  const consequential = save.settings.mode !== 'sandbox'
  const size = consequential ? Math.max(8, scheduleEntry?.size || 8) : (scheduleEntry?.size || 8)
  const ranked = Object.values(save.players)
    .filter((p) => p.isRegular && p.mainCharId && !p.retired && !p.banished)
    .sort(castFirst)
  if (ranked.length < size) {
    return { ok: false, reason: `${name} cancelled — only ${ranked.length} eligible, need at least ${size}.` }
  }
  const storylines = []
  const field = fillBracket(save, ranked, size, storylines)
  if (!field) {
    return { ok: false, reason: `${name} cancelled — too many dropouts left the bracket short of ${size}.` }
  }
  // The house stakes the pot before a single game is played. A bracket the
  // venue can't fund doesn't run — which also stops a dying room from hyping
  // itself further into the hole with events it can't pay for.
  const potCadence = scheduleEntry?.cadence || 'yearly'
  const pot = tournamentPot(size, potCadence)
  if (pot > 0 && !trySpend(save, pot, `${name} — pot & trophies`)) {
    return { ok: false, reason: `${name} cancelled — the house couldn't put up the $${pot} pot.` }
  }
  storylines.push(`$${pot} on the line, staked by the house.`)
  const entrants = field.map((p) => arcadeEntrant(save, p))
  const format = scheduleEntry?.format || 'single'
  const { rounds, placements, champion } = runFormat(save, entrants, format)

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
    // A deep run is exactly what keeps a player in love with the game.
    bumpPassion(p, place === 1 ? 12 : place === 2 ? 7 : place <= 4 ? 4 : 1.5)
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
    format,
    name,
    day: save.day, year: save.year, dateLabel: formatDay(save.day, save.year),
    storylines,
    revealed: 0,
    // Single-elim returns raw match arrays (titled by roundName); round-robin
    // and double-elim return pre-titled {title, matches} rounds — support both.
    rounds: rounds.map((r, i) => (r.matches ? { title: r.title, matches: r.matches } : { title: roundName(i, rounds.length), matches: r })),
    placements: placements.slice(0, 8).map(({ entrant, place }) => ({ place, name: entrant.name })),
    champion: champion.name,
    entrantCount: entrants.length,
  }
  decorateStreamStats(save, record)
  updateFeedFromTournament(save, record)
  applyTournamentMess(save, scheduleEntry)
  save.hallOfFame.push(summaryOf(record))
  save.lastTournament = record
  pushVod(save, record) // same object reference → shared reveal cursor
  return { ok: true, record }
}

// ---------- Team battles ----------

export function runTeamTournament(save, scheduleEntry) {
  bindRng(save)
  const allSquads = Object.values(save.teams)
    .filter((t) => t.memberIds.length >= 4)
    .map((t) => ({
      team: t,
      squad: t.memberIds.map((id) => save.players[id]).filter((p) => p && p.mainCharId && !p.retired && !p.banished)
        .sort((a, b) => b.elo - a.elo).slice(0, 4),
      avgScore: 0,
    }))
    .filter((s) => s.squad.length === 4)
  // Consequential worlds require at least 4 full teams to run a real crew battle.
  const consequential = save.settings.mode !== 'sandbox'
  const minTeams = Math.max(consequential ? 4 : 2, Math.min(scheduleEntry?.size || 2, 8))
  if (allSquads.length < minTeams) {
    return {
      ok: false,
      reason: `${scheduleEntry?.name || 'Team battle'} cancelled — only ${allSquads.length} full team${allSquads.length === 1 ? '' : 's'} (need ${minTeams}).`,
    }
  }
  // Power-of-two field: the strongest teams by average invitation score.
  for (const s of allSquads) {
    s.avgScore = s.squad.reduce((sum, p) => sum + invitationScore(p), 0) / 4
    s.castCount = s.squad.filter((p) => !p.npc).length
  }
  // Squads carrying the user's players outrank all-filler squads for the field.
  allSquads.sort((a, b) => b.castCount - a.castCount || b.avgScore - a.avgScore)
  let fieldSize = 2
  while (fieldSize * 2 <= allSquads.length) fieldSize *= 2
  const squads = allSquads.slice(0, fieldSize)

  // Same pot rule as singles: the house pays for the night, per player on the
  // floor (four to a squad).
  const teamPot = tournamentPot(fieldSize * 4, scheduleEntry?.cadence || 'monthly')
  if (teamPot > 0 && !trySpend(save, teamPot, `${scheduleEntry?.name || 'Team battle'} — pot & trophies`)) {
    return { ok: false, reason: `${scheduleEntry?.name || 'Team battle'} cancelled — the house couldn't put up the $${teamPot} pot.` }
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
  const teamCadence = scheduleEntry?.cadence || 'yearly'
  const teamGlory = Math.round(8 * (teamCadence === 'yearly' ? 2 : teamCadence === 'monthly' ? 1.2 : 0.6))
  for (const p of champion.squad) { p.glory += teamGlory; p.respect += 5; p.mood = clamp(p.mood + 1.5, 0, 10); bumpPassion(p, 9) }
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
  applyTournamentMess(save, scheduleEntry)
  save.hallOfFame.push(summaryOf(record))
  save.lastTournament = record
  pushVod(save, record) // same object reference → shared reveal cursor
  return { ok: true, record }
}

// ---------- EVO ----------

const EVO_SOUNDBITES = [
  "I didn't come all this way to place top 8. I came to win.",
  "Pools were a warmup. The real tournament starts now.",
  "Everyone's got a gameplan until they're down to last pixel on the big stage.",
  "Respect to my pool. But I'm not here to make friends.",
  "I've been dreaming about this stage since I was a kid feeding quarters into a cabinet.",
  "The bracket doesn't scare me. I scare the bracket.",
  "My arcade back home is watching. I'm not letting them down.",
]

const EVO_HYPE_HANDLES = [
  'fgc_daily', 'framedata_andy', 'neutralgod', 'pooltourist', 'saltmine',
  'downback_dave', 'combovideo', 'the_rail', 'wakeup_dp', 'lab_monster',
  'bracketdemon', 'grandfinals', 'hitconfirm_hq', 'tourneylife',
]

const EVO_WIN_LINES = [
  "I told everybody. Nobody listened. Now they have to.",
  "Every early morning in the lab was for this. Every one.",
  "I'm not going to pretend I'm surprised. I knew what I had.",
  "This is for my arcade. This whole thing is for my arcade.",
  "I've lost this bracket in my head a thousand times. Not today.",
  "Ask me again tomorrow. Right now I can't feel my hands.",
]
const EVO_LOSS_LINES = [
  "I'll be back. Write that down.",
  "They were better today. Today. That's all it was.",
  "One read. The whole thing came down to one read and I got it wrong.",
  "I'm not going to cry about it on camera. I'm going to go practice.",
  "Congratulations to them, genuinely. Now if you'll excuse me.",
  "I learned more in that set than in the last six months.",
]

/**
 * The noise around the tournament, baked at sim time so the broadcast plays
 * back the same way twice. Everything the EVO screen shows between matches —
 * the pre-bracket chatter, the words either side of the exhibition, and what
 * the champion says while they still can't feel their hands — comes from here
 * rather than being invented live in the UI.
 */
function buildEvoTalk(save, { seeds, favourite }) {
  const pick = (n, arr) => {
    const out = []
    const pool = [...arr]
    for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(randInt(0, pool.length - 1), 1)[0])
    return out
  }
  const names = seeds.map((s) => s.name)
  const mine = seeds.filter((s) => s.kind === 'arcade').map((s) => s.name)
  const dark = names[names.length - 1] || 'the last seed'
  const lines = [
    `the ${names.length} that made it out of pools. this is the best bracket we've had in years`,
    `${favourite} is the favourite and it isn't close. someone please take a game off them`,
    `putting money on ${dark}. i know. i KNOW. but watch.`,
    `every year i say pools are the best part of ${save.game.name} and every year i'm right`,
    `whoever seeded this bracket has a personal problem with me`,
    `if ${favourite} wins this again i'm switching games. (i am not switching games)`,
    `the top half of this bracket is a bloodbath and the bottom half is a coronation`,
    `genuinely no idea who wins this. best ${save.game.name} has ever looked`,
  ]
  if (mine.length) {
    lines.push(`wait ${mine[0]} is in this?? from ${save.arcade.name}?? the local scene is COOKING`)
    lines.push(`nobody outside their arcade has heard of ${mine[0]}. that changes tonight`)
  }
  return pick(Math.min(6, lines.length), lines).map((text) => ({
    handle: choice(EVO_HYPE_HANDLES),
    text,
  }))
}

/** What somebody says with a camera in their face. */
function interviewFor(save, entrant, won) {
  if (!entrant) return null
  const pool = won ? EVO_WIN_LINES : EVO_LOSS_LINES
  const lines = [choice(pool)]
  if (chance(0.6)) lines.push(choice(EVO_SOUNDBITES))
  // One of yours gets to sound like themselves rather than like a press release.
  if (entrant.kind === 'arcade' && entrant.ref) {
    const own = speak(entrant.ref, won ? 'ggWin' : 'ggLossGood', { self: entrant.name })
    if (own) lines.push(own)
  }
  return { name: entrant.name, kind: entrant.kind, won, lines }
}

// Distribute a field into `count` pools, snake-seeded by elo so each pool is
// balanced (best player to pool 0, next to pool 1, … then back).
// ---------- EVO pools ----------

/**
 * The world major. 64 entrants, sixteen pools of four, one out of each — which
 * is what makes pools mean anything. The old shape put 24 people into four
 * pools and advanced sixteen of them, so qualifying was very nearly automatic.
 */
export const EVO_FIELD = 64
export const EVO_POOL_SIZE = 4
export const EVO_POOLS = EVO_FIELD / EVO_POOL_SIZE // 16 — a 4×4 grid

/**
 * A pool table, in the shape a group stage is always drawn in: played, won,
 * lost, games for and against, and points.
 *
 * Sets have no draws, so `D` is always zero — it is carried anyway because the
 * table reads as a group table and a missing column reads as a mistake.
 *
 * Ties break the way the fight does: points, then game differential (how many
 * games you took off people — the stocks), then games won, then how much
 * HEALTH you had left across the pool. Two players who both went 2–1 are
 * separated by how close their losses were, which is exactly the argument the
 * room would have.
 */
function poolStandings(entrants, matches) {
  const row = new Map(entrants.map((e) => [e.id, {
    entrant: e, mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, hp: 0, form: [],
  }]))
  for (const m of matches) {
    const a = row.get(m.aId)
    const b = row.get(m.bId)
    if (!a || !b) continue
    const target = m.ftTarget ?? 2
    const lg = m.setLoserGames ?? 0
    const aWon = m.winnerId === m.aId
    const win = aWon ? a : b
    const lose = aWon ? b : a
    win.mp++; lose.mp++
    win.w++; lose.l++
    win.gf += target; win.ga += lg
    lose.gf += lg; lose.ga += target
    win.form.push('w'); lose.form.push('l')
    // Health left at the final bell, from the last HUD snapshot of the set.
    const last = (m.narrationHud || []).filter(Boolean).at(-1)
    if (last) {
      a.hp += Math.max(0, last.hpA || 0)
      b.hp += Math.max(0, last.hpB || 0)
    }
  }
  return [...row.values()]
    .map((r) => ({ ...r, gd: r.gf - r.ga, pts: r.w * 3 + r.d }))
    .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || y.hp - x.hp
      || (y.entrant.ref.elo || 0) - (x.entrant.ref.elo || 0))
}

/**
 * A four-player round robin: three rounds, two matches a round, everybody
 * plays everybody. Returned round by round so the UI can walk it.
 */
function runPool(save, entrants, letter) {
  const [p1, p2, p3, p4] = entrants
  const pairings = [
    [[p1, p2], [p3, p4]],
    [[p1, p3], [p2, p4]],
    [[p1, p4], [p2, p3]],
  ]
  const rounds = []
  const all = []
  for (let r = 0; r < pairings.length; r++) {
    const matches = []
    for (const [a, b] of pairings[r]) {
      if (!a || !b) continue
      const m = resolveEntrantMatch(save, a, b, { context: 'evo', long: false })
      matches.push(m)
      all.push(m)
    }
    rounds.push({ title: `Round ${r + 1}`, matches })
  }
  const standings = poolStandings(entrants, all)
  return { letter, entrants, rounds, matches: all, standings, winner: standings[0].entrant }
}

function snakePools(entrants, count) {
  const sorted = [...entrants].sort((a, b) => (b.ref.elo || 0) - (a.ref.elo || 0))
  const pools = Array.from({ length: count }, () => [])
  let dir = 1
  let p = 0
  for (const e of sorted) {
    pools[p].push(e)
    if (dir === 1 && p === count - 1) dir = -1
    else if (dir === -1 && p === 0) dir = 1
    else p += dir
  }
  return pools
}

// The media-break day between pools and the main event: a couple of exhibition
// money matches between marquee names, plus interview soundbites. No bracket
// stakes — pure spectacle and story.
function buildMediaDay(save, advancers) {
  const rounds = []
  const storylines = []
  const marquee = [...advancers].sort((a, b) => entrantPersonality(b) - entrantPersonality(a)).slice(0, 4)
  const matches = []
  for (let i = 0; i + 1 < marquee.length; i += 2) {
    const m = resolveEntrantMatch(save, marquee[i], marquee[i + 1], { context: 'evo' })
    m.exhibition = true
    matches.push(m)
    storylines.push(`Media Day exhibition: ${marquee[i].name} vs ${marquee[i + 1].name} — a money match with nothing but pride on the line.`)
  }
  if (matches.length) rounds.push({ title: 'Media Day · Exhibitions', matches, phase: 'media' })
  for (const e of marquee.slice(0, 3)) {
    storylines.push(`${e.name} at the presser: "${choice(EVO_SOUNDBITES)}"`)
  }
  // The headline exhibition and the two people in it — the EVO screen puts a
  // camera in both their faces the moment it ends.
  const headline = matches[0] || null
  const pair = headline
    ? [marquee[0], marquee[1]].filter(Boolean)
    : []
  const expo = headline && pair.length === 2 ? {
    matchId: headline.id,
    winner: pair.find((e) => e.id === headline.winnerId) || pair[0],
    loser: pair.find((e) => e.id !== headline.winnerId) || pair[1],
  } : null
  return { rounds, storylines, expo }
}

/**
 * What it takes to be invited to the world championship.
 *
 * Turning up at your local every night is not a qualification. Glory is the
 * record of having actually WON something, so a scene that has never run a
 * bracket sends nobody — which is exactly what happens at your first EVO,
 * seven days after you open the doors.
 */
export const EVO_QUALIFY_GLORY = 20

/**
 * You qualify for EVO by being one of the best players IN THE WORLD, which is
 * exactly what the world rankings are for.
 *
 * This used to be `glory >= 20` — a local measure. Measured across 15 EVOs, it
 * sent EIGHT people every year of whom forty entries were players not ranked
 * anywhere; they averaged 3.9th of 4 in their pool and dragged the whole read
 * of the tournament down with them. Meanwhile the genuinely good ones did fine
 * (the 17–32 band averaged 2nd). The problem was never that pools are too
 * hard; it was that the arcade was sending its Tuesday regulars to the world
 * championship.
 *
 * Now: ranked, or you watch it on the stream like everybody else. That also
 * makes the World tab the thing you check to see who is going.
 */
export const evoQualifiers = (save) => {
  const ranked = new Map(rankedWorld(save).map((r) => [r.id, r.rank]))
  return Object.values(save.players)
    .filter((p) => p.isRegular && p.mainCharId && !p.retired && !p.banished)
    .filter((p) => ranked.has(p.id))
    .sort((a, b) => ranked.get(a.id) - ranked.get(b.id))
    .slice(0, 8)
}

export function runEvo(save) {
  bindRng(save)
  const qualified = evoQualifiers(save)

  // EVO WEEK. A 64-player field (your qualifiers + the world's elite) runs as:
  //  · Pools — SIXTEEN four-player round robins, one out of each. A 4×4 grid.
  //  · Media Day — the exhibition, and the words either side of it.
  //  · Top 16 — a double-elimination bracket to the Grand Finals.
  const elites = [...save.evoRoster]
    .sort((a, b) => b.elo - a.elo)
    .slice(0, EVO_FIELD - qualified.length)
  if (!elites.length) return { ok: false, reason: 'No elite field exists for EVO.' }
  const entrants = [
    ...qualified.map((p) => arcadeEntrant(save, p)),
    ...elites.map(eliteEntrant),
  ]
  const rounds = []
  const storylines = []

  // ---- Pools ----
  // Snaked by seed so the field is spread evenly: no pool of death, and your
  // qualifier is never quietly buried behind three gods.
  const grouped = snakePools(entrants, Math.min(EVO_POOLS, Math.ceil(entrants.length / EVO_POOL_SIZE)))
  const pools = grouped
    .filter((g) => g.length >= 2)
    .map((g, pi) => runPool(save, g, String.fromCharCode(65 + pi)))
  const advancers = pools.map((p) => p.winner)
  // Everyone who didn't get out of their pool, ranked, fills places 17+.
  const poolOut = pools.flatMap((p) => p.standings.slice(1).map((r) => r.entrant))
  for (const pool of pools) {
    for (const r of pool.rounds) {
      rounds.push({ title: `Pool ${pool.letter} · ${r.title}`, matches: r.matches, phase: 'pools' })
    }
  }

  // ---- Media Day ----
  const media = buildMediaDay(save, advancers)
  rounds.push(...media.rounds)
  storylines.push(...media.storylines)

  // ---- Top 16, double elimination ----
  const de = doubleElimBracket(save, advancers.slice(0, 16), { context: 'evo' })
  de.rounds.forEach((r) => rounds.push({ title: `Top 16 · ${r.title}`, matches: r.matches, phase: 'top16' }))
  const champion = de.champion

  // Overall placements: top 16 from the bracket, then the pool casualties.
  const placements = [...de.placements]
  let place = 17
  for (const e of poolOut) placements.push({ entrant: e, place: place++ })

  const arcadePlacements = placements.filter((pl) => pl.entrant.kind === 'arcade')
  for (const { entrant, place } of arcadePlacements) {
    const p = entrant.ref
    const glory = place === 1 ? 100 : place === 2 ? 60 : place <= 4 ? 40 : place <= 8 ? 25 : place <= 16 ? 12 : 5
    p.glory += glory
    p.respect += Math.round(glory / 3)
    // The world stage reignites a career — the reason they grind another year.
    bumpPassion(p, place === 1 ? 30 : place <= 4 ? 18 : place <= 8 ? 12 : 6)
    if (place <= 8) awardMilestone(save, 'evo-top8', 2, `${pName(save, p)} made EVO top 8 — the arcade is on the world map`)
    if (place <= 4) awardMilestone(save, 'evo-top4', 3, `${pName(save, p)} made EVO top 4 — nobody laughs at this scene anymore`)
    if (place === 1) {
      p.tournamentWins += 1; p.evoTitles = (p.evoTitles || 0) + 1; p.mood = 10
      // A dynasty is a STREAK of these, so the year has to be on the record.
      if (!p.npc && save.tally) save.tally.evoWinYears = [...(save.tally.evoWinYears || []), save.year]
      remember(save, p, 'evo', `WINNING EVO Year ${save.year}`)
      awardMilestone(save, `evo-champion-y${save.year}`, 8, `EVO CHAMPION, Year ${save.year} — from this arcade`)
      // The Champion Dividend: a world title out of YOUR arcade changes
      // everything — the game roars back into the conversation (golden age),
      // and the prize/sponsor money flows through the venue that made them.
      applyChampionDividend(save)
      const prize = 400 + Math.round((save.stream?.followers || 0) * 0.05)
      econLog(save, Math.min(900, prize), 'EVO champion — sponsors & pilgrimage')
    }
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
    storylines,
    revealed: 0,
    rounds: rounds.map((r) => ({ title: r.title, matches: r.matches, phase: r.phase })),
    placements: placements.slice(0, 8).map(({ entrant, place }) => ({ place, name: entrant.name, arcade: entrant.kind === 'arcade' })),
    arcadeResults: arcadePlacements.map(({ entrant, place }) => ({ place, name: entrant.name })),
    champion: champion.name,
    abrupt: false,
    entrantCount: entrants.length,
    // The pool stage as a browsable thing: sixteen tables the player can open,
    // round by round, rather than a flat list of 96 matches.
    pools: pools.map((p) => ({
      letter: p.letter,
      // Seed order, so the grid can list a pool before it has been played
      // without the running order quietly spoiling who wins it.
      entrants: p.entrants.map((e) => ({ id: e.id, name: e.name, kind: e.kind })),
      rounds: p.rounds.map((r) => ({ title: r.title, matchIds: r.matches.map((m) => m.id) })),
      standings: p.standings.map((r) => ({
        id: r.entrant.id,
        name: r.entrant.name,
        kind: r.entrant.kind,
        charId: r.entrant.charId || null,
        mp: r.mp, w: r.w, d: r.d, l: r.l, gf: r.gf, ga: r.ga, gd: r.gd, pts: r.pts,
        hp: Math.round(r.hp), form: r.form,
      })),
      winnerId: p.winner.id,
    })),
    seeds: advancers.map((e, i) => ({ seed: i + 1, id: e.id, name: e.name, kind: e.kind })),
    // Everything the EVO broadcast says between the matches, baked now so a
    // replay plays back word for word.
    talk: buildEvoTalk(save, {
      seeds: advancers.map((e, i) => ({ seed: i + 1, id: e.id, name: e.name, kind: e.kind })),
      favourite: [...advancers].sort((a, b) => (b.ref.elo || 0) - (a.ref.elo || 0))[0]?.name || 'the top seed',
    }),
    expo: media.expo ? {
      matchId: media.expo.matchId,
      winner: interviewFor(save, media.expo.winner, true),
      loser: interviewFor(save, media.expo.loser, false),
    } : null,
    championInterview: interviewFor(save, champion, true),
  }
  decorateStreamStats(save, record)
  updateFeedFromTournament(save, record)
  applyTournamentMess(save, { type: 'singles', format: 'doubleelim', size: 16 })
  // Roll the broadcast. The whole tournament is already decided; this is the
  // cursor the EVO screen walks through it with.
  save.evoWeek = { step: 'intro', poolRound: 0, openPool: null, watched: [] }
  // The year you send nobody is the year the goal gets set. Say so, plainly.
  if (!qualified.length) {
    chronicle(save, '📺', `EVO ${save.year} came and went and nobody from ${save.arcade.name} was in it. ${champion.name} took the title.`)
  }
  save.hallOfFame.push(summaryOf(record))
  save.lastTournament = record
  pushVod(save, record) // same object reference → shared reveal cursor
  return { ok: true, record }
}

// ---------- Match-by-match reveal ----------
// A tournament record is fully simulated up front but plays back one match at
// a time via its `revealed` cursor (used by the Tournament/VOD screens AND by
// idle mode's live-in-the-arcade broadcast). These are the shared helpers so
// every surface computes the reveal identically.

// Flatten a bracket into broadcast order (round by round, byes included).
export function flattenBracket(record) {
  const flat = []
  record.rounds.forEach((round, ri) => {
    round.matches.forEach((m) => flat.push({ m, ri, offScreen: !!round.offScreen }))
  })
  return flat
}

/**
 * The reveal state for a record's current `revealed` cursor: byes air
 * instantly, and hitting an off-screen round (EVO after the last arcade player
 * is out) ends the broadcast. Returns { flat, revealedCount, done }.
 */
export function revealState(record) {
  const flat = flattenBracket(record)
  let cursor = Math.min(record.revealed ?? 0, flat.length)
  while (cursor < flat.length && flat[cursor].m.bye) cursor++
  const broadcastEnded = cursor < flat.length && flat[cursor].offScreen
  const revealedCount = broadcastEnded ? flat.length : cursor
  return { flat, revealedCount, done: revealedCount >= flat.length }
}

/**
 * Push the reveal cursor forward by one REAL match (skipping byes so a single
 * tick always surfaces something worth watching). Mutates record.revealed.
 */
export function revealNextMatch(record) {
  const flat = flattenBracket(record)
  let r = (record.revealed ?? 0) + 1
  while (r < flat.length && flat[r - 1]?.m.bye) r++
  record.revealed = Math.min(r, flat.length)
  return record
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

/**
 * The state of the room after a bracket night.
 *
 * Cleanliness is already an attendance multiplier and already summons the
 * health inspector under 30, so this doesn't need a new system — a big event
 * simply spends the thing a busy arcade was already short of. It is why a
 * packed calendar quietly demands staff.
 */
function applyTournamentMess(save, entry) {
  if (!save.arcade || !entry) return
  const mess = tournamentMess(entry)
  save.arcade.cleanliness = clamp((save.arcade.cleanliness ?? 80) - mess, 0, 100)
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
    format: record.format || null, // achievements ask what shape it was
  }
}
