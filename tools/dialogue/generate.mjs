// Generate dialogue lines from spec.mjs.
//
//   node tools/dialogue/generate.mjs                 # every kind in the spec
//   node tools/dialogue/generate.mjs trashTalk       # one kind
//
// Writes tools/dialogue/out/<kind>.json and prints everything for review.
// Requires ANTHROPIC_API_KEY in the environment (or an `ant auth login`
// profile — the SDK finds either on its own).
//
// One request per bucket, deliberately: a bucket that reads badly is a
// five-cent regeneration rather than a reason to redo the corpus. The stable
// context (game, voices, anti-patterns) sits at the front of every request
// with a cache breakpoint, so after the first call it bills at cache-read
// rates instead of full input.

import Anthropic from '@anthropic-ai/sdk'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  GAME_CONTEXT, VOICE_DIMENSIONS, TIERS, PLACEHOLDERS, ANTI_PATTERNS, KINDS,
} from './spec.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, 'out')
const MODEL = 'claude-opus-5'

const client = new Anthropic()

// The invariant part of every request. Cached — see the cache_control below.
function systemPrompt() {
  const voices = Object.entries(VOICE_DIMENSIONS)
    .map(([dim, vals]) => `${dim}:\n` + Object.entries(vals).map(([k, v]) => `  ${k} — ${v}`).join('\n'))
    .join('\n\n')
  const tiers = Object.entries(TIERS).map(([k, v]) => `  ${k} — ${v}`).join('\n')
  return `${GAME_CONTEXT}

## Voice dimensions

${voices}

## Relationship tiers

${tiers}

## Hard rules

${ANTI_PATTERNS}

Each line must stand completely alone. It is shown as one quoted sentence with
no surrounding context, so it can never reference a previous line, answer a
question that was not asked, or trail into a reply.`
}

// The variable part: which bucket, what it means, what the bar is.
function bucketPrompt({ kind, when, poolKind, poolName, poolDesc, seed, placeholders, count }) {
  const ph = placeholders.length
    ? placeholders.map((p) => `  {${p}} — ${PLACEHOLDERS[p]}`).join('\n')
    : '  (none — this line takes no placeholders at all)'
  return `Write ${count} lines for one bucket of the corpus.

## The moment

${when}

## The speaker

${poolKind === 'tier'
    ? `This bucket is for the RELATIONSHIP TIER "${poolName}": ${poolDesc}\nWrite for that relationship specifically — it matters more here than the speaker's voice.`
    : poolKind === 'any'
      ? 'This bucket is voice-neutral: any speaker might say any of these. Range widely across personalities.'
      : `This bucket is for the ${poolKind.toUpperCase()} value "${poolName}": ${poolDesc}\nEvery line must be unmistakably this voice and not the neighbouring ones.`}

## Placeholders you may use

${ph}

Use them naturally and sparingly — a line that works without one is usually
better than a line that shoehorns one in. Never invent a placeholder that is
not on this list.

## The bar

These are the hand-written lines for this exact bucket. They are the target —
match this register, this specificity, this level of restraint. Do not rewrite
or vary them; write ${count} NEW lines that could sit alongside them without
looking generated:

${seed.map((l) => `  "${l}"`).join('\n')}

