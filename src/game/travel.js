// TRAVEL — the other half of money's new job (REVISION §0). Your players ask
// to attend outside events; the arcade foots the bill. You can say no, and
// often you simply cannot afford everyone and must choose. Cost scales with
// distance, which makes your region a standing financial fact — and the
// calendar problem is the sharpest two-hands-ahead read in the game: did you
// still have the cash in month eight, or did it go into a pot in month three?
//
// Saying no is itself eureka fuel — "they wouldn't send me to Stockholm" is
// the §1.10 denied-funding wound (weight 4–6). Your books are visible to your
// players: refusing while broke is understood; refusing while flush is a
// betrayal. Funding is a wager — a placing recoups, an early exit is money
// burned.
//
// Until P4 builds the real calendar (qualifiers, regionals, majors), the
// destinations here are GENERIC away events on a cadence. The ask/deny loop,
// the costs, the wager and the wounds are the permanent machinery; P4 swaps
// the destinations for the real thing.

import { clamp, rand, randInt, choice, displayName, uid } from './util.js'
import { absDayOf, competitiveIntensity } from './constants.js'
import { chronicle } from './model.js'
import { econLog, trySpend } from './economy.js'
import { countryCluster, countryName, rollCountry } from './geo.js'
import { arcadeCountryOf } from './generate.js'
import { adversity, edge, eliminationWound } from './eureka.js'
import { writeJournal } from './journal.js'
import { pushToast, dismissToastByKey } from './notify.js'
import { bumpPassion } from './career.js'

export const TRAVEL_TIERS = {
  regional: { label: 'a regional', field: [40, 58], costMult: 1, glory: 4 },
  invitational: { label: 'an invitational', field: [50, 68], costMult: 1.5, glory: 7 },
  major: { label: 'a major', field: [58, 80], costMult: 2.5, glory: 12 },
}

const EVENT_NAMES = {
  regional: ['Coastal Clash', 'Northern Format', 'The Runback Open', 'Second City Showdown'],
  invitational: ['Kings of the Cabinet', 'The Proving Grounds', 'Marquee Invitational', 'House of Reads'],
  major: ['Continental Finals', 'The Grand Circuit', 'World Stage Classic', 'Summit of Play'],
}

export function newTravelState() {
  return { nextEventAbs: 0, event: null, asks: [] }
}

/** Distance is a standing financial fact: your region prices every trip. */
function travelCost(save, country, tier) {
  const home = arcadeCountryOf(save)
  const near = country === home
  const mid = !near && countryCluster(country) === countryCluster(home)
  const base = near ? 60 : mid ? 140 : 240
  return Math.round(base * TRAVEL_TIERS[tier].costMult)
}

function generateEvent(save, abs) {
  const roll = rand()
  const tier = roll < 0.5 ? 'regional' : roll < 0.85 ? 'invitational' : 'major'
  const country = rollCountry()
  return {
    id: uid('away'),
    tier,
    name: `${choice(EVENT_NAMES[tier])} · ${countryName(country)}`,
    country,
    startAbs: abs + 21, // three weeks' notice — enough time for the books to matter
    cost: travelCost(save, country, tier),
  }
}

const activeCast = (save) => Object.values(save.players)
  .filter((p) => !p.npc && p.createdBy === 'user' && p.isRegular && !p.retired && !p.banished)

/** Who wants to go: ambition asks, and ambition is earned visibility. */
function pickAskers(save, event) {
  const eligible = activeCast(save).filter((p) =>
    ((p.belief ?? 0) >= 30 || (p.tournamentWins || 0) >= 2)
    && (p.eureka?.askCooldownAbs || 0) <= event.startAbs - 21)
  return eligible
    .sort((a, b) => ((b.belief ?? 0) + b.glory / 10 + competitiveIntensity(b) * 3)
      - ((a.belief ?? 0) + a.glory / 10 + competitiveIntensity(a) * 3))
    .slice(0, 2)
}

/**
 * The daily tick (advanceDay): raise events, collect asks, resolve trips,
 * and let unanswered asks lapse into the soft no.
 */
export function travelDaily(save) {
  const t = (save.travel ??= newTravelState())
  const abs = absDayOf(save.day, save.year)

  if (!t.event && abs >= (t.nextEventAbs || 0)) {
    t.event = generateEvent(save, abs)
    for (const p of pickAskers(save, t.event)) {
      const ask = { id: uid('ask'), playerId: p.id, eventId: t.event.id, cost: t.event.cost, state: 'pending' }
      t.asks.push(ask)
      if (p.eureka) p.eureka.askCooldownAbs = abs + 45
      writeJournal(save, p, 'travelAsk', { event: t.event.name, place: countryName(t.event.country) })
      pushToast(save, {
        icon: '✈️',
        text: `${displayName(p, save)} wants to go to ${t.event.name} — $${t.event.cost}, ${daysUntil(save, t.event)} days out.`,
        see: { screen: 'arcade' },
        sticky: true,
        key: `ask_${ask.id}`,
      })
    }
    // A destination with no askers just passes by — the world is running
    // whether or not your room is ready for it.
    if (!t.asks.some((a) => a.eventId === t.event.id)) {
      t.event = null
      t.nextEventAbs = abs + randInt(25, 40)
    }
  }

  if (t.event && abs >= t.event.startAbs) {
    for (const ask of t.asks.filter((a) => a.eventId === t.event.id)) {
      if (ask.state === 'pending') denyAsk(save, ask, { lapsed: true })
      if (ask.state === 'funded') resolveTrip(save, ask, t.event)
    }
    t.asks = t.asks.filter((a) => a.eventId !== t.event.id)
    t.event = null
    t.nextEventAbs = abs + randInt(40, 65)
  }
}

