// THE CIRCUIT — the world's competitive calendar (REVISION §0, P4).
//
// Before this, the world had exactly one date: EVO. Everything else your
// players could aspire to was a generic away event invented on a cadence.
// This file replaces that with the real thing — a fixed annual circuit the
// whole planet runs on, whether or not your room is ready for any of it:
//
//   Jan 15   Winter Major        invitational, 16, double elim
//   Feb 8    Squad Showdown      eight crews, survivor format (lunar new year)
//   Mar 15   Spring Qualifier    32, single elim, belief-gated self-entry
//   Apr 15   Spring Major
//   May 15   Regionals           top 16 of your 64-deep national board
//   Jun 22   EVO                 (tournament.js — unchanged, still the summit)
//   Sep 15   Autumn Qualifier
//   Oct 15   Autumn Major
//   Nov 22   Regionals
//   Dec 15   Winter Qualifier    → feeds NEXT year's Winter Major
//
// Every date is a Sunday (day 1 is a Sunday and 28-day months keep the week
// aligned, so day ≡ 1 mod 7 is a Sunday forever). The circuit owns its
// Sundays: a local weekly scheduled against one simply doesn't run that week.
//
// For the first two years your players mostly do not get in, and majors are
// something you WATCH. That is the mythology engine working as intended. The
// rung that makes the middle of the climb real is the regional board: your
// country's own top 64, strong in proportion to how much scene your country
// actually has — which is what makes your address a run-shaping fact rather
// than a flag on a profile.

import { uid, rand, randInt, clamp, displayName } from './util.js'
import { bindRng } from './rng.js'
import { formatDay, absDayOf } from './constants.js'
import { WORLD_COUNTRIES, countryName } from './geo.js'
import { arcadeCountryOf, makeRegionalCompetitor } from './generate.js'
import { rankedInTop } from './world.js'
import {
  arcadeEntrant, eliteEntrant, resolveEntrantMatch, runBracket, doubleElimBracket,
  roundName, decorateStreamStats, summaryOf, stampRanked,
} from './tournament.js'
import { chronicle, remember, pushVod, awardMilestone } from './model.js'
import { econLog } from './economy.js'
import { writeJournal } from './journal.js'
import { pushToast } from './notify.js'
import { bumpPassion } from './career.js'
import { eliminationWound } from './eureka.js'
import { updateFeedFromTournament } from './socialmedia.js'
import { personalityOf, elitePersonality } from './stream.js'
import { eliteFragment } from './fragments.js'

const pName = (save, p) => displayName(p, save)

/**
 * A regional-board name in a bracket. Same wrapper as an elite — flag in the
 * name, skill+elo resolution — but a DISTINCT kind, because beating one is a
 * good Saturday, not "a name off the world list": the eliteWin journal, the
 * toast and metric 2 must all stay deaf to these.
 */
function rcEntrant(ref) {
  const e = eliteEntrant(ref)
  e.kind = 'rc'
  return e
}

const entrantOf = (kind, save, ref) =>
  kind === 'arcade' ? arcadeEntrant(save, ref) : kind === 'rc' ? rcEntrant(ref) : eliteEntrant(ref)

// ---------- The calendar itself ----------

export const CIRCUIT = [
  { key: 'winterMajor', day: 15, kind: 'major', season: 'Winter' },
  { key: 'squad', day: 36, kind: 'squad' },
  { key: 'springQual', day: 71, kind: 'qualifier', feeds: 'springMajor', season: 'Spring' },
  { key: 'springMajor', day: 99, kind: 'major', season: 'Spring' },
  { key: 'springRegional', day: 127, kind: 'regional' },
  { key: 'autumnQual', day: 239, kind: 'qualifier', feeds: 'autumnMajor', season: 'Autumn' },
  { key: 'autumnMajor', day: 267, kind: 'major', season: 'Autumn' },
  { key: 'autumnRegional', day: 302, kind: 'regional' },
  // The December qualifier feeds JANUARY — a seat won this year is a trip you
  // must still be able to afford next year. The sharpest two-hands-ahead read
  // on the whole calendar.
  { key: 'winterQual', day: 323, kind: 'qualifier', feeds: 'winterMajor', season: 'Winter' },
]

export const circuitEventOn = (dayOfYear) => CIRCUIT.find((e) => e.day === dayOfYear) || null

/** The next `n` circuit dates from a given absolute day, with years resolved. */
export function upcomingCircuit(save, n = 3) {
  const abs = absDayOf(save.day, save.year)
  const out = []
  for (let y = save.year; out.length < n + CIRCUIT.length; y++) {
    for (const def of CIRCUIT) {
      const startAbs = absDayOf(def.day, y)
      if (startAbs > abs) out.push({ def, year: y, startAbs })
    }
  }
  return out.sort((a, b) => a.startAbs - b.startAbs).slice(0, n)
}

/** Which year's major a qualifier feeds (December's feeds January). */
export const feedsYear = (def, year) =>
  def.feeds && CIRCUIT.find((e) => e.key === def.feeds).day < def.day ? year + 1 : year

// ---------- Circuit state on the save ----------

function newCircuitState() {
  return {
    field: null, // the regional board's generated names (rc_*), persistent
    hosts: {}, // year → {winterMajor, springMajor, autumnMajor, squad}
    seats: {}, // `${majorKey}:${year}` → [{id, kind, via}] from the qualifier
  }
}

export const circuitState = (save) => (save.circuit ??= newCircuitState())

// ---------- Region strength, hosts, and the world's pecking order ----------

const countryWeight = (code) => WORLD_COUNTRIES.find((c) => c.code === code)?.weight ?? 0.05

/**
 * How strong each country's scene is RIGHT NOW: the sum of its four best
 * ranked players. Your cast counts toward your own country — a decade of
 * champions built in a small scene drags the whole region up this table,
 * which is what buys it hosting rights and major seats (§0: region is
 * run-shaping, and you can reshape it).
 */
export function regionStrength(save) {
  const byRegion = new Map()
  const add = (code, elo) => {
    if (!byRegion.has(code)) byRegion.set(code, [])
    byRegion.get(code).push(elo)
  }
  for (const e of save.evoRoster || []) add(e.region, e.elo || 0)
  const home = arcadeCountryOf(save)
  for (const p of Object.values(save.players || {})) {
    if (!p.npc && !p.retired && !p.banished) add(home, p.elo || 0)
  }
  return [...byRegion.entries()]
    .map(([code, elos]) => ({
      code,
      score: elos.sort((a, b) => b - a).slice(0, 4).reduce((s, e) => s + e, 0),
    }))
    .sort((a, b) => b.score - a.score || (a.code < b.code ? -1 : 1))
}

