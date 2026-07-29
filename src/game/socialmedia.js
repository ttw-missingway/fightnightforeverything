// Fake social media about the scene: short "Chirper" posts and longer
// board threads. Nobody posts about an arcade the internet hasn't heard
// of — the feed wakes up as the stream channel gets traction.

import { uid, choice, chance, randInt, shuffle, clamp } from './util.js'
import { CHAT_NAME_PARTS } from './names.js'
import { upsetSeverityOf } from './match.js'
import { formatDay, absDayOf, dateOfAbs, EVO_DAY, DAYS_PER_YEAR } from './constants.js'
import { observedPower } from './balance.js'
import { worldRankings, rankedInTop } from './world.js'
import { regionFlag } from './flags.js'
import { countryName } from './geo.js'

const BOARD_HANDLES = {
  a: ['Throwaway', 'Actual', 'Definitely_Not', 'Local', 'Former', 'Certified', 'Anonymous', 'Ex'],
  b: ['Grappler', 'TopPlayer', 'Railbird', 'ArcadeRat', 'FrameNerd', 'Spectator', 'PotMonster', 'Lurker'],
}

function chirpHandle() {
  return `@${choice(CHAT_NAME_PARTS.a)}${choice(CHAT_NAME_PARTS.b)}${choice(CHAT_NAME_PARTS.c)}`
}

function boardHandle() {
  return `${choice(BOARD_HANDLES.a)}_${choice(BOARD_HANDLES.b)}${chance(0.5) ? randInt(2, 99) : ''}`
}

function gameSlug(save) {
  return save.game.name.replace(/[^a-zA-Z0-9]/g, '')
}

function feedActive(save) {
  return save.socialFeed && (save.stream.hype >= 4 || save.stream.followers >= 40)
}

function post(save, { platform, text, title = null, scope = 'arcade', agoDays = 0 }) {
  const buzz = save.stream.hype + save.stream.followers / 50
  save.socialFeed.unshift({
    id: uid('post'),
    platform, // 'chirper' | 'boards'
    // 'arcade' = about YOUR scene. 'world' = about the wider competitive world,
    // which the internet talks about whether or not it has heard of you.
    scope,
    user: platform === 'chirper' ? chirpHandle() : boardHandle(),
    board: platform === 'boards' ? `arcade/${gameSlug(save)}` : null,
    title,
    text,
    likes: Math.max(1, randInt(1, 4) + Math.round(buzz * (0.3 + Math.random() * 1.2))),
    ...(() => {
      const when = agoDays > 0
        ? dateOfAbs(Math.max(1, absDayOf(save.day, save.year) - agoDays))
        : { day: save.day, year: save.year }
      return { day: when.day, year: when.year, dateLabel: formatDay(when.day, when.year) }
    })(),
  })
  if (save.socialFeed.length > 120) save.socialFeed.pop()
}


// ---------- The world feed ----------
//
// The internet does not go quiet because your arcade is small. Before this,
// `feedActive` gated EVERY post on your own hype, so a new lineage opened the
// Feed tab and found nothing at all — the one screen whose job is to make the
// wider scene feel real was empty for exactly as long as you needed convincing
// that a wider scene existed.
//
// World posts run on their own clock and are always available. What changes as
// you grow is how often YOUR people are the subject: the feed starts as other
// people's business and becomes yours, without a filter being touched.

const WORLD_TAKES = [
  (c) => `${c.top} is playing a different game to everyone else right now. it's not close`,
  (c) => `hot take: ${c.rando} is the most underrated player in the world and it isn't close`,
  (c) => `${c.rando} switching to ${c.char} mid-season is either genius or a cry for help`,
  (c) => `every time i think i understand ${c.game} ${c.top} does something that resets me to zero`,
  (c) => `${c.rando} [${c.region}] has quietly won three events this season and nobody is talking about it`,
  (c) => `the ${c.char} matchup discourse is out of control. it's fine. it's FINE`,
  (c) => `people forget ${c.top} has been top 5 for years. longevity is a skill`,
  (c) => `${c.rando} vs ${c.top} is the set i'd pay actual money to see again`,
  (c) => `${c.char} is either the best character in ${c.game} or i am bad. researching`,
  (c) => `regional check: ${c.region} is stacked right now and everyone else is coping`,
]

