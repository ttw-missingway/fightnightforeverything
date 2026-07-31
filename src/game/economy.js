// The arcade's books AND its operations. Income: tokens and food the players
// actually buy (priced by the owner, judged by their wallets). Expenses:
// weekly rent scaled to the floor and the difficulty, weekly upkeep on every
// cabinet and food line, daily payroll. Consequential mode has a fail state
// now: stay in the red long enough and the landlord takes the keys.

import { clamp, chance, choice, randInt, uid, hash01 } from './util.js'
import { bindRng } from './rng.js'
import { pushToast } from './notify.js'
import { FOODS, OTHER_GAMES, FIRST_NAMES, LAST_NAMES } from './names.js'
import { difficultyOf, absDayOf, runAge, DAYS_PER_MONTH, DEFAULT_FOOD_PRICE, DEFAULT_GAME_TOKENS, AD_CHANNELS, statLevel } from './constants.js'
import { chronicle, bump, bumpPeak } from './model.js'
import { worldRentMult } from './worldevents.js'
import { attractionIncome, attractionFootprint } from './catalog.js'
import { isUnlocked } from './achievements.js'

export const foodPriceOf = (save, name) => save.arcade.foodPrices?.[name] ?? DEFAULT_FOOD_PRICE
export const gameTokensOf = (save, name) => save.arcade.gameTokens?.[name] ?? DEFAULT_GAME_TOKENS

// ---------- Advertising ----------

export const activeAds = (save) => AD_CHANNELS.filter((c) => (save.arcade.ads || []).includes(c.key))
export const adWeeklyCost = (save) => activeAds(save).reduce((s, c) => s + c.cost, 0)

// Early-biased channels lose their punch as the arcade becomes known: a flyer
// campaign for a place everyone already goes is wasted paper. 1 when brand new,
// tapering toward 0.1 as days pass and a following builds.
function earlyWeight(save) {
  const daysOpen = runAge(save) - 1
  const followers = save.stream?.followers || 0
  return clamp(1.1 - daysOpen / 50 - followers / 700, 0.1, 1)
}

// How effective a single channel is right now, 0..1 (UI + effect scaling).
export function adEffectiveness(save, channel) {
  return channel.phase === 'early' ? earlyWeight(save) : 1
}

// Discovery lift from all active channels (added to the awareness factor).
export function adAwarenessBoost(save) {
  return activeAds(save).reduce((s, c) => s + c.awareness * adEffectiveness(save, c), 0)
}

// Extra pull on new faces wandering in (added to the arrival chance).
export function adArrivalBoost(save) {
  return activeAds(save).reduce((s, c) => s + c.arrivals * adEffectiveness(save, c), 0)
}

// Daily channel-hype (public opinion) push. Opinion channels compound with the
// following you already have — word of mouth amplifies the spend.
export function adHypePerDay(save) {
  const followers = save.stream?.followers || 0
  return activeAds(save).reduce((s, c) =>
    s + c.hypePerDay * (c.phase === 'opinion' ? 1 + followers / 2500 : 1), 0)
}

export function econLog(save, amount, label) {
  const e = save.economy
  if (!e) return
  e.money = Math.round((e.money + amount) * 100) / 100
  e.log.unshift({ day: save.day, year: save.year, amount: Math.round(amount * 100) / 100, label })
  if (e.log.length > 40) e.log.pop()
}

/**
 * Recurring bills — weekly upkeep/restocking and monthly rent — settled from a
 * week/month ledger rather than "on this exact weekday". This MUST run on every
 * day transition (including tournament/EVO days, which skip the normal open/
 * close cycle), or the bill's calendar day can be silently skipped. Guarded so
 * calling it twice in a day never double-charges. The opening week and month
 * are grace periods (you just built the place). Pass `events` to surface the
 * "in the red" warning in a daily recap.
 */
export function settleRecurring(save, events = null) {
  const e = save.economy
  if (!e) return
  const abs = absDayOf(save.day, save.year)

  const weekIdx = Math.floor((abs - 1) / 7)
  if (weekIdx > (e.lastUpkeepWeek ?? 0)) {
    e.lastUpkeepWeek = weekIdx
    const upkeep = weeklyUpkeep(save)
    if (upkeep > 0) econLog(save, -upkeep, 'upkeep & restocking')
  }

  const monthIdx = Math.floor((abs - 1) / DAYS_PER_MONTH)
  if (monthIdx > (e.lastRentMonth ?? 0)) {
    e.lastRentMonth = monthIdx
    econLog(save, -monthlyRent(save), 'monthly rent')
    if (events && e.money < 0) {
      events.push({ type: 'economy', text: `💸 Rent cleared the account — you're $${Math.abs(Math.round(e.money))} in the red. The landlord "checked in."` })
    }
  }
}

