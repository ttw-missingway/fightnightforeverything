// TRAVEL — the other half of money's new job (REVISION §0). Your players ask
// to attend the circuit; the arcade foots the bill. You can say no, and often
// you simply cannot afford everyone and must choose. Cost scales with
// distance, which makes your region a standing financial fact — and the
// calendar problem is the sharpest two-hands-ahead read in the game: did you
// still have the cash in December, or did it go into a pot in September?
//
// Saying no is itself eureka fuel — "they wouldn't send me to Stockholm" is
// the §1.10 denied-funding wound (weight 4–6). Your books are visible to your
// players: refusing while broke is understood; refusing while flush is a
// betrayal. Funding is a wager — a placing recoups, an early exit is money
// burned.
//
// P4: the destinations are no longer generic away events on a cadence — every
// ask points at a REAL date on the world's calendar (circuit.js), and a funded
// player actually appears in that event's field. The ask/deny loop, the costs,
// the wager and the wounds are the same machinery P3 built; the calendar is
// what it was always waiting for.

import { clamp, uid, displayName } from './util.js'
import { absDayOf } from './constants.js'
import { trySpend } from './economy.js'
import { countryCluster, countryName } from './geo.js'
import { arcadeCountryOf } from './generate.js'
import { adversity } from './eureka.js'
import { writeJournal } from './journal.js'
import { pushToast, dismissToastByKey } from './notify.js'
import { bumpPassion } from './career.js'
import { rankedInTop } from './world.js'
import {
  upcomingCircuit, circuitEventName, hostOf, feedsYear, circuitState,
  regionalRankings, REGIONAL_CUT, projectedMajorField, QUALIFIER_BELIEF,
  ensureRegionalField, hostsForYear,
} from './circuit.js'

/**
 * What a trip is FOR, and what the fare multiplier is. The squad tier buys
 * four seats on the plane, which is why it costs like it does.
 */
export const TRAVEL_TIERS = {
  regional: { label: 'the national regionals', costMult: 1 },
  qualifier: { label: 'a major qualifier', costMult: 1.5 },
  major: { label: 'a world major', costMult: 2.5 },
  squad: { label: 'the Squad Showdown', costMult: 3.5 },
}

/** Three weeks' notice — enough time for the books to matter. */
export const TRAVEL_LEAD = 21

export function newTravelState() {
  return { asks: [], seen: {} }
}

/** Distance is a standing financial fact: your region prices every trip. */
export function travelCost(save, country, kind) {
  const home = arcadeCountryOf(save)
  const near = country === home
  const mid = !near && countryCluster(country) === countryCluster(home)
  const base = near ? 60 : mid ? 140 : 240
  return Math.round(base * (TRAVEL_TIERS[kind]?.costMult ?? 1))
}

const activeCast = (save) => Object.values(save.players)
  .filter((p) => !p.npc && p.createdBy === 'user' && p.isRegular && !p.retired && !p.banished && p.mainCharId)

/**
 * Who asks to go where. Eligibility is the event's own entry rule, read three
 * weeks early — the ask IS the calendar telling you what it will cost to be
 * the scene you claim to be building:
 *  · regionals — you're on the board's top 16; the cut is the invitation
 *  · qualifier — belief ≥ 40; self-entry is a claim about yourself
 *  · major — you hold a seat (won at the qualifier, or the region's own)
 *  · squad — the room has a world-top-64 name and four bodies for a crew
 */
function askSpecsFor(save, occ) {
  const { def, year } = occ
  const cast = activeCast(save)
  if (def.kind === 'regional') {
    const rows = regionalRankings(save)
    return cast.filter((p) => {
      const row = rows.find((r) => r.id === p.id)
      return row && row.rank <= REGIONAL_CUT
    })
  }
  if (def.kind === 'qualifier') {
    return cast
      .filter((p) => (p.belief ?? 0) >= QUALIFIER_BELIEF)
      .sort((a, b) => ((b.belief ?? 0) + b.glory / 10) - ((a.belief ?? 0) + a.glory / 10))
      .slice(0, 4)
  }
  if (def.kind === 'major') {
    const seats = circuitState(save).seats[`${def.key}:${feedsYear(def, year)}`] || []
    const seated = new Set(seats.filter((s) => s.kind === 'arcade').map((s) => s.id))
    const { picks } = projectedMajorField(save, def, year)
    for (const pick of picks) if (pick.kind === 'arcade') seated.add(pick.id)
    return cast.filter((p) => seated.has(p.id))
  }
  // squad — one ask, carried by the ace, for the whole crew.
  if (!rankedInTop(save, 64).length) return []
  const crew = [...cast].sort((a, b) => b.elo - a.elo)
  return crew.length >= 4 ? [crew[0]] : []
}

/**
 * The daily tick (advanceDay): raise asks for circuit dates entering the
 * three-week window, and let unanswered asks lapse into the soft no when the
 * date arrives. Runs AFTER the event itself on event days, so a funded ask is
 * still on the books when the runner builds its field.
 */