const WORLD_ABOUT_YOU = [
  (c) => `who is ${c.mine}?? just saw them ranked #${c.rank} and i've never heard the name`,
  (c) => `${c.mine} is ranked #${c.rank} in the WORLD out of a local arcade. that's the story of the season`,
  (c) => `been watching ${c.mine} tape all week. the neutral is legit. remember the name`,
  (c) => `if ${c.mine} keeps this up we're going to have to start taking ${c.arcade} seriously`,
  (c) => `${c.mine} at #${c.rank}. from a ROOM. not a team house, a room`,
]


// ---------- EVO buzz ----------
//
// A run opens seven days before EVO, so the countdown is the very first thing
// the world is talking about when you walk in. That is deliberate: the goal of
// the entire game is on the calendar before you have done anything at all, and
// the timeline should be shouting about it.

const EVO_COUNTDOWN = [
  { at: 30, lines: [
    (c) => `a month out from EVO. time to decide if you're actually going or just saying you are`,
    (c) => `EVO seeding discourse season is officially open. everybody log off`,
  ] },
  { at: 14, lines: [
    (c) => `two weeks to EVO. ${c.fav} looks unbeatable and i hate it`,
    (c) => `every year i tell myself i'll practice before EVO and every year it is now two weeks out`,
  ] },
  { at: 7, lines: [
    (c) => `ONE WEEK. ${c.game} at EVO. i'm not going to sleep properly until it's over`,
    (c) => `a week out and the pools aren't even up yet. classic`,
    (c) => `who are we watching at EVO? i've got ${c.fav} and whoever comes out of the bottom half`,
  ] },
  { at: 3, lines: [
    (c) => `three days. if you haven't picked your ${c.game} horse yet you're out of time`,
    (c) => `EVO in three days and i genuinely could not tell you who wins it`,
  ] },
  { at: 1, lines: [
    (c) => `EVO. TOMORROW.`,
    (c) => `last night of sleep before EVO, allegedly`,
  ] },
  { at: 0, lines: [
    (c) => `IT'S EVO DAY`,
    (c) => `pools start today. ${c.game} on the big stage. let's go`,
  ] },
]

/**
 * EVO buildup that isn't pinned to an exact day.
 *
 * The countdown above only speaks on six specific mornings, which is right for
 * a countdown and useless for filling the weeks between them — a month of
 * timeline seeded from it comes back three-quarters ordinary world gossip, and
 * a new owner's first screen never says what the year is FOR. These carry the
 * same appetite without claiming a date, so any day in the run-up can use one.
 */
const EVO_BUILDUP = [
  (c) => `${c.game} at EVO is the only thing on my calendar. everything else is a rehearsal`,
  (c) => `the ${c.game} EVO entrant list is going to be absurd this year`,
  (c) => `booked the flights for EVO. no plan beyond that. no plan needed`,
  (c) => `every local from here to EVO is just seeding practice and we all know it`,
  (c) => `if ${c.fav} doesn't at least top 8 at EVO i'm giving up analysis forever`,
  (c) => `EVO brackets are where ${c.game} careers get made. one weekend. that's the whole thing`,
  (c) => `the run-up to EVO is my favourite time of year. everyone thinks they're winning it`,
  (c) => `people practising for EVO right now: everyone. people ready for EVO: nobody`,
  (c) => `whoever takes ${c.game} at EVO decides what the next year looks like. no pressure`,
  (c) => `my EVO prediction is ${c.fav} and my EVO prediction is always wrong`,
  (c) => `the ${c.char} players are all going to EVO thinking this is their year. it never is`,
  (c) => `nothing in this game means anything until EVO. then it all means everything`,
]

/** Close enough to EVO that the buildup pool is fair game. */
const BUILDUP_WINDOW = 40

const EVO_AFTERMATH = [
  (c) => `still thinking about ${c.champ} winning EVO. what a run`,
  (c) => `${c.champ} is the EVO champion and the whole meta just moved`,
  (c) => `post-EVO ${c.game} is going to look completely different. mark it`,
  (c) => `whatever you thought about ${c.game} before EVO, throw it out`,
]

