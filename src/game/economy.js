// The arcade's books AND its operations. Income: tokens and food the players
// actually buy (priced by the owner, judged by their wallets). Expenses:
// weekly rent scaled to the floor and the difficulty, weekly upkeep on every
// cabinet and food line, daily payroll. Consequential mode has a fail state
// now: stay in the red long enough and the landlord takes the keys.

import { clamp, chance, choice, randInt, uid, hash01 } from './util.js'
import { FOODS, OTHER_GAMES, FIRST_NAMES, LAST_NAMES } from './names.js'
import { difficultyOf, absDayOf, DAYS_PER_MONTH, DEFAULT_FOOD_PRICE, DEFAULT_GAME_TOKENS, AD_CHANNELS } from './constants.js'
import { chronicle } from './model.js'

export const foodPriceOf = (save, name) => save.arcade.foodPrices?.[name] ?? DEFAULT_FOOD_PRICE
export const gameTokensOf = (save, name) => save.arcade.gameTokens?.[name] ?? DEFAULT_GAME_TOKENS

// ---------- Advertising ----------

export const activeAds = (save) => AD_CHANNELS.filter((c) => (save.arcade.ads || []).includes(c.key))
export const adWeeklyCost = (save) => activeAds(save).reduce((s, c) => s + c.cost, 0)

// Early-biased channels lose their punch as the arcade becomes known: a flyer
// campaign for a place everyone already goes is wasted paper. 1 when brand new,
// tapering toward 0.1 as days pass and a following builds.
function earlyWeight(save) {
  const daysOpen = absDayOf(save.day, save.year) - 1
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
  // Rent bites harder than it used to: a passively-run arcade (default prices,
  // no traffic-building, no efficient staffing) can't quite cover it, so walking
  // away after setup bleeds you toward foreclosure. Active management — ads for
  // traffic, smart pricing, a well-run floor — is what turns a profit.
  const base = 160 + save.settings.setups * 38 + save.arcade.otherGames.length * 18
  return Math.round(base * difficultyOf(save).rentMult)
}

// ---------- Fixed catalogs ----------
// Foods and side cabinets are set in stone now — no more inventing menu
// items. Each has a deterministic price tag (hashed from the name so the
// same item always costs the same in every save).

const priceRoll = (seed, lo, hi) => Math.round(lo + hash01(seed) * (hi - lo))

export const FOOD_CATALOG = FOODS.map((name) => ({
  name,
  stockCost: priceRoll(`${name}:stock`, 25, 55), // first stocking
  restock: priceRoll(`${name}:restock`, 6, 14), // weekly resupply
}))

