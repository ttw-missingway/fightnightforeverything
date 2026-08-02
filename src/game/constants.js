// constants.js owns the season calendar, so it owns the season-filtered view
// of the excuse pool. names.js is a pure leaf (no imports of its own), so this
// edge cannot close a cycle.
import { LIFE_EVENTS, SCHOOL_LIFE_EVENTS } from './names.js'

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
  // Deliberately double-edged (decided 2026-07-29, REVISION §1.2): the same
  // number that lets someone read and settle a room is the number that makes
  // a bad night land twice as hard. Kept its key and its name; only the
  // definition widened to carry empathy alongside the volatility it had.
  ['sensitivity', 'Reads the room and is moved by it — considerate, and easily wounded'],
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
    key: 'killer', label: 'The Killer', emoji: '🔥', color: 'var(--red)',
    stats: ['determination', 'dominance', 'mojo', 'xfactor'],
    blurb: 'Winning is the point. Losing is fuel. They run hotter than everyone in the room and the room can feel it — keep one leashed and they drag your whole scene up; leave one alone and they burn it down.',
  },
  {
    key: 'scholar', label: 'The Scholar', emoji: '💨', color: 'var(--gold)',
    stats: ['analysis', 'innovation', 'learning', 'mastery'],
    blurb: "They watch three sets for every one they play, and they remember all of it. The chart is a weapon, the lab is home, and the tech everyone runs next month has their name on it — whether anyone says so or not.",
  },
  {
    key: 'natural', label: 'The Natural', emoji: '💧', color: 'var(--blue)',
    stats: ['spark', 'aptitude', 'adaptation', 'presence'],
    blurb: "Some people just have it. They're at the arcade every night like water finding its level, they pick up a new character over a weekend, and when the camera swings their way the chat wakes up.",
  },
  {
    key: 'stoic', label: 'The Stoic', emoji: '🪨', color: 'var(--green)',
    stats: ['temperance', 'loyalty', 'stamina', 'composure'],
    blurb: "Nothing moves them. Not a bad loss, not a hot streak, not ten thousand people watching a grand final. They pick a character, play a thousand hours, and outlast every prodigy who ever laughed at their neutral.",
  },
]

export const SOCIAL_TEMPERAMENTS = [
  {
    key: 'warm', label: 'Warm', emoji: '💛', color: 'var(--orange)',
    stats: ['charisma', 'community'],
    blurb: 'The glue. Learns your name the first night, introduces newcomers around, ends up godparent to half the scene.',
  },
  {
    key: 'gracious', label: 'Gracious', emoji: '🤝', color: 'var(--cyan)',
    stats: ['politeness', 'sportsmanship'],
    blurb: "Runs the set back, says good games and means it. The kind of loss you don't mind taking — and the kind of player a warning actually reaches.",
  },
  {
    key: 'dramatic', label: 'Dramatic', emoji: '🎭', color: 'var(--magenta)',
    stats: ['persona', 'sensitivity'],
    blurb: 'Feels everything, at volume. Half the arcade would run through a wall for them; the other half leaves when they arrive. Nobody plateaus with one of these around.',
  },
  {
    key: 'puttogether', label: 'Put-together', emoji: '🧾', color: 'var(--indigo)',
    stats: ['reliability', 'income'],
    blurb: "Has their life in order, which around here makes them exotic. Shows up when they said they would, never drops from a bracket, and actually buys the food.",
  },
]
export const temperamentOf = (key, list = TEMPERAMENTS) => list.find((t) => t.key === key) || null