// Returns false (and does nothing) if the arcade can't afford it.
export function trySpend(save, amount, label) {
  if (!save.economy) return true
  if (save.economy.money < amount) return false
  econLog(save, -amount, label)
  return true
}

// Rent is a monthly bill now — charged on the 1st of each in-game month.
export function monthlyRent(save) {
  // Rent is a FLAT nut that has nothing to do with how busy you are — the
  // landlord wants the same check whether the room is packed or empty. That's
  // the whole early game: a hands-off arcade draws a thin crowd whose spending
  // can't cover the rent, so it bleeds out; the only way into the black is
  // filling the room, which takes actually running the place. The flat floor
  // (not the per-cabinet part) is what makes low attendance fatal — so it
  // punishes coasting, not building.
  // COSTS SCALE WITH WHAT YOU BUILT, not with the fact that you exist.
  //
  // The per-setup charge was $30/month against a cabinet that can only take
  // ~12 matches a day — so at an honest arcade price (~$1 a match, see
  // costPerPlay) a two-cabinet room paid more in rent for its floor than the
  // floor could physically earn. That is what made "a quarter a game" a death
  // sentence rather than a strategy: not the price, the overhead underneath
  // it. A small room now carries a small room's nut.
  //
  // Attractions are the opposite case and are priced separately below: a
  // bowling alley is FLOOR SPACE and the landlord charges for it.
  const diff = difficultyOf(save)
  const base = (diff.rentBase ?? 220)
    + save.settings.setups * 18
    + attractionFootprint(save)
  // The lease gets renegotiated every year, and never in your favour. This is
  // what makes a hands-off arcade lose: an operation that was comfortably in
  // the black on day one is underwater by year three unless the owner has
  // actually grown the takings. Standing still is a slow way of quitting.
  // THE LEASE HAS A CEILING (P6). The hike is annual and compounding, which
  // is the correct pressure on a young arcade — "standing still is a slow way
  // of quitting" is the early game's whole thesis and it lands inside the
  // first few years. Compounded FOREVER it stops being a pressure and becomes
  // a countdown: on normal, 12% a year is 1.57× by year five (fine) and 3.9×
  // by year thirteen (unanswerable, since attendance is capped and relevance
  // inevitably declines). That was invisible while runs ended in year five;
  // P5's fifteen-year lineages made it the thing that killed 23 of 24 runs.
  //
  // So the escalator runs out. A landlord who has already doubled the rent
  // has extracted what the location is worth, and a tenant facing a third
  // doubling simply leaves — which is a negotiation, not a mechanic. What
  // still scales without limit is the REVIEW below: being busy and famous
  // costs you, permanently and proportionally, and that is the term that is
  // supposed to punish success.
  const years = Math.max(0, (save.year || 1) - 1)
  const escalation = Math.pow(1 + (diff.rentEscalation || 0), Math.min(years, RENT_ESCALATION_YEARS))
  // THE RENT REVIEW. A landmark pays landmark rent — the landlord reads the
  // same news everyone else does. Without this a thriving arcade compounds
  // cash forever with nothing pulling against it (measured: $51k banked over
  // three years, and rising). Success should cost something, and the thing it
  // costs is the reason you were successful.
  const busy = clamp((save.peakAttendance || 0) / 60, 0, 0.35)
  const famous = clamp(((save.relevance ?? 55) - 55) / 150, 0, 0.2)
  const review = 1 + busy + famous
  // Active world events (a landlord "revisiting the market rate") stack on top.
  return Math.round(base * diff.rentMult * escalation * review * worldRentMult(save))
}

// ---------- Fixed catalogs ----------
// Foods and side cabinets are set in stone now — no more inventing menu
// items. Each has a deterministic price tag (hashed from the name so the
// same item always costs the same in every save).

const priceRoll = (seed, lo, hi) => Math.round(lo + hash01(seed) * (hi - lo))

export const FOOD_CATALOG = FOODS.map((name) => ({
  name,
  stockCost: priceRoll(`${name}:stock`, 25, 55), // first stocking
  restock: priceRoll(`${name}:restock`, 4, 10), // weekly resupply (was 6–14 pre-overhaul; see FAIR_WAGE note)
}))

export const GAME_CATALOG = OTHER_GAMES.map((name) => ({
  name,
  price: priceRoll(`${name}:price`, 180, 420), // buying the cabinet
  upkeep: priceRoll(`${name}:upkeep`, 6, 13), // weekly maintenance (was 8–18 pre-overhaul; see FAIR_WAGE note)
}))

// Legacy saves may hold custom items that predate the fixed catalogs —
// give them sane costs instead of crashing.
export const foodItem = (name) =>
  FOOD_CATALOG.find((f) => f.name === name) || { name, stockCost: 40, restock: 10 }
export const gameItem = (name) =>
  GAME_CATALOG.find((g) => g.name === name) || { name, price: 250, upkeep: 12 }