/** How many days until EVO fires, 0 on the day itself. */
export const daysToEvo = (save, agoDays = 0) => {
  const abs = Math.max(1, absDayOf(save.day, save.year) - agoDays)
  return (EVO_DAY - dateOfAbs(abs).day + DAYS_PER_YEAR) % DAYS_PER_YEAR
}

/**
 * The tournament everyone is pointed at. Fires alongside the ordinary world
 * chatter and takes priority over it near the date.
 *
 * `agoDays` matters: a backdated post has to count down from the day it was
 * written, or a seeded fortnight of buildup reads "ONE WEEK" nine times.
 */
function evoBuzz(save, ctx, agoDays = 0, { buildup = false } = {}) {
  const left = daysToEvo(save, agoDays)
  const beat = EVO_COUNTDOWN.find((b) => b.at === left)
  if (beat) return choice(beat.lines)(ctx)
  // Any other day in the run-up, when the caller wants the date pushed —
  // seeding the opening timeline does, an ordinary Tuesday doesn't.
  if (buildup && left <= BUILDUP_WINDOW) return choice(EVO_BUILDUP)(ctx)
  // The week after: everyone is still chewing on it.
  const since = (DAYS_PER_YEAR - left) % DAYS_PER_YEAR
  if (since >= 1 && since <= 6 && agoDays === 0) {
    const last = [...(save.hallOfFame || [])].reverse().find((r) => r.type === 'evo')
    if (last) return choice(EVO_AFTERMATH)({ ...ctx, champ: last.champion })
  }
  return null
}

/**
 * A timeline that already exists when you open the game for the first time.
 *
 * An arcade opens into a world that has been running for years, and a Feed
 * whose first post arrives on day three reads like the world started when you
 * did. These are backdated across the fortnight before opening night.
 */
export function seedWorldFeed(save, count = 9) {
  if (!save.socialFeed) save.socialFeed = []
  // Spread across the month before opening night so the countdown beats
  // (a month out, two weeks, one week, three days...) actually land, and drop
  // anything that repeats a line already on the timeline.
  //
  // `buildup` is on for MOST of these. The opening feed is the one screen that
  // has to answer "what is this run for?", and the answer is EVO — so the
  // timeline a new owner scrolls is mostly a scene counting down to it, with
  // enough ordinary gossip left in (every third post) that the world reads like
  // it has other things going on too.
  // Dedupe on the SHAPE of the post, not its text. The pools substitute names,
  // so "the Ken Masters players are all going to EVO" and "the Sagat players
  // are all going to EVO" are the same template twice and read as one — an
  // exact-text check waves both through. Proper nouns collapse to a dot, which
  // leaves the template as the key.
  const shapeOf = (t) => t.replace(/\b[A-Z][\w'’]*(?:\s+[A-Z][\w'’]*)*/g, '·')
  const seen = new Set()
  for (let i = count; i > 0; i--) {
    const before = save.socialFeed.length
    worldFeedDaily(save, { force: true, buildup: i % 3 !== 0, agoDays: Math.round(i * 3.5) + randInt(0, 2) })
    const added = save.socialFeed.length > before ? save.socialFeed[0] : null
    if (!added) continue
    const key = shapeOf(added.text)
    if (seen.has(key)) save.socialFeed.shift()
    else seen.add(key)
  }
  // Opening night is EXACTLY the one-week mark (OPENING_DAY 155, EVO_DAY 162),
  // so guarantee that beat rather than leaving it to the daily roll. The first
  // thing a new owner reads should be the countdown to the thing they will
  // spend the next year trying to reach.
  worldFeedDaily(save, { force: true, buildup: true })
  // Newest first, like every other feed.
  save.socialFeed.sort((a, b) =>
    (b.year - a.year) || (b.day - a.day))
}


/**
 * A background result big enough that the feed notices: somebody near the top
 * of the world dropped a set they had no business dropping, at some local
 * nobody was streaming. This is most of how the rankings feel ALIVE — the
 * list moves between your tournaments, not just at them.
 */