// ---------- Spirit — the third temperament layer (REVISION §1.6) ----------
// Six choose-ones: the COMPLETE set of orderings of three axes, so nothing is
// missing and nothing is redundant. Spirit is SET IN STONE — never grows,
// never rerolled, one per player. Competitive temperament is how they play,
// social temperament is how they relate, spirit is what they could become.
//
// Each axis ceilings one of the player's own quantities AND radiates an
// effect onto everyone around them. Caps and radiances are tuned on separate
// knobs (see eureka.js RADIANCE) — conflated, tuning one silently breaks the
// other.
export const SPIRIT_AXES = {
  skill: { label: 'skill', caps: 'skill', radiates: 'standards — proximity raises what the room believes normal is' },
  love: { label: 'love', caps: 'community', radiates: 'cohesion — suppresses hatred and burnout in others' },
  mana: { label: 'mana', caps: 'popularity', radiates: 'attention — people want to be like them' },
}

export const SPIRITS = [
  {
    key: 'guru', label: 'The Guru', emoji: '🕯', order: ['love', 'skill', 'mana'],
    blurb: 'The room comes first, and the room notices. Good — genuinely good — but their real gift is what everyone around them becomes.',
  },
  {
    key: 'fool', label: 'The Fool', emoji: '🎈', order: ['mana', 'love', 'skill'],
    blurb: 'Beloved and unbothered. The crowd adores them, their friends would die for them, and the bracket will never quite be theirs.',
  },
  {
    key: 'king', label: 'The King', emoji: '👑', order: ['mana', 'skill', 'love'],
    blurb: 'Famous first, great second. The camera finds them before the results do — and the results usually come. It gets lonely at the top.',
  },
  {
    key: 'hero', label: 'The Hero', emoji: '⚔️', order: ['skill', 'love', 'mana'],
    blurb: 'The real thing. The blade comes first, the people close behind — the world just takes a while to notice either.',
  },
  {
    key: 'outlaw', label: 'The Outlaw', emoji: '🃏', order: ['skill', 'mana', 'love'],
    blurb: 'Great, watchable, and impossible. The talent is enormous, the legend grows — and the room never quite feels like theirs.',
  },
  {
    key: 'healer', label: 'The Healer', emoji: '🌿', order: ['love', 'mana', 'skill'],
    blurb: 'The heart of any scene lucky enough to have them. Everyone is better for knowing them; the trophy shelf stays modest.',
  },
]
export const spiritOf = (key) => SPIRITS.find((s) => s.key === key) || null

// Three hidden values, uniform on this range, assigned highest-to-lowest in
// the spirit's order. The range is the ONLY lever on how much the third slot
// bites (§1.6: no axis gets an additional penalty). It is a claim about the
// elite band and calibrated against BALANCE.md §14's measurements: champion
// skill ~95, top-8 ~89, top-64 cutoff ~55. At [75,100] a primary (E≈94) is
// world-champion material and a tertiary (E≈81) makes the leaderboard and
// never wins EVO — the essential shape. (Deviation on record: a tertiary
// lands nearer top-20 than "fringe of top 64", because the measured cutoff
// sits at 55, not the ~85 the original sketch assumed. Revisit only with
// fingerprint numbers in hand.)
export const SPIRIT_ROLL = [75, 100]

/**
 * Talent breadth — how many stats glow at once (§1.1's K). Derived from how
 * LOPSIDED the roll is, not how high: a 94/85/76 is a specialist with few,
 * focused glows; a 90/88/86 is a generalist with wide ones. Orthogonal to
 * power, so there is no rich-get-richer loop, and it makes roll variance do
 * real work instead of sitting there as noise.
 *
 * THE FLOOR IS TWO, AND IT IS NOT NEGOTIABLE. This used to clamp to 1–4, and
 * a specialist's breakthrough therefore arrived as a single button with one
 * label on it. §1.3 says the choice between fixing the flaw and sharpening
 * the blade IS the system; a choice of one is not a smaller version of that
 * system, it is the absence of it — a chore with a modal. So breadth now
 * decides how WIDE the choice is, from two to five, and never whether there
 * is one. (The specialist is still a specialist: they get two options where a
 * generalist gets five, and their options are more likely to be the same
 * stats over and over, which is what being narrow actually feels like.)
 */
