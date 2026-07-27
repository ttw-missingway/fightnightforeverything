// Generate the full exchange corpus from situations.mjs.
//
//   node tools/dialogue/gen-corpus.mjs            # all 120, skipping any done
//   node tools/dialogue/gen-corpus.mjs A B        # only categories A and B
//
// RESUMABLE. One file per situation under out/corpus/; a situation that already
// has a file is skipped. So an interrupted run costs nothing to restart, and a
// single situation that reads badly can be deleted and regenerated for pennies
// without touching the other 119.
//
// Sequential-with-concurrency rather than the Batch API: batch is 50% cheaper
// but its hour-long turnaround blows past the 5-minute prompt cache, and the
// cached system prompt is ~4k tokens on every one of 120 calls. The two roughly
// cancel, and this way there is live progress and it can be stopped mid-run.

import Anthropic from '@anthropic-ai/sdk'
import { writeFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  GAME_CONTEXT, THE_ROOM, FG_GLOSSARY, VOICE_DIMENSIONS, TIERS, ANTI_PATTERNS,
} from './spec.mjs'
import { SITUATIONS, ROLE_REQS, WORLD_REQS } from './situations.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'out', 'corpus')
const MODEL = 'claude-opus-5'
const PER_SITUATION = 12
const CONCURRENCY = 6

const client = new Anthropic()
mkdirSync(OUT, { recursive: true })

// Dylan's graded examples, verbatim. These do more than any description of
// voice — the distinction he drew is that good scenes are people handling a
// situation and bad ones are people performing an observation about one.
const CALIBRATION = `
## Calibration — the designer graded two earlier batches

THESE WORKED. Concrete, practical, no reach for cleverness. He singled the last
one out as "sounds legitimate" — two players correctly describing real play:

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

THESE WERE REJECTED as "very AI-ish". Both are competent, and both close on a
wry observational button a person would never say aloud and an essayist
absolutely would. That rhythm is the single biggest tell:

  A: "You've gone quiet, which is usually the good part."
  B: "That last round was clean. All of it. I don't have anything."
  A: "Say that one more time but louder and toward the door."      <- the tell

  A: "There's a coin sitting on the cabinet, is that in play?"
  B: "That coin predates me. I asked about it once and got three different
      answers, none of them confident."                            <- the tell
  A: "I'll play around it."

The difference is not quality of writing. The good ones are people HANDLING a
situation; the bad ones are people PERFORMING AN OBSERVATION about a situation.
Write the first kind.

THESE WERE CALLED CONFUSING, and the cause is always the same: a pronoun with
nothing behind it. Your scene plays with no surrounding context, so "work on
that one" or "just do the thing" points at something the reader cannot see and
simply reads as broken. Every "it", "that", "one" must resolve inside the scene.
`.trim()

function systemPrompt() {
  const voices = Object.entries(VOICE_DIMENSIONS)
    .map(([d, v]) => `${d}:\n` + Object.entries(v).map(([k, x]) => `  ${k} — ${x}`).join('\n')).join('\n\n')
  const tiers = Object.entries(TIERS).map(([k, v]) => `  ${k} — ${v}`).join('\n')
  return `${GAME_CONTEXT}

## The room

${THE_ROOM}

Reference the room only where it earns its place — roughly one scene in five,
and mostly in scenes that are ABOUT the room. Everywhere else the setting is
felt, not described. Curtains and projectors in every scene become a tic.

## Fighting-game vocabulary

${FG_GLOSSARY}

## Voice dimensions

${voices}

## Relationship tiers

${tiers}

## Hard rules

${ANTI_PATTERNS}

## You are writing EXCHANGES, not lines

An exchange is a short scene: consecutive turns between named roles, shown in
the game as consecutive quoted lines. You write BOTH sides, so the whole point
is that each turn depends on the one before it. A turn that would read
identically with the previous turn deleted is a failure.

Within a turn, {t} is the other person and {self} is the speaker. Use them
sparingly — two people talking to each other rarely say each other's names.

Do not write a comedy sketch. These are not setup / punchline / tag. Real
conversation between people who see each other weekly is lumpy and unresolved:
it lands on a shrug, a non-answer, a changed subject, or one person declining to
dignify the other. At least a third of your exchanges should end flat.

${CALIBRATION}`
}