const WORLD_UPSET_TAKES = [
  (c) => `${c.wFlag} ${c.w} just took a set off ${c.lFlag} ${c.l} at a local. No footage. I am BEGGING someone to have filmed it`,
  (c) => `hearing ${c.lFlag} ${c.l} dropped a money match to ${c.wFlag} ${c.w} last night. the ladder is going to feel that one`,
  (c) => `${c.wFlag} ${c.w} over ${c.lFlag} ${c.l} at some invitational?? results page or it didn't happen`,
  (c) => `don't look now but ${c.wFlag} ${c.w} is beating ranked players offline. ${c.l} today. who tomorrow`,
]
export function postWorldUpset(save, { winner, loser }) {
  if (!save.socialFeed) return
  post(save, {
    platform: 'chirper',
    scope: 'world',
    text: choice(WORLD_UPSET_TAKES)({
      w: winner.alias, l: loser.alias,
      wFlag: regionFlag(winner.region), lFlag: regionFlag(loser.region),
    }),
  })
}

/**
 * One post a day-ish about the wider world, and — once your people are
 * actually ranked — sometimes about them.
 *
 * The shift is driven by world RANK rather than by followers, which means the
 * feed starts talking about you because your players got good, not because you
 * bought advertising.
 */
export function worldFeedDaily(save, { force = false, agoDays = 0, buildup = false } = {}) {
  if (!save.socialFeed) return
  if (!force && !chance(0.42)) return
  const rows = worldRankings(save)
  if (!rows.length) return
  const top = rows.slice(0, 8)
  const chars = save.game.characters || []
  const ctx = {
    game: save.game.name,
    arcade: save.arcade.name,
    top: choice(top).name,
    rando: choice(rows.slice(0, 40)).name,
    region: countryName(choice(rows.slice(0, 24)).region),
    char: chars.length ? choice(chars).name : 'the top tier',
  }
  // How often the world talks about YOU: nothing until one of yours cracks the
  // top 64, then rising as they climb.
  const mine = rankedInTop(save, 64)
  const best = mine.length ? mine.reduce((a, b) => (a.rank <= b.rank ? a : b)) : null
  const aboutYou = best && chance(clamp(0.15 + (64 - best.rank) / 64 * 0.5, 0, 0.65))
  // EVO owns the conversation when it is close. Everything else is filler
  // next to the one date the whole year points at.
  const evo = evoBuzz(save, { ...ctx, fav: ctx.top }, agoDays, { buildup })
  const line = evo && (force || chance(0.75))
    ? evo
    : aboutYou
      ? choice(WORLD_ABOUT_YOU)({ ...ctx, mine: best.name, rank: best.rank })
      : choice(WORLD_TAKES)(ctx)
  post(save, { platform: 'chirper', text: line, scope: 'world', agoDays })
}

/**
 * How loud your scene is on the wider internet, 0.2–1.
 *
 * This throttles the AMBIENT chatter about your arcade — the day-to-day upsets
 * and drama — so that a new lineage's timeline is mostly other people's
 * business and slowly becomes its own. Deliberate announcements (a patch, a
 * tier list, a money match callout) are never throttled: those are you talking,
 * not the internet noticing.
 *
 * Keyed off how many of your players are actually WORLD RANKED rather than off
 * follower count, because the question the feed is answering is "does this
 * scene matter yet", and a big local following does not make it matter.
 */
export function arcadeVoice(save) {
  const ranked = rankedInTop(save, 64)
  const best = ranked.length ? Math.min(...ranked.map((r) => r.rank)) : null
  const depth = Math.min(1, ranked.length / 4)
  const height = best ? Math.min(1, (64 - best) / 48) : 0
  return clamp(0.2 + depth * 0.45 + height * 0.35, 0.2, 1)
}

