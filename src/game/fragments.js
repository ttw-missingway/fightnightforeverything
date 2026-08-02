// Elite fragments — REVISION §0.4. Elites get NO journal. They get
// fragments: interview quotes, tweets, lines of VOD commentary, sentences
// out of guides. The asymmetry is the mythology — your people are diaries,
// the world's best are headlines. An elite's actual journal unlocks when
// they retire or when one of yours becomes a genuine rival of theirs; both
// arrive with P5, when elites live enough to have written one
// (`journalUnlockedAbs` is the hook, set here, filled there).
//
// Voice is the elite PERSONA (generate.js): loyalist, meta-chaser,
// lab-monster, showman, veteran.

import { choice } from './util.js'
import { absDayOf } from './constants.js'

const CAP = 16

export function addFragment(save, elite, kind, text) {
  elite.fragments ??= []
  elite.fragments.unshift({ absDay: absDayOf(save.day, save.year), kind, text })
  if (elite.fragments.length > CAP) elite.fragments.length = CAP
}

const fill = (t, data) => t.replace(/\{(\w+)\}/g, (_, k) => (data[k] != null ? String(data[k]) : '…'))

const FRAGMENTS = {
  champion: {
    loyalist: [`interview|"People keep asking when I'll switch characters. {char} and I just won the biggest event on Earth. Ask a better question."`],
    'meta-chaser': [`interview|"I play whatever wins. This year that was {char}. Next year it'll be whatever it needs to be. The trophy doesn't care."`],
    'lab-monster': [`interview|"There are things in {char}'s toolkit nobody has ever seen on a stream. I used maybe half of them this weekend."`],
    showman: [`interview|"Did you HEAR that crowd? That's why we play. The bracket was just the excuse."`],
    veteran: [`interview|"My {n}th year at this. The kids get faster every season and somehow the old man keeps the belt. Study your fundamentals."`],
  },
  // A major is a big weekend, not the summit. The champion talks about it like
  // one — a stop on a season rather than the thing they will be remembered for.
  championMajor: {
    loyalist: [`interview|"{event}. Same character I brought to the last one, and the one before that. That's the whole answer."`],
    'meta-chaser': [`interview|"{char} was the correct pick for this field. Ask me again in April and it'll be a different name."`],
    'lab-monster': [`interview|"I found something in {char} on the flight over. Used it twice. Nobody blocked it either time."`],
    showman: [`tweet|{event} 🏆 — that's {n} now. Somebody tell the bracket to stop putting me in it if they want a different ending.`],
    veteran: [`interview|"Majors are the season. EVO is the year. I'll take this one and keep my mouth shut until June."`],
  },
  beaten: {
    loyalist: [`tweet|Losses like tonight's don't change anything. Same character, same work, next year.`],
    'meta-chaser': [`tweet|Wrong pick for the bracket. My fault. The spreadsheet gets updated tomorrow.`],
    'lab-monster': [`tweet|Got clipped by something I hadn't mapped. Haven't slept. It's beautiful. Back to the lab.`],
    showman: [`tweet|You can't script every ending. Sold out crowd though — see you all next major.`],
    veteran: [`tweet|Been eliminated in worse ways by worse players. The sun came up anyway. GGs.`],
  },
  patch: {
    loyalist: [`tweet|Read the notes. Don't care. See you in bracket with the same character as always.`],
    'meta-chaser': [`tweet|Patch day. Everything you knew is homework now, and some of us do the homework faster.`],
    'lab-monster': [`tweet|The patch broke three of my setups and accidentally created five better ones. They never learn.`],
    showman: [`tweet|New patch, new highlight reel. Somebody warm up the clip channel.`],
    veteran: [`tweet|Patch number four hundred of my career. The fundamentals survived every single one.`],
  },
  idle: {
    loyalist: [`vod|Commentary, week's top set: "That's {alias}'s whole career in one clip — one character, ten thousand hours, zero doubt."`],
    'meta-chaser': [`guide|From {alias}'s tier notes: "Play the character the game wants you to play. Sentiment is a losing matchup."`],
    'lab-monster': [`guide|Footnote in a lab doc circulating this week — {alias}: "If the frame data says it's impossible, check the frame data again."`],
    showman: [`vod|Caught on stream: {alias} taunting mid-set at a major. Chat is still recovering.`],
    veteran: [`interview|{alias}, asked about retirement again: "When it stops being interesting. It has not stopped being interesting."`],
  },
}

/** Compose and attach one fragment. `data` fills {char}, {alias}, {n}. */
export function eliteFragment(save, elite, situation, data = {}) {
  const table = FRAGMENTS[situation]
  if (!table) return null
  const variants = table[elite.persona] || table.veteran
  const [kind, text] = choice(variants).split('|')
  addFragment(save, elite, kind, fill(text, { alias: elite.alias, ...data }))
  return elite.fragments[0]
}

/** The monthly drip: one line of world texture on a ranked name. */
export function fragmentsMonthly(save) {
  const pool = (save.evoRoster || []).slice(0, 24)
  if (!pool.length) return
  const elite = choice(pool)
  eliteFragment(save, elite, 'idle')
}
