// The arcade's books. Income: door quarters, concession sales, stream ad
// revenue. Expenses: weekly rent scaled to the floor, plus anything the
// owner buys mid-save. No fail state yet — just pressure.

export function econLog(save, amount, label) {
  const e = save.economy
  if (!e) return
  e.money = Math.round((e.money + amount) * 100) / 100
  e.log.unshift({ day: save.day, year: save.year, amount: Math.round(amount * 100) / 100, label })
  if (e.log.length > 40) e.log.pop()
}

// Returns false (and does nothing) if the arcade can't afford it.
export function trySpend(save, amount, label) {
  if (!save.economy) return true
  if (save.economy.money < amount) return false
  econLog(save, -amount, label)
  return true
}

export function weeklyRent(save) {
  return 100 + save.settings.setups * 35 + save.arcade.otherGames.length * 12
}

// Purchase prices for mid-save additions (setup wizard configuration is free
// — that's the arcade you started with).
export const PRICES = {
  food: 40,
  sideGame: 250,
  setup: 400,
}
