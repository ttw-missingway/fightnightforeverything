export const PERSONAL_STATS = [
  ['spark', 'How likely they are to go to the arcade and stay around'],
  ['analysis', 'How much better they get from watching a game'],
  ['determination', 'How much better they get from losing'],
  ['dominance', 'How much better they get from winning'],
  ['temperance', 'How much winning/losing impacts their mood'],
  ['mojo', 'Performance bonus when in a good mood'],
  ['innovation', 'How likely they are to create a new technique'],
  ['learning', 'How quickly they adopt innovations others created'],
  ['xfactor', 'How much added bonus could spike their performance'],
  ['loyalty', 'How likely they are to stick with one character'],
  ['aptitude', 'How quickly they learn a new character'],
  ['mastery', 'How skilled they are at mastering a character'],
  ['stamina', 'How many games they can play in a day before fatigue sets in'],
  ['composure', 'Nerves on the big stage — tournaments and EVO punish the shaky'],
]

export const SOCIAL_STATS = [
  ['politeness', 'Baseline for how easy they are to get along with'],
  ['charisma', 'Make friends faster, better first impressions'],
  ['sportsmanship', 'How gracefully they handle losses'],
  ['persona', 'Polarizing — people either love or hate them'],
  ['community', 'Mentors weaker players, builds teams'],
  ['sensitivity', 'How much social interactions swing their mood'],
  ['hygiene', 'Self-explanatory. The arcade is a small room. People notice.'],
]

export const PERSONAL_KEYS = PERSONAL_STATS.map(([k]) => k)
export const SOCIAL_KEYS = SOCIAL_STATS.map(([k]) => k)

export const ARCHETYPES = [
  'Shoto', 'Grappler', 'Zoner', 'Rushdown', 'Charge', 'Puppet',
  'Setplay', 'Footsies', 'Mix-up', 'Glass Cannon', 'All-Rounder', 'Big Body',
]

export const MOVE_TYPES = [
  'projectile', 'melee', 'light', 'heavy', 'set up', 'trap',
  'anti-air', 'command grab', 'counter', 'install', 'movement', 'super',
]

export const GENDERS = ['woman', 'man', 'non-binary']

// Calendar: 12 months x 28 days.
export const DAYS_PER_MONTH = 28
export const MONTHS_PER_YEAR = 12
export const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR // 336
export const EVO_DAY = 322 // day-of-year EVO fires automatically

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Day 1 of every year is a Sunday (28-day months keep weekdays aligned).
export const weekdayOf = (dayOfYear) => (dayOfYear - 1) % 7
export const dayOfMonthOf = (dayOfYear) => ((dayOfYear - 1) % DAYS_PER_MONTH) + 1

export const BRACKET_SIZES = [2, 4, 8, 16, 32, 64]

// Join a {city, state, country} into a display string, skipping blanks.
export function formatLocation(loc) {
  if (!loc) return ''
  return [loc.city, loc.state, loc.country].map((s) => (s || '').trim()).filter(Boolean).join(', ')
}

export function formatDay(dayOfYear, year) {
  const m = Math.floor((dayOfYear - 1) / DAYS_PER_MONTH)
  const d = ((dayOfYear - 1) % DAYS_PER_MONTH) + 1
  return `${MONTH_NAMES[m]} ${d}, Year ${year}`
}

export const HOURS_PER_DAY = 6 // the arcade is open 4 PM - 10 PM
export const HOUR_LABELS = ['4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM']

// Absolute day number across years (year 1 day 1 === 1). Used for idle
// catch-up math, auto-stream cadence gating, and scheduled patch dates.
export const absDayOf = (dayOfYear, year) => (year - 1) * DAYS_PER_YEAR + dayOfYear
export const dateOfAbs = (abs) => ({
  year: Math.floor((abs - 1) / DAYS_PER_YEAR) + 1,
  day: ((abs - 1) % DAYS_PER_YEAR) + 1,
})

// Idle mode: how much real time one advance-step (one in-game hour, plus the
// open/close/tournament boundary steps) costs. `ms` is uniform across step
// types so offline catch-up is just floor(elapsed / ms). Real time anchors an
// in-game hour to a real hour; the faster tiers are for watching progress.
export const IDLE_SPEEDS = [
  { key: 'realtime', label: 'Real time', ms: 3600000, blurb: '1 hour = 1 hour · a full day ≈ 8 real hrs' },
  { key: 'fast', label: 'Fast', ms: 60000, blurb: '1 hour = 1 min · a full day ≈ 8 min' },
  { key: 'faster', label: 'Faster', ms: 10000, blurb: '1 hour = 10 sec · a full day ≈ 80 sec' },
  { key: 'blitz', label: 'Blitz', ms: 1000, blurb: '1 hour = 1 sec · a full day ≈ 8 sec' },
]
export const idleSpeedOf = (key) => IDLE_SPEEDS.find((s) => s.key === key) || IDLE_SPEEDS[0]

