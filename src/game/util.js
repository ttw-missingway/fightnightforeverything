// Small shared helpers for the simulation.

let idCounter = 0
export function uid(prefix = 'id') {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}_${idCounter}_${Math.floor(Math.random() * 1e6).toString(36)}`
}

export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n))

export const rand = () => Math.random()
export const randInt = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1))
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)]
export const chance = (p) => Math.random() < p

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function sample(arr, n) {
  return shuffle(arr).slice(0, n)
}

// Roll 4d6 drop lowest, mapped onto a 1-10 scale (D&D style stat rolls).
export function rollStat() {
  const dice = [randInt(1, 6), randInt(1, 6), randInt(1, 6), randInt(1, 6)]
  dice.sort((a, b) => a - b)
  const total = dice[1] + dice[2] + dice[3] // 3..18
  return clamp(Math.round((total - 2) / 1.6), 1, 10)
}

// Deterministic pair key so relationship math is symmetric-friendly.
export const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`)

// Stable pseudo-random in [0,1) from a string. Used for "persona" polarization
// so two given players always polarize the same direction.
export function hash01(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10000) / 10000
}

export function fullName(p) {
  return p.alias ? `${p.firstName} "${p.alias}" ${p.lastName}` : `${p.firstName} ${p.lastName}`
}

export function displayName(p, teams) {
  const base = p.alias || `${p.firstName} ${p.lastName}`
  const team = p.teamId && teams ? teams[p.teamId] : null
  return team ? `${team.acronym} | ${base}` : base
}
