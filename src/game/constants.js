export const PERSONAL_STATS = [
  ['spark', 'How likely they are to go to the arcade and stay around'],
  ['analysis', 'Learns by watching, and turns matchup knowledge into wins'],
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
  ['adaptation', 'Counterpicking and pocket characters — thrives off their main'],
  ['presence', 'The camera loves them — draws viewers and builds a public profile'],
]

export const SOCIAL_STATS = [
  ['politeness', 'Baseline for how easy they are to get along with'],
  ['charisma', 'Make friends faster, better first impressions'],
  ['sportsmanship', 'How gracefully they handle losses'],
  ['persona', 'Polarizing — people either love or hate them'],
  ['community', 'Mentors weaker players, builds teams'],
  ['sensitivity', 'How much social interactions swing their mood'],
  ['reliability', 'Shows up when it counts — steady weekday turnout, never drops from a bracket'],
  ['income', 'Spending money they walk in with — buys tokens and food, resists high prices'],
]

export const PERSONAL_KEYS = PERSONAL_STATS.map(([k]) => k)
export const SOCIAL_KEYS = SOCIAL_STATS.map(([k]) => k)

// ---------- Temperaments ----------
// Creation is a Disco-style build now: every stat starts EMPTY, you pick one
// competitive temperament and one social temperament (a point in each of that
// row's stats, free), then spend your difficulty's creation points wherever you
// like, capped at 5 per stat. An unspent stat isn't "average" — it's a flaw,
// and flaws are where the stories come from.
export const TEMPERAMENTS = [
  {
    key: 'killer', label: 'The Killer', emoji: '🔥',
    stats: ['determination', 'dominance', 'mojo', 'xfactor'],
    blurb: 'Winning is the point. Losing is fuel. They run hotter than everyone in the room and the room can feel it — keep one leashed and they drag your whole scene up; leave one alone and they burn it down.',
  },
  {
    key: 'scholar', label: 'The Scholar', emoji: '💨',
    stats: ['analysis', 'innovation', 'learning', 'mastery'],
    blurb: "They watch three sets for every one they play, and they remember all of it. The chart is a weapon, the lab is home, and the tech everyone runs next month has their name on it — whether anyone says so or not.",
  },
  {
    key: 'natural', label: 'The Natural', emoji: '💧',
    stats: ['spark', 'aptitude', 'adaptation', 'presence'],
    blurb: "Some people just have it. They're at the arcade every night like water finding its level, they pick up a new character over a weekend, and when the camera swings their way the chat wakes up.",
  },
  {
    key: 'stoic', label: 'The Stoic', emoji: '🪨',
    stats: ['temperance', 'loyalty', 'stamina', 'composure'],
    blurb: "Nothing moves them. Not a bad loss, not a hot streak, not ten thousand people watching a grand final. They pick a character, play a thousand hours, and outlast every prodigy who ever laughed at their neutral.",
  },
]

export const SOCIAL_TEMPERAMENTS = [
  {
    key: 'warm', label: 'Warm', emoji: '💛',
    stats: ['charisma', 'community'],
    blurb: 'The glue. Learns your name the first night, introduces newcomers around, ends up godparent to half the scene.',
  },
  {
    key: 'gracious', label: 'Gracious', emoji: '🤝',
    stats: ['politeness', 'sportsmanship'],
    blurb: "Runs the set back, says good games and means it. The kind of loss you don't mind taking — and the kind of player a warning actually reaches.",
  },
  {
    key: 'dramatic', label: 'Dramatic', emoji: '🎭',
    stats: ['persona', 'sensitivity'],
    blurb: 'Feels everything, at volume. Half the arcade would run through a wall for them; the other half leaves when they arrive. Nobody plateaus with one of these around.',
  },
  {
    key: 'puttogether', label: 'Put-together', emoji: '🧾',
    stats: ['reliability', 'income'],
    blurb: "Has their life in order, which around here makes them exotic. Shows up when they said they would, never drops from a bracket, and actually buys the food.",
  },
]
export const temperamentOf = (key, list = TEMPERAMENTS) => list.find((t) => t.key === key) || null