export function talentBreadth(player) {
  const rolls = player.spiritRolls
  if (!rolls || rolls.length < 3) return 3
  const spread = rolls[0] - rolls[2] // 0..25 on the current range
  return clampBreadth(5 - Math.floor(spread / 6))
}
const clampBreadth = (k) => Math.max(2, Math.min(5, k))

// Stats are stored internally on the same 0–10 scale the engine has always
// used; creation works in 0–5 display points (1 point = 2 internal). This is
// why old saves, exports, and every formula keep working untouched.
export const STAT_UNIT = 2 // internal per creation point
export const STAT_MAX_POINTS = 5 // per-stat cap, every difficulty

/**
 * Re-express a sparse point-buy stat on the 1–10 scale the old formulas expect.
 *
 * The comment above is half true: the NUMERIC range survived the temperament
 * rework, but the distribution did not. Stats used to be rolled and sat near 5;
 * now every stat starts EMPTY and you spend a small budget, so a roster is
 * mostly zeroes with a few spikes and the mean of any one stat is about 1.2.
 *
 * That silently inverted every formula shaped like `(10 - stat)` or `stat - 5`.
 * Those read an unspent stat as the WORST possible value, when the point-buy
 * design means it should read as unremarkable — so the average arcade regular
 * came out maximally disloyal, maximally tilted, maximally rude and maximally
 * prone to choking, all at once, without anyone having chosen any of it.
 *
 * statLevel puts an unspent stat back on the old average of 5 and lets every
 * point spent read as above average. Use it wherever ABSENCE of a stat would
 * otherwise be a penalty. Do NOT use it for plain bonus terms (`+ mojo * 0.8`)
 * — there, zero correctly means "no bonus", which is what the point buy is for.
 */
export const statLevel = (v) => 5 + (v || 0) / 2

export const ARCHETYPES = [
  'Shoto', 'Grappler', 'Zoner', 'Rushdown', 'Charge', 'Puppet',
  'Setplay', 'Footsies', 'Mix-up', 'Glass Cannon', 'All-Rounder', 'Big Body',
  'Weapon Master', 'Aerial', 'Stance Switch', 'Counter-Puncher',
]

// What a character DEMANDS of the person playing it — the character half of
// the eureka influence channel (REVISION §1.2). Playing against the grain of
// your own sheet generates more friction and opens glows otherwise out of
// reach, which turns pocket-pick rotation and character crisis into build
// decisions rather than flavour.
export const ARCHETYPE_DEMANDS = {
  'Shoto': ['mastery', 'loyalty'],
  'Grappler': ['dominance', 'composure', 'temperance'],
  'Zoner': ['analysis', 'mastery'],
  'Rushdown': ['mojo', 'spark', 'xfactor'],
  'Charge': ['temperance', 'loyalty'],
  'Puppet': ['aptitude', 'analysis', 'mastery'],
  'Setplay': ['innovation', 'analysis'],
  'Footsies': ['composure', 'analysis'],
  'Mix-up': ['xfactor', 'mojo'],
  'Glass Cannon': ['xfactor', 'composure'],
  'All-Rounder': ['adaptation', 'learning'],
  'Big Body': ['temperance', 'determination'],
  'Weapon Master': ['mastery', 'adaptation'],
  'Aerial': ['spark', 'aptitude'],
  'Stance Switch': ['aptitude', 'learning', 'adaptation'],
  'Counter-Puncher': ['analysis', 'composure', 'temperance'],
}

// The move type that turns one character into another. It lives here rather
// than in design.js because forms.js needs it and must not depend on the
// design content module — see src/game/forms.js.
export const FORM_MOVE_TYPE = 'form change'

export const MOVE_TYPES = [
  'projectile', 'melee', 'light', 'heavy', 'set up', 'trap',
  'anti-air', 'command grab', 'counter', 'install', 'movement', 'super',
  FORM_MOVE_TYPE,
]