// Scan a day's events for post-worthy moments. Called at endDay.
export function updateFeedFromDay(save, events) {
  if (!feedActive(save)) return
  // Most of what happens in an unknown arcade never leaves the room.
  if (!chance(arcadeVoice(save))) return
  const candidates = []

  for (const ev of events) {
    if (ev.type === 'match' && ev.moneyMatch) {
      candidates.push({ priority: 3, make: () => post(save, {
        platform: chance(0.5) ? 'chirper' : 'boards',
        title: chance(0.5) ? `That ${ev.aName} vs ${ev.bName} money match just happened` : null,
        text: choice([
          `was at the arcade for the ${ev.aName} vs ${ev.bName} money match. ${ev.winnerName} won and the place LOST IT`,
          `money match report: ${ev.winnerName} cashes out against ${ev.winnerName === ev.aName ? ev.bName : ev.aName}. crowd was insane`,
        ]),
      }) })
    } else if (ev.type === 'match' && ev.stream && ev.stream.viewers > 0) {
      const sev = upsetSeverityOf(ev.probA, ev.winnerId === ev.aId)
      if (sev === 'severe') {
        const loser = ev.winnerName === ev.aName ? ev.bName : ev.aName
        candidates.push({ priority: 2, make: () => post(save, {
          platform: 'chirper',
          text: choice([
            `did ${ev.winnerName} really just beat ${loser}??? on stream???`,
            `clip of ${ev.winnerName} upsetting ${loser} is doing numbers rn`,
            `${loser} losing to ${ev.winnerName} was not on my bingo card`,
          ]),
        }) })
      }
    } else if (ev.type === 'innovation' && ev.text.includes('discovered')) {
      candidates.push({ priority: 1, make: () => post(save, {
        platform: 'boards',
        title: choice(['New tech just dropped', 'Has anyone labbed this yet?', 'This changes the matchup']),
        text: ev.text.replace(/\s*\(\+.*\)$/, ''),
      }) })
    } else if (ev.type === 'team') {
      candidates.push({ priority: 1, make: () => post(save, {
        platform: chance(0.5) ? 'chirper' : 'boards',
        title: chance(0.5) ? 'Team news out of the arcade' : null,
        text: ev.text,
      }) })
    } else if (ev.type === 'retirement') {
      // A veteran walking away is an end-of-an-era moment the scene mourns.
      candidates.push({ priority: 2, make: () => post(save, {
        platform: chance(0.5) ? 'chirper' : 'boards',
        title: chance(0.5) ? 'End of an era' : null,
        text: ev.text.replace(/^🏁\s*/, '') + ' ' + choice([
          'ggs to a real one. thanks for the memories 🫡',
          'who steps up now? the throne is open',
          'genuinely don\'t know what the scene looks like without them',
          'saw them win their first local. wild to see them hang it up',
        ]),
      }) })
    }
  }

  // The internet is not, in fact, always positive. Losing to the same
  // character all night generates content too.
  for (const ev of events) {
    if (ev.type !== 'match' || !ev.stream || ev.stream.viewers <= 0) continue
    const sev = upsetSeverityOf(ev.probA, ev.winnerId === ev.aId)
    if (sev === 'none' && chance(0.12)) {
      const winnerChar = ev.winnerId === ev.aId ? ev.charAName : ev.charBName
      candidates.push({ priority: 1, make: () => post(save, {
        platform: 'chirper',
        text: choice([
          `watched ${winnerChar} do ${winnerChar} things for a whole set. cool game`,
          `${winnerChar} won the way ${winnerChar} always wins. yawn / cry`,
          `losing to ${winnerChar} should award double the arcade tokens honestly`,
        ]),
      }) })
      break
    }
  }

  // A character the DATA says is busted becomes a running complaint thread.
  if (chance(0.1) && save.game.characters.length >= 2) {
    const busted = save.game.characters.filter((c) => observedPower(save, save.game, c) > 58)
    if (busted.length) {
      const c = choice(busted)
      candidates.push({ priority: 1, make: () => post(save, {
        platform: 'boards',
        title: choice([
          `${c.name} discussion thread (locked in 3... 2...)`,
          `How is ${c.name} still legal`,
          `Day ${randInt(3, 40)} of asking for ${c.name} nerfs`,
        ]),
        text: choice([
          `Not even mad anymore. Just document every set ${c.name} steals and send it to the devs.`,
          `The matchup chart says what we all know. Do something.`,
          `Inb4 "just adapt". We adapted. ${c.name} adapted harder.`,
        ]),
      }) })
    }
  }

  // A scene going toxic doesn't stay a secret — the internet notices the vibe
  // curdling, and it's the opposite of good press. The worse the bad blood, the
  // likelier the arcade's reputation takes a public hit.
  const tox = save.scene?.toxicity || 0
  if (tox >= 0.3 && chance(tox * 0.5)) {
    candidates.push({ priority: 2, make: () => post(save, {
      platform: chance(0.5) ? 'chirper' : 'boards',
      title: chance(0.5) ? `Is it just me or has the ${gameSlug(save)} scene gotten toxic?` : null,
      text: choice([
        `stopped going to the arcade tbh. too much drama, everyone's got beef with everyone`,
        `used to love that place. now it's just people at each other's throats. hard pass`,
        `the vibe at that arcade is RANCID lately. all the chill regulars stopped showing up`,
        `can't enjoy a session when half the room won't talk to the other half. someone fix it`,
      ]),
    }) })
  }

  // Money matches always post; otherwise cap the daily chatter.
  const must = candidates.filter((c) => c.priority >= 3)
  const rest = shuffle(candidates.filter((c) => c.priority < 3)).slice(0, 2 - Math.min(must.length, 2))
  for (const c of [...must, ...rest]) c.make()
}

