// WHAT IS THIS PLACE ACTUALLY DOING? — the numbers that decide the run.
//
// danger.js answers "how close am I to losing". This answers the question
// before it: "what are my levers, and are they set". Those are different
// problems and they need different treatment.
//
// The observed failure is not that people ignore warnings. It is that they
// never find the lever at all — staffing sits two clicks past the last tab in
// the nav, so a run can be lost to a mechanic the owner never knew existed.
// By the time danger.js speaks, at least 30% of a death counter has already
// elapsed and the arcade is often past saving.
//
// So this module does two things:
//   venueVitals — the standing readout, shown whether or not anything is wrong
//   venueTips   — levers that have never been touched and are now costing money
//
// Pure derivation over state that already exists: no schema, no migration, and
// it reads correctly on a save made before it existed.

import { DAYS_PER_MONTH, absDayOf } from './constants.js'
import {
  monthlyRent, weeklyUpkeep, staffCounts, FAIR_WAGE, managementQuality,
} from './economy.js'
import { runDangers } from './danger.js'

// How many days of history the trend reads. A week smooths out the weekday /
// weekend swing, which is large enough that a single day's net says nothing.
const TREND_DAYS = 7

/** Average daily net over the last week of recorded days, or null if too new. */
function recentNet(save) {
  const h = save.economy?.history || []
  if (h.length < 2) return null
  const recent = h.slice(-TREND_DAYS)
  return recent.reduce((s, d) => s + (d.net || 0), 0) / recent.length
}

/** Yesterday's money movement, itemised from the log the sim already writes. */
function lastDayMoney(save) {
  const log = save.economy?.log || []
  if (!log.length) return null
  // The log is newest-first and stamped with the game day it happened on, so
  // "the most recent day that had any movement" is just the head's stamp.
  const { day, year } = log[0]
  const items = log.filter((e) => e.day === day && e.year === year)
  if (!items.length) return null
  const took = items.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0)
  const paid = items.filter((e) => e.amount < 0).reduce((s, e) => s - e.amount, 0)
  return { day, year, took, paid, net: took - paid, items }
}

/**
 * The standing readout. Always available, always populated — this is the strip
 * that makes the economy ambient instead of hidden behind a tab.
 */
export function venueVitals(save) {
  const cash = save.economy?.money ?? 0
  const st = save.staffing || { morale: 70, employeeWage: FAIR_WAGE.employee, managerWage: FAIR_WAGE.manager }
  const { employees, managers } = staffCounts(save)

  // The nut, expressed PER DAY, because that is the unit the owner experiences.
  // Rent is monthly and upkeep is weekly; showing them in their own cadence is
  // why nobody can tell what they are actually spending.
  const rent = monthlyRent(save) / DAYS_PER_MONTH
  const upkeep = weeklyUpkeep(save) / 7
  const payroll = employees * st.employeeWage + managers * st.managerWage
  const total = rent + upkeep + payroll

  const trend = recentNet(save)
  // Runway only means something while you are losing money. When the arcade is
  // in the black, a "days left" number is noise dressed up as urgency.
  const runwayDays = trend != null && trend < -0.01 && cash > 0
    ? Math.floor(cash / -trend)
    : null

  return {
    cash,
    trend,
    runwayDays,
    yesterday: lastDayMoney(save),
    nut: { rent, upkeep, payroll, total },
    staff: { employees, managers, total: employees + managers, morale: Math.round(st.morale ?? 70) },
    cleanliness: Math.round(save.arcade?.cleanliness ?? 80),
    management: managementQuality(save),
  }
}

// ---------- Teaching tips ----------
//
// A tip is NOT a danger. It fires while there is still time to act, it names a
// lever rather than a countdown, and it goes away by itself once the lever has
// been used. The UI styles them apart from the red rows on purpose: a tip that
// looks like an alarm gets dismissed like an alarm.

const DAY_GRACE = 7 // nothing is "neglected" in the opening week

/**
 * Levers this owner has not touched that are now costing them, worst first.
 *
 * Suppressed once danger.js is already shouting about the same funnel — being
 * told twice that the money is wrong does not teach anything the first row
 * didn't, and stacked banners are how a UI trains people to scroll past.
 */