export const GENDERS = ['woman', 'man', 'non-binary']

// Calendar: 12 months x 28 days.
export const DAYS_PER_MONTH = 28
export const MONTHS_PER_YEAR = 12
export const DAYS_PER_YEAR = DAYS_PER_MONTH * MONTHS_PER_YEAR // 336
/**
 * EVO is a fixed date on the world's calendar: June 22.
 *
 * It sits a week after a new arcade opens, and that is the whole point. Your
 * first one happens TO you — nobody from your room is anywhere near qualifying
 * — and then it is a date you can see coming for the next eleven months.
 */
export const EVO_DAY = 162 // June 22

/**
 * A run opens on June 15. Two reasons, and they are the same reason.
 *
 * The cast are school and college kids, so summer is when the room is full —
 * a new owner gets their best months first, learns the place while it is easy,
 * and then meets September. And opening a week before EVO means the goal is
 * set before the player has done anything at all.
 */
export const OPENING_DAY = 155 // June 15

/**
 * Days this run has been open. NOT the same as the absolute day any more:
 * a run starts on day 155, so `absDayOf` reads 155 on opening night.
 *
 * Anything asking "how old is this arcade" wants this. Anything asking "what
 * date is it" (rent, EVO, the schedule) wants the calendar.
 */
export const runAge = (save) =>
  absDayOf(save?.day ?? 1, save?.year ?? 1) - (save?.openedAbs ?? 1) + 1

/**
 * The school year, which is the calendar the cast actually lives on.
 *
 * Summer is the good months. September is a cliff, not a slope — everyone
 * goes back at once, and a room that felt like a scene in August is suddenly
 * four people on a Tuesday. Surviving that first September is the earliest
 * real test of whether the place is built on anything.
 */
export const SEASONS = [
  { key: 'summer', from: 141, to: 224, factor: 1.3, label: 'Summer', blurb: 'School is out and the room is full.' },
  { key: 'backtoschool', from: 225, to: 252, factor: 0.7, label: 'Back to school', blurb: 'Everyone just went back. The floor is half empty and nobody has a routine yet.' },
  { key: 'term', from: 253, to: 329, factor: 0.88, label: 'Term time', blurb: 'Classes, homework, jobs. Weekends carry the scene now.' },
  { key: 'winterbreak', from: 330, to: 336, factor: 1.15, label: 'Winter break', blurb: 'Everyone is home for the holidays.' },
  { key: 'winterbreak2', from: 1, to: 7, factor: 1.15, label: 'Winter break', blurb: 'Everyone is home for the holidays.' },
  { key: 'spring', from: 8, to: 140, factor: 0.88, label: 'Term time', blurb: 'Classes, homework, jobs. Weekends carry the scene now.' },
]

export const seasonOf = (dayOfYear) =>
  SEASONS.find((s) => dayOfYear >= s.from && dayOfYear <= s.to) || SEASONS[5]

export const seasonFactor = (dayOfYear) => seasonOf(dayOfYear).factor

// How long a brand-new arcade still feels brand new. For this long the floor
// talk is mostly ABOUT the room — first impressions, what everyone played
// before, whether the food's any good — because nobody has any history here
// yet to talk about instead. Measured in RUN AGE (`runAge`), never absDayOf:
// a run opens on day 155, so a calendar comparison is false on opening night
// and the whole opening-weeks vocabulary goes unreachable.
export const OPENING_DAYS = 24

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Day 1 of every year is a Sunday (28-day months keep weekdays aligned).
export const weekdayOf = (dayOfYear) => (dayOfYear - 1) % 7
export const dayOfMonthOf = (dayOfYear) => ((dayOfYear - 1) % DAYS_PER_MONTH) + 1

export const BRACKET_SIZES = [2, 4, 8, 16, 32, 64]