// Weekly cost of keeping the lights on beyond rent: food restocks, cabinet
// maintenance, and advertising. Sloppy management makes machines cost more.
export function weeklyUpkeep(save) {
  const foods = save.arcade.foods.reduce((s, f) => s + foodItem(f).restock, 0)
  const mgmt = managementQuality(save)
  const machines = save.arcade.otherGames.reduce((s, g) => s + gameItem(g).upkeep, 0)
  return Math.round(foods + machines * (1.2 - mgmt * 0.4) + adWeeklyCost(save))
}

/**
 * How many years the annual hike compounds for before the lease plateaus.
 *
 * A YEAR count rather than a multiplier cap, and the distinction matters. The
 * first cut of this capped the multiplier at a flat 2×, which lands at year
 * six on normal (12%) but year FOUR on master (20%) — so the harder the
 * difficulty, the sooner its main long-run pressure switched off, and
 * competent play on hard sailed through twenty years untouched. Capping the
 * years instead keeps the difficulty ordering intact: after eight years the
 * escalator stops everywhere, at 2.5× on normal and 4.3× on master.
 */
export const RENT_ESCALATION_YEARS = 8


/**
 * What you get back for a cabinet you no longer need. Used gear sells for a
 * fraction of new, which is what makes over-building a real mistake rather
 * than a refundable one.
 */
export const SETUP_RESALE = 0.4

/**
 * SHRINK THE ROOM (P6). A room that grew had no way to get smaller: there was
 * no `sellSetup` anywhere in the codebase, so every cabinet bought at the peak
 * was a permanent line on the rent and upkeep for the rest of the lineage.
 * Combined with a relevance slope that inevitably thins the crowd, that made
 * the late game a bill you could watch arriving and do nothing about.
 *
 * Downsizing is the Act 3 verb that was missing. It is a genuine decision with
 * a genuine cost — you lose 60% of the cabinet's value and the capacity to run
 * the brackets you used to — and it is how a shrinking scene stays solvent
 * long enough to find its next generation.
 */
export function sellSetup(save, label = 'sold a setup cabinet') {
  if ((save.settings?.setups || 0) <= 1) return false // never sell the last one
  save.settings.setups -= 1
  econLog(save, Math.round(SETUP_COST * SETUP_RESALE), label)
  return true
}

/** The same, for a side attraction: floor space handed back to the landlord. */
export function closeAttraction(save, name) {
  const games = save.arcade?.otherGames || []
  const i = name ? games.indexOf(name) : games.length - 1
  if (i < 0) return null
  const [gone] = games.splice(i, 1)
  econLog(save, Math.round(gameItem(gone).price * SETUP_RESALE), `closed ${gone}`)
  return gone
}

// A cabinet for the main game — the same price to install at creation or
// mid-save. Food stocking and side-cabinet install costs come from the
// catalogs above.
export const SETUP_COST = 200
export const PRICES = { setup: SETUP_COST }

// ---------- Creation budget & monthly projection ----------

// What the current arcade build costs to stand up: every setup cabinet, every
// stocked food, every side-cabinet install. Drives the creation budget bar.
export function arcadeBuildCost(save) {
  const setups = (save.settings.setups || 0) * SETUP_COST
  const foods = save.arcade.foods.reduce((s, f) => s + foodItem(f).stockCost, 0)
  const games = save.arcade.otherGames.reduce((s, g) => s + gameItem(g).price, 0)
  return setups + foods + games
}

// The opening budget: your difficulty's starting funds. In creation you spend
// it building the arcade; whatever's left becomes your opening cash.
export function startingBudget(save) {
  return difficultyOf(save).startingMoney
}
export function budgetRemaining(save) {
  return startingBudget(save) - arcadeBuildCost(save)
}

// What a month of operating costs, projected from the current setup: rent
// (monthly), restocking & upkeep (weekly ×4), and payroll (daily ×28).
export function projectedMonthlyCost(save) {
  const rent = monthlyRent(save)
  const upkeep = weeklyUpkeep(save) * 4
  const st = save.staffing || { employeeWage: FAIR_WAGE.employee, managerWage: FAIR_WAGE.manager }
  const { employees, managers } = staffCounts(save)
  const payroll = (employees * st.employeeWage + managers * st.managerWage) * 28
  return Math.round(rent + upkeep + payroll)
}

// ---------- Staffing ----------

// $/day the market expects. Counter work is part-time minimum-wage work; these
// were 10/16 until the 2026-07-28 pricing overhaul anchored costPerPlay to
// reality (~$1.20 comfort) and cut sustainable revenue by a third. At 10/16
// payroll was ~$14/day of a ~$36/day nut and a competently-run NORMAL room
// netted +$1.22/day — breakeven sat exactly on the attendance a competent
// player reaches, so variance decided who lived (measured n=16: easy 50%,
// normal 50%, difficult/master 100% deaths, all economy funnel). Every morale/
// quit formula reads wage÷fair, so moving FAIR_WAGE and the newStaffing
// defaults together changes only the dollars.
export const FAIR_WAGE = { employee: 7, manager: 12 }
export const HIRE_COST = 25 // posting the job, training the hire