/**
 * Where this year's majors are held: three different cities, rotating through
 * the eight strongest scenes so the circuit moves around the world instead of
 * living in one country. Decided once per year and remembered, because a
 * booked venue doesn't re-decide itself when the rankings wobble.
 */
export function hostsForYear(save, year) {
  const c = circuitState(save)
  if (c.hosts[year]) return c.hosts[year]
  const strong = regionStrength(save).slice(0, 8).map((r) => r.code)
  while (strong.length < 4) strong.push('US') // a degenerate world still books venues
  const at = (i) => strong[((year - 1) * 3 + i) % strong.length]
  c.hosts[year] = {
    winterMajor: at(0),
    springMajor: at(1),
    autumnMajor: at(2),
    squad: strong[(year - 1) % strong.length],
  }
  return c.hosts[year]
}

/** Where a circuit occurrence happens, as a country code. */
export function hostOf(save, def, year) {
  if (def.kind === 'regional') return arcadeCountryOf(save)
  if (def.kind === 'squad') return hostsForYear(save, year).squad
  const majorKey = def.feeds || def.key
  return hostsForYear(save, feedsYear(def, year))[majorKey]
}

/** The event's display name — calendar-plain on purpose; the date is the myth. */
export function circuitEventName(save, def, year) {
  const place = countryName(hostOf(save, def, year))
  if (def.kind === 'regional') return `Regionals · ${place}`
  if (def.kind === 'squad') return `Squad Showdown · ${place}`
  if (def.kind === 'qualifier') return `${def.season} Qualifier · ${place}`
  return `${def.season} Major · ${place}`
}

// ---------- The regional board — the missing rung ----------

export const REGIONAL_CUT = 16 // top 16 of the board make the regional
const REGIONAL_FIELD_SIZE = 56 // + your country's elites + your cast ≈ 64 deep

/**
 * How strong the generated national field is: proportional to how much scene
 * your country actually has. A powerhouse board's top rivals the world's
 * contender tail; a long-tail board is winnable in year two — and either way
 * it is an OPEN elo pool, which a sealed room desperately needs (§2.6).
 */
const REGIONAL_BANDS = {
  strong: { skill: [34, 66], elo: [1360, 1800] },
  mid: { skill: [29, 58], elo: [1300, 1690] },
  tail: { skill: [24, 50], elo: [1250, 1570] },
}

export function ensureRegionalField(save) {
  const c = circuitState(save)
  if (!c.field) {
    const home = arcadeCountryOf(save)
    const w = countryWeight(home)
    const band = REGIONAL_BANDS[w >= 6 ? 'strong' : w >= 1 ? 'mid' : 'tail']
    const usedAliases = new Set((save.evoRoster || []).map((e) => e.alias))
    c.field = Array.from({ length: REGIONAL_FIELD_SIZE }, () =>
      makeRegionalCompetitor(save, { country: home, band, usedAliases }))
  }
  return c.field
}

/**
 * The national board, ranked: the generated field, your country's own world
 * elites (they are regional players too — and beating one at Regionals counts
 * for exactly what it sounds like), and your cast. One ladder, like the world
 * list, but one your players can actually appear on in year two.
 *
 * READ-ONLY on purpose: generating the field draws from the save's rng
 * stream, and this is called from renders (the World tab). The engine owns
 * creation — travelDaily calls ensureRegionalField on the universal tick —
 * so a user who opens a tab early can never fork the stream (the P3 lesson,
 * twice-learned).
 */