// Auto-stream: which match to put on the channel, and how often.
export const AUTO_STREAM_SELECTORS = [
  { key: 'closest', label: 'Closest matches', blurb: 'the match nearest a 50/50' },
  { key: 'best', label: 'Best players', blurb: 'top combined skill + fame' },
  { key: 'first', label: 'First setup', blurb: 'whatever is on setup 1' },
]
export const AUTO_STREAM_CADENCES = [
  { key: 'hourly', label: 'Every hour' },
  { key: 'daily', label: 'Once a day' },
  { key: 'weekly', label: 'Once a week' },
  { key: 'weekends', label: 'Weekends only' },
]

// Floor talk: game-brained nerd chatter over the side cabinets.
export const TOPICS = [
  'frame data', 'the current meta', 'a controversial tier list', 'an old tournament moment',
  'controller vs stick', 'a rumor about a patch', 'their favorite anime', 'the best combo route',
  'a legendary comeback', 'training routines', 'matchup theory', 'the worst stage in the game',
  'which side cabinet is secretly rigged', 'high score strategies',
]

// Concession talk: people talk about PEOPLE over food.
export const GOSSIP_TOPICS = [
  'salt from a recent set', 'who the best player in the arcade is', 'weekend plans',
  'who has beef with whom', 'somebody\'s mysterious new practice schedule',
  'whether the new regular is actually good', 'the drama from last week',
  'work, life, and everything outside the arcade', 'which team is recruiting',
]

// Preset stat spreads for quick player creation. Every key 1-10.
export const STAT_PRESETS = {
  'The Prodigy': {
    personal: { spark: 6, analysis: 5, determination: 3, dominance: 7, temperance: 4, mojo: 8, innovation: 5, learning: 6, xfactor: 9, loyalty: 4, aptitude: 9, mastery: 7, stamina: 5 , composure: 4 },
    social: { politeness: 4, charisma: 7, sportsmanship: 4, persona: 8, community: 3, sensitivity: 6 , hygiene: 5 },
  },
  'The Grinder': {
    personal: { spark: 8, analysis: 5, determination: 9, dominance: 4, temperance: 8, mojo: 3, innovation: 3, learning: 5, xfactor: 2, loyalty: 9, aptitude: 4, mastery: 8, stamina: 9 , composure: 8 },
    social: { politeness: 6, charisma: 3, sportsmanship: 7, persona: 2, community: 4, sensitivity: 3 , hygiene: 4 },
  },
  'The Lab Monster': {
    personal: { spark: 5, analysis: 9, determination: 6, dominance: 4, temperance: 6, mojo: 3, innovation: 9, learning: 8, xfactor: 4, loyalty: 6, aptitude: 6, mastery: 7, stamina: 6 , composure: 6 },
    social: { politeness: 5, charisma: 3, sportsmanship: 6, persona: 4, community: 5, sensitivity: 4 , hygiene: 2 },
  },
  'The Showman': {
    personal: { spark: 8, analysis: 3, determination: 4, dominance: 7, temperance: 3, mojo: 9, innovation: 4, learning: 4, xfactor: 8, loyalty: 5, aptitude: 5, mastery: 4, stamina: 6 , composure: 7 },
    social: { politeness: 4, charisma: 9, sportsmanship: 3, persona: 9, community: 4, sensitivity: 7 , hygiene: 8 },
  },
  'The Mentor': {
    personal: { spark: 6, analysis: 7, determination: 5, dominance: 3, temperance: 8, mojo: 4, innovation: 5, learning: 6, xfactor: 3, loyalty: 8, aptitude: 5, mastery: 7, stamina: 5 , composure: 8 },
    social: { politeness: 8, charisma: 6, sportsmanship: 9, persona: 3, community: 9, sensitivity: 5 , hygiene: 7 },
  },
  'The Hothead': {
    personal: { spark: 7, analysis: 3, determination: 7, dominance: 9, temperance: 2, mojo: 6, innovation: 3, learning: 3, xfactor: 7, loyalty: 6, aptitude: 5, mastery: 5, stamina: 7 , composure: 2 },
    social: { politeness: 2, charisma: 5, sportsmanship: 2, persona: 8, community: 2, sensitivity: 8 , hygiene: 5 },
  },
  'The Wildcard': {
    personal: { spark: 5, analysis: 4, determination: 4, dominance: 5, temperance: 5, mojo: 6, innovation: 8, learning: 5, xfactor: 10, loyalty: 2, aptitude: 7, mastery: 3, stamina: 5 , composure: 5 },
    social: { politeness: 5, charisma: 6, sportsmanship: 5, persona: 7, community: 3, sensitivity: 5 , hygiene: 3 },
  },
  'The Journeyman': {
    personal: { spark: 6, analysis: 6, determination: 6, dominance: 5, temperance: 7, mojo: 5, innovation: 4, learning: 6, xfactor: 4, loyalty: 8, aptitude: 5, mastery: 6, stamina: 7 , composure: 7 },
    social: { politeness: 7, charisma: 5, sportsmanship: 7, persona: 3, community: 6, sensitivity: 4 , hygiene: 6 },
  },
}