export function newStaffMember(role, playerId = null, name = null, family = false) {
  return {
    id: uid('staff'),
    role, // 'employee' | 'manager'
    playerId, // a player who took the job — they can't play while staffed
    name: name || `${choice(FIRST_NAMES)} ${choice(LAST_NAMES)}`,
    // Family. They draw no wage and they never walk out — see FAMILY_CREW.
    family,
    hiredAbs: 0,
  }
}

/**
 * The family business: two people behind the counter from day one who are
 * never on the payroll and never quit.
 *
 * This is the single biggest early-game gift in the ladder, which is why it
 * costs half a year of running the floor completely alone to earn. Payroll and
 * cleaning are what kill an opening month; a run that starts with two free
 * hands starts a different game.
 */
export const FAMILY_CREW = [
  { role: 'employee' },
  { role: 'employee' },
]

export function seedFamilyCrew(save) {
  bindRng(save)
  if (!isUnlocked(save, 'family')) return
  save.staffing ??= newStaffing()
  if (save.staffing.staff.some((s) => s.family)) return
  for (const { role } of FAMILY_CREW) {
    save.staffing.staff.push(newStaffMember(role, null, null, true))
  }
}

export function staffCounts(save) {
  const staff = save.staffing?.staff || []
  return {
    employees: staff.filter((s) => s.role === 'employee').length,
    managers: staff.filter((s) => s.role === 'manager').length,
  }
}

export function isStaffed(save, playerId) {
  return (save.staffing?.staff || []).some((s) => s.playerId === playerId)
}

/**
 * The upside of putting a PLAYER on staff instead of hiring an outsider: a
 * familiar face behind the counter is a draw. Regulars turn up to hang out
 * where their friend (or the arcade's local star) works, and a warm,
 * community-minded player sets a good tone for the whole crew. An outside
 * employee is pure labor — cheaper in that you don't spend a competitor, but
 * they pull nobody in on their own. Returns a small appeal score (~0..1.5+),
 * summed over every player currently on the payroll. Feeds attendance (the
 * draw) and staff morale (the vibe).
 */
export function playerStaffAppeal(save) {
  const staff = save.staffing?.staff || []
  let appeal = 0
  for (const s of staff) {
    if (!s.playerId) continue
    const p = save.players?.[s.playerId]
    if (!p) continue
    const fame = clamp((p.respect + p.glory * 1.2) / 100, 0, 1)
    const warmth = (((p.social?.community ?? 5) + (p.social?.charisma ?? 5)) / 20)
    appeal += fame * 0.75 + warmth * 0.35
  }
  return appeal
}

/**
 * 0..1 — how well the floor actually runs. Managers are the balancing
 * mechanism: roughly one per four employees, paid a fair wage, keeps
 * everyone effective. Too few (or underpaid) managers and cleaning slips
 * and machines break; too MANY managers doesn't help here — it shows up
 * as quit pressure instead.
 */
export function managementQuality(save) {
  const st = save.staffing
  if (!st) return 0.5
  const { employees, managers } = staffCounts(save)
  if (employees === 0) return managers > 0 ? 0.75 : 0.5 // the owner runs a tight, quiet floor solo
  const coverage = clamp(managers / Math.ceil(employees / 4), 0, 1)
  const pay = clamp(st.managerWage / FAIR_WAGE.manager, 0.4, 1.25)
  // A crew with no manager still runs (0.4) but under-directed; a well-managed,
  // fairly-paid crew runs the tightest ship of all.
  return clamp(0.4 + coverage * 0.5 * pay, 0.1, 1)
}

// Extra quit pressure from too many chiefs: past ~1 manager per 3
// employees, everyone starts polishing their resume.
function overmanagement(save) {
  const { employees, managers } = staffCounts(save)
  return Math.max(0, managers - Math.max(1, Math.ceil(employees / 3)))
}

/**
 * How badly the crew is outnumbered by the floor, 0..1.
 *
 * One employee can comfortably carry roughly a twenty-head night. Past that
 * they are running between a broken cabinet, the counter and the mop, and no
 * wage makes that pleasant. Read off a rolling attendance average rather than
 * today's number so a single busy Saturday is not a morale crisis and a
 * tournament day (which records no attendance at all) is not a holiday.
 */
export const STAFF_CAPACITY = 20 // heads one employee can cover without strain

export function staffStrain(save) {
  const { employees, managers } = staffCounts(save)
  const crew = employees + managers * 0.5
  const recent = (save.economy?.history || []).slice(-14)
    .map((h) => h.attendance).filter((a) => a != null)
  if (!recent.length) return 0
  const avg = recent.reduce((s2, a) => s2 + a, 0) / recent.length
  if (crew <= 0) return avg > 0 ? 1 : 0
  return clamp(avg / (crew * STAFF_CAPACITY) - 1, 0, 1)
}