// Stats are stored internally on the same 0–10 scale the engine has always
// used; creation works in 0–5 display points (1 point = 2 internal). This is
// why old saves, exports, and every formula keep working untouched.
export const STAT_UNIT = 2 // internal per creation point
export const STAT_MAX_POINTS = 5 // per-stat cap, every difficulty

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

// Difficulty: the sliders that make a run harder. Stat points bound player
// creation, starting money is the opening float, rent/popularity/reception
// multipliers squeeze (or pad) everything downstream. Master is meant to be
// nearly impossible.
// Each tier also sets how much rope the two non-economic funnels give you:
// `collapseGrace` is how many dead nights the scene survives, `fadeGrace` how
// long the world can ignore you, and `rentEscalation` is the annual rent hike
// that makes standing still a losing move.
export const DIFFICULTIES = [
  {
    key: 'easy', label: 'Easy', statPoints: 10,
    startingMoney: 2200, rentMult: 0.7, rentBase: 120, popularityMult: 1.35, receptionBias: 4,
    collapseGrace: 60, fadeGrace: 120, rentEscalation: 0, relevanceDecayMult: 0.6,
    blurb: 'Generous funds, cheap rent, a forgiving community.',
  },
  {
    key: 'normal', label: 'Normal', statPoints: 5,
    startingMoney: 1500, rentMult: 1, rentBase: 150, popularityMult: 0.95, receptionBias: -1,
    collapseGrace: 30, fadeGrace: 50, rentEscalation: 0.12, relevanceDecayMult: 1.32,
    blurb: 'The intended experience: a scene you have to keep alive on purpose.',
  },
  {
    key: 'difficult', label: 'Difficult', statPoints: 3,
    startingMoney: 850, rentMult: 1.15, rentBase: 175, popularityMult: 0.6, receptionBias: -5,
    collapseGrace: 21, fadeGrace: 38, rentEscalation: 0.16, relevanceDecayMult: 1.35,
    blurb: 'Thin margins, a skeptical internet, a hungry landlord.',
  },
  {
    key: 'master', label: 'Master', statPoints: 0,
    startingMoney: 1050, rentMult: 1.2, rentBase: 170, popularityMult: 0.95, receptionBias: -9,
    collapseGrace: 16, fadeGrace: 30, rentEscalation: 0.16, relevanceDecayMult: 1.7,
    blurb: 'Nearly impossible. The landlord is already drafting the notice.',
  },
]
export const difficultyOf = (save) =>
  DIFFICULTIES.find((d) => d.key === (save?.settings?.difficulty || 'normal')) || DIFFICULTIES[1]

// Default per-item prices when something is first stocked/installed.
export const DEFAULT_FOOD_PRICE = 4 // dollars per serving
export const DEFAULT_GAME_TOKENS = 2 // tokens to play a side cabinet once
// Changing a created player's rolled food/arcade tastes costs stat points —
// tastes come free from the random roll; curating them is a real tradeoff.
export const TASTE_CHANGE_COST = 1