function userPrompt(s) {
  const roles = Object.entries(s.roles)
    .map(([r, reqs]) => `  ${r} — ${reqs.length ? reqs.map((q) => ROLE_REQS[q]).join('; ') : 'no particular requirement'}`)
    .join('\n')
  const world = s.world.length
    ? `\n## What is true of the arcade right now\n\n${s.world.map((w) => `  - ${WORLD_REQS[w]}`).join('\n')}\n`
    : ''
  return `Write ${PER_SITUATION} DIFFERENT exchanges for this situation.

## Situation

${s.when}

## Cast

${roles}
${world}
These are conditions the game checks before casting real players, so every
exchange must be true of ANY people meeting them — do not write for one
imagined pair, and do not give them names, jobs, or histories beyond what the
conditions state.

## Shape

3 or 4 turns each, alternating. Vary the length across the set — some scenes
are three short beats, some run a little longer. Each must work with no
preceding context and be genuinely different from the others, not the same beat
reworded. Vary who speaks first.

Return ${PER_SITUATION} exchanges, each an array of turns with "role" and "text".
Role names must be exactly: ${Object.keys(s.roles).join(', ')}.`
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
  [/\b(do|doing|did|does) the thing\b/i, 'the-thing construction'],
  [/\bthe thing where\b/i, 'the-thing construction'],
  [/\bgame (three|four|five|3|4|5)\b/i, 'specific game number'],
  [/\bthrow(ing|s)? (it |that )?at (me|you|them)\b/i, 'throw-at misuse'],
  [/\b(about|roughly|approximately) (two|three|four|five|six|seven|eight|nine|ten|\d+) (seconds|minutes)\b/i, 'false precision'],
  [/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i, 'month'],
  [/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, 'weekday'],
  [/\b(he|she|his|her|him)\b/i, 'gendered pronoun'],
  [/\b\d+ (years|months|weeks)\b/i, 'hardcoded duration'],
  [/\*[^*]+\*/, 'stage direction'],
  [/\b(lowkey|highkey|no cap|it's giving|rizz)\b/i, 'internet register'],
]

// 3-grams, but only ones carrying a content word. Round 2 lost two good scenes
// to "of it i" and "to me i" — pure function-word grams collide constantly and
// mean nothing.
const STOP = new Set(('a an and are as at be been but by do does did for from had has have he her him his i if in is it its me my no not of on one or our out say she so that the their them then there they this to too up us was we were what when who will with you your just got get go going gonna'
  + ' am been being can could would should how know like now off over than that s t re ll ve d m').split(' '))
function contentGrams(text) {
  const w = text.toLowerCase().replace(/[^a-z0-9{} ]/g, '').split(/\s+/).filter(Boolean)
  const out = []
  for (let i = 0; i + 3 <= w.length; i++) {
    const g = w.slice(i, i + 3)
    if (g.some((x) => !STOP.has(x))) out.push(g.join(' '))
  }
  return out
}

async function generate(s) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 12000,
    system: [{ type: 'text', text: systemPrompt(), cache_control: { type: 'ephemeral' } }],
    output_config: { effort: 'high', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content: userPrompt(s) }],
  })
  if (res.stop_reason === 'refusal') throw new Error(`refused: ${res.stop_details?.category}`)
  const raw = JSON.parse(res.content.find((b) => b.type === 'text').text).exchanges ?? []

  const validRoles = new Set(Object.keys(s.roles))
  const seen = new Set()
  const kept = [], rejected = []
  for (const ex of raw) {
    const all = ex.turns.map((t) => t.text).join(' ')
    const badRole = ex.turns.find((t) => !validRoles.has(t.role))
    const banned = BANNED.find(([re]) => re.test(all))
    const dupe = contentGrams(all).find((g) => seen.has(g))
    if (badRole) rejected.push(`bad role "${badRole.role}"`)
    else if (banned) rejected.push(banned[1])
    else if (ex.turns.length < 2) rejected.push('too short')
    else if (dupe) rejected.push(`repeats "${dupe}"`)
    else { contentGrams(all).forEach((g) => seen.add(g)); kept.push(ex) }
  }
  return { kept, rejected, usage: res.usage }
}

// ---------- run ----------
const cats = process.argv.slice(2)
const todo = SITUATIONS
  .filter((s) => !cats.length || cats.includes(s.cat))
  .filter((s) => !existsSync(join(OUT, `${s.id}.json`)))

console.error(`${todo.length} situations to generate (${SITUATIONS.length - todo.length} already done)\n`)

let done = 0, inTok = 0, outTok = 0, cr = 0, cw = 0, totalKept = 0, totalRej = 0
const queue = [...todo]

async function worker(once = false) {
  for (;;) {
    const s = queue.shift()
    if (!s) return
    try {
      const { kept, rejected, usage } = await generate(s)
      writeFileSync(join(OUT, `${s.id}.json`), JSON.stringify({
        id: s.id, cat: s.cat, when: s.when, roles: s.roles, world: s.world, exchanges: kept,
      }, null, 2))
      inTok += usage.input_tokens; outTok += usage.output_tokens
      cr += usage.cache_read_input_tokens ?? 0; cw += usage.cache_creation_input_tokens ?? 0
      totalKept += kept.length; totalRej += rejected.length
      done++
      console.error(`  [${done}/${todo.length}] ${s.id} — ${kept.length} kept${rejected.length ? `, ${rejected.length} cut (${[...new Set(rejected)].join(', ')})` : ''}`)
    } catch (e) {
      console.error(`  [!] ${s.id} FAILED: ${e.message}`)
    }
    if (once) return
  }
}

// Warm the cache on ONE request before fanning out. A cache entry only becomes
// readable once the first response starts streaming, so N parallel requests
// with the same prefix all pay the 1.25x write instead of the 0.1x read. The
// smoke run wrote 28k cache tokens against 4.7k reads for exactly this reason.
if (queue.length) await worker.call(null, true)
await Promise.all(Array.from({ length: CONCURRENCY }, worker))

const cost = (inTok * 5 + outTok * 25 + cr * 0.5 + cw * 6.25) / 1e6
const files = readdirSync(OUT).filter((f) => f.endsWith('.json'))
const lines = files.reduce((n, f) =>
  n + JSON.parse(readFileSync(join(OUT, f))).exchanges.reduce((m, e) => m + e.turns.length, 0), 0)
console.error(`\n${files.length}/${SITUATIONS.length} situations on disk`)
console.error(`${totalKept} exchanges kept this run, ${totalRej} cut by the validator`)
console.error(`corpus now: ${lines} lines total`)
console.error(`tokens: in ${inTok} · out ${outTok} · cache ${cr}r/${cw}w · this run ≈ $${cost.toFixed(2)}`)
