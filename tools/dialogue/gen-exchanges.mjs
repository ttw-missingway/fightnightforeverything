// PILOT: generate multi-turn EXCHANGES rather than single lines.
//
//   node tools/dialogue/gen-exchanges.mjs
//
// The question this answers: can the model write a 3-turn scene that sounds
// like two SPECIFIC people, given only their voices and their relationship?
// If yes, the casting layer in makeBeats is worth building. See NOTES.md.
//
// Requirement vocabulary is deliberately limited to things makeBeats can
// already check at cast time — results[], familiarity(), player.voice, mood.
// A requirement the sim can't evaluate is a scene that can never play.

import Anthropic from '@anthropic-ai/sdk'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GAME_CONTEXT, THE_ROOM, FG_GLOSSARY, VOICE_DIMENSIONS, TIERS, ANTI_PATTERNS } from './spec.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'out')
const MODEL = 'claude-opus-5'
const client = new Anthropic()

// Three situations chosen to stress different conversational shapes: an
// asymmetric one (winner/loser), a symmetric one (both drained), and the case
// the sim currently handles worst — strangers, which is where the
// four-monologue problem in NOTES.md was observed.
const SITUATIONS = [
  {
    id: 'salt-after-loss',
    situation: 'A just lost a set to B. They know each other well. A is not handling it gracefully and B is enjoying that a little, but affectionately — this is a thing that happens between them constantly.',
    cast: [
      { role: 'A', requires: ['lost', 'rel:close'] },
      { role: 'B', requires: ['won', 'rel:close'] },
    ],
    turns: 3,
    count: 8,
  },
  {
    id: 'long-close-set',
    situation: 'A and B just finished a long, close set — the kind that goes the distance and leaves both of them wrung out. Who won matters less than that it was good. Neither is gloating; they are both still coming down from it.',
    cast: [
      { role: 'A', requires: ['rel:familiar'] },
      { role: 'B', requires: ['rel:familiar'] },
    ],
    turns: 3,
    count: 8,
  },
  {
    id: 'first-meeting',
    situation: 'A and B have never spoken before. One of them opens. This is a small arcade so there is no real anonymity — they will see each other again next week, and both know it.',
    cast: [
      { role: 'A', requires: ['rel:stranger'] },
      { role: 'B', requires: ['rel:stranger'] },
    ],
    turns: 3,
    count: 8,
  },
]

function systemPrompt() {
  const voices = Object.entries(VOICE_DIMENSIONS)
    .map(([d, v]) => `${d}:\n` + Object.entries(v).map(([k, x]) => `  ${k} — ${x}`).join('\n')).join('\n\n')
  const tiers = Object.entries(TIERS).map(([k, v]) => `  ${k} — ${v}`).join('\n')
  return `${GAME_CONTEXT}

## The room

${THE_ROOM}

Reference the room only where it earns its place — roughly one scene in five,
and mostly in scenes that are ABOUT the room. Everywhere else the setting
should be felt rather than described. Curtains and projectors mentioned in
every scene become a tic.

## Fighting-game vocabulary

${FG_GLOSSARY}

## Voice dimensions

${voices}

## Relationship tiers

${tiers}

## Hard rules

${ANTI_PATTERNS}

## You are writing EXCHANGES, not lines

An exchange is a short scene: consecutive turns between two named roles, shown
in the game as consecutive quoted lines. You are writing BOTH sides, so the
whole point is that each turn depends on the one before it. A turn that would
read identically if the previous turn were deleted is a failure.

Within a turn, {t} is the OTHER person in the scene and {self} is the speaker.
Use them sparingly — most turns need neither, because the two people are
already talking to each other and know who they are.

The specific failure mode to avoid: writing a comedy sketch. These are not
setup / punchline / tag. Real conversation between people who see each other
every week is lumpy and unresolved — it lands on a shrug, a non-answer, someone
changing the subject, or one person simply not dignifying the other. Do not tie
a bow on it. At least a third of your exchanges should end on something flat.

Do not invent facts the simulation owns: no weekday or month names, no specific
durations ("twelve years"), no invented score lines. The game tracks all of
that and your guess will contradict it.

Do not reuse a distinctive phrase or construction across exchanges. If one
exchange uses a particular joke shape, no other exchange in this set may.

## Calibration — the designer graded an earlier batch

THESE WORKED. Concrete, practical, no reach for cleverness. The last one he
singled out as "sounds legitimate" — two players correctly describing real play:

  A: "Something was off with my buttons that whole set."
  B: "Swap sides with me, I genuinely don't care."
  A: "No. I'm attached to them now."

  A: "Is the left stick supposed to do that?"
  B: "It's been doing that. Everyone's decided to live with it, which I think
      tells you most of what you need to know about this place."
  A: "Right side, then."

  A: "Is it the sticky one?"
  B: "They're all the sticky one."

  A: "You changed something midway. Around when I went up."
  B: "Stopped pressing after the knockdown. You were counting on it."
  A: "I was. Took me three games to notice you'd quit."
  B: "Took me three games to trust it would work."

THESE WERE REJECTED as "very AI-ish". Study why — both are competent, and both
close on a wry observational button that a person would never say out loud and
an essayist absolutely would. That rhythm is the single biggest tell:

  A: "You've gone quiet, which is usually the good part."
  B: "That last round was clean. All of it. I don't have anything."
  A: "Say that one more time but louder and toward the door."      ← the tell

  A: "There's a coin sitting on the cabinet, is that in play?"
  B: "That coin predates me. I asked about it once and got three different
      answers, none of them confident."                            ← the tell
  A: "I'll play around it."

The difference is not quality of writing. It is that the good ones are people
handling a situation, and the bad ones are people performing an observation
about a situation. Write the first kind.`
}

