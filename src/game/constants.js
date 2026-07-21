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
]

export const SOCIAL_STATS = [
  ['politeness', 'Baseline for how easy they are to get along with'],
  ['charisma', 'Make friends faster, better first impressions'],
  ['sportsmanship', 'How gracefully they handle losses'],
  ['persona', 'Polarizing — people either love or hate them'],
  ['community', 'Mentors weaker players, builds teams'],
  ['sensitivity', 'How much social interactions swing their mood'],
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

export function formatDay(dayOfYear, year) {
  const m = Math.floor((dayOfYear - 1) / DAYS_PER_MONTH)
  const d = ((dayOfYear - 1) % DAYS_PER_MONTH) + 1
  return `${MONTH_NAMES[m]} ${d}, Year ${year}`
}

export const HOURS_PER_DAY = 6 // the arcade is open 4 PM - 10 PM
export const HOUR_LABELS = ['4 PM', '5 PM', '6 PM', '7 PM', '8 PM', '9 PM']

export const TOPICS = [
  'frame data', 'the current meta', 'a controversial tier list', 'an old tournament moment',
  'controller vs stick', 'a rumor about a patch', 'their favorite anime', 'the best combo route',
  'salt from a recent set', 'who the best player in the arcade is', 'weekend plans',
  'a legendary comeback', 'training routines', 'matchup theory', 'the worst stage in the game',
]
