// THE HIATUS — closing the setups so the room can cool off.
//
// The counterplay problem this exists to solve: feuds cool at
// `0.16 x (1 - toxicity * 2.2)` (social.js spreadFeuds), which reaches ZERO at
// toxicity 0.455. Past that the room cannot heal itself while it keeps
// playing — cooling is throttled to nothing and the faction re-spreads faster
// than the flat -30 drift can pull it back. The only lever that worked was
// banishment, which is nuclear, priced, and needs a correct read on who the
// source is. A player who missed that window had a dead run and no verb.
//
// So: you can stop. The doors stay open, the counter still sells, people still
// hang around — but the cabinets are dark, the brackets are postponed, and
// nobody loses to anybody. Cooling runs at full rate regardless of how
// poisonous the room is, and nothing new gets recruited into a fight that
// isn't happening.
//
// It is deliberately not free and deliberately not permanent. The setups ARE
// the reason most people come, so the crowd thins immediately and keeps
// thinning the longer the shutters are down — "they found somewhere else to
// be" is the real cost, and it escalates until reopening is the only sensible
// move. Rent does not pause. Neither does passion decay, so a long hiatus
// burns out the veterans it was meant to protect.

import { clamp } from './util.js'
import { absDayOf } from './constants.js'
import { chronicle, newHiatusState } from './model.js'
import { pushToast, dismissToastByKey } from './notify.js'

export const hiatusActive = (save) => !!save.hiatus?.active

/** How many days the setups have been dark this stretch (0 when open). */
export function hiatusDays(save) {
  if (!hiatusActive(save) || save.hiatus.sinceAbs == null) return 0
  return Math.max(0, absDayOf(save.day, save.year) - save.hiatus.sinceAbs)
}

/**
 * The crowd, thinning. Multiplies attendance while the setups are dark.
 *
 * Starts steep — most of the room came to play, and they find out the cabinets
 * are off on day one — and keeps sliding, so an indefinite hiatus is not a
 * strategy. A floor with other things on it (side cabinets, an attraction)
 * holds more of its crowd, which is the payoff for having built a room that
 * isn't only a fighting game.
 */
function drawAfter(save, days) {
  const elsewhere = Math.min(0.20,
    (save.arcade?.otherGames?.length || 0) * 0.03
    + (save.arcade?.attractions?.length || 0) * 0.05)
  return clamp(0.72 - days * 0.035 + elsewhere, 0.20, 0.92)
}

export function hiatusAttendanceFactor(save) {
  if (!hiatusActive(save)) return 1
  return drawAfter(save, hiatusDays(save))
}

/**
 * What it costs, in plain language, for the Manage panel — today and a week
 * from today. "Some attendance" is not a number anyone can plan against, and
 * the whole point of the lever is that you can see the bill before you sign.
 */
export function hiatusForecast(save) {
  const days = hiatusDays(save)
  const pct = (d) => Math.round((1 - drawAfter(save, d)) * 100)
  return {
    days,
    crowdLostPct: hiatusActive(save) ? pct(days) : pct(0),
    crowdLostPctInAWeek: pct(days + 7),
  }
}

/**
 * Open or close the setups. Free, reversible, and announced — the room notices
 * both directions.
 */
export function setHiatus(save, on, events = null) {
  save.hiatus ??= newHiatusState()
  if (!!save.hiatus.active === !!on) return
  const abs = absDayOf(save.day, save.year)
  save.hiatus.active = !!on
  if (on) {
    save.hiatus.sinceAbs = abs
    // A hiatus answers the toxicity prompt — take the question down with it.
    dismissToastByKey(save, 'feud_source')
    chronicle(save, '🔌', `The cabinets at ${save.arcade.name} went dark. No matches, no brackets — the room needs a minute.`)
    if (events) {
      events.push({
        type: 'staff',
        text: '🔌 The setups are off. People drift in, see the dark screens, and mostly drift back out — the ones who stay are here for each other.',
      })
    }
    pushToast(save, {
      icon: '🔌',
      text: 'The setups are closed. Bad blood cools at full speed while nobody is losing to anybody — but the crowd thins every day the cabinets stay dark.',
      see: { screen: 'manage', params: { tab: 'schedule' } },
      key: 'hiatus',
      sticky: true,
    })
  } else {
    const ran = save.hiatus.sinceAbs == null ? 0 : abs - save.hiatus.sinceAbs
    save.hiatus.totalDays = (save.hiatus.totalDays || 0) + Math.max(0, ran)
    save.hiatus.sinceAbs = null
    save.hiatus.lastEndedAbs = abs
    dismissToastByKey(save, 'hiatus')
    dismissToastByKey(save, 'hiatus_cost')
    chronicle(save, '🔛', `${save.arcade.name} switched the cabinets back on after ${ran} day${ran === 1 ? '' : 's'} dark.`)
    if (events) {
      events.push({
        type: 'staff',
        text: `🔛 The setups are live again after ${ran} day${ran === 1 ? '' : 's'}. Somebody puts a token down before the screens have finished warming up.`,
      })
    }
  }
}

// What the room says at each week of darkness. Keyed so one live warning
// replaces the last rather than stacking a wall of the same complaint.
const MILESTONES = [
  [3, '🪑', 'Third night with the cabinets off. The regulars are still turning up, but they are running out of things to say to each other.'],
  [7, '🚪', 'A week dark. Half the room has found somewhere else to be on a Friday, and the counter is carrying the rent on its own.'],
  [14, '🥀', 'A fortnight closed. Whatever the setups were shut to fix, this is now its own problem — the scene is forgetting it has somewhere to go.'],
]

/**
 * Every day, while the shutters are down. Called from advanceDay rather than
 * endDay so it ticks on tournament days and idle catch-up too — a hiatus that
 * only costs you on nights you sat and watched would be free to anyone using
 * spectator mode.
 *
 * Speaks through toasts, not day events, for the same reason: advanceDay is
 * the one tick every kind of day passes through, and it has no day report to
 * write into.
 */
export function hiatusDaily(save) {
  if (!hiatusActive(save)) return
  const days = hiatusDays(save)
  // The scene stops being talked about when it stops playing. Small per day,
  // but it means a hiatus long enough to fix a poisoned room costs some of the
  // relevance that room was earning — you are buying peace with attention.
  save.relevance = clamp((save.relevance ?? 55) - 0.12, 0, 100)

  const hit = MILESTONES.find(([d]) => d === days)
  if (hit) {
    pushToast(save, {
      icon: hit[1],
      text: hit[2],
      see: { screen: 'manage', params: { tab: 'schedule' } },
      key: 'hiatus_cost',
      sticky: true,
    })
  } else if (days > 14 && days % 7 === 0) {
    dismissToastByKey(save, 'hiatus_cost')
    pushToast(save, {
      icon: '🥀',
      text: `${days} days dark. There is barely a room left to reopen.`,
      see: { screen: 'manage', params: { tab: 'schedule' } },
      key: 'hiatus_cost',
      sticky: true,
    })
  }
}