// Where morale is headed given current pay, management AND workload.
export function staffMoraleTarget(save) {
  const st = save.staffing
  const { employees, managers } = staffCounts(save)
  if (employees + managers === 0) return 70 // nobody to be unhappy
  const wageRatio = clamp(st.employeeWage / FAIR_WAGE.employee, 0.3, 1.6)
  // BEING SWAMPED COSTS MORALE (P6). This had four inputs — wage, manager
  // coverage, over-management and player charm — and no workload term at all,
  // so one employee covering a sixty-person night sat at exactly the same
  // target as one covering an empty Tuesday. The causality was even inverted:
  // morale raised cleaning throughput, but heavy traffic never touched morale,
  // so an understaffed room's only feedback was dirt it could not keep up with.
  return clamp(30 + (wageRatio - 1) * 80 + managementQuality(save) * 35
    - staffStrain(save) * 45
    - overmanagement(save) * 8 + playerStaffAppeal(save) * 6, 5, 98)
}

/**
 * The daily operations pass: payroll, morale drift, dirt vs cleaning,
 * breakdowns, turnover, and the health inspector. Pushes day-report events.
 */
export function staffDaily(save, attendeeCount, gamesPlayed, events) {
  const st = save.staffing
  if (!st || !save.economy) return
  const abs = absDayOf(save.day, save.year)
  const { employees, managers } = staffCounts(save)

  // Family work for nothing, so they are not on this bill.
  const paid = st.staff.filter((x) => !x.family)
  const payroll = paid.filter((x) => x.role === 'employee').length * st.employeeWage
    + paid.filter((x) => x.role === 'manager').length * st.managerWage
  if (payroll > 0) econLog(save, -payroll, 'payroll')

  // Attractions earn from the general public, not from your roster — the
  // bowling lanes take money on an afternoon when not one fighting-game player
  // walked in. Scaled by how busy and how known the place is, so a room full
  // of unlocked attractions in a dead arcade is a bill, not an income.
  const rooms = attractionIncome(save)
  if (rooms > 0) econLog(save, rooms, 'attractions — walk-in trade')

  const target = staffMoraleTarget(save)
  st.morale = clamp(st.morale + (target - st.morale) * 0.12, 0, 100)

  // Cleanliness: traffic makes mess, staff clean it back. A solo owner can
  // keep a QUIET floor tidy, but one person is quickly overwhelmed by a crowd
  // — a busy arcade needs employees or it visibly degrades (and eventually
  // the health inspector calls). Managers and morale make cleaning effective.
  const mgmt = managementQuality(save)
  const dirt = attendeeCount * 0.3 + gamesPlayed * 0.04
  const ownerClean = Math.max(0, 3 - attendeeCount * 0.2) // one person, spread thin by a crowd
  const cleaning = ownerClean + employees * 7 * (0.4 + mgmt * 0.6) * (0.5 + st.morale / 150)
  save.arcade.cleanliness = clamp((save.arcade.cleanliness ?? 80) - dirt + cleaning, 0, 100)

  // Breakdowns: a poorly-run floor chews through machines.
  const machines = save.settings.setups + save.arcade.otherGames.length
  if (machines > 0 && chance(machines * 0.005 * (1.7 - mgmt))) {
    // A REPAIR IS A FRACTION OF THE MACHINE (P6). This was a flat $12–32 roll
    // against cabinets that cost $180–420 to buy, so "a cabinet broke down"
    // resolved for the price of lunch and the whole maintenance loop was
    // decoration. Priced off what actually broke: a board swap or a new stick
    // assembly, ~8–22% of the machine, with a floor so it is never trivial.
    const cost = Math.max(18, Math.round(SETUP_COST * (randInt(8, 22) / 100)))
    econLog(save, -cost, 'machine repair')
    events.push({ type: 'economy', text: `🔧 A cabinet broke down mid-evening — $${cost} to get it running again.` })
  }

  // Turnover: underpayment is the big driver; low morale and a top-heavy
  // org chart pile on. Managers quit too.
  const overm = overmanagement(save)
  for (const s of [...st.staff]) {
    if (s.family) continue // family don't quit over the pay they aren't getting
    const fair = s.role === 'manager' ? FAIR_WAGE.manager : FAIR_WAGE.employee
    const wage = s.role === 'manager' ? st.managerWage : st.employeeWage
    const ratio = wage / fair
    let q = 0.003
    if (ratio < 1) q += (1 - ratio) * 0.06
    if (st.morale < 35) q += 0.012
    q += overm * 0.01
    if (chance(q)) {
      st.staff = st.staff.filter((x) => x.id !== s.id)
      const why = ratio < 0.9 ? ' — the pay was not worth it' : overm > 0 ? ' — too many bosses, not enough job' : ''
      events.push({ type: 'staff', text: `🧹 ${s.name} quit${why}.` })
      pushToast(save, { icon: '🧹', text: `${s.name} quit${why}.`, see: { screen: 'manage' }, sticky: true })
    }
  }

  // The health inspector only knocks when the place has visibly gone south.
  if (save.settings.mode !== 'sandbox' &&
      (save.arcade.cleanliness ?? 80) < 30 &&
      (save.arcade.closedUntilAbs == null || save.arcade.closedUntilAbs <= abs) &&
      chance(0.07)) {
    const days = randInt(2, 4)
    const fine = randInt(60, 120)
    save.arcade.closedUntilAbs = abs + days
    econLog(save, -fine, 'health-code fine')
    events.push({
      type: 'economy',
      text: `🚨 The health inspector walked the floor, took one look at the concession counter, and shut the arcade down for ${days} days ($${fine} fine).`,
    })
    chronicle(save, '🚨', `The health department shut ${save.arcade.name} down for ${days} days. Nobody let the regulars forget it.`)
  }
}

