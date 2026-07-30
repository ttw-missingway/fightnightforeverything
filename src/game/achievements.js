import { runAge, DAYS_PER_YEAR, STAT_MAX_POINTS, STAT_UNIT } from './constants.js'
import { chronicle } from './model.js'

/**
 * The permanent ladder: what a lineage keeps when a run ends.
 *
 * Two rules decide this list.
 *
 * The first is that an unlock is EARNED, never bought. Everything here makes
 * the arcade easier or richer to run, and a thing you can buy is a thing the
 * struggling owner never gets — the same trap the helpers setting exists to
 * avoid, one tier up. So the currency is proof.
 *
 * The second is what the proof is FOR. Often it is doing the thing without the
 * tool: you keep a poisonous room together with nothing but matchmaking and
 * the discipline screen is the reward. Where that doesn't fit, the proof is
 * the NEED — six teams organising themselves is the argument for laser tag,
 * and it arrives from your own floor rather than from a price list.
 *
 * EVERY THRESHOLD HERE IS MEASURED, not guessed. The first cut priced several
 * of these off intuition and the sim refused all of them: cabinet queues never
 * happen (zero in 500 days at any floor size), mutual close friendships top
 * out at two, and national interest cannot climb at all while the game is
 * unpatched. Anything changed here should be re-measured, not reasoned about.
 *
 * PAYOUT RULE. Creation points are scarce (a Normal build is FIVE), so only
 * unlocks that prove something about the players or the scene pay them.
 * Catalogue unlocks — idle speeds, food packs, attractions, ad channels — pay
 * nothing: the content is the reward. Without that rule thirty achievements
 * would quietly hand out sixty points against a five-point budget. Total here
 * is 25, pitched against RUNG_ALLOWANCE (24) so the two legacy tracks stay
 * peers. Phase 7 recalibrates.
 *
 * PHASE 4 SCOPE: this file is the ledger and the award loop. Nothing consults
 * `unlocks` to gate a feature, and the packs it names have no contents yet —
 * both are Phase 5, where the catalogue is authored and priced.
 */

/**
 * The idle ladder is measured in DAYS THIS RUN HAS BEEN OPEN, and the numbers
 * are now literally the seasons: a run opens June 15, so 70 days carries you
 * to the end of August and 182 reaches New Year's Day.
 *
 * (These were written before the summer start existed, as elapsed-day
 * approximations of a calendar that hadn't landed yet. It has now — Phase 6b —
 * so they say what they always meant.)
 */
const SUMMER = 70 // June 15 → the end of August
const TO_NEW_YEAR = 182 // June 15 → January 1

/**
 * Tournaments YOU ran. EVO and the circuit (majors, qualifiers, regionals,
 * the Squad Showdown) sit on the same hall-of-fame shelf but they are the
 * WORLD's tournaments — you did not book them, fill them, or clean up after
 * them, and counting a major's 16-invitation field as "you filled a bracket"
 * is exactly the sort of free credit these achievements exist not to give.
 */
const yours = (save) => (save.hallOfFame || []).filter((r) => r.type !== 'evo' && r.type !== 'circuit' && !r.circuitKind)