export const daysUntil = (save, event) => Math.max(0, event.startAbs - absDayOf(save.day, save.year))
export const pendingAsks = (save) => (save.travel?.asks || []).filter((a) => a.state === 'pending')

export function fundAsk(save, askId) {
  const t = save.travel
  const ask = t?.asks.find((a) => a.id === askId)
  const p = ask && save.players[ask.playerId]
  if (!ask || !p || ask.state !== 'pending' || !t.event) return false
  if (!trySpend(save, ask.cost, `funded ${displayName(p, save)}'s trip to ${t.event.name}`)) return false
  ask.state = 'funded'
  dismissToastByKey(save, `ask_${ask.id}`)
  writeJournal(save, p, 'travelFunded', { event: t.event.name, place: countryName(t.event.country) })
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
  const flush = (save.economy?.money ?? 0) >= ask.cost * 3
  const weight = lapsed ? 4 : flush ? 6 : 4
  adversity(save, p, {
    weight,
    stats: ['determination'],
    why: `they wouldn't send me to ${t?.event ? countryName(t.event.country) : 'the event'}`,
    convKey: 'determination',
  })
  // Ledgered apart so the instruments can tell bought adversity (pots, road
  // losses) from withheld-money adversity — both are real, but they are
  // different levers doing different jobs (latency.mjs subtracts this).
  if (p.eureka) p.eureka.deniedAdversity = (p.eureka.deniedAdversity || 0) + weight
  bumpPassion(p, flush ? -7 : -3)
  p.mood = clamp(p.mood - (flush ? 2 : 1), 0, 10)
  writeJournal(save, p, flush ? 'travelDeniedFlush' : 'travelDenied', {
    event: t?.event?.name || 'the event',
    place: t?.event ? countryName(t.event.country) : 'there',
  })
  return true
}

/**
 * The trip itself, simmed offscreen: four rounds against the tier's field.
 * A placing recoups; an early exit is money burned — the wager the funding
 * always was.
 */
function resolveTrip(save, ask, event) {
  const p = save.players[ask.playerId]
  if (!p || p.retired || p.banished) return
  const [lo, hi] = TRAVEL_TIERS[event.tier].field
  const skill = Math.max(0, ...Object.values(p.charSkill || {}), 0)
  let wins = 0
  for (let round = 0; round < 4; round++) {
    // The field sharpens every round — winning out means beating the top of it.
    const opp = lo + (hi - lo) * (0.25 + round * 0.22) + (rand() - 0.5) * 6
    const pWin = 1 / (1 + Math.pow(10, (opp - skill) / 14))
    if (rand() < pWin) wins += 1
    else break
  }
  const placeLabel = wins === 4 ? 'won it' : wins === 3 ? 'made the final four' : wins === 2 ? 'made top eight' : wins === 1 ? 'went two-and-out' : 'went out first round'
  const prize = wins === 4 ? Math.round(ask.cost * 2.5) + 40 : wins === 3 ? Math.round(ask.cost * 1.2) : wins === 2 ? Math.round(ask.cost * 0.5) : 0
  if (prize > 0) econLog(save, prize, `${displayName(p, save)} placed at ${event.name} — prize`)

  const tier = TRAVEL_TIERS[event.tier]
  p.glory += wins * tier.glory
  p.belief = clamp((p.belief ?? 0) + 3 + wins * 3, 0, 100) // road reps are stage reps
  p.elo += Math.round((wins - 1.5) * 8) // the world saw the result
  bumpPassion(p, wins >= 3 ? 10 : wins >= 2 ? 4 : 1)

  if (wins >= 3) {
    edge(save, p, { weight: 1.4, stats: ['composure', 'stamina'], why: `went the distance at ${event.name}` })
    chronicle(save, '✈️', `${displayName(p, save)} ${placeLabel} at ${event.name}. The arcade's money came home with interest.`)
  } else if (wins <= 1 && (p.belief ?? 0) >= 35) {
    eliminationWound(save, p, {
      believed: true,
      late: false,
      favored: (p.belief ?? 0) >= 60,
      stage: event.tier === 'major' ? 'evo' : 'tournament',
    })
  }
  writeJournal(save, p, wins >= 3 ? 'awayPlaced' : 'awayOut', {
    event: event.name, place: placeLabel, always: true,
  })
}