// Is the arcade shuttered by the health department today?
export function arcadeClosed(save) {
  const until = save.arcade?.closedUntilAbs
  return until != null && absDayOf(save.day, save.year) < until
}

// ---------- Player wallets ----------

/**
 * TOKENS PER MATCH on the main game. The other half of the price.
 *
 * A token price on its own was never the lever — an arcade sets a cheap token
 * AND charges several of them per play, which is how "a quarter a game" and
 * "solvent" were ever the same sentence. With this pinned at 1 the only way to
 * charge a fair price was to make a token expensive, so 25c tokens meant 25c a
 * match and the room starved. Nobody ran an arcade that way.
 */
export const playTokensOf = (save) => Math.max(1, save?.arcade?.prices?.play ?? 1)

/**
 * WHAT IT COSTS TO PLAY, in dollars. The only price the game should ever judge.
 *
 * Every "is this expensive?" question reads this, never the token price —
 * 25c x 4 and $1 x 1 are the same deal and must feel identical, or the two
 * levers just fight each other.
 */
export const costPerPlay = (save) => (save?.arcade?.prices?.token ?? 1) * playTokensOf(save)

/**
 * What this player thinks of your price, as one signed number.
 *
 * Negative means cheap — under what they'd think twice about. Positive means
 * dear. Everything downstream reads this, so there is exactly one place that
 * decides what "expensive" means to a given wallet.
 *
 * ANCHORED TO A REAL ARCADE. A dollar a game is ordinary, fifty cents is
 * cheap, two dollars is steep, and three dollars a match is outrageous to
 * everybody — the old curve let a rich regular shrug at $2.70, which is not a
 * price any arcade on earth has ever charged for one match. The wallet term is
 * now a modest tilt (±$0.45 across the whole income range) rather than the
 * thing that decides what a fair price is.
 */
export function tokenFeel(save, p) {
  const comfort = 0.75 + statLevel(p.social?.income) * 0.09 // 0.75 .. 1.65
  return costPerPlay(save) - comfort
}

/**
 * How the price moves this player's urge to play, per hour. SIGNED.
 *
 * This used to be `tokenDeterrence` — a one-sided penalty that bottomed out at
 * zero, which made every price under ~$1.80 identical to the game and pricing
 * cheap strictly dominated: less revenue, no upside anywhere in the model.
 * A quarter arcade could not be built, which is the wrong answer to the most
 * obvious thing a player will try.
 *
 * Now cheap play buys VOLUME — the thing quarter arcades actually ran on. A
 * cheap token means one more game, and one more after that.
 *
 * The curve is deliberately ASYMMETRIC: hesitation bites harder than eagerness
 * and reaches further, because people quit an expensive room faster than they
 * binge a cheap one. Volume can soften a low price; it cannot make
 * undercharging free.
 *
 * The dear side is PIECEWISE, and that shape is the point. A bit over the odds
 * is a grumble — people still play, they just play less — so there is a real
 * band between about 75c and $1.75 where an owner can make a living. Past
 * that it turns vertical: at $3 a match this returns about −0.9 against a base
 * urge of ~0.4, and the machines simply stop. Three dollars a game is not a
 * pricing strategy, it is a closed arcade, and no wallet in the room excuses it.
 *
 * A single straight slope could not say both of those things at once — tuned
 * steep enough to kill $3 it also killed $1.50, and tuned to spare $1.50 it
 * let $3 trade.
 */
const DEAR_GRUMBLE = 0.55 // $ over comfort you can get away with

export function tokenPlayShift(save, p) {
  const feel = tokenFeel(save, p)
  if (feel <= 0) return clamp(-feel * 0.16, 0, 0.24) // cheap: one more game
  const grumble = Math.min(feel, DEAR_GRUMBLE) * 0.3
  const gouge = Math.max(0, feel - DEAR_GRUMBLE) * 0.95
  return -clamp(grumble + gouge, 0, 0.95)
}

