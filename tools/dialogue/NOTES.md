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

## Pilot 2 (exchanges) — done, 2026-07-27. IT WORKS.

22 exchanges / ~78 lines across three situations, **$0.210**. The exchange unit
answers the question: the model can write a scene that sounds like two people
talking to each other, given only voices and relationship.

    A: "Don't say anything to me for a minute."
    B: "I was going to ask if you wanted half this sandwich."
    A: "Which half."

    A: "Is it the sticky one?"
    B: "They're all the sticky one."

    A: "There's a coin sitting on the cabinet, is that in play?"
    B: "That coin predates me. I asked about it once and got three different
        answers, none of them confident."

Every turn depends on the one before it. That is exactly what no pool of
independent lines could produce, and `first-meeting` — the case the sim
currently handles worst — improved the most.

Three findings:

1. **Turn count is not honored.** Asked for 3, `long-close-set` returned 6 —
   and the 6-turn scenes are the best writing in the set. Structured outputs
   don't support array length constraints, so enforce in the validator. Worth
   deciding deliberately: variable-length scenes are probably *better*, but it
   should be a choice rather than drift.

2. **The 3-gram dedupe throws false positives.** It killed two good exchanges
   on "of it i" and "to me i" — stopword trigrams, not distinctive phrases.
   Fix: require at least one content word in the gram, or move to 4-grams.

3. **Casting is now the concrete problem, and the requirement vocabulary is too
   thin.** Scenes encode physical context the cast conditions don't capture —
   "Coat's on. Bold." assumes A is leaving; the sandwich exchange assumes B is
   sitting with food. `lost + rel:close` doesn't express that. Either enrich the
   vocabulary (leaving/arriving/eating/spectating) or accept some scenes land
   slightly off-context. This is the real design work remaining.

Next: build the casting layer in `makeBeats`. The corpus shape is settled.

## Dylan's tier pass on the 22 (2026-07-27) — READ BEFORE GENERATING ANYTHING

    perfect      3, 10, 14, 15
    good         1, 12, 16, 19
    good/funny   5, 21, 22      (a little of this, not too much)
    FG terms wrong  13
    boring       6, 9, 18, 20
    confusing    2, 4, 8, 11
    horrible     7, 17          ("sounds very AI-ish")

What separates them — this is the calibration, not the scores:

**Perfect = concrete and practical, no reach for cleverness.** 3 is two people
swapping sides over a button excuse. 15 is a broken stick. 10 is a bench nobody
wants. 14 is two players correctly describing an adjustment one of them made
mid-set — Dylan's note was "sounds legitimate", which is the bar: real players
discussing real play.

**Horrible = a writerly tag on the end.** 7 closes "Say that one more time but
louder and toward the door"; 17 closes "I asked about it once and got three
different answers, none of them confident." Both land a wry observational
button that a person would not say and an essayist would. That rhythm — setup,
beat, knowing flourish — is the AI tell. Cut it wherever it appears, including
from lines that are otherwise good.

**Confusing = too elliptical.** 4 ("Coat's on. Bold.") needs you to infer A is
leaving; 8 and 11 need you to reconstruct an unstated premise. Implication is
good, but the reader gets one inference per exchange, not three.

**Boring = logistics with no turn.** 6, 9, 18, 20 are just people arranging
themselves. Every exchange needs one thing that isn't information transfer.

**Two new hard constraints, both from Dylan:**

1. **Fighting-game vocabulary must be used CORRECTLY** (13 failed on this). You
   punish a move that is minus on block or whiffed — you do not "punish"
   someone's reads going bad. The audience is his fighting-game friends; misuse
   grates on exactly the people who will play this. The spec now carries a
   glossary and the rule.

2. **Scenes that assume elapsed time need a cast condition.** 12 is good but
   only works in an arcade that has existed a while ("I've been coming here a
   long time"). Same class as the weekday/month bug: add `arcade:new` /
   `arcade:established` to the requirement vocabulary and gate on it.

The four perfect ones plus 1, 12, 16, 19 are the few-shot seed. 7 and 17 go in
the prompt as explicit negative examples.

## Round 2 tier pass (2026-07-27) — floor achieved, three defects left

    perfect      14, 18
    good         2, 4, 7, 8, 10, 11, 12, 21
    funny        1, 6, 19
    wrong jargon 5
    boring       3, 15
    confusing    9, 13, 16, 17, 20
    horrible     — EMPTY —

Dylan: "these ARE better… nothing that was just flat out unacceptably bad, I
would be happy with a database of lines full of this quality." The calibration
worked: naming the closing-flourish tell and showing his own graded examples
removed the bottom of the distribution, which is what matters at corpus scale —
nobody reads 2,400 scenes, but everybody notices the bad ones.

Three defects remain, and **two of them are the same defect**:

1. **Unanchored referents — the biggest one.** Confusion held at 5/21 and did
   not improve. The failures aren't too-many-inferences (what I guessed after
   round 1); they're pronouns with no antecedent. "What the hell are they
   talking about? work on what one, the console?" A scene plays with no
   surrounding context, so a referent pointing at something offstage is not
   subtle, it's broken. Rule added: every "it"/"that"/"one" must resolve INSIDE
   the exchange.