function userPrompt(s) {
  const cast = s.cast.map((c) => `  ${c.role} — ${c.requires.join(', ')}`).join('\n')
  return `Write ${s.count} DIFFERENT exchanges for this situation.

## Situation

${s.situation}

## Cast

${cast}

("lost"/"won" = how the set just went. "rel:X" = how they relate. These are
conditions the game checks before casting real players into the scene, so every
exchange you write must be true of ANY two people meeting them — do not write
for one imagined pair.)

## Shape

${s.turns} turns each, alternating. Each exchange must work with no preceding
context, and must be genuinely different from the others — not the same beat
with the words swapped. Vary who speaks first where it makes sense.

Return ${s.count} exchanges, each an array of ${s.turns} turns with "role" and
"text".`
}

const SCHEMA = {
  type: 'object',
  properties: {
    exchanges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          turns: {
            type: 'array',
            items: {
              type: 'object',
              properties: { role: { type: 'string' }, text: { type: 'string' } },
              required: ['role', 'text'], additionalProperties: false,
            },
          },
        },
        required: ['turns'], additionalProperties: false,
      },
    },
  },
  required: ['exchanges'], additionalProperties: false,
}

const BANNED = [
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\b(he|she|his|her|him)\b/i,
  /\b\d+ (years|months|weeks)\b/i,
  /\*[^*]+\*/,
]

// Cross-exchange 3-gram repetition, the defect pilot 1 missed.
function ngrams(text) {
  const w = text.toLowerCase().replace(/[^a-z0-9{} ]/g, '').split(/\s+/).filter(Boolean)
  return Array.from({ length: Math.max(0, w.length - 2) }, (_, i) => w.slice(i, i + 3).join(' '))
}

mkdirSync(OUT, { recursive: true })
let inTok = 0, outTok = 0, cr = 0, cw = 0
const results = []

for (const s of SITUATIONS) {
  process.stderr.write(`  ${s.id} … `)
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: [{ type: 'text', text: systemPrompt(), cache_control: { type: 'ephemeral' } }],
    output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: userPrompt(s) }],
  })
  if (res.stop_reason === 'refusal') throw new Error('refused')
  const raw = JSON.parse(res.content.find((b) => b.type === 'text').text).exchanges ?? []

  const seenGrams = new Map()
  const kept = [], rejected = []
  for (const ex of raw) {
    const all = ex.turns.map((t) => t.text).join(' ')
    const bad = BANNED.find((re) => re.test(all))
    if (bad) { rejected.push([all.slice(0, 60), `banned ${bad}`]); continue }
    const dupe = ngrams(all).find((g) => seenGrams.has(g))
    if (dupe) { rejected.push([all.slice(0, 60), `repeats "${dupe}"`]); continue }
    ngrams(all).forEach((g) => seenGrams.set(g, true))
    kept.push(ex)
  }
  results.push({ ...s, exchanges: kept })
  inTok += res.usage.input_tokens; outTok += res.usage.output_tokens
  cr += res.usage.cache_read_input_tokens ?? 0; cw += res.usage.cache_creation_input_tokens ?? 0
  process.stderr.write(`${kept.length} kept, ${rejected.length} rejected\n`)
  rejected.forEach(([t, why]) => process.stderr.write(`      ✗ ${why}: ${t}…\n`))
}

writeFileSync(join(OUT, 'exchanges.json'), JSON.stringify(results, null, 2))
const cost = (inTok * 5 + outTok * 25 + cr * 0.5 + cw * 6.25) / 1e6
console.error(`\nin ${inTok} · out ${outTok} · cache ${cr}r/${cw}w · ≈ $${cost.toFixed(3)}`)