// Kept as the positive-only reading for anything that only cares about the
// penalty side (and so old call sites can't silently invert).
export const tokenDeterrence = (save, p) => Math.max(0, -tokenPlayShift(save, p))

/**
 * End-of-day register count: main-game tokens, side-cabinet tokens (each at
 * that cabinet's set token cost), and food (each at its set price). High
 * prices squeeze more per sale but lose sales and goodwill — higher-income
 * players barely notice.
 */
// Every player has ONE favorite food and ONE favorite cabinet now, and both
// are finite: a food sells so many servings a night, a cabinet seats so many
// fans. Stock two crowd-pleasers for a big room and you get sellouts and
// lines — SPREAD is what a well-run concession looks like. Nobody is upset
// about a food you never carry; they are upset about the one you DO carry
// being gone when they got in line.
export const FOOD_SERVINGS_PER_DAY = 6
export const CABINET_SEATS_PER_DAY = 6

export function playerSpending(save, attendees, gamesToday, events) {
  if (!save.economy) return 0
  const tokenPrice = save.arcade.prices?.token ?? 1
  const playTokens = playTokensOf(save)
  let tokens = 0
  let foodRevenue = 0
  let foodSales = 0
  let grumbles = 0
  let letdowns = 0 // sold-out favorites + full cabinets — the room remembers
  const servings = {} // food -> sold tonight
  const seats = {} // cabinet -> fans who got a turn tonight
  const sellouts = {} // food -> how many walked away hungry
  const lines = {} // cabinet -> how many never got a turn
  for (const p of attendees) {
    // Read through statLevel like every other consumer of a point-buy stat.
    // Raw, an unspent `income` is 0 rather than the ~5 "average" these formulas
    // were written against — so a generated player was modelled as having
    // literally no money and the concession stand was nearly a closed counter
    // (measured: 111 servings a year at $4 against 469 at $2). tokenDeterrence
    // three lines up was already doing this correctly; this one was missed in
    // the temperament rework.
    const wallet = statLevel(p.social?.income)
    // Main-game matches, at whatever the machine is set to take. This is the
    // half of the price that used to be hardcoded to one token — the reason a
    // cheap token could only ever mean a cheap match.
    tokens += (gamesToday[p.id] || 0) * playTokens
    // Their favorite cabinet: one machine only seats so many a night. Coming
    // in for Rhythm Storm and staring at a line all evening is a real letdown.
    const favGame = (p.otherGames || [])[0]
    if (favGame && save.arcade.otherGames.includes(favGame)) {
      if ((seats[favGame] || 0) < CABINET_SEATS_PER_DAY) {
        seats[favGame] = (seats[favGame] || 0) + 1
        const cost = gameTokensOf(save, favGame)
        const deter = clamp((cost - (1 + wallet * 0.3)) * 0.14, 0, 0.55)
        if (chance(0.55 - deter)) tokens += cost * randInt(1, 3)
      } else {
        lines[favGame] = (lines[favGame] || 0) + 1
        letdowns += 1
        p.mood = clamp(p.mood - 0.25, 0, 10)
      }
    }
    // Food: their favorite first — IF it is carried and has not sold out.
    if (!save.arcade.foods.length) continue
    const favFood = (p.foods || [])[0]
    const favCarried = favFood && save.arcade.foods.includes(favFood)
    let food = null
    let appetite = 0.3
    if (favCarried && (servings[favFood] || 0) < FOOD_SERVINGS_PER_DAY) {
      food = favFood
      appetite = 0.75
    } else if (favCarried) {
      // The one thing they came in wanting, gone. (A food you never stock
      // disappoints nobody — you cannot miss what was never on the counter.)
      sellouts[favFood] = (sellouts[favFood] || 0) + 1
      letdowns += 1
      p.mood = clamp(p.mood - 0.25, 0, 10)
      continue
    } else {
      const pool = save.arcade.foods.filter((f) => (servings[f] || 0) < FOOD_SERVINGS_PER_DAY)
      if (!pool.length) continue
      food = choice(pool)
    }
    const price = foodPriceOf(save, food)
    // The $2 hot dog a broke kid buys every night is a $4 hot dog they never
    // buy again. Wallet decides the ceiling; your price list has to respect it.
    // What a player considers a fair price. Reading `income` through statLevel
    // (above) fixed a counter that was effectively closed, but at the old
    // comfort curve it went too far the other way: an average wallet was
    // comfortable up to $4.30, so the catalogue's default $4 carried NO
    // deterrent and charging more was strictly better. Pricing has to be a
    // trade-off — volume against margin — not a free lever.
    const priceFactor = price / (1.15 + wallet * 0.33)
    // Same trade the token price makes: dear costs you customers, cheap buys
    // volume. Without the second half, underpricing food was pure donation —
    // identical sales at a lower margin — so the counter had one correct price
    // and no decision in it. A cheap snack is one more person at the counter.
    const buyChance = clamp(
      appetite - Math.max(0, priceFactor - 1) * 0.85 + Math.min(Math.max(0, 1 - priceFactor), 0.6) * 0.35,
      0.02, 0.95)
    if (chance(buyChance)) {
      foodRevenue += price
      foodSales += 1
      servings[food] = (servings[food] || 0) + 1
      p.mood = clamp(p.mood + 0.15, 0, 10)
    } else if (priceFactor > 1.25 && chance(0.25)) {
      grumbles += 1
      p.mood = clamp(p.mood - 0.1, 0, 10)
    }
  }
  // The room remembers being let down — a rolling share that drags the
  // arcade's reputation until the stock and the floor plan catch up to demand.
  save.arcade.letdowns = (save.arcade.letdowns ?? 0) * 0.75 +
    (attendees.length ? letdowns / attendees.length : 0) * 0.25
  const worstSellout = Object.entries(sellouts).sort((a, b) => b[1] - a[1])[0]
  if (worstSellout && worstSellout[1] >= 2) {
    events.push({ type: 'economy', text: `🌭 Sold out of ${worstSellout[0]} — ${worstSellout[1]} people left the counter empty-handed.` })
  }
  const worstLine = Object.entries(lines).sort((a, b) => b[1] - a[1])[0]
  if (worstLine && worstLine[1] >= 2) {
    events.push({ type: 'economy', text: `👾 The ${worstLine[0]} cabinet had a line all night — ${worstLine[1]} people never got a turn.` })
  }
  // What the counter and the floor did tonight, for the achievement ledger.
  // Turns taken and turns missed are both recorded: a cabinet with a line all
  // night is the arcade asking for a bigger attraction.
  bump(save, 'foodSold', foodSales)
  bump(save, 'foodRevenue', foodRevenue)
  bumpPeak(save, 'bestFoodNight', foodSales)
  bump(save, 'cabinetPlays', Object.values(seats).reduce((n, v) => n + v, 0))
  bump(save, 'cabinetTurnaways', Object.values(lines).reduce((n, v) => n + v, 0))
  const income = Math.round((tokens * tokenPrice + foodRevenue) * 100) / 100
  if (income > 0) {
    econLog(save, income, `${tokens} token${tokens === 1 ? '' : 's'}, ${foodSales} concession sale${foodSales === 1 ? '' : 's'}`)
  }
  if (grumbles >= 2) {
    events.push({ type: 'economy', text: `😒 ${grumbles} players grumbled about the prices on their way out.` })
  }
  return income
}