/**
 * The excuses available on a given day. School-only reasons are dropped when
 * school is out — the cast are students, and a final exam during the summer
 * holidays is the kind of detail that tells a player nothing is really being
 * simulated. Lives here rather than in names.js because it needs seasonOf.
 */
export function lifeEventsFor(dayOfYear) {
  const key = seasonOf(dayOfYear).key
  const termTime = key !== 'summer' && key !== 'winterbreak' && key !== 'winterbreak2'
  return termTime ? [...LIFE_EVENTS, ...SCHOOL_LIFE_EVENTS] : LIFE_EVENTS
}

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
  // FOLLOW ONE PERSON (§6). The camera is the cultivation lever — §1.8 makes
  // exposure a prerequisite for growth — so "point it at THIS player" is a
  // strategy, not a convenience. Falls back to the closest match on nights
  // they do not play.
  { key: 'follow', label: 'Follow a player', blurb: 'whoever you are building' },
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
// The difficulty ladder. EVERY lever here must be monotonic across the four
// tiers, and the one that matters is `rentBase * rentMult` — the effective nut
// — not either column alone. That product is where this table last went wrong:
// the 2026-07-24 attendance rework raised Master's popularity and starting cash
// to make it survivable and left Difficult at its pre-rework values, so
// Difficult was measurably HARDER than Master for a month (competent play died
// at 0.18yr on Difficult vs 0.24yr on Master, and autopilot outlived skill on
// both). Effective rent read 201 vs 204 — near-identical where it should have
// been a clear step.
//
// Rent is the lever that carries this table. It's a flat cost with no feedback
// loop, so relief lands entirely on the owner who is actually running the
// place: cutting Normal's rent lifted competent play from 10% to 27% survival
// at four years and moved the autopilot bot NOT AT ALL (0% alive at every rent
// level tested). That's the property the whole ladder is built on — below Easy,
// difficulty should be a test of play, not a countdown that skill can't affect.
//
// `popularityMult` deliberately does NOT carry it. More bodies through the door
// without staff to match overwhelms cleaning (dirt scales with attendance while
// a solo owner's cleaning shrinks against it), which feeds back into the
// attendance multiplier and health inspections — so past ~1.1 it cancels itself
// and a bigger crowd is worth less than it looks.
export const DIFFICULTIES = [
  {
    key: 'easy', label: 'Easy', statPoints: 10,
    startingMoney: 2200, rentMult: 0.7, rentBase: 100, popularityMult: 1.35, receptionBias: 4,
    collapseGrace: 60, fadeGrace: 120, foreclosureGrace: 50, rentEscalation: 0, relevanceDecayMult: 0.6,
    blurb: 'Generous funds, cheap rent, a forgiving community.',
  },
  {
    key: 'normal', label: 'Normal', statPoints: 5,
    startingMoney: 1500, rentMult: 1, rentBase: 95, popularityMult: 0.95, receptionBias: -1,
    collapseGrace: 30, fadeGrace: 50, foreclosureGrace: 35, rentEscalation: 0.12, relevanceDecayMult: 1.32,
    blurb: 'The intended experience: a scene you have to keep alive on purpose.',
  },
  {
    key: 'difficult', label: 'Difficult', statPoints: 3,
    startingMoney: 1000, rentMult: 1.15, rentBase: 105, popularityMult: 0.8, receptionBias: -5,
    collapseGrace: 21, fadeGrace: 38, foreclosureGrace: 28, rentEscalation: 0.16, relevanceDecayMult: 1.5,
    blurb: 'Thin margins, a skeptical internet, a hungry landlord.',
  },
  {
    key: 'master', label: 'Master', statPoints: 0,
    startingMoney: 700, rentMult: 1.25, rentBase: 115, popularityMult: 0.68, receptionBias: -9,
    collapseGrace: 16, fadeGrace: 30, foreclosureGrace: 21, rentEscalation: 0.2, relevanceDecayMult: 1.7,
    blurb: 'Nearly impossible. The landlord is already drafting the notice.',
  },
]
export const difficultyOf = (save) =>
  DIFFICULTIES.find((d) => d.key === (save?.settings?.difficulty || 'normal')) || DIFFICULTIES[1]