export function venueTips(save) {
  if (!save || save.gameOver || save.settings?.mode === 'sandbox') return []
  const age = absDayOf(save.day, save.year)
  if (age < DAY_GRACE) return []

  const v = venueVitals(save)
  const loud = new Set(runDangers(save).map((d) => d.key))
  const out = []

  // Nobody behind the counter. Measured across the playtest, staff is
  // monotonically positive up to three — running zero is a straight loss the
  // owner never opted into, and it is the single most common thing missed.
  if (v.staff.total === 0) {
    out.push({
      key: 'no-staff',
      icon: '🧹',
      weight: v.cleanliness < 55 ? 3 : 2,
      title: "You haven't hired anyone yet",
      detail: v.cleanliness < 55
        ? `Nobody is cleaning up, and the place is at ${v.cleanliness}%. Below 30 the health inspector shuts you down for a few days.`
        : 'Nobody is cleaning up or working the counter. Cleanliness falls on its own, and a dirty room quietly drives people off.',
      cta: 'Hire someone',
      to: 'manage', tab: 'staff',
    })
  } else if (v.staff.managers === 0 && v.staff.employees >= 3) {
    // Employees without a manager go feral: the floor slips and machines break.
    out.push({
      key: 'no-manager',
      icon: '🧑‍💼',
      weight: 2,
      title: `${v.staff.employees} employees and nobody running them`,
      detail: 'Unmanaged staff get less done and machines start breaking. About one manager per four employees keeps the floor working.',
      cta: 'Hire a manager',
      to: 'manage', tab: 'staff',
    })
  }

  // Paying under the market rate reads as thrift and behaves as turnover.
  const st = save.staffing
  if (v.staff.total > 0 && v.staff.morale < 55 &&
      (st.employeeWage < FAIR_WAGE.employee || st.managerWage < FAIR_WAGE.manager)) {
    out.push({
      key: 'underpaying',
      icon: '💸',
      weight: 2,
      title: 'Your staff are underpaid and it shows',
      detail: `Morale is ${v.staff.morale}. The market rate is $${FAIR_WAGE.employee}/day for an employee and $${FAIR_WAGE.manager} for a manager — under it, people stop trying and then stop coming.`,
      cta: 'Review wages',
      to: 'manage', tab: 'staff',
    })
  }

  // An empty counter is revenue sitting on the floor, and food is also the
  // thing that makes people stay long enough to play another game.
  if (!(save.arcade?.foods || []).length) {
    out.push({
      key: 'no-concession',
      icon: '🍿',
      weight: 1,
      title: 'The concession stand is empty',
      detail: "Nothing is stocked, so nobody is buying anything. Food is the second income stream and it's the reason people stay for one more set.",
      cta: 'Stock something',
      to: 'manage', tab: 'arcade',
    })
  }

  // Bleeding money. This is the window BEFORE the landlord starts counting,
  // and the whole reason tips exist. Note the second arm: once cash has gone
  // negative there IS no runway figure, and danger.js stays quiet until 30% of
  // the foreclosure grace has burned — which was a silent gap at exactly the
  // moment the owner most needed telling.
  const broke = v.cash <= 0
  if (!loud.has('economy') && v.trend != null && v.trend < -1 &&
      (broke || (v.runwayDays != null && v.runwayDays < 45))) {
    const nut = `The nut is $${Math.round(v.nut.total)}/day — rent $${Math.round(v.nut.rent)}, upkeep $${Math.round(v.nut.upkeep)}, payroll $${Math.round(v.nut.payroll)}.`
    out.push({
      key: 'bleeding',
      icon: '📉',
      weight: broke || v.runwayDays < 20 ? 3 : 2,
      title: `Losing about $${Math.round(-v.trend)} a day`,
      detail: broke
        ? `The account is already ${v.cash < 0 ? 'overdrawn' : 'empty'}. Stay under water and the landlord starts counting. ${nut}`
        : `Roughly ${v.runwayDays} days of cash left at this rate. ${nut}`,
      cta: 'Check prices',
      to: 'manage', tab: 'arcade',
    })
  }

  // Two at a time, hardest-hitting first. Everything here is true at once for a
  // brand-new owner, and a wall of tips is indistinguishable from no tips.
  return out.sort((a, b) => b.weight - a.weight).slice(0, 2)
}
