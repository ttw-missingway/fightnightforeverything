# Dialogue generation — decisions, findings, and where this stands

State as of 2026-07-27. Read this before touching `spec.mjs` or `generate.mjs`.

## The decision

Dialogue is generated **offline, once**, and shipped as static data. Not at
runtime. Three reasons, in order of weight:

1. **`src/game/` is fully synchronous** — zero `async`/`await`. An API call
   inside `makeBeats` means making the whole sim async, and skip-to-recap would
   then await thousands of round trips.
2. **Volume.** Measured: ~30 spoken lines per in-game day at a 10-person
   roster, so ~10,000 per in-game *year*, and a mature scene is 40+ regulars.
   Per-line runtime generation is $10–48 per in-game year *per player*.
3. VOD replay must stay deterministic, and the game should work offline.

Baking costs **~$10 once, $0 forever**. Model: `claude-opus-5`.

## The real gap is conditioning, not prose

Combat conditions each beat on ~23 kit signals plus arc, momentum, health
fraction, whiff/punish, guard, stun, and stakes. Dialogue conditions on ~4:
voice dimension, familiarity tier, quirk, one placeholder. That asymmetry —
not word quality — is why dialogue feels flatter than combat.

Generation is worth doing mainly because it makes breadth affordable: at $10
you can afford ~120 situations where hand-authoring caps out around 45.

## Pilot 1 (lines) — done, 2026-07-27

7 buckets, 84 lines, **$0.111**. Prompt caching worked (9,270 read / 1,545
written), so the full-corpus estimate holds.

Prose quality was good — several lines are as good as the hand-written ones
("Sit down. I already put the coin in for you." / "Beat me once tonight and
I'll drive you home."). The relationship tiers landed hardest.

**Two defects the validator missed. Fix before scaling:**

1. **Cross-bucket phrase repetition.** "First to seven" appeared in 4 of 6
   buckets; "living off it ever since" twice, near-verbatim. The validator only
   catches exact-string dupes. Fix: dedupe on 3-grams corpus-wide, and generate
   buckets sequentially within a kind so accepted lines are visible to later
   calls. This matters more than it looks — buckets are selected by voice, so
   one repeated construction across four voices kills the illusion of voice.

2. **Lines asserting facts the sim owns.** Six lines hardcoded a weekday, a
   month, or a duration ("since Tuesday", "won one game in March", "twelve
   years of this"). The sim owns the calendar and the relationship clock, so
   these contradict real state — the same class of bug as the `greet` tiers
   claiming shared history in a week-old arcade. Fix: ban bare weekday/month
   names and hardcoded durations in the spec AND the validator; use
   placeholders the sim fills instead.

## The open problem: conversations don't cohere

Measured over 25 days: 226 conversations, most 4 lines, only 16% same-speaker
runs — so turn-taking already alternates and the UI already renders it as
dialogue. What's missing is **reference**: line N+1 doesn't know line N
happened. Real output:

    SafeJump:    "...SafeJump. Hey."
    DownBack:    "Alright?"
    TechChase:   "I walked into that. Fine. FINE."
    NeutralKing: "Rent went up again. Anyway. Who's got next."

Four monologues. A pool of independent lines can produce adjacency but never
reference, so better lines cannot fix this — the corpus *unit* is wrong.

### Proposed fix: make the unit an EXCHANGE, not a line

Generate 2–4 turn scenes; the model writes both sides at once, so continuity
lives inside the artifact instead of being reconstructed at runtime:

```js
{
  situation: 'One just lost a set to the other; they know each other well',
  cast: [
    { role: 'A', requires: ['lost', 'humor:dry'] },
    { role: 'B', requires: ['won', 'rel:close'] },
  ],
  turns: [
    { role: 'A', text: "I don't want to talk about it." },
    { role: 'B', text: "I haven't said anything." },
    { role: 'A', text: "You're standing there in a way that's saying something." },
  ],
}
```

The sim's job becomes **casting** — find people present who satisfy the roles.
`makeBeats` already holds everything needed (group, results, `getRel`, voices,
h2h, mood, takes), and the UI needs no change because consecutive beats already
render as dialogue.

**Two honest costs.** Casting is constraint-matching against the actual people
in the room plus a fallback when nothing fits — genuinely harder than "pick a
pool, pick a line", and that's where the engineering time goes. And exchanges
are less reusable than lines, so either the corpus grows or scenes recur more
often; slot-filling from real state mitigates but does not solve it.

Sizing: ~40 situations × ~5 cast variants × ~12 exchanges ≈ 2,400 scenes /
7,200 lines. Same ~$10–15 range. Cost is not the constraint; design is.

### Next step

Pilot ONE exchange set (~15 exchanges, ~$0.20) before building the casting
layer. The question it answers: can the model write a three-turn scene that
sounds like two specific people given only their voices and relationship? If
yes, build casting. If no, the line corpus is still a real improvement alone.

## Rejected alternatives

- **Runtime per-line generation** — see "The decision" above.
- **Runtime whole-conversation generation** — highest ceiling (~$12 per in-game
  year at ~3,000 conversations), but collides with the sync engine and makes
  VOD replay non-deterministic. Hold as a possible later "marquee moments only"
  layer, not the foundation.
- **Local in-browser model** — 500MB–2GB download, needs WebGPU, and small
  models write mediocre character voice.

## Practical notes

- `@anthropic-ai/sdk` is a **devDependency**; confirmed absent from the built
  bundle. Nothing here ships to the browser.
- Auth is `ant auth login` (OAuth profile), not a static key.
- `tools/dialogue/out/` is gitignored — raw per-bucket output is a review
  artifact until a corpus is promoted into `src/`.
- One request per bucket on purpose: a bad bucket is a five-cent regeneration.
- The 296 hand-written lines are the few-shot seed AND stay in the shipped
  corpus. They are the quality bar.