// Advertising channels. Each you run adds `cost` to the weekly upkeep bill.
// `awareness` lifts how easily first-timers discover the arcade; `arrivals`
// pulls in new faces; `hypePerDay` steers public opinion (channel hype).
// `phase` shapes when it's worth it:
//  - 'early'  : reach fades as you become known (great while unknown, wasteful later)
//  - 'steady' : constant presence — momentum once you're established
//  - 'late'   : big reach, but the cost self-selects for a bankrolled arcade
//  - 'opinion': primarily a hype/opinion lever, compounds with your following
export const AD_CHANNELS = [
  {
    key: 'flyers', label: 'Flyers', cost: 18, phase: 'early',
    awareness: 0.18, arrivals: 0.015, hypePerDay: 0.02,
    blurb: 'Cheap and local. Nudges the room fuller while nobody knows you exist — but no one reads a flyer for a place they already go.',
  },
  {
    key: 'radio', label: 'Radio', cost: 44, phase: 'early',
    awareness: 0.15, arrivals: 0.025, hypePerDay: 0.05,
    blurb: 'Local drive-time spots. Solid early reach that fades once you\'re a known quantity — and the weekly cost stings on a tight budget.',
  },
  {
    key: 'social', label: 'Social Media', cost: 36, phase: 'opinion',
    awareness: 0.06, arrivals: 0.025, hypePerDay: 0.16,
    blurb: 'Compounds with your following. The best lever for steering public opinion back up when it sours.',
  },
  {
    key: 'billboards', label: 'Billboards', cost: 90, phase: 'steady',
    awareness: 0.15, arrivals: 0.04, hypePerDay: 0.04,
    blurb: 'A constant presence on the commute. Pricey, but keeps momentum once you\'re established.',
  },
  {
    key: 'tv', label: 'TV', cost: 190, phase: 'late',
    awareness: 0.20, arrivals: 0.07, hypePerDay: 0.13,
    blurb: 'The big reach. Expensive enough to hurt early, but it moves everything — attendance and opinion alike.',
  },
]

// Arcade status ladder: showing up once makes you a newbie, not a regular.
// Checked top-down; star and legend also demand a resume (glory), because
// being a fixture isn't just attendance — it's mattering.
// Status is EARNED, and the top of the ladder is rare. Legend is for EVO
// champions and all-time greats (an EVO title is ~100 glory); star is a genuine
// standout with deep runs and titles; even veteran demands you've been around a
// long time AND actually done something. Most of a 48-player roster lives at
// regular or below — the forgettable and the casual never climb past it.
export const STATUS_TIERS = [
  // Legend is EVO-champions-only in practice — the glory path is set beyond
  // reach on purpose (local glory inflates over the years and would otherwise
  // hand the title out). The champion shortcut lives in statusOf below.
  { key: 'legend', label: 'legend', days: 160, glory: 100000 },
  { key: 'star', label: 'star', days: 130, glory: 90 },
  { key: 'veteran', label: 'veteran', days: 110, glory: 15 },
  { key: 'regular', label: 'regular', days: 40, glory: 0 },
  { key: 'casual', label: 'casual', days: 12, glory: 0 },
  { key: 'newbie', label: 'newbie', days: 1, glory: 0 },
]

export function statusOf(player) {
  if (!player.isRegular || !player.daysAttended) return null
  // Legend is essentially reserved for EVO champions — that title alone (with
  // real tenure) makes you an all-time great. The glory path exists only for a
  // monumental non-champion career, and its bar is deliberately near-unreachable
  // without a title so the label stays rare and meaningful.
  if ((player.evoTitles || 0) >= 1 && player.daysAttended >= 120) return STATUS_TIERS[0]
  for (const t of STATUS_TIERS) {
    if (player.daysAttended >= t.days && (player.glory || 0) >= t.glory) return t
  }
  return STATUS_TIERS[STATUS_TIERS.length - 1]
}

// Competitive intensity: how hungry a player is — DERIVED from their "will to
// win" stats, not stored. It's the single most important thing about a roster:
// a high-intensity scene left unmanaged curdles into toxicity, while a
// low-intensity one plateaus and never produces an EVO threat. Returns 1..10.
export function competitiveIntensity(player) {
  const s = player.personal || {}
  return ((s.determination ?? 5) + (s.dominance ?? 5) + (s.mojo ?? 5) + (s.xfactor ?? 5)) / 4
}

export function intensityLabel(v) {
  if (v >= 7.5) return 'ferociously competitive'
  if (v >= 6) return 'hungry'
  if (v >= 4.5) return 'competitive enough'
  if (v >= 3) return 'casual'
  return 'just here to hang out'
}

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
  'someone\'s new job', 'a breakup nobody saw coming', 'who\'s been skipping sessions',
  'the rumor going around the counter', 'who\'s secretly thinking about quitting',
]

// Preset stat spreads for quick player creation. Every key 1-10.
