// The journal — REVISION §0.4 and P2. Each user-created player keeps a
// first-person feed. It is both the UI and the story, and it carries ONE HARD
// RULE: the journal is the only place a stat change is announced, and nothing
// is announced anywhere else. No entry means nothing moved. That keeps the
// eureka system auditable, prevents log-file bloat, and makes reading the
// journal the way you play two hands ahead — early warnings arrive as entries
// you could skim past, and by the time something is a toast (notify.js) it is
// nearly too late.
//
// VOICE: two players write the same loss differently. Competitive events are
// voiced by the competitive temperament (a Killer rages, a Scholar takes
// notes, a Natural shrugs, a Stoic states); social events are voiced by the
// social temperament. The prose here is the front of the game now — it is
// what decides whether the eureka system sings or embarrasses.
//
// Filler keeps no journal. Elites keep no journal either — they get FRAGMENTS
// (fragments.js); the asymmetry is the mythology.
//
// (The dialogue corpus in tools/dialogue/out was considered and passed over:
// it is two-party exchange prose, and rewriting it into a single first-person
// voice loses more than it saves. Journals sidestep the coherence problem
// that stalled conversations precisely because nobody answers back.)

import { choice } from './util.js'
import { absDayOf, TEMPERAMENTS, SOCIAL_TEMPERAMENTS } from './constants.js'
import LINES from '../content/journal.json' with { type: 'json' }

const CAP = 350 // ~25/yr × a 12-year career; the oldest fall off the back
const WEEK_BUDGET = 3 // soft cap — a journal is a diary, not a ticker

export const isJournaled = (player) => !player.npc && player.createdBy === 'user'

/**
 * Write one first-person entry. `data` carries the interpolants the kind
 * needs ({opp}, {stat}, {char}, {event}, {place}, …), plus:
 *   deltas  — [{stat, points}] mechanical margin for the one-announcement rule
 *   thread  — a thread id for continuity
 *   always  — bypass the weekly budget (stat changes are NEVER skipped)
 * Returns the entry, or null if unjournaled/budgeted out.
 */
export function writeJournal(save, player, kind, data = {}) {
  if (!isJournaled(player)) return null
  player.journal ??= []
  const today = absDayOf(save.day, save.year)
  if (!data.always) {
    const recent = player.journal.filter((e) => today - e.absDay < 7).length
    if (recent >= WEEK_BUDGET) return null
  }
  const text = composeEntry(player, kind, data)
  if (!text) return null
  const entry = {
    absDay: today,
    day: save.day,
    year: save.year,
    kind,
    text,
    deltas: data.deltas || null,
    thread: data.thread || null,
  }
  player.journal.push(entry)
  player.journalWritten = (player.journalWritten || 0) + 1
  if (player.journal.length > CAP) player.journal.splice(0, player.journal.length - CAP)
  return entry
}

// ---------- Threads (rival, slump, goal, grudge, crisis) ----------
// Continuity: a thread is an open storyline entries can hang off. Opening and
// closing are themselves journal moments; the ids let journal.mjs and the P4+
// systems read arcs instead of isolated lines.

export function threadOf(player, kind, subjectId = null) {
  return (player.threads || []).find((t) => t.kind === kind && t.subjectId === subjectId && !t.closedAbs) || null
}

export function openThread(save, player, kind, subjectId = null) {
  if (!isJournaled(player)) return null
  player.threads ??= []
  const existing = threadOf(player, kind, subjectId)
  if (existing) return existing
  const thread = {
    id: `${kind}_${subjectId || 'self'}_${absDayOf(save.day, save.year)}`,
    kind,
    subjectId,
    openedAbs: absDayOf(save.day, save.year),
    closedAbs: null,
  }
  player.threads.push(thread)
  if (player.threads.length > 40) player.threads.splice(0, player.threads.length - 40)
  return thread
}

export function closeThread(save, player, thread) {
  if (thread) thread.closedAbs = absDayOf(save.day, save.year)
}

// ---------- The voice ----------

const COMP_ROWS = new Set(TEMPERAMENTS.map((t) => t.key))
const SOC_ROWS = new Set(SOCIAL_TEMPERAMENTS.map((t) => t.key))

function fill(template, data) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (data[k] != null ? String(data[k]) : `…`))
}

function composeEntry(player, kind, data) {
  const table = LINES[kind]
  if (!table) return data.text || null // a caller may hand finished prose
  const social = !!table.social
  const voice = social ? (player.socialTemperament || 'gracious') : (player.temperament || 'stoic')
  const variants = table[voice] || table.any
  if (!variants) return null
  return fill(choice(variants), data)
}

/**
 * The prose tables. First person, present-or-just-happened tense, no emoji —
 * icons belong to the UI. Interpolants in braces. `social: true` routes the
 * entry through the social temperament instead of the competitive one.
 *
 * Killer runs hot. Scholar takes notes. Natural shrugs. Stoic states facts.
 * Warm reaches out. Gracious keeps its manners. Dramatic feels it at volume.
 * Put-together files it under handled.
 */
/**
 * The prose tables live in `src/content/journal.json` — see that directory's
 * README. Shape: { kind: { voice: [ "template", ... ] } }, plus `social: true`
 * on a kind to route it through the social temperament instead of the
 * competitive one. First person, present-or-just-happened tense, no emoji
 * (icons belong to the UI). Interpolants in braces: {stat}, {opp}, {char},
 * {event}, {place}, {why}, {row}.
 *
 * Killer runs hot. Scholar takes notes. Natural shrugs. Stoic states facts.
 * Warm reaches out. Gracious keeps its manners. Dramatic feels it at volume.
 * Put-together files it under handled.
 */


// Exposed for the dev suite and journal.mjs: which kinds exist and how a
// player's voices resolve. Content tools read this so gaps are visible.
export const JOURNAL_KINDS = Object.keys(LINES)
export const journalVoiceOf = (player, kind) =>
  LINES[kind]?.social ? (player.socialTemperament || 'gracious') : (player.temperament || 'stoic')
export const COMP_VOICE_ROWS = COMP_ROWS
export const SOC_VOICE_ROWS = SOC_ROWS