export const ACHIEVEMENTS = [
  // ---------- Idle speeds: you earn the right to skip ahead ----------
  {
    key: 'summer-holds', icon: '☀️', name: 'The summer holds',
    unlock: 'idle-realtime', unlockLabel: 'Idle mode at real time', points: 0,
    how: 'Keep the doors open through your first summer.',
    check: (s, absDay) => absDay >= SUMMER,
  },
  {
    key: 'new-year', icon: '🎆', name: 'Still here in January',
    unlock: 'idle-fast', unlockLabel: 'Idle speed: Fast', points: 0,
    how: "Make it to New Year's Day.",
    check: (s, absDay) => absDay >= TO_NEW_YEAR,
  },
  {
    key: 'one-year', icon: '📅', name: 'A year of this',
    unlock: 'idle-faster', unlockLabel: 'Idle speed: Faster', points: 0,
    how: 'Run the arcade for one whole year.',
    check: (s, absDay) => absDay >= DAYS_PER_YEAR,
  },
  {
    key: 'five-years', icon: '🏛', name: 'An institution',
    unlock: 'idle-blitz', unlockLabel: 'Idle speed: Blitz', points: 0,
    how: 'Five whole years, one arcade.',
    check: (s, absDay) => absDay >= DAYS_PER_YEAR * 5,
  },

  // ---------- The tabs: information you have proved you can read ----------
  {
    key: 'own-eyes', icon: '📊', name: 'Read it yourself',
    unlock: 'tiers', unlockLabel: 'The community tier list', points: 2,
    // A tier list is a borrowed opinion. A guide the scene actually picked up
    // is one your room wrote, and somebody put in the reps to be worth reading.
    how: 'Have a character guide out of your scene catch on.',
    check: (s) => (s.guides || []).some((g) => g.landed),
  },
  {
    key: 'worth-watching', icon: '🗓', name: 'A year of this room',
    unlock: 'studio', unlockLabel: 'The Game Studio — patch your own game', points: 2,
    // THE STUDIO IS THE ANSWER TO A GAME GOING STALE, and the price of it is
    // simply having been here a while.
    //
    // Two earlier versions were wrong in opposite directions. `peakRelevance
    // >= 62` was a HIGH-WATER mark — the opposite of the problem the Studio
    // solves — and relevance spikes around EVO, which lands seven days after
    // opening, so a first EVO handed over the biggest tool in the game before
    // the arcade had a second cabinet. Replacing it with a slump condition
    // ("sixty days at interest <= 50") fixed the timing but priced the tool on
    // suffering: measured, a competent scene never goes stale at all, so the
    // owner running the place well was the one who never got it.
    //
    // A year. That is all. It cannot fire in the first fortnight, it does not
    // require the run to be dying, and it lands well before the death march
    // starts biting around year three — you get the tool before the war it is
    // for. (The key stays `worth-watching` so lineages that already earned it
    // keep it.)
    how: 'Run the arcade for a full year.',
    check: (s, absDay) => absDay >= DAYS_PER_YEAR,
  },

  // ---------- Food packs: the counter argues for itself ----------
  {
    key: 'the-fryer', icon: '🍟', name: 'The fryer never rests',
    unlock: 'food-fryer', unlockLabel: 'Food pack: The Fryer — hot, salty, fast', points: 0,
    how: 'Sell 200 servings across a single run.',
    check: (s) => (s.tally?.foodSold || 0) >= 200,
  },
  {
    key: 'sweet-tooth', icon: '🍬', name: 'Sweet tooth',
    unlock: 'food-sweets', unlockLabel: 'Food pack: The Sweet Counter — sugar and cold drinks', points: 0,
    how: 'Take $900 across the concession counter in a single run.',
    check: (s) => (s.tally?.foodRevenue || 0) >= 900,
  },
  {
    key: 'hot-line', icon: '🍜', name: 'On the hot line',
    unlock: 'food-hotline', unlockLabel: 'Food pack: The Hot Line — food people sit down for', points: 0,
    // Six servings per item per night is the ceiling, so this is a counter
    // running at capacity across a properly stocked case.
    how: 'Serve 18 people in a single night.',
    check: (s) => (s.tally?.bestFoodNight || 0) >= 18,
  },
  {
    key: 'last-call', icon: '🌙', name: 'Last call',
    unlock: 'food-latenight', unlockLabel: 'Food pack: Late Night — what closing-time crowds eat', points: 0,
    how: 'Sell 1,200 servings across a single run.',
    check: (s) => (s.tally?.foodSold || 0) >= 1200,
  },

  // ---------- Attractions: six rooms the floor asked you for ----------
  {
    key: 'silver-ball', icon: '🎱', name: 'The silver ball',
    unlock: 'attr-pinball', unlockLabel: 'Attraction pack: the pinball collection', points: 0,
    how: 'Take 1,200 turns on your side cabinets.',
    check: (s) => (s.tally?.cabinetPlays || 0) >= 1200,
  },
  {
    key: 'full-house', icon: '🎳', name: 'Full house',
    unlock: 'attr-bowling', unlockLabel: 'Attraction pack: the bowling alley', points: 0,
    how: 'Draw 20 people through the door in one night.',
    check: (s) => (s.peakAttendance || 0) >= 20,
  },
  {
    key: 'the-classics', icon: '👾', name: 'The classics',
    unlock: 'attr-classics', unlockLabel: 'Attraction pack: classic arcade cabinets', points: 0,
    how: 'Keep four or more side cabinets running for a full year straight.',
    check: (s) => (s.tally?.fullFloorDays || 0) >= DAYS_PER_YEAR,
  },
  {
    key: 'enough-for-teams', icon: '🔫', name: 'Enough for teams',
    unlock: 'attr-lasertag', unlockLabel: 'Attraction pack: laser tag', points: 0,
    // Laser tag is the one attraction nobody plays alone, so it is priced in
    // squads rather than turnstiles: six real teams means a room that already
    // organises itself into sides.
    // Two, and that is a real ask. Phase 6 shipped this at three on reasoning
    // alone (flagged at the time as the one unmeasured threshold); Phase 7
    // measured it. Teams only form around YOUR players and only once a genuine
    // friendship exists, which takes most of a year — a well-run two-year scene
    // produces one or two crews, so three at once was unreachable.
    how: 'Have two teams of three or more running at once.',
    check: (s) => Object.values(s.teams || {}).filter((t) => (t.memberIds || []).length >= 3).length >= 2,
  },
  {
    key: 'the-spectacle', icon: '🥽', name: 'The spectacle',
    unlock: 'attr-vr', unlockLabel: 'Attraction pack: VR', points: 0,
    how: 'Get the channel to 80 hype.',
    check: (s) => (s.tally?.peakHype || 0) >= 80,
  },
  {
    key: 'after-work', icon: '📱', name: 'The after-work crowd',
    unlock: 'attr-touchscreen', unlockLabel: 'Attraction pack: touch-screen bar games', points: 0,
    // The people who wander in without meaning to. Proof is a night where the
    // room was full of faces that aren't part of your scene at all.
    how: 'Have twenty regulars on the books while your floor carries four or more cabinets.',
    check: (s) => (s.arcade?.otherGames || []).length >= 4
      && Object.values(s.players).filter((p) => p.isRegular && !p.retired && !p.banished).length >= 20,
  },
  {
    key: 'the-hangout', icon: '🥒', name: 'The hangout',
    unlock: 'attr-pickleball', unlockLabel: 'Attraction pack: pickleball', points: 0,
    // Not a competitive bar at all: pickleball is for the room that stopped
    // being only about the bracket, so it is priced in friendships. Eight
    // pairs against a measured ceiling of twelve — this is most of a room.
    how: 'Have eight pairs of genuine friends in the room at once.',
    check: (s) => friendPairs(s) >= 8,
  },

  // ---------- Advertising: outgrow the channel you're on ----------
  {
    key: 'airtime', icon: '📻', name: 'Airtime',
    unlock: 'ads-airwaves', unlockLabel: 'Advertising: radio and social', points: 0,
    how: 'Reach 150 followers without ever paying for advertising.',
    check: (s) => !s.tally?.usedAds && (s.stream?.followers || 0) >= 150,
  },
  {
    key: 'landmark', icon: '🪧', name: 'A landmark',
    unlock: 'ads-billboards', unlockLabel: 'Advertising: billboards', points: 0,
    how: 'Draw 28 people through the door in one night.',
    check: (s) => (s.peakAttendance || 0) >= 28,
  },
  {
    key: 'primetime', icon: '📺', name: 'Primetime',
    unlock: 'ads-tv', unlockLabel: 'Advertising: television', points: 0,
    how: 'Reach 5,000 followers.',
    check: (s) => (s.stream?.followers || 0) >= 5000,
  },

  // ---------- The scene: the ones that pay ----------
  {
    key: 'kept-the-peace', icon: '🕊', name: 'Kept the peace',
    unlock: 'discipline', unlockLabel: 'Separating and banning players', points: 3,
    how: 'Let the room turn toxic and bring it back — without one warning, separation or ban.',
    check: (s) => (s.tally?.peakToxicity || 0) >= 0.3
      && (s.scene?.toxicity ?? 1) <= 0.12
      && !s.tally?.usedDiscipline,
  },
  {
    key: 'first-time-right', icon: '🎯', name: 'Right the first time',
    unlock: 'hotfix', unlockLabel: 'Hotfixes — small corrections without a full patch', points: 2,
    how: 'Land a patch the community adores.',
    check: (s) => (s.tally?.bestReception || 0) >= 24,
  },
  {
    key: 'solo-shift', icon: '🧹', name: 'Solo shift',
    unlock: 'family', unlockLabel: 'The family business — staff who never quit and never bill you', points: 3,
    how: 'Half a year running the floor completely alone, finishing every single day up.',
    check: (s) => (s.tally?.soloBlackDays || 0) >= 180,
  },
  {
    key: 'world-champion', icon: '👑', name: 'World champion',
    unlock: 'points', unlockLabel: 'A permanently larger creation allowance', points: 3,
    how: 'Send a player of yours to EVO and have them win it.',
    check: (s) => Object.values(s.players).some((p) => !p.npc && (p.evoTitles || 0) >= 1),
  },

  // ---------- Bandwidth: how much calendar the room can carry ----------
  {
    key: 'weekly-habit', icon: '🗓', name: 'A standing fixture',
    unlock: 'bandwidth-1', unlockLabel: '+25 bandwidth — a busier calendar', points: 0,
    how: 'Run thirty of your own tournaments to a finish.',
    check: (s) => yours(s).length >= 30,
  },
  {
    key: 'a-real-field', icon: '🎟', name: 'A real field',
    unlock: 'bandwidth-2', unlockLabel: '+25 bandwidth — a busier calendar', points: 0,
    // Thirty-two entrants means thirty-two people who all turned up to YOUR
    // arcade on the same night, which is a bigger ask of the room than of the
    // bracket. EVO is a 64-player major and is emphatically not your doing.
    how: 'Fill a 32-entrant bracket at your own arcade.',
    check: (s) => yours(s).some((r) => (r.entrantCount || 0) >= 32),
  },
  {
    key: 'all-day-affair', icon: '⏳', name: 'An all-day affair',
    unlock: 'bandwidth-3', unlockLabel: '+55 bandwidth — a full circuit', points: 0,
    // A round robin of eight is twenty-eight sets. Running one to a finish is
    // the proof that this arcade can hold a room for a whole day.
    how: 'Run a round robin of eight or more to a finish.',
    check: (s) => yours(s).some((r) => r.format === 'roundrobin' && (r.entrantCount || 0) >= 8),
  },

  // ---------- The long haul ----------
  //
  // Five that nobody earns by accident. Each pays a COSMETIC, because at this
  // level the reward is not another tool — it is the room looking like the
  // place where that happened, to you and to anyone you share the world with.
  // (Phase 5/6 renders them; the ledger just records which are yours.)
  {
    key: 'dynasty', icon: '🏆', name: 'Dynasty',
    unlock: 'cosmetic-banners', unlockLabel: 'Championship banners hang over the floor', points: 2,
    cosmetic: true,
    how: 'Win EVO three years running.',
    check: (s) => hasStreak(s.tally?.evoWinYears || [], 3),
  },
  {
    key: 'perfect-books', icon: '💎', name: 'Perfect books',
    unlock: 'cosmetic-marquee', unlockLabel: "The arcade's name in gold", points: 2,
    cosmetic: true,
    how: 'A full year without the account once going into the red.',
    check: (s) => (s.tally?.blackStreak || 0) >= DAYS_PER_YEAR,
  },
  {
    key: 'the-lifer', icon: '🎖', name: 'The lifer',
    unlock: 'cosmetic-laurel', unlockLabel: 'A laurel on the player who never left', points: 2,
    cosmetic: true,
    how: 'Carry one player to a thousand days on the floor without them ever burning out.',
    check: (s) => Object.values(s.players).some((p) =>
      !p.npc && !p.retired && !p.banished && (p.daysAttended || 0) >= 1000),
  },
  {
    key: 'written-in-stone', icon: '📚', name: 'Written in stone',
    unlock: 'cosmetic-library', unlockLabel: 'The Codex becomes a proper library', points: 2,
    cosmetic: true,
    how: 'Five guides out of your scene catch on in a single run.',
    check: (s) => (s.guides || []).filter((g) => g.landed).length >= 5,
  },
  {
    key: 'the-complete-player', icon: '💠', name: 'The complete player',
    unlock: 'cosmetic-aura', unlockLabel: 'A gold aura on the player who has everything', points: 3,
    cosmetic: true,
    // Every stat at five on one person. That is 114 creation points, which is
    // more than any single run can bank — it is the capstone of a whole
    // lineage, and the ceiling formula now reads all of it (see skillCeiling).
    how: 'Build one player with every single stat maxed out.',
    check: (s) => Object.values(s.players).some((p) =>
      !p.npc && !p.banished
      && Object.values(p.personal || {}).every((v) => v >= STAT_MAX_POINTS * STAT_UNIT)
      && Object.values(p.social || {}).every((v) => v >= STAT_MAX_POINTS * STAT_UNIT)),
  },
  {
    key: 'the-hard-way', icon: '🔥', name: 'The hard way',
    unlock: 'cosmetic-neon', unlockLabel: 'An exclusive neon for the storefront', points: 2,
    cosmetic: true,
    how: 'Reach Year 5 on Master.',
    check: (s, absDay) => s.settings?.difficulty === 'master' && absDay >= DAYS_PER_YEAR * 4,
  },
]