export const GAME_CATALOG = OTHER_GAMES.map((name) => ({
  name,
  price: priceRoll(`${name}:price`, 180, 420), // buying the cabinet
  upkeep: priceRoll(`${name}:upkeep`, 8, 18), // weekly maintenance
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
  const st = save.staffing || { employeeWage: 10, managerWage: 16 }
  const { employees, managers } = staffCounts(save)
  const payroll = (employees * st.employeeWage + managers * st.managerWage) * 28
  return Math.round(rent + upkeep + payroll)
}

// ---------- Staffing ----------

export const FAIR_WAGE = { employee: 10, manager: 16 } // $/day the market expects
export const HIRE_COST = 25 // posting the job, training the hire

export function newStaffMember(role, playerId = null, name = null) {
  return {
    id: uid('staff'),
    role, // 'employee' | 'manager'
    playerId, // a player who took the job — they can't play while staffed
    name: name || `${choice(FIRST_NAMES)} ${choice(LAST_NAMES)}`,
    hiredAbs: 0,
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

// Where morale is headed given current pay and management.
export function staffMoraleTarget(save) {
  const st = save.staffing
  const { employees, managers } = staffCounts(save)
  if (employees + managers === 0) return 70 // nobody to be unhappy
  const wageRatio = clamp(st.employeeWage / FAIR_WAGE.employee, 0.3, 1.6)
  return clamp(30 + (wageRatio - 1) * 80 + managementQuality(save) * 35
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

  const payroll = employees * st.employeeWage + managers * st.managerWage
  if (payroll > 0) econLog(save, -payroll, 'payroll')

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
    const cost = randInt(12, 32)
    econLog(save, -cost, 'machine repair')
    events.push({ type: 'economy', text: `🔧 A cabinet broke down mid-evening — $${cost} to get it running again.` })
  }

  // Turnover: underpayment is the big driver; low morale and a top-heavy
  // org chart pile on. Managers quit too.
  const overm = overmanagement(save)
  for (const s of [...st.staff]) {
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

// How much a token's price cools a player's urge to play this hour.
// 0 = happily feeding the machine; up to ~0.35 = thinking real hard.
export function tokenDeterrence(save, p) {
  const price = save.arcade.prices?.token ?? 1
  const comfort = 0.6 + (p.social?.income ?? 5) * 0.16 // $/game they don't think about
  return clamp((price - comfort) * 0.25, 0, 0.35)
}

/**
 * End-of-day register count: main-game tokens, side-cabinet tokens (each at
 * that cabinet's set token cost), and food (each at its set price). High
 * prices squeeze more per sale but lose sales and goodwill — higher-income
 * players barely notice.
 */
export function playerSpending(save, attendees, gamesToday, events) {
  if (!save.economy) return 0
  const tokenPrice = save.arcade.prices?.token ?? 1
  let tokens = 0
  let foodRevenue = 0
  let foodSales = 0
  let grumbles = 0
  for (const p of attendees) {
    const wallet = p.social?.income ?? 5
    // Main-game matches: a token a game, paid at the change machine.
    tokens += gamesToday[p.id] || 0
    // Side cabinets they like: they feed each its token cost a few times.
    // Pricey cabinets get skipped by the budget-conscious.
    for (const g of save.arcade.otherGames) {
      if (!p.otherGames.includes(g)) continue
      const cost = gameTokensOf(save, g)
      const deter = clamp((cost - (1 + wallet * 0.3)) * 0.14, 0, 0.55)
      if (chance(0.55 - deter)) tokens += cost * randInt(1, 3)
    }
    // Food: buy one liked stocked item at its set price.
    if (!save.arcade.foods.length) continue
    const liked = save.arcade.foods.filter((f) => p.foods.includes(f))
    const pool = liked.length ? liked : save.arcade.foods
    const food = choice(pool)
    const price = foodPriceOf(save, food)
    const appetite = liked.length ? 0.75 : 0.3
    const priceFactor = price / (1.5 + wallet * 0.8)
    const buyChance = clamp(appetite - Math.max(0, priceFactor - 1) * 0.7, 0.02, 0.9)
    if (chance(buyChance)) {
      foodRevenue += price
      foodSales += 1
      p.mood = clamp(p.mood + 0.15, 0, 10)
    } else if (priceFactor > 1.25 && chance(0.25)) {
      grumbles += 1
      p.mood = clamp(p.mood - 0.1, 0, 10)
    }
  }
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
 * patience shrinks. Three weeks of it and the arcade is foreclosed — the UI
 * prompts a reset (which converts fame into prestige points).
 */
export function landlordDaily(save, events) {
  const e = save.economy
  if (!e || save.settings.mode === 'sandbox' || e.foreclosed) return
  if (e.money >= 0) {
    e.redDays = 0
    return
  }
  e.redDays = (e.redDays || 0) + 1
  if (e.redDays === 10) {
    events.push({ type: 'economy', text: '📮 A FINAL NOTICE is taped to the door. The landlord wants the account settled — soon.' })
  } else if (e.redDays === 17) {
    events.push({ type: 'economy', text: '📞 The landlord called twice today. The second call was shorter.' })
  } else if (e.redDays > 21) {
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
  const totalGlory = Object.values(save.players).reduce((s, p) => s + (p.glory || 0), 0)
  const fame = save.stream.followers / 40 + save.stream.hype / 4 + totalGlory / 60 + (save.chronicle?.length || 0) / 12
  return Math.max(1, Math.round(fame))
}