/**
 * The reading aids, and whether this owner still wants them.
 *
 * `tips` = the coaching row on the danger banner. `vitals` = the venue strip
 * of the four numbers that decide a run. `rumors` = the rumor mill on the
 * concession stand and the recap.
 *
 * Default ON, and unknown/absent means on — a save that predates the setting
 * should never quietly lose the thing it has always shown. Failure countdowns
 * are NOT in here: those aren't help, they're the game telling you what state
 * it is in, and you don't get to switch off the state.
 */
export const HELPERS = [
  ['tips', '💡 Coaching tips', "Levers you haven't touched that are costing you — \"nobody is cleaning up\"."],
  ['vitals', '💰 Venue strip', 'The standing cash / yesterday / daily nut / venue readout above every page.'],
  ['rumors', '🗣 Rumor mill', 'What the room is talking about: feuds, grudges, who is about to walk.'],
]
export const helperOn = (save, key) => save?.settings?.helpers?.[key] !== false

// Default per-item prices when something is first stocked/installed.
// Dollars per serving. Sits just under what an average wallet finds
// comfortable, so an owner who never opens the price screen is charging
// sensibly rather than quietly strangling their own counter. Measured: $3 is
// the revenue peak, $2 trades margin for volume, $4+ falls off a cliff.
export const DEFAULT_FOOD_PRICE = 3
export const DEFAULT_GAME_TOKENS = 2 // tokens to play a side cabinet once

// Advertising channels. Each you run adds `cost` to the weekly upkeep bill.
// `awareness` lifts how easily first-timers discover the arcade; `arrivals`
// pulls in new faces; `hypePerDay` steers public opinion (channel hype).
// `phase` shapes when it's worth it:
//  - 'early'  : reach fades as you become known (great while unknown, wasteful later)
//  - 'steady' : constant presence — momentum once you're established
//  - 'late'   : big reach, but the cost self-selects for a bankrolled arcade
//  - 'opinion': primarily a hype/opinion lever, compounds with your following
// `unlock` is the achievement key that opens the channel (see achievements.js).
// A new lineage starts with flyers and word of mouth and nothing else — the
// rest are earned by outgrowing what you already have.
export const AD_CHANNELS = [
  {
    key: 'flyers', label: 'Flyers', cost: 18, phase: 'early', unlock: null,
    awareness: 0.18, arrivals: 0.015, hypePerDay: 0.02,
    blurb: 'Cheap and local. Nudges the room fuller while nobody knows you exist — but no one reads a flyer for a place they already go.',
  },
  {
    key: 'radio', label: 'Radio', cost: 44, phase: 'early', unlock: 'ads-airwaves',
    awareness: 0.15, arrivals: 0.025, hypePerDay: 0.05,
    blurb: 'Local drive-time spots. Solid early reach that fades once you\'re a known quantity — and the weekly cost stings on a tight budget.',
  },
  {
    key: 'social', label: 'Social Media', cost: 36, phase: 'opinion', unlock: 'ads-airwaves',
    awareness: 0.06, arrivals: 0.025, hypePerDay: 0.16,
    blurb: 'Compounds with your following. The best lever for steering public opinion back up when it sours.',
  },
  {
    key: 'billboards', label: 'Billboards', cost: 90, phase: 'steady', unlock: 'ads-billboards',
    awareness: 0.15, arrivals: 0.04, hypePerDay: 0.04,
    blurb: 'A constant presence on the commute. Pricey, but keeps momentum once you\'re established.',
  },
  {
    key: 'tv', label: 'TV', cost: 190, phase: 'late', unlock: 'ads-tv',
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

// Preset stat spreads for quick player creation. Every key 1-10.