/**
 * Pairs who both count the other a friend (rel ≥ 20, mutual).
 *
 * The threshold is the "friends" band, not "close friends" — measured over a
 * 500-day well-run scene the room reached TWO mutual close-friendships and
 * twelve ordinary ones, so pricing this at the higher band would have made it
 * unreachable rather than hard.
 */
function friendPairs(save) {
  const active = Object.values(save.players).filter((p) => p.isRegular && !p.retired && !p.banished)
  let pairs = 0
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i], b = active[j]
      if ((a.relationships?.[b.id] ?? 0) >= 20 && (b.relationships?.[a.id] ?? 0) >= 20) pairs += 1
    }
  }
  return pairs
}

/** Does this list of years contain `n` consecutive ones? */
function hasStreak(years, n) {
  const sorted = [...new Set(years)].sort((a, b) => a - b)
  let run = 0
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1
    if (run >= n) return true
  }
  return false
}

/**
 * What an EVO title is worth to every build that comes after it.
 *
 * Deliberately large against a Normal allowance of five — this is the top of
 * the competitive ladder and the only unlock in the game that makes your
 * PEOPLE better rather than your arcade. Winning the world championship should
 * change what you are able to make next time.
 */
export const CHAMPION_POINTS = 3

/** Has this lineage earned it? (Reads the permanent record, not the run.) */
export const hasAchievement = (save, key) => !!save?.prestige?.achievements?.[key]