// A money match got announced — the internet loves a callout.
export function postMoneyMatchAnnouncement(save, challengerName, targetName, days) {
  if (!feedActive(save)) return
  post(save, {
    platform: 'chirper',
    text: choice([
      `${challengerName} just called out ${targetName} for a money match. ${days} days. be there`,
      `MONEY MATCH ALERT: ${challengerName} vs ${targetName}. the arcade is going to be PACKED`,
      `${challengerName} said it to ${targetName}'s face. money match, ${days} days. this scene is alive`,
    ]),
  })
}

// Tier list day: the second topic the internet never skips.
export function postTierList(save, list, topNames) {
  if (!feedActive(save)) return
  post(save, {
    platform: 'boards',
    title: `Official v${list.version} community tier list`,
    text: topNames.length
      ? `S tier: ${topNames.join(', ')}. ${choice(['Discuss (politely, for once).', 'The votes are in.', 'You already know the comments are a warzone.'])}`
      : 'Somehow nobody is S tier this patch. Balanced game or cowardly voters?',
  })
}

// A patch got a DATE. Announcement hype, then countdown posts as it nears.
export function postPatchAnnouncement(save, version, dateLabel, daysAhead) {
  if (!feedActive(save)) return
  post(save, {
    platform: 'chirper',
    text: choice([
      `PATCH DATE. v${version} drops ${dateLabel}. mark it`,
      `they really put a date on it. v${version}, ${dateLabel}. ${daysAhead} days of theorycrafting starts NOW`,
      `v${version} announced for ${dateLabel}. my main better survive`,
    ]),
  })
  post(save, {
    platform: 'boards',
    title: `v${version} confirmed for ${dateLabel} — predictions thread`,
    text: choice([
      'Post your buff/nerf predictions now so we can dunk on you later.',
      'Calling it now: somebody gets gutted and the boards melt down.',
      'What does everyone want out of this one? Wrong answers only.',
    ]),
  })
}

export function postPatchCountdown(save, version, daysLeft) {
  if (!feedActive(save)) return
  post(save, {
    platform: 'chirper',
    text: daysLeft === 1
      ? choice([
        `v${version} TOMORROW. i am not sleeping`,
        `last night on the old patch. pour one out for the current meta`,
        `patch eve. see everyone at the arcade tomorrow`,
      ])
      : choice([
        `${daysLeft} days until v${version}. the speculation threads are unhinged`,
        `v${version} in ${daysLeft} days. get your last wins in on this patch`,
        `counting down: ${daysLeft} days to v${version}`,
      ]),
  })
}