Return exactly ${count} lines.`
}

const SCHEMA = {
  type: 'object',
  properties: {
    lines: { type: 'array', items: { type: 'string' } },
  },
  required: ['lines'],
  additionalProperties: false,
}

async function generateBucket(spec, poolKind, poolName, poolDesc, seed) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: [
      { type: 'text', text: systemPrompt(), cache_control: { type: 'ephemeral' } },
    ],
    output_config: {
      effort: 'high',
      format: { type: 'json_schema', schema: SCHEMA },
    },
    messages: [{
      role: 'user',
      content: bucketPrompt({
        kind: spec.kind, when: spec.when, poolKind, poolName, poolDesc,
        seed, placeholders: spec.placeholders, count: spec.count,
      }),
    }],
  })
  if (res.stop_reason === 'refusal') {
    throw new Error(`refused (${res.stop_details?.category ?? 'unknown'})`)
  }
  const text = res.content.find((b) => b.type === 'text')?.text ?? '{}'
  return { lines: JSON.parse(text).lines ?? [], usage: res.usage }
}

// ---------- Validation ----------
// Machine-checkable failures only. Taste is reviewed by reading; these are the
// things that would ship a broken line into the game without anyone noticing.

const BANNED = [
  /^(look|listen|honestly|real talk|not gonna lie|ngl)\b/i,
  /\b(lowkey|highkey|no cap|it's giving|rizz|based on my analysis)\b/i,
  /\b(he|she|his|her|him)\b/i, // {t} has no stated gender
  /\*[^*]+\*/,                 // stage directions
]

function validate(lines, spec, seedAll) {
  const legal = new Set(spec.placeholders)
  const seen = new Set(seedAll.map((s) => s.toLowerCase().trim()))
  const kept = []
  const rejected = []
  for (const line of lines) {
    const used = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
    const bad = used.find((p) => !legal.has(p))
    const key = line.toLowerCase().trim()
    if (bad) rejected.push([line, `illegal placeholder {${bad}}`])
    else if (seen.has(key)) rejected.push([line, 'duplicate'])
    else if (line.length < 8 || line.length > 190) rejected.push([line, `length ${line.length}`])
    else {
      const banned = BANNED.find((re) => re.test(line))
      if (banned) rejected.push([line, `banned pattern ${banned}`])
      else { seen.add(key); kept.push(line) }
    }
  }
  return { kept, rejected }
}

// ---------- Run ----------

const only = process.argv[2]
const kinds = only ? KINDS.filter((k) => k.kind === only) : KINDS
if (!kinds.length) { console.error(`no such kind: ${only}`); process.exit(1) }

mkdirSync(OUT, { recursive: true })
let inTok = 0, outTok = 0, cacheRead = 0, cacheWrite = 0

for (const spec of kinds) {
  const buckets = []
  for (const [name, seed] of Object.entries(spec.pools)) {
    buckets.push({
      poolKind: name === 'any' ? 'any' : spec.dimension,
      poolName: name,
      poolDesc: name === 'any' ? '' : (VOICE_DIMENSIONS[spec.dimension]?.[name] ?? ''),
      seed, group: 'pools',
    })
  }
  for (const [name, seed] of Object.entries(spec.tiers || {})) {
    buckets.push({ poolKind: 'tier', poolName: name, poolDesc: TIERS[name], seed, group: 'tiers' })
  }

  const seedAll = buckets.flatMap((b) => b.seed)
  const result = { kind: spec.kind, pools: {}, tiers: {} }

  for (const b of buckets) {
    process.stderr.write(`  ${spec.kind}/${b.poolName} … `)
    const { lines, usage } = await generateBucket(spec, b.poolKind, b.poolName, b.poolDesc, b.seed)
    const { kept, rejected } = validate(lines, spec, seedAll)
    kept.forEach((l) => seedAll.push(l))
    result[b.group][b.poolName] = [...b.seed, ...kept]
    inTok += usage.input_tokens; outTok += usage.output_tokens
    cacheRead += usage.cache_read_input_tokens ?? 0
    cacheWrite += usage.cache_creation_input_tokens ?? 0
    process.stderr.write(`${kept.length} kept, ${rejected.length} rejected\n`)
    for (const [line, why] of rejected) process.stderr.write(`      ✗ ${why}: ${line}\n`)
  }

  if (!Object.keys(result.tiers).length) delete result.tiers
  writeFileSync(join(OUT, `${spec.kind}.json`), JSON.stringify(result, null, 2))
}

// Opus 5: $5/MTok in, $25/MTok out; cache reads ~0.1x input, writes 1.25x.
const cost = (inTok * 5 + outTok * 25 + cacheRead * 0.5 + cacheWrite * 6.25) / 1e6
console.error(`\nin ${inTok} · out ${outTok} · cache read ${cacheRead} / write ${cacheWrite}`)
console.error(`≈ $${cost.toFixed(3)}`)