export function travelDaily(save) {
  const t = (save.travel ??= newTravelState())
  t.asks ??= []
  t.seen ??= {}
  // The engine mints the national board on its own tick — regionalRankings
  // itself is read-only so UI renders can never fork the rng stream.
  ensureRegionalField(save)
  // Hosts likewise: this year's and next year's cities are booked on the
  // engine's clock (they derive from current region strength, so WHEN they
  // are computed is part of the answer). By the time any screen shows an
  // upcoming event, the venue is already on the books.
  hostsForYear(save, save.year)
  hostsForYear(save, save.year + 1)
  // P3's generic-event fields, retired with the generic events themselves.
  delete t.event
  delete t.nextEventAbs
  const abs = absDayOf(save.day, save.year)

  // The date arriving answers every unanswered ask — with a no.
  for (const ask of t.asks) {
    if (ask.state === 'pending' && abs >= ask.startAbs) denyAsk(save, ask, { lapsed: true })
  }
  t.asks = t.asks.filter((a) => abs < a.startAbs)

  for (const occ of upcomingCircuit(save, 6)) {
    const lead = occ.startAbs - abs
    if (lead < 7 || lead > TRAVEL_LEAD) continue
    const seenKey = `${occ.def.key}:${occ.year}`
    if (t.seen[seenKey]) continue
    t.seen[seenKey] = true
    const country = hostOf(save, occ.def, occ.year)
    const eventName = circuitEventName(save, occ.def, occ.year)
    const cost = travelCost(save, country, occ.def.kind)
    for (const p of askSpecsFor(save, occ)) {
      const ask = {
        id: uid('ask'),
        playerId: p.id,
        eventKey: occ.def.key,
        eventYear: occ.year,
        startAbs: occ.startAbs,
        kind: occ.def.kind,
        eventName,
        country,
        cost,
        squad: occ.def.kind === 'squad' || undefined,
        state: 'pending',
      }
      t.asks.push(ask)
      // Asking to go somewhere is only a page when the somewhere is a big
      // deal — a regional ask every season is a diary of logistics.
      if (occ.def.kind === 'major' || occ.def.kind === 'squad') {
        writeJournal(save, p, 'travelAsk', { event: eventName, place: countryName(country) })
      }
      pushToast(save, {
        icon: '✈️',
        text: ask.squad
          ? `The crew wants to go to ${eventName} — $${cost} for four seats, ${lead} days out. ${displayName(p, save)} did the asking.`
          : `${displayName(p, save)} wants to go to ${eventName} — $${cost}, ${lead} days out.`,
        see: { screen: 'arcade' },
        sticky: true,
        key: `ask_${ask.id}`,
      })
    }
  }
  // Old seen-keys are dead weight once their year has passed.
  for (const k of Object.keys(t.seen)) {
    if (Number(k.split(':')[1]) < save.year) delete t.seen[k]
  }
}

export const daysUntil = (save, ask) => Math.max(0, ask.startAbs - absDayOf(save.day, save.year))
export const pendingAsks = (save) => (save.travel?.asks || []).filter((a) => a.state === 'pending')

export function fundAsk(save, askId) {
  const t = save.travel
  const ask = t?.asks.find((a) => a.id === askId)
  const p = ask && save.players[ask.playerId]
  if (!ask || !p || ask.state !== 'pending') return false
  if (!trySpend(save, ask.cost, `funded ${ask.squad ? 'the crew' : displayName(p, save)} — ${ask.eventName}`)) return false
  ask.state = 'funded'
  dismissToastByKey(save, `ask_${ask.id}`)
  // Being SENT somewhere big is a page; being sent to the regionals for the
  // fourth time is a Tuesday with a plane ticket. Same gate the ask uses.
  if (ask.kind === 'major' || ask.kind === 'squad') {
    writeJournal(save, p, 'travelFunded', { event: ask.eventName, place: countryName(ask.country) })
  }
  bumpPassion(p, 5) // being backed is being believed in
  return true
}

export function denyAsk(save, askId, { lapsed = false } = {}) {
  const t = save.travel
  const ask = typeof askId === 'object' ? askId : t?.asks.find((a) => a.id === askId)
  const p = ask && save.players[ask.playerId]
  if (!ask || !p || ask.state !== 'pending') return false
  ask.state = 'denied'
  dismissToastByKey(save, `ask_${ask.id}`)
  // THE BOOKS ARE VISIBLE. Refusing while broke is understood; refusing while
  // flush is a betrayal — and never answering at all is its own message.
  // Refusing someone a seat they QUALIFIED for is the flush weight regardless:
  // the world said yes and the front counter said no.
  const flush = (save.economy?.money ?? 0) >= ask.cost * 3
  const seatHeld = ask.kind === 'major'
  const weight = lapsed ? 4 : flush || seatHeld ? 6 : 4
  adversity(save, p, {
    weight,
    stats: ['determination'],
    why: `they wouldn't send me to ${countryName(ask.country)}`,
    convKey: 'determination',
  })
  // Ledgered apart so the instruments can tell bought adversity (pots, road
  // losses) from withheld-money adversity — both are real, but they are
  // different levers doing different jobs (latency.mjs subtracts this).
  if (p.eureka) p.eureka.deniedAdversity = (p.eureka.deniedAdversity || 0) + weight
  bumpPassion(p, flush ? -7 : -3)
  p.mood = clamp(p.mood - (flush ? 2 : 1), 0, 10)
  writeJournal(save, p, flush ? 'travelDeniedFlush' : 'travelDenied', {
    event: ask.eventName,
    place: countryName(ask.country),
  })
  return true
}