// Patch day: the one topic the internet never skips.
export function postPatchReaction(save, patch) {
  if (!feedActive(save)) return
  const good = patch.score >= 5
  const bad = patch.score <= -5
  post(save, {
    platform: 'boards',
    title: `Patch v${patch.version} notes — discussion thread`,
    text: patch.notes.slice(0, 3).join(' · ') + (patch.notes.length > 3 ? ` · +${patch.notes.length - 3} more` : ''),
  })
  // A controversial patch doesn't get one take — it gets a war.
  if (patch.divisive) {
    post(save, {
      platform: 'boards',
      title: choice([
        `v${patch.version} is tearing this community apart`,
        `Can we talk about v${patch.version} like adults (no)`,
        `v${patch.version} megathread #2 (first one got locked)`,
      ]),
      text: patch.why[0] ? `"${patch.why[0]}" — half the board agrees, the other half is typing in caps.` : 'Half the board loves it. The other half is typing in caps.',
    })
    post(save, {
      platform: 'chirper',
      text: choice([
        `v${patch.version} is good actually and I'm tired of pretending it's not`,
        `the v${patch.version} defenders are in my replies. blocked. all of you`,
        `v${patch.version} discourse has ended three friendships today (arcade count)`,
      ]),
    })
    return
  }
  post(save, {
    platform: 'chirper',
    text: good
      ? choice([
        `patch v${patch.version} is actually GOOD?? devs cooked`,
        `v${patch.version} dropped and the arcade is eating well tonight`,
      ])
      : bad
        ? choice([
          `v${patch.version}… who asked for this`,
          `read the v${patch.version} notes twice hoping they'd change. they did not`,
          `${patch.why[0] || 'this patch'} — v${patch.version} is rough`,
        ])
        : choice([
          `v${patch.version} is fine I guess. mid patch, decent game`,
          `v${patch.version}: some stuff changed. the grind continues`,
        ]),
  })
}

// The community wants specific things — nerf THIS character, buff THAT one.
// Reading these is how you decide what to patch; the trick is that some demands
// are traps (the loud complaint about a character who isn't actually strong,
// usually blamed for a good player's wins). The astute owner checks the power
// curve before caving.
export function postCommunityDemand(save, d) {
  if (!feedActive(save)) return
  if (!d.legit) {
    post(save, {
      platform: 'chirper',
      text: choice([
        `${d.name} is BROKEN and ${d.blame} proves it every single week. nerf this character already`,
        `so tired of losing to ${d.name}. that character is busted (it's not me, it's the character, i promise)`,
        `${d.blame} would be a nobody without ${d.name}. nerf the crutch`,
      ]),
    })
  } else if (d.kind === 'nerf') {
    post(save, {
      platform: 'boards',
      title: choice([`${d.name} NEEDS a nerf (serious thread)`, `How is ${d.name} still untouched`, `${d.name} nerf megathread #4`]),
      text: choice([`Every bracket it's the same story. ${d.name} is warping the entire meta.`, `The data isn't subtle. ${d.name} has been oppressive for too long.`]),
    })
  } else {
    post(save, {
      platform: 'boards',
      title: choice([`Justice for ${d.name}`, `${d.name} buffs when?`, `Nobody plays ${d.name} and here's why`]),
      text: choice([`Bottom of every tier list and it's not close. ${d.name} deserves help.`, `Give ${d.name} literally anything. The character is unplayable at a high level.`]),
    })
  }
}

// The community starts asking when the game goes stale.
export function postPatchDemand(save, days) {
  if (!feedActive(save)) return
  post(save, {
    platform: chance(0.5) ? 'chirper' : 'boards',
    title: chance(0.5) ? 'Is this game still being updated?' : null,
    text: choice([
      `${days} days since the last patch. the meta is FOSSILIZED`,
      `day ${days} of asking for a balance patch`,
      `love this game but it hasn't been touched in ${days} days and it shows`,
    ]),
  })
}

// Tournament wrapped — the recap threads write themselves.
export function updateFeedFromTournament(save, record) {
  if (!feedActive(save)) return
  post(save, {
    platform: chance(0.5) ? 'chirper' : 'boards',
    title: chance(0.5) ? `${record.name} results thread` : null,
    text: record.type === 'teams'
      ? `${record.champion} win ${record.name}. crews putting the scene on their back`
      : choice([
        `${record.champion} takes ${record.name} (${record.entrantCount} entrants). ggs all around`,
        `${record.name} is in the books — ${record.champion} on top. vods on ${save.stream.channelName}`,
      ]),
  })
  if (record.type === 'evo' && record.arcadeResults?.length) {
    const best = record.arcadeResults[0]
    post(save, {
      platform: 'boards',
      title: `Our locals went to EVO and this happened`,
      text: `${best.name} finished ${ordinalWord(best.place)} out of ${record.entrantCount} AT EVO. from our arcade. I'm not crying you're crying`,
    })
  }
}

function ordinalWord(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