// ---------- The landlord ----------

/**
 * Consequential only: every day the account sits in the red, the landlord's
 * patience shrinks. Run out of it and the arcade is foreclosed — the UI
 * prompts a reset (which converts fame into prestige points).
 *
 * How long that patience lasts is a difficulty lever. The other two ways a run
 * can end — the empty room (`collapseGrace`) and being forgotten (`fadeGrace`)
 * — have always scaled with difficulty; this one was a hardcoded 21 days for
 * everyone, which left Master's "the landlord is already drafting the notice"
 * as flavour text with nothing behind it. The two warning beats scale with the
 * grace so the notice and the phone call still land at the same points in the
 * slide no matter how long the slide is.
 */
export function landlordDaily(save, events) {
  const e = save.economy
  if (!e || save.settings.mode === 'sandbox' || e.foreclosed) return
  if (e.money >= 0) {
    e.redDays = 0
    return
  }
  const grace = difficultyOf(save).foreclosureGrace ?? 21
  const notice = Math.max(2, Math.round(grace * 0.48))
  const secondCall = Math.max(notice + 1, Math.round(grace * 0.81))
  e.redDays = (e.redDays || 0) + 1
  if (e.redDays === notice) {
    events.push({ type: 'economy', text: '📮 A FINAL NOTICE is taped to the door. The landlord wants the account settled — soon.' })
  } else if (e.redDays === secondCall) {
    events.push({ type: 'economy', text: '📞 The landlord called twice today. The second call was shorter.' })
  } else if (e.redDays > grace) {
    e.foreclosed = true
    events.push({ type: 'economy', text: '🔒 The locks were changed overnight. The landlord has foreclosed on the arcade.' })
    chronicle(save, '🔒', `${save.arcade.name} was foreclosed on. The last night, nobody wanted to go home.`)
  }
}

/**
 * What a run's fame is worth when it ends: prestige points spent on player
 * creation stats in the next life. Followers, hype, accumulated glory and a
 * storied chronicle all count.
 */
export function prestigeEarned(save) {
  // Legacy points come from milestones hit during the run (model.awardMilestone)
  // — never from merely existing. Start a run and die immediately: bank nothing.
  return Math.round(save.prestigePending || 0)
}