/**
 * What earns a given unlock, in words — for every screen that has to explain
 * why something is greyed out. A lock with no stated way through is just a wall.
 */
export const howToUnlock = (unlockKey) =>
  ACHIEVEMENTS.find((a) => a.unlock === unlockKey)?.how || 'not yet earnable'

export const achievementForUnlock = (unlockKey) =>
  ACHIEVEMENTS.find((a) => a.unlock === unlockKey) || null

/**
 * The ladder as a catalogue: what kind of thing each unlock is. Thirty rows in
 * one list is inventory; six short lists is a shop.
 */
export const UNLOCK_GROUPS = [
  { key: 'speed', label: '⏩ Speed', blurb: 'How fast the arcade may run without you.', match: (a) => a.unlock.startsWith('idle-') },
  { key: 'screens', label: '🖥 Screens', blurb: 'Information you have proved you can read.', match: (a) => ['tiers', 'studio'].includes(a.unlock) },
  { key: 'counter', label: '🍟 The Counter', blurb: 'What the concession stand is allowed to carry.', match: (a) => a.unlock.startsWith('food-') },
  { key: 'floor', label: '🎳 The Floor', blurb: 'Rooms that draw a crowd of their own.', match: (a) => a.unlock.startsWith('attr-') },
  { key: 'reach', label: '📣 Reach', blurb: 'Ways of telling people you exist.', match: (a) => a.unlock.startsWith('ads-') },
  { key: 'tools', label: '🛠 Tools', blurb: 'Levers on the scene itself.', match: (a) => ['discipline', 'hotfix', 'family', 'points'].includes(a.unlock) },
  { key: 'calendar', label: '🗓 Calendar', blurb: 'How much tournament this room can carry.', match: (a) => a.unlock.startsWith('bandwidth-') },
  { key: 'legend', label: '🏆 The Long Haul', blurb: 'Nobody earns these by accident.', match: (a) => !!a.cosmetic },
]

