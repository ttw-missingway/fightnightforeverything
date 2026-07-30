# The balance harness

A headless **competent player**, and the measurements Phase 7 ran with it.

Every balance number before this was measured against *autopilot* — a save that
opens the doors and never touches a lever. That arm dies 100% of the time on
every difficulty, which makes it useless as an instrument: you cannot see what
removing an archetype costs a run that was going to die anyway.

`policy.mjs` plays the game the way someone who has read the tooltips plays it:
buys the streaming rig, stocks the counter, prices to the room, hires when the
floor gets dirty, adds setups as the room fills, advertises, streams a match a
day, runs a weekly bracket, and patches the game once the Studio is earned. It
is not optimal. It is *competent*, which is the baseline every balance question
is actually about.

```bash
node tools/balance/funnels.mjs 24 336      # the difficulty ladder, one year
node tools/balance/longarc.mjs 6 5 normal  # the five-year arc of a normal run
node tools/balance/ablate.mjs 16 336 master # no archetype superfluous
node tools/balance/playstyles.mjs 10 1008  # no dominant strategy
node tools/balance/books.mjs normal        # month-by-month books of one run
node tools/balance/unit.mjs normal         # where every dollar comes from and goes
```

## The revision instruments (docs/REVISION.md §2)

```bash
node tools/balance/determinism.mjs 400        # seeded-RNG invariants — run after ANY randomness change
node tools/balance/fingerprint.mjs 24 normal  # headline metrics → out/fingerprint.json, diffed vs baseline.json
node tools/balance/fingerprint.mjs 24 normal --full   # + lever latency (8) and recovery (9); slow
node tools/balance/fingerprint.mjs --commit   # bless the current out as the committed baseline
node tools/balance/separation.mjs 12 10 normal # metric 1 — THE metric; must widen, never converge
node tools/balance/eureka.mjs 12 normal       # metrics 3+4 — honest zeros until P1 builds the spine
node tools/balance/latency.mjs stream|money|patch  # metric 8 — days from lever pull to measurable effect
node tools/balance/recovery.mjs toxicity|burnout|irrelevance|plateau  # metric 9 — the S-curve hunt
node tools/balance/attention.mjs 8 normal     # metric 6 — mutating decisions per week, by year
node tools/balance/journal.mjs 0 4            # a content tool: one career's memory feed, readable
```

Fingerprints are fully seeded: two fingerprints of the same code are
identical, so any diff vs `baseline.json` is the change under test. Every
phase of the revision ends by running `fingerprint.mjs` and recording the
diff in `BALANCE.md` §12 — a phase that moves a metric the wrong way is not
finished.

## Two traps this harness exists to avoid

**Measure the player, not the autopilot.** Half of what looked like brutal
difficulty was the harness making choices no real player would make — buying a
build it could not afford, never hiring, never adding a setup, never patching.
Every one of those read as "the game is too hard" until it was fixed.

**A harness with no cast measures the wrong game.** The first version created
no user players at all. Created players attend far more readily, are the only
ones teams form around, and are the only ones who can qualify for EVO — so a
cast-less run measures a room full of strangers and reports skill 0.

## What the numbers were on 2026-07-27

Competent policy, one year (336 days), n=24:

| difficulty | died | lasted | attendance | avg/top skill | cash |
|---|---|---|---|---|---|
| easy | 0% | 337d | 20.3 | 32 / 41 | $9,210 |
| normal | 0% | 337d | 19.6 | 31 / 41 | $5,889 |
| difficult | 0% | 337d | 19.1 | 26 / 33 | $4,297 |
| master | 75% | 230d | 9.1 | 9 / 12 | $43 |

A normal run peaks in year 3 and dies around year 4–5 (opinion funnel). Master
is meant to be near-impossible for a first lineage; it becomes playable on
banked creation points.