export function regionalRankings(save) {
  const home = arcadeCountryOf(save)
  const rows = [
    ...(save.circuit?.field || []).map((r) => ({ id: r.id, kind: 'rc', name: r.alias, elo: Math.round(r.elo), skill: Math.round(r.skill), charId: r.mainCharId, ref: r, yours: false })),
    ...(save.evoRoster || []).filter((e) => e.region === home)
      .map((e) => ({ id: e.id, kind: 'elite', name: e.alias, elo: Math.round(e.elo), skill: Math.round(e.skill), charId: e.mainCharId, ref: e, yours: false })),
    ...Object.values(save.players || {})
      .filter((p) => !p.npc && !p.banished && !p.retired)
      .map((p) => ({ id: p.id, kind: 'yours', name: p.alias || `${p.firstName} ${p.lastName}`, elo: Math.round(p.elo), skill: Math.round(Math.max(0, ...Object.values(p.charSkill || {}), 0)), charId: p.mainCharId, ref: p, yours: true })),
  ]
  return rows
    .sort((a, b) => b.elo - a.elo || b.skill - a.skill)
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

/** Where one of yours sits on the national board, or null. */
export function regionalRankOf(save, playerId) {
  const row = regionalRankings(save).find((r) => r.id === playerId)
  return row ? row.rank : null
}

/**
 * Yearly drift for the national field, called at the year rollover alongside
 * driftEvoRoster: regress toward the band (the board must not be worn down
 * permanently by your cast farming it), plus a little churn — a few names
 * quit the grind and a few new ones enter.
 */
export function driftRegionalField(save) {
  const c = save.circuit
  if (!c?.field) return
  const home = arcadeCountryOf(save)
  const w = countryWeight(home)
  const band = REGIONAL_BANDS[w >= 6 ? 'strong' : w >= 1 ? 'mid' : 'tail']
  const midSkill = (band.skill[0] + band.skill[1]) / 2
  const midElo = (band.elo[0] + band.elo[1]) / 2
  for (const r of c.field) {
    r.skill = clamp(Math.round(r.skill + (midSkill - r.skill) * 0.25 + randInt(-3, 3)), 15, 90)
    r.elo = Math.max(1150, Math.round(r.elo + (midElo - r.elo) * 0.25 + randInt(-35, 45)))
  }
  const usedAliases = new Set([...(save.evoRoster || []).map((e) => e.alias), ...c.field.map((r) => r.alias)])
  const byElo = [...c.field].sort((a, b) => a.elo - b.elo)
  for (const leaving of byElo.slice(0, randInt(3, 5))) {
    const i = c.field.indexOf(leaving)
    if (i >= 0) c.field[i] = makeRegionalCompetitor(save, { country: home, band, usedAliases })
  }
  // Seats and hosts from finished years are dead weight; keep this year's and
  // next (a December qualifier's seats point at January).
  for (const k of Object.keys(c.seats)) {
    if (Number(k.split(':')[1]) < save.year) delete c.seats[k]
  }
  for (const y of Object.keys(c.hosts)) {
    if (Number(y) < save.year) delete c.hosts[y]
  }
}

// ---------- Who is funded to be there ----------

const fundedCast = (save, def, year) => (save.travel?.asks || [])
  .filter((a) => a.eventKey === def.key && a.eventYear === year && a.state === 'funded')
  .map((a) => save.players[a.playerId])
  .filter((p) => p && !p.retired && !p.banished && p.mainCharId)

// ---------- Shared record plumbing ----------

function finishRecord(save, record) {
  decorateStreamStats(save, record)
  updateFeedFromTournament(save, record)
  save.hallOfFame.push(summaryOf(record))
  save.lastTournament = record
  pushVod(save, record)
  return { ok: true, record }
}

/**
 * The road-trip wound and page, shared by every circuit event a cast member
 * attends: deep runs write awayPlaced, early exits write awayOut, and going
 * out with belief in hand is the §1.10 elimination wound at the right stage.
 */
function castAftermath(save, placements, opts) {
  const { name, glory, prize, stage, believedAt = 40 } = opts
  for (const { entrant, place } of placements) {
    if (entrant.kind !== 'arcade') continue
    const p = entrant.ref
    const g = glory(place)
    p.glory += g
    p.respect += Math.ceil(g / 3)
    bumpPassion(p, place === 1 ? 14 : place === 2 ? 8 : place <= 4 ? 5 : 2)
    const money = prize(place)
    if (money > 0) econLog(save, money, `${pName(save, p)} placed at ${name} — prize`)
    if (place === 1) {
      p.tournamentWins += 1
      p.mood = clamp(p.mood + 2, 0, 10)
      remember(save, p, 'tournament', `winning ${name} (Year ${save.year})`)
    }
    const placeLabel = place === 1 ? 'won it' : place === 2 ? 'took second'
      : place <= 4 ? 'made the final four' : place <= 8 ? 'made top eight' : `went out ${place <= 16 ? 'in the bracket' : 'early'}`
    if (place > 2 && p.eureka && (p.belief ?? 0) >= believedAt) {
      eliminationWound(save, p, {
        believed: true,
        late: place <= 4,
        favored: (p.belief ?? 0) >= 60 && place > 4,
        stage,
      })
    }
    // A LANDMARK, OR THE WEEK'S BUDGET (P6). This wrote `always: true` for
    // every cast member at every one of the circuit's ten annual dates, which
    // is a large part of why metric 7 ran to 26–43 entries a year against a
    // 15–30 band — "it must not become a log file" (§2.3). A deep run, or any
    // day at a major, is a page a career is judged by and still bypasses the
    // budget. Going out early at a qualifier is a Tuesday, and now competes
    // for space like one.
    const landmark = place <= 4 || stage === 'evo'
    // P6 made the routine exits compete for the weekly budget instead of
    // bypassing it — but competing still means usually winning, because a
    // circuit week is otherwise quiet. An early exit at a regional is not a
    // page at all: the elimination WOUND already fired, which is the part
    // that matters, and §2.3's band is what stops a diary becoming a log.
    if (landmark) {
      writeJournal(save, p, place <= 4 ? 'awayPlaced' : 'awayOut', {
        event: name, place: placeLabel, always: true,
      })
    } else if (place <= 8) {
      writeJournal(save, p, 'awayOut', { event: name, place: placeLabel })
    }
  }
}

// ---------- Regionals — twice a year, top 16 of the board ----------

export function runRegional(save, def) {
  bindRng(save)
  const year = save.year
  const name = circuitEventName(save, def, year)
  const rows = regionalRankings(save)
  // A funded trip is a chair, full stop — the board seeds them wherever their
  // elo says. Your unfunded top-16 player stays home and the next name on the
  // board slides up. The country's world-ranked names hold board spots but
  // only SOMETIMES show up — they have a world calendar to run, and a
  // regional pays them nothing — so the national title is usually contested
  // by the board itself, with an occasional god in the room to ruin a year.
  const entry = castEntryReport(save, def, year)
  const field = fundedCast(save, def, year).map((p) => arcadeEntrant(save, p))
  // Who the board sent, and who couldn't be bothered — recorded so the screen
  // can answer "why is a world name in a national bracket, and why aren't the
  // other three" without the player having to infer it from a coin flip.
  const skippedElites = []
  for (const r of rows) {
    if (field.length >= REGIONAL_CUT) break
    if (r.yours || !r.ref.mainCharId) continue
    if (r.kind === 'elite' && rand() >= 0.25) { skippedElites.push(r.name); continue }
    field.push(r.kind === 'elite' ? eliteEntrant(r.ref) : rcEntrant(r.ref))
  }
  const storylines = [`The national top ${REGIONAL_CUT}, under one roof. Winner takes the season.`]
  if (skippedElites.length) {
    storylines.push(`${skippedElites.slice(0, 3).join(', ')}${skippedElites.length > 3 ? ` and ${skippedElites.length - 3} more` : ''} hold board spots and didn't travel for it — a regional pays a world-ranked player nothing.`)
  }
  stampRanked(save, field)
  const { rounds, placements, champion } = doubleElimBracket(save, field, { context: 'tournament' })

  castAftermath(save, placements, {
    name,
    glory: (place) => (place === 1 ? 25 : place === 2 ? 14 : place <= 4 ? 8 : 4),
    prize: (place) => (place === 1 ? 100 : place === 2 ? 50 : place <= 4 ? 25 : 0),
    stage: 'tournament',
  })
  const castTop = placements.find((pl) => pl.entrant.kind === 'arcade')
  if (champion.kind === 'arcade') {
    awardMilestone(save, 'regional-champion', 3, `${champion.name} is the national champion — ${name}, Year ${year}`)
    chronicle(save, '🗺', `${champion.name} won ${name}. The best in the country trains in YOUR room.`)
  } else if (castTop && castTop.place <= 4) {
    chronicle(save, '🗺', `${castTop.entrant.name} made the final four at ${name}. The country knows the arcade's name now.`)
  } else if (castTop) {
    chronicle(save, '🗺', `${champion.name} won ${name}; ${castTop.entrant.name} went out ${castTop.place <= 8 ? 'top 8' : 'early'}.`)
  }
  announceEntry(save, def, name, entry)

  const record = {
    id: uid('t'),
    type: 'circuit',
    circuitKind: 'regional',
    format: 'doubleelim',
    name,
    host: hostOf(save, def, year),
    entry,
    day: save.day, year, dateLabel: formatDay(save.day, year),
    storylines,
    revealed: 0,
    rounds: rounds.map((r) => ({ title: r.title, matches: r.matches })),
    placements: placements.slice(0, 8).map(({ entrant, place }) => ({ place, name: entrant.name, arcade: entrant.kind === 'arcade' })),
    arcadeResults: placements.filter((pl) => pl.entrant.kind === 'arcade').map(({ entrant, place }) => ({ place, name: entrant.name })),
    champion: champion.name,
    entrantCount: field.length,
  }
  return finishRecord(save, record)
}

// ---------- Qualifiers — 32, single elim, and the vote ----------

export const QUALIFIER_BELIEF = 40 // self-entry is a claim about yourself
export const QUALIFIER_FIELD = 32

/**
 * Who the vote loves: the two fan-favourite seats are personality and
 * visibility made into competitive access — the whole reason the streaming
 * systems exist (§0). An arcade player the channel has been putting on
 * camera carries that into the vote.
 */
function voteScore(save, entrant) {
  if (entrant.kind === 'arcade') {
    const p = entrant.ref
    const streamed = (save.stream?.recentStreamedIds || []).some((s) => s.id === p.id)
    return personalityOf(p) * 55 + (p.popularity || 0) * 0.6 + (streamed ? 30 : 0) + rand() * 25
  }
  return elitePersonality(entrant.ref) * 60 + (entrant.ref.tier === 'god' || entrant.ref.tier === 'legend' ? 15 : 0) + rand() * 25
}

export function runQualifier(save, def) {
  bindRng(save)
  const year = save.year
  const name = circuitEventName(save, def, year)
  const majorYear = feedsYear(def, year)
  const seatsKey = `${def.feeds}:${majorYear}`

  // The field: your funded believers, a DOZEN of the world list's hungry
  // middle (the top doesn't qualify — it gets invited — and the tail can't
  // all afford the trip either), and regional-board names making the same
  // bet your players are. Density matters: a qualifier where every round-one
  // draw is a world name isn't a door, it's a wall.
  const entry = castEntryReport(save, def, year)
  const entrants = fundedCast(save, def, year).map((p) => arcadeEntrant(save, p))
  const invited = new Set(rankedInvitables(save).slice(0, 14).map((e) => e.id))
  const hungry = [...(save.evoRoster || [])]
    .filter((e) => e.mainCharId && !invited.has(e.id))
    .sort((a, b) => b.elo - a.elo)
  let eliteSeats = 0
  for (const e of hungry) {
    if (eliteSeats >= 12 || entrants.length >= QUALIFIER_FIELD - 8) break
    if (rand() >= 0.55) continue
    entrants.push(eliteEntrant(e))
    eliteSeats += 1
  }
  for (const r of regionalRankings(save)) {
    if (entrants.length >= QUALIFIER_FIELD) break
    if (r.kind !== 'rc' || !r.ref.mainCharId) continue
    entrants.push(rcEntrant(r.ref))
  }

  const storylines = [`Thirty-two names, four seats at the ${def.season} Major: two by the bracket, two by the crowd.`]
  const { rounds, placements, champion } = runBracket(save, stampRanked(save, entrants.slice(0, QUALIFIER_FIELD)), { context: 'tournament' })

  // The bracket's two seats…
  const seats = []
  for (const { entrant, place } of placements) {
    if (seats.length >= 2) break
    if (place <= 2) seats.push({ id: entrant.id, kind: entrant.kind, via: 'bracket' })
  }
  // …and the crowd's two. Anyone not already seated is on the ballot — going
  // two-and-out with a face the stream loves is still a road to the major.
  const seated = new Set(seats.map((s) => s.id))
  const ballot = placements
    .filter((pl) => !seated.has(pl.entrant.id))
    .map((pl) => ({ entrant: pl.entrant, votes: voteScore(save, pl.entrant) }))
    .sort((a, b) => b.votes - a.votes)
  for (const { entrant } of ballot.slice(0, 2)) {
    seats.push({ id: entrant.id, kind: entrant.kind, via: 'vote' })
  }
  circuitState(save).seats[seatsKey] = seats

  // What a seat means to one of yours: the page, the toast, the belief.
  for (const seat of seats) {
    const entrant = placements.find((pl) => pl.entrant.id === seat.id)?.entrant
    if (!entrant || entrant.kind !== 'arcade') continue
    const p = entrant.ref
    p.belief = clamp((p.belief ?? 0) + 6, 0, 100)
    p.glory += seat.via === 'bracket' ? 10 : 7
    bumpPassion(p, 10)
    writeJournal(save, p, seat.via === 'bracket' ? 'seatWon' : 'fanFavourite', {
      event: `the ${def.season} Major`, always: true,
    })
    pushToast(save, {
      icon: seat.via === 'bracket' ? '🎫' : '📣',
      text: seat.via === 'bracket'
        ? `${entrant.name} QUALIFIED for the ${def.season} Major.`
        : `The vote is in: ${entrant.name} is going to the ${def.season} Major as a fan favourite.`,
      see: { screen: 'players' },
    })
    chronicle(save, seat.via === 'bracket' ? '🎫' : '📣', seat.via === 'bracket'
      ? `${entrant.name} punched their ticket to the ${def.season} Major at ${name}.`
      : `The crowd voted ${entrant.name} into the ${def.season} Major. Personality is access.`)
  }
  const voteNames = ballot.slice(0, 2).map((b) => b.entrant.name)
  storylines.push(`Seats: ${placements.find((pl) => pl.place === 1)?.entrant.name} and ${placements.find((pl) => pl.place === 2)?.entrant.name} by right; ${voteNames.join(' and ')} by acclaim.`)

  castAftermath(save, placements, {
    name,
    glory: (place) => (place === 1 ? 15 : place === 2 ? 8 : place <= 4 ? 5 : 2),
    prize: (place) => (place === 1 ? 80 : place === 2 ? 40 : 0),
    stage: 'tournament',
    believedAt: QUALIFIER_BELIEF,
  })
  announceEntry(save, def, name, entry)

  // WHAT THE QUALIFIER WAS FOR, WRITTEN DOWN. A qualifier is thirty-two names
  // playing for four chairs three months from now, and nothing carried that
  // forward: the seats went into `circuit.seats` — engine state nobody can
  // read — and the connection to the major was left for the player to hold in
  // their head across a whole season. This is the boarding pass, on the record,
  // where the VOD and the major's own splash can both find it.
  const majorDef = CIRCUIT.find((e) => e.key === def.feeds)
  const seatList = seats.map((s) => {
    const entrant = placements.find((pl) => pl.entrant.id === s.id)?.entrant
    return {
      name: entrant?.name || '—',
      via: s.via,
      yours: entrant?.kind === 'arcade',
      place: placements.find((pl) => pl.entrant.id === s.id)?.place ?? null,
    }
  })
  const qualifiedFor = {
    majorKey: def.feeds,
    majorYear,
    majorName: majorDef ? circuitEventName(save, majorDef, majorYear) : `the ${def.season} Major`,
    daysAway: absDayOf(majorDef?.day ?? def.day, majorYear) - absDayOf(save.day, year),
    seats: seatList,
  }

  const record = {
    id: uid('t'),
    type: 'circuit',
    circuitKind: 'qualifier',
    format: 'single',
    name,
    host: hostOf(save, def, year),
    entry,
    qualifiedFor,
    day: save.day, year, dateLabel: formatDay(save.day, year),
    storylines,
    revealed: 0,
    rounds: rounds.map((r, i) => ({ title: roundName(i, rounds.length), matches: r })),
    placements: placements.slice(0, 8).map(({ entrant, place }) => ({ place, name: entrant.name, arcade: entrant.kind === 'arcade' })),
    arcadeResults: placements.filter((pl) => pl.entrant.kind === 'arcade').map(({ entrant, place }) => ({ place, name: entrant.name })),
    champion: champion.name,
    entrantCount: Math.min(entrants.length, QUALIFIER_FIELD),
  }
  return finishRecord(save, record)
}

// ---------- Majors — sixteen chairs, three cities, and the vote's payoff ----------

/**
 * The invitational half of a major, PROJECTED: 4 seats to the host region,
 * 2 each to the next four strongest. Exposed (as a preview) so travel asks
 * can fire three weeks out for a cast member sitting in a seat.
 */
export function projectedMajorField(save, def, year) {
  const majorYear = feedsYear(def, year)
  const host = hostOf(save, def, year)
  const strong = regionStrength(save).map((r) => r.code).filter((c) => c !== host)
  const regions = [[host, 4], ...strong.slice(0, 4).map((c) => [c, 2])]
  const home = arcadeCountryOf(save)
  const taken = new Set()
  const picks = [] // {id, kind, ref, region}
  for (const [code, n] of regions) {
    const candidates = code === home
      ? regionalRankings(save).filter((r) => r.ref.mainCharId)
      : (save.evoRoster || []).filter((e) => e.region === code && e.mainCharId)
        .sort((a, b) => b.elo - a.elo)
        .map((e) => ({ id: e.id, kind: 'elite', ref: e, yours: false }))
    let placed = 0
    for (const cand of candidates) {
      if (placed >= n) break
      if (taken.has(cand.id)) continue
      taken.add(cand.id)
      picks.push({ id: cand.id, kind: cand.yours ? 'arcade' : cand.kind, ref: cand.ref, region: code })
      placed += 1
    }
  }
  // Qualifier seats ride on top of the invitational twelve.
  const seats = circuitState(save).seats[`${def.key}:${majorYear}`] || []
  return { picks, seats, host }
}

export function runMajor(save, def) {
  bindRng(save)
  const year = save.year
  const name = circuitEventName(save, def, year)
  const { picks, seats } = projectedMajorField(save, def, year)
  const entry = castEntryReport(save, def, year)
  const funded = new Set(fundedCast(save, def, year).map((p) => p.id))
  const taken = new Set()
  const entrants = []
  // HOW EACH CHAIR WAS EARNED. Sixteen names arriving with no provenance is
  // the single biggest reason a major reads as noise: four of them qualified
  // months ago at an event you watched, four are the host country's own, eight
  // are regional invitations, and nothing said which was which. Recorded per
  // entrant so the splash can lay the field out as a story about who got in.
  const via = new Map()
  const push = (kind, ref, howIn) => {
    if (!ref || taken.has(ref.id) || entrants.length >= 16) return
    taken.add(ref.id)
    via.set(ref.id, howIn)
    entrants.push(entrantOf(kind, save, ref))
  }
  // Seats first — a qualified name is in whatever the rankings say — then the
  // invitational twelve. A cast member's chair is real only if the trip was
  // funded: an unfunded seat is the year's most expensive empty chair.
  const wasted = []
  for (const seat of seats) {
    const howIn = seat.via === 'vote' ? 'vote' : 'qualified'
    if (seat.kind === 'arcade') {
      const p = save.players[seat.id]
      if (p && !p.retired && !p.banished && funded.has(p.id)) push('arcade', p, howIn)
      else if (p && !p.retired && !p.banished) wasted.push(p)
      continue
    }
    push(seat.kind, [...(save.evoRoster || []), ...(circuitState(save).field || [])].find((e) => e.id === seat.id), howIn)
  }
  for (const pick of picks) {
    if (pick.kind === 'arcade') {
      if (funded.has(pick.id)) push('arcade', pick.ref, 'region')
      continue
    }
    push(pick.kind, pick.ref, 'region')
  }
  // Backfill to sixteen from the best of the world not already in the room.
  for (const e of [...(save.evoRoster || [])].sort((a, b) => b.elo - a.elo)) {
    if (entrants.length >= 16) break
    if (e.mainCharId) push('elite', e, 'ranking')
  }

  const storylines = [`Sixteen invitations. Three cities a year. This one answered to ${name.split(' · ')[1] || 'the host'}.`]
  for (const p of wasted) {
    storylines.push(`${pName(save, p)} had a seat — and no plane ticket. The chair sat empty.`)
    chronicle(save, '🪑', `${pName(save, p)} QUALIFIED for ${name} and stayed home. The seat was won weeks ago; the fare had to still be there today.`)
  }

  stampRanked(save, entrants)
  const { rounds, placements, champion } = doubleElimBracket(save, entrants, { context: 'evo' })

  castAftermath(save, placements, {
    name,
    glory: (place) => (place === 1 ? 60 : place === 2 ? 35 : place <= 4 ? 22 : place <= 8 ? 12 : 6),
    prize: (place) => (place === 1 ? 300 : place === 2 ? 150 : place <= 4 ? 80 : place <= 8 ? 40 : 0),
    stage: 'evo',
    believedAt: 35,
  })
  const arcadePlacements = placements.filter((pl) => pl.entrant.kind === 'arcade')
  for (const { entrant, place } of arcadePlacements) {
    if (place <= 8) awardMilestone(save, 'major-top8', 2, `${entrant.name} made top 8 at a world major`)
    if (place === 1) {
      // A major title is a target on your back too (match.js targetBurden).
      entrant.ref.majorTitles = (entrant.ref.majorTitles || 0) + 1
      awardMilestone(save, `major-champion-y${year}-${def.key}`, 5, `${entrant.name} won ${name} — a world major, out of this arcade`)
      writeJournal(save, entrant.ref, 'title', { event: name, always: true })
    }
  }
  if (champion.kind === 'elite' && String(champion.id).startsWith('elite_')) {
    // A major, not EVO — counted apart so the world list can show the two
    // trophies as the two different things they are. (See runEvo's note.)
    champion.ref.majorTitles = (champion.ref.majorTitles || 0) + 1
    eliteFragment(save, champion.ref, 'championMajor', {
      char: save.game.characters.find((c) => c.id === champion.charId)?.name || 'my character',
      n: champion.ref.majorTitles,
      event: name,
    })
  }
  chronicle(save, '🏛', champion.kind === 'arcade'
    ? `${champion.name} WON ${name}. A world major. From this arcade.`
    : arcadePlacements.length
      ? `${champion.name} took ${name}; ${arcadePlacements[0].entrant.name} carried the arcade to ${arcadePlacements[0].place === 2 ? 'the grand finals' : `top ${arcadePlacements[0].place <= 4 ? 4 : arcadePlacements[0].place <= 8 ? 8 : 16}`}.`
      : `${name} came and went. ${champion.name} took it. Nobody from ${save.arcade.name} was in the room.`)
  announceEntry(save, def, name, entry)

  // The seat state is spent either way.
  delete circuitState(save).seats[`${def.key}:${feedsYear(def, year)}`]

  // The field as a card: seeded order (elo, which is exactly how the bracket
  // is drawn), each name's provenance, and the chairs that went unused.
  const seededField = [...entrants]
    .sort((a, b) => (b.ref.elo || 0) - (a.ref.elo || 0))
    .map((e, i) => ({
      seed: i + 1,
      name: e.name,
      elo: Math.round(e.ref.elo || 0),
      yours: e.kind === 'arcade',
      region: e.kind === 'arcade' ? arcadeCountryOf(save) : (e.ref.region || null),
      char: save.game.characters.find((c) => c.id === e.charId)?.name || null,
      via: via.get(e.ref.id) || 'ranking',
    }))

  const record = {
    id: uid('t'),
    type: 'circuit',
    circuitKind: 'major',
    format: 'doubleelim',
    name,
    host: hostOf(save, def, year),
    season: def.season || null,
    entry,
    field: seededField,
    emptyChairs: wasted.map((p) => pName(save, p)),
    day: save.day, year, dateLabel: formatDay(save.day, year),
    storylines,
    revealed: 0,
    rounds: rounds.map((r) => ({ title: r.title, matches: r.matches })),
    placements: placements.slice(0, 8).map(({ entrant, place }) => ({ place, name: entrant.name, arcade: entrant.kind === 'arcade' })),
    arcadeResults: arcadePlacements.map(({ entrant, place }) => ({ place, name: entrant.name })),
    champion: champion.name,
    entrantCount: entrants.length,
  }
  return finishRecord(save, record)
}

/** The world names a major can't be bothered to qualify for: its likely invitees. */
function rankedInvitables(save) {
  return [...(save.evoRoster || [])].sort((a, b) => b.elo - a.elo)
}

// ---------- Squad Showdown — eight crews, survivor format ----------

/**
 * One team match, survivor rules: a player stays on the machine until they're
 * knocked off, and the first crew with nobody left to send loses. Order is
 * weakest first, ace anchoring — the classic crew-battle shape — and staying
 * on costs you: fatigue stacks a set at a time until somebody takes you down.
 */
function survivorMatch(save, A, B) {
  const orderOf = (squad) => [...squad].sort((a, b) => (a.ref.elo || 0) - (b.ref.elo || 0))
  const a = orderOf(A.entrants)
  const b = orderOf(B.entrants)
  let ai = 0
  let bi = 0
  let streakA = 0
  let streakB = 0
  const duels = []
  while (ai < a.length && bi < b.length) {
    const m = resolveEntrantMatch(save, a[ai], b[bi], {
      long: false, context: 'evo', handicapA: streakA * 0.9, handicapB: streakB * 0.9,
    })
    // A CREW BATTLE IS FOUR SETS, NOT ONE RESULT. Each duel is already a
    // complete match object with its own narration — it just had nowhere to be
    // watched. These fields are what the playback needs to introduce it: whose
    // turn it is, how long the person on the machine has been standing there,
    // and how many bodies each side has left when it starts.
    m.seat = duels.length + 1
    m.squadA = A.name
    m.squadB = B.name
    m.streakA = streakA
    m.streakB = streakB
    m.aliveA = a.length - ai
    m.aliveB = b.length - bi
    duels.push(m)
    if (m.winnerId === a[ai].id) { bi += 1; streakA += 1; streakB = 0 }
    else { ai += 1; streakB += 1; streakA = 0 }
  }
  const aWon = bi >= b.length
  const winner = aWon ? A : B
  const left = aWon ? a.length - ai : b.length - bi
  return {
    id: uid('m'),
    bye: false,
    aName: A.name, bName: B.name,
    winnerId: winner.id, winnerName: winner.name,
    score: `${left} left standing`,
    duels,
    narration: [
      `${A.name} vs ${B.name} — survivor rules. Lose and you're done; win and you stay on.`,
      ...duels.map((d) => {
        const streak = Math.max(d.streakA, d.streakB)
        return streak >= 2
          ? `${d.aName} vs ${d.bName} — ${d.winnerName} takes it. That's ${streak + (d.winnerName === (d.streakA > d.streakB ? d.aName : d.bName) ? 1 : 0)} on the trot for somebody who should be exhausted by now.`
          : `${d.aName} vs ${d.bName} — ${d.winnerName} takes it.`
      }),
      `${winner.name} take it with ${left} ${left === 1 ? 'player' : 'players'} still alive.`,
    ],
  }
}

/** The eight crews: your arcade if it has earned the invite, then the world's. */
function showdownSquads(save) {
  const squads = []
  // The gate the P2 banner promised: a player in the world top 64 gets your
  // room a chair at the table. The trip is ONE funded ask — the ace asks for
  // the whole crew — and the crew is your best four.
  const invited = rankedInTop(save, 64).length > 0
  const squadFunded = fundedCast(save, CIRCUIT.find((d) => d.kind === 'squad'), save.year).length > 0
  if (invited && squadFunded) {
    const four = Object.values(save.players)
      .filter((p) => !p.npc && p.isRegular && !p.retired && !p.banished && p.mainCharId)
      .sort((a, b) => b.elo - a.elo)
      .slice(0, 4)
    if (four.length === 4) {
      squads.push({
        id: 'squad_yours',
        name: `Team ${save.arcade.name}`,
        yours: true,
        entrants: four.map((p) => arcadeEntrant(save, p)),
      })
    }
  }
  // The world fields national crews, strongest scenes first.
  const byRegion = new Map()
  for (const e of save.evoRoster || []) {
    if (!e.mainCharId) continue
    if (!byRegion.has(e.region)) byRegion.set(e.region, [])
    byRegion.get(e.region).push(e)
  }
  const national = [...byRegion.entries()]
    .filter(([, list]) => list.length >= 4)
    .map(([code, list]) => ({
      code,
      list: list.sort((a, b) => b.elo - a.elo).slice(0, 4),
      power: list.slice(0, 4).reduce((s, e) => s + e.elo, 0),
    }))
    .sort((a, b) => b.power - a.power)
  for (const n of national) {
    if (squads.length >= 8) break
    squads.push({
      id: `squad_${n.code}`,
      name: `Team ${countryName(n.code)}`,
      yours: false,
      entrants: n.list.map(eliteEntrant),
    })
  }
  // Small worlds still field eight: mixed crews of the best leftovers.
  const used = new Set(squads.flatMap((s) => s.entrants.map((e) => e.id)))
  const leftovers = [...(save.evoRoster || [])]
    .filter((e) => e.mainCharId && !used.has(e.id))
    .sort((a, b) => b.elo - a.elo)
  let selectN = 0
  while (squads.length < 8 && leftovers.length >= 4) {
    const four = leftovers.splice(0, 4)
    squads.push({
      id: `squad_select_${selectN}`,
      name: `World Select ${String.fromCharCode(65 + selectN++)}`,
      yours: false,
      entrants: four.map(eliteEntrant),
    })
  }
  return squads.slice(0, 8)
}

export function runSquadShowdown(save, def) {
  bindRng(save)
  const year = save.year
  const name = circuitEventName(save, def, year)
  const squads = showdownSquads(save)
  if (squads.length < 4) {
    // A world this thin can't stage it — quietly skip the year.
    chronicle(save, '🏮', `${name} was called off — the scene couldn't field the crews.`)
    return { ok: false, reason: `${name} needs at least four crews.` }
  }
  for (const s of squads) {
    s.ref = { elo: s.entrants.reduce((sum, e) => sum + (e.ref.elo || 0), 0) / s.entrants.length }
    stampRanked(save, s.entrants)
  }
  const seedOrder = [...squads].sort((a, b) => b.ref.elo - a.ref.elo)
  // Standard eight-crew bracket: 1v8, 4v5, 2v7, 3v6 — winners cross.
  const pairIdx = seedOrder.length >= 8 ? [[0, 7], [3, 4], [1, 6], [2, 5]] : [[0, 3], [1, 2]]
  let current = pairIdx.flatMap(([i, j]) => (seedOrder[i] && seedOrder[j] ? [[seedOrder[i], seedOrder[j]]] : []))
  const rounds = []
  const exitRound = new Map()
  let roundIdx = 0
  let winners = []
  while (current.length) {
    const matches = []
    winners = []
    for (const [A, B] of current) {
      const m = survivorMatch(save, A, B)
      const w = m.winnerId === A.id ? A : B
      const l = w === A ? B : A
      exitRound.set(l.id, { squad: l, round: roundIdx })
      matches.push(m)
      winners.push(w)
    }
    rounds.push({ title: winners.length === 1 ? 'Grand Finals' : winners.length === 2 ? 'Semifinals' : 'Quarterfinals', matches })
    current = []
    for (let i = 0; i + 1 < winners.length; i += 2) current.push([winners[i], winners[i + 1]])
    roundIdx += 1
    if (winners.length === 1) break
  }
  const champion = winners[0]

  const storylines = [
    'Lunar new year. Eight crews. One player stays on until they fall — first team out of bodies goes home.',
  ]
  const yours = squads.find((s) => s.yours)
  if (yours) {
    const out = exitRound.get(yours.id)
    const ran = champion === yours ? 'won the whole thing'
      : out?.round === roundIdx - 1 ? 'fell in the grand finals'
        : out?.round === 1 ? 'made the semifinals' : 'went out in the quarters'
    storylines.push(`Your crew ${ran}.`)
    for (const e of yours.entrants) {
      const p = e.ref
      const won = champion === yours
      p.glory += won ? 30 : 10
      p.respect += won ? 8 : 3
      bumpPassion(p, won ? 15 : 6)
      writeJournal(save, p, won ? 'awayPlaced' : 'awayOut', {
        event: name, place: won ? 'won it as a crew' : ran, always: true,
      })
    }
    if (champion === yours) {
      awardMilestone(save, 'squad-champion', 4, `Team ${save.arcade.name} won the Squad Showdown, Year ${year}`)
      chronicle(save, '🏮', `TEAM ${save.arcade.name.toUpperCase()} WON THE SQUAD SHOWDOWN. Four of yours against the world, and the world blinked.`)
    } else {
      chronicle(save, '🏮', `Squad Showdown, Year ${year}: your crew ${ran}; ${champion.name} took the lanterns home.`)
    }
  } else {
    chronicle(save, '🏮', `${champion.name} won the Squad Showdown. ${rankedInTop(save, 64).length ? 'Your crew stayed home — the trip was never funded.' : 'A crew of yours gets the invite the day one of them cracks the world top 64.'}`)
  }
  const entry = castEntryReport(save, def, year)
  if (!yours) announceEntry(save, def, name, entry)

  const record = {
    id: uid('t'),
    type: 'teams',
    circuitKind: 'squad',
    name,
    host: hostOf(save, def, year),
    entry,
    day: save.day, year, dateLabel: formatDay(save.day, year),
    storylines,
    revealed: 0,
    rounds,
    placements: [{ place: 1, name: champion.name }],
    arcadeResults: yours ? [{ place: champion === yours ? 1 : 2, name: yours.name }] : null,
    champion: champion.name,
    entrantCount: squads.length,
  }
  return finishRecord(save, record)
}

// ---------- The dispatcher the day loop calls ----------

export function runCircuitEvent(save, def) {
  if (def.kind === 'regional') return runRegional(save, def)
  if (def.kind === 'qualifier') return runQualifier(save, def)
  if (def.kind === 'major') return runMajor(save, def)
  return runSquadShowdown(save, def)
}

// ---------- WHAT AM I WATCHING, AND WHY ISN'T ANYONE OF MINE IN IT? ----------
//
// A major arrives, sixteen strangers play a bracket, and a stranger wins it.
// That is the mythology engine working — for the first two years you are
// SUPPOSED to be watching — but it only reads as mythology if the game says so.
// Left silent it reads as a bug: a screen full of names you have never seen,
// with no statement anywhere that your room was never eligible, or was eligible
// and you didn't pay, or entered and went out in round one.
//
// So every circuit event now carries an ENTRY REPORT: who of yours was in it,
// and for everyone who wasn't, the one sentence that says why. Each reason
// below is the negation of a specific gate in askSpecsFor/travel.js, which is
// what makes it actionable rather than a shrug — "belief 31, the qualifier
// wants 40" tells you what to do next; "nobody entered" does not.

/** What the entry rule IS, per kind — one line, for headers and empty states. */
export const ENTRY_RULE = {
  regional: `the top ${REGIONAL_CUT} of your national board are invited`,
  qualifier: `open entry to anyone with belief ${QUALIFIER_BELIEF}+ — up to four of yours ask per event`,
  major: 'invitation only: sixteen chairs, won at a qualifier or handed out by region',
  squad: 'one crew of four, invited once somebody of yours is in the world top 64',
}

/** How the bracket is ordered, per kind — the seeding question, answered. */
export const SEED_RULE = {
  regional: 'seeded strictly by elo — #1 on the board plays the lowest seed in the room',
  qualifier: 'seeded strictly by elo, single elimination: one bad set and the road ends',
  major: 'seeded strictly by elo, double elimination — there is a losers bracket',
  squad: 'crews seeded by the average elo of their four; weakest sent out first, ace anchors',
}

/**
 * Everyone of yours, and the one sentence about each. `entered` are in the
 * field; `missed` carry a `reason` that names the gate they failed.
 */
export function castEntryReport(save, def, year) {
  const cast = Object.values(save.players).filter((p) =>
    !p.npc && p.createdBy === 'user' && p.isRegular && !p.retired && !p.banished)
  const asks = (save.travel?.asks || []).filter((a) => a.eventKey === def.key && a.eventYear === year)
  const askOf = (id) => asks.find((a) => a.playerId === id) || null
  const funded = new Set(fundedCast(save, def, year).map((p) => p.id))
  const entered = []
  const missed = []

  const rows = def.kind === 'regional' || def.kind === 'major' ? regionalRankings(save) : null
  const seats = def.kind === 'major'
    ? new Set((circuitState(save).seats[`${def.key}:${feedsYear(def, year)}`] || [])
      .filter((s) => s.kind === 'arcade').map((s) => s.id))
    : null
  if (def.kind === 'major') {
    for (const pick of projectedMajorField(save, def, year).picks) {
      if (pick.kind === 'arcade') seats.add(pick.id)
    }
  }
  const topRanked = [...cast].sort((a, b) => b.elo - a.elo)

  for (const p of cast) {
    const name = pName(save, p)
    if (funded.has(p.id) && p.mainCharId) { entered.push({ id: p.id, name }); continue }
    const ask = askOf(p.id)
    // The trip was offered and refused — the most important reason of all,
    // because it is the one that was entirely yours.
    if (ask && ask.state === 'denied') {
      missed.push({ id: p.id, name, reason: `qualified, and the trip wasn't funded — $${ask.cost} you didn't have or didn't spend`, yours: true })
      continue
    }
    if (ask && ask.state === 'pending') {
      missed.push({ id: p.id, name, reason: `asked to go and never got an answer — the date arrived and the ask lapsed`, yours: true })
      continue
    }
    if (!p.mainCharId) {
      missed.push({ id: p.id, name, reason: 'still hasn’t settled on a character — nobody enters a bracket undecided' })
      continue
    }
    if (def.kind === 'regional') {
      const row = rows.find((r) => r.id === p.id)
      missed.push({
        id: p.id, name,
        reason: row
          ? `#${row.rank} on the national board — the regionals cut is the top ${REGIONAL_CUT}`
          : 'not on the national board at all yet',
      })
    } else if (def.kind === 'qualifier') {
      const belief = Math.round(p.belief ?? 0)
      missed.push({
        id: p.id, name,
        reason: belief < QUALIFIER_BELIEF
          ? `belief ${belief} — entering a qualifier is a claim about yourself, and it takes ${QUALIFIER_BELIEF}`
          : 'four of yours asked to go and they weren’t one of the four — belief and glory decide who does the asking',
      })
    } else if (def.kind === 'major') {
      missed.push({
        id: p.id, name,
        reason: seats.has(p.id)
          ? 'held a seat and never got on a plane'
          : 'no seat — a major is invitation only: win one at a qualifier, or be one of the four your region hands out',
      })
    } else {
      const inTop = rankedInTop(save, 64).length > 0
      missed.push({
        id: p.id, name,
        reason: !inTop
          ? 'the crew gets its invitation the day one of yours cracks the world top 64'
          : cast.length < 4 ? 'a crew is four people and the room hasn’t got four'
            : topRanked[0]?.id === p.id ? 'the ace asked for the whole crew and the fare wasn’t there'
              : 'the crew never got on the plane',
      })
    }
  }
  return { entered, missed, rule: ENTRY_RULE[def.kind], seeding: SEED_RULE[def.kind] }
}

/**
 * Say it out loud when a circuit date passes with nobody of yours in it. The
 * chronicle keeps the fact; the toast points at the reason, because "why was
 * that not us" is the question the screen has to be able to answer.
 */
function announceEntry(save, def, name, report) {
  if (report.entered.length) return
  // The sharpest reason wins the headline: something you decided beats
  // something the world decided.
  const yours = report.missed.find((m) => m.yours)
  const nearest = yours || report.missed[0]
  const kindWord = def.kind === 'major' ? 'major' : def.kind === 'qualifier' ? 'qualifier'
    : def.kind === 'regional' ? 'regionals' : 'Squad Showdown'
  chronicle(save, '📺', report.missed.length
    ? `${name} ran without anybody from ${save.arcade.name} in it. ${nearest.name}: ${nearest.reason}.`
    : `${name} ran without anybody from ${save.arcade.name} in it — the room has nobody eligible yet.`)
  pushToast(save, {
    icon: '📺',
    text: `Nobody of yours is in ${name} — you're watching this one. ${
      report.missed.length ? `Closest was ${nearest.name}: ${nearest.reason}.` : `Entry: ${report.rule}.`}`,
    see: { screen: 'world' },
    key: `noentry_${def.key}_${save.year}`,
  })
  return kindWord
}