export const groupedAchievements = () =>
  UNLOCK_GROUPS.map((g) => ({ ...g, items: ACHIEVEMENTS.filter(g.match) }))

/**
 * Is a tool available to this lineage?
 *
 * Phase 5 will call this at every gate. It answers `true` for anything not in
 * the catalogue on purpose: a feature nobody has decided to lock is not locked.
 */
export const isUnlocked = (save, unlockKey) => {
  if (!ACHIEVEMENTS.some((a) => a.unlock === unlockKey)) return true
  return !!save?.prestige?.unlocks?.[unlockKey]
}

/**
 * Award anything newly proved. Called once a day from advanceDay.
 *
 * Points land in `prestige.points` immediately rather than in the run's
 * pending pot: an achievement is a lineage fact the moment it happens, and
 * banking it at reset would mean losing it to a run that ends badly — which is
 * exactly the run that most needed the encouragement.
 *
 * Sandbox runs record nothing. The whole ladder is a claim about a scene that
 * had something at stake.
 *
 * Anything earned is also queued on `save.unlockNotices` for the UI to
 * announce. This runs from `advanceDay`, the universal tick, which has no day
 * report to write into — and a permanent unlock that only ever showed up as a
 * chronicle line you had to go looking for may as well not have happened.
 */
export function checkAchievements(save) {
  if (!save || save.settings?.mode === 'sandbox') return []
  save.prestige.achievements ??= {}
  save.prestige.unlocks ??= {}
  save.unlockNotices ??= []
  const absDay = runAge(save) // every check below means "days this run has been open"
  const earned = []
  for (const a of ACHIEVEMENTS) {
    if (save.prestige.achievements[a.key]) continue
    let ok = false
    try { ok = !!a.check(save, absDay) } catch { ok = false }
    if (!ok) continue
    save.prestige.achievements[a.key] = { day: save.day, year: save.year, run: (save.prestige.runs || 0) + 1 }
    save.prestige.unlocks[a.unlock] = true
    // An attraction earned by a run that is nearly over is a trophy you never
    // get to touch, so the run that wins it gets one room on the house.
    if (a.unlock.startsWith('attr-')) {
      save.freeInstalls ??= {}
      save.freeInstalls[a.unlock] = true
    }
    save.prestige.points = (save.prestige.points || 0) + a.points
    const pay = a.points > 0 ? ` (+${a.points} prestige)` : ''
    chronicle(save, a.icon, `${a.name} — ${a.unlockLabel} is yours for good${pay}`)
    save.unlockNotices.push(a.key)
    earned.push(a)
  }
  return earned
}
