// Fake social media about the scene: short "Chirper" posts and longer
// board threads. Nobody posts about an arcade the internet hasn't heard
// of — the feed wakes up as the stream channel gets traction.

import { uid, choice, chance, randInt, shuffle } from './util.js'
import { CHAT_NAME_PARTS } from './names.js'
import { upsetSeverityOf } from './match.js'
import { formatDay } from './constants.js'

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

function post(save, { platform, text, title = null }) {
  const buzz = save.stream.hype + save.stream.followers / 50
  save.socialFeed.unshift({
    id: uid('post'),
    platform, // 'chirper' | 'boards'
    user: platform === 'chirper' ? chirpHandle() : boardHandle(),
    board: platform === 'boards' ? `arcade/${gameSlug(save)}` : null,
    title,
    text,
    likes: Math.max(1, randInt(1, 4) + Math.round(buzz * (0.3 + Math.random() * 1.2))),
    day: save.day,
    year: save.year,
    dateLabel: formatDay(save.day, save.year),
  })
  if (save.socialFeed.length > 120) save.socialFeed.pop()
}

// Scan a day's events for post-worthy moments. Called at endDay.
export function updateFeedFromDay(save, events) {
  if (!feedActive(save)) return
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
    }
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