2. **The ironic "the thing" construction — his most disliked pattern, by a
   distance.** "just do the thing", "I can't believe you did the thing", "make
   me stop doing the thing". His words: "I do not care for that convention of
   talking AT ALL. It is very cringe-y to me." Note this is defect 1 wearing a
   hat — "the thing" IS an unanchored referent, used as a verbal tic. Banned in
   the prompt and regex-enforced.

   Generalised: "I don't want everyone in the cast talking like they're on
   twitter or reddit." Some real players talk in internet register; a whole cast
   doing it is unbearable. Rule added.

3. **Jargon still loose, in two distinct ways.** Vocabulary — "throw at me" is
   not what a throw is (it's a grab; you throw *someone*). And mechanics —
   scene 21 had somebody dashing forward whenever their meter fills, which
   invents a causal link between two unrelated systems. The glossary now covers
   both, plus: sets are FT2/FT3 so "game four" is usually wrong (scene 4 was
   rated marvellous but Dylan noted few sets ever reach a game 4).

Also newly banned: false-precision jokes ("spent about four seconds building
it"), which he clocked as AI-ish.

Regex-enforced now: "the thing" construction, specific game numbers, "throw
at", false-precision quantities. The referent rule and the register rule can
only live in the prompt.

## Corpus generated — 2026-07-27

**120/120 situations, 1,280 exchanges, 4,856 lines, $7.13.** No failures.

Payload: 272KB raw, **85KB gzipped** — well inside the 400KB Dylan approved, so
there is headroom to top up thin situations later without a bundle problem.

Scene lengths came out 282 three-turn / 980 four-turn / 18 five-turn.

Cache warm-up before fan-out worked exactly as intended: **532,456 cache reads
and zero writes** across the run. The category-B smoke test, which fanned out
immediately, had written 28k and read only 4.7k — six workers racing to write
the same prefix before any could read it. Warming one request first saved
roughly $3 on this run alone, and matters more the bigger the corpus gets.

152 exchanges cut by the validator. Sampled reasons: 27 repeated content
phrases, 11 weekday names, 5 gendered pronouns, 1 false-precision joke. The
weekday and pronoun catches are the ones that matter — those would have shipped
as real bugs (the sim owns the calendar, and {t} has no stated gender).

Next: casting layer in makeBeats.

---

## Casting (2026-07-27)

The corpus ships as `src/game/data/scenes.js` (generated, do not hand-edit) and
is matched to real players by `src/game/scenes.js`. `makeBeats` tries to cast a
scene FIRST — before introductions, so the corpus's own first-meeting material
can play instead of the generic intro/greet pair — and returns immediately when
one casts. If nothing casts, the old line pools run unchanged.

Measured over a simulated year with a 14-character roster and 7 patches:
**1,865 interactions, 803 scenes cast, 78–88 of the 120 situations used**
(varies by seed), zero placeholder leaks, zero `undefined`.

### Three sim bugs found while calibrating

All three are the same root cause: constants written for the retired 1-10 stat
roll, still in place after the temperament rework made stats a sparse 0-5 point
buy where most values are 0.

1. **`deriveVoice` gave every player in the game the identical voice.**
   `persona >= 7` needed 4 of 5 points on one stat and essentially never fired;
   `charisma <= 3` caught every unspent stat, which is most of them. Measured
   across 32 players: one distinct voice, `chill/dry/terse`. Since the existing
   line pools are selected by voice dimension, the whole cast had been drawing
   from the same three pools. Recalibrated to read investment, not magnitude.

2. **Mentorships and teams could never form.** `chance(social.community * 0.02)`
   is `chance(0)` for anyone who did not spend on community. Given a floor.

3. **The arcade drifted into universal mutual dislike.** `socialDelta` centred
   on 4.5 / 4 / 5 — the midpoints of the old roll — so an unspent stat scored
   as a strong negative on every interaction. Measured over a year: median
   relationship −15, friendliest pair on the entire roster +3. Nobody could
   reach `close`, mentor anyone, or found a team. Recentred on `SOCIAL_NEUTRAL`
   (1.5); median is now 0 with real friendships and the occasional feud.

### Predicates recalibrated to measured ranges

- `veteran` 60 → 35 attended nights (nobody reached 60 in a year).
- `main:toptier` / `main:lowtier`: absolute 55/45 → top/bottom 20% of the
  roster. `charPower` is an average matchup score and clusters hard: a measured
  14-character roster spanned 48.2 to 50.8, so the absolute cutoffs were
  unreachable.
- `stream:growing` 250 → 120 followers.

### Small state added to support casting

- `patch.buffedIds` / `patch.nerfedIds` — the notes carried this as prose only.
- `player.form` — last 8 results, so "on a losing streak" is answerable.
- `dip.charToday` — what someone actually brought, vs what they main.

### Situations that cannot cast yet

Five need world state the sim does not model: `setup:broken` (no faulty-cabinet
state), `game:new` (no install date on side cabinets), `price:raised` (no price
history), `staff:new` (no hire date). `dormantReqs()` reports these.

Others are gated on things only the player does — stocking concession, running
into the red, shipping a system change or a new character, letting the place get
shut down. Those are correct to be rare; they are not dead.
