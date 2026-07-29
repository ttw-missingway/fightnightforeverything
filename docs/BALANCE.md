# What "balanced" means for Fight Night

**Written 2026-07-28, for the rebalancing pass. Updated 2026-07-28 (evening)
after the pass ran** — measurements below marked *(post-pass)* were taken after
that day's changes; §12 records what the pass changed and what it left open.
The owner's definition of a balanced game, the measured state of the game as of
writing, and the map of where every lever lives.

Read this before touching a coefficient. It exists because balance work on this
project keeps failing the same way: someone invents a target, tunes toward it,
and ships a number nobody measured. Several sections below are notes on *how the
last attempt went wrong*, and they are as load-bearing as the targets.

---

## 0. How to use this document

Three kinds of statement live here and they are **not** interchangeable:

| Marker | Means |
|---|---|
| **GOAL** | The owner's requirement. Not negotiable, not my inference. If the code disagrees, the code is wrong. |
| **MEASURED** | A number produced by a harness run, with its sample size and date. Reproducible. |
| **OPEN** | Unknown, unverified, or a judgement nobody has made yet. Do not treat as settled. |

If you produce a number, say how many runs it came from. A single run is not a
measurement here — see §6.

---

## 1. Playstyles

**GOAL — diversity of successful playstyles.** Economy, community and
competition must all be viable routes.

**GOAL — every playstyle has a benefit, a sacrifice and a risk.** Not one of the
three: all three. A style that is simply better is a bug; so is a style that is
simply worse; so is a style with an upside and no exposure.

- *Benefit* — the thing it is uniquely good at.
- *Sacrifice* — the thing it knowingly gives up. An opportunity cost the player
  accepts going in.
- *Risk* — the way it can go wrong. Variance, a failure mode, an exposure the
  other styles do not carry.

The reference implementations of the three styles live in
`tools/balance/playstyles.mjs`. Its header states the bar: *"one being best is
fine, a gap that makes the others feel like self-kneecapping is not."*

**History (n=6, 336d, normal, BEFORE the pricing overhaul):** economy-first
dominated (0% died, $9,300) with no identified risk, community-first died 67%.
The overhaul then FLIPPED the table — post-overhaul, competition-first
dominated every axis ($3,727 vs under $300 at n=8) because brackets were free
upside, and economy-first was the weakest style. Both defects are addressed;
§12 has the pass log and the current numbers, and playstyles.mjs now records
each style's benefit/sacrifice/risk in its spec comment.

**OPEN — the three-year horizon.** Year-one viability is restored for all
three routes, but slow-patch, low-event styles still die around year 1.5–2
while competition-first reaches year 3+. See §12's "Remaining OPEN" item 1.

---

## 2. The eight player archetypes

**GOAL — there are 8 archetypes of player and every one must be a viable
candidate for an EVO winner.**

**GOAL — every archetype's absence should hurt a community.** Removing one from
the world should be felt, not shrugged off.

**GOAL — a run of ONLY one archetype should not be viable**, or should be very,
very difficult.

These are the **temperaments** in `src/game/constants.js` — four competitive and
four social, which is the 8:

- Competitive (`TEMPERAMENTS`): `killer`, `scholar`, `natural`, `stoic`
- Social (`SOCIAL_TEMPERAMENTS`): `warm`, `gracious`, `dramatic`, `puttogether`

Do not confuse these with the **16 character archetypes** (`ARCHETYPES` in the
same file — Shoto, Grappler, Zoner…). Those are fighting-game characters and are
governed by §5. When this document says "archetype" unqualified it means the 8
player temperaments.

The tool for the absence question already exists: `tools/balance/ablate.mjs`
restricts which temperament rows exist via `policy.rows`.

**MEASURED (post-pass, 2026-07-28):**

*Absences (ablate.mjs, n=12, 672d, matched control):* four rows are clearly
load-bearing — remove **scholar** and innovations fall 22.4 → 7.3 (−67%);
remove **warm** and mentorships fall 5.3 → 1.8 (−66%) with teams −43%; remove
**puttogether** and toxicity rises +73% with attendance and relevance down;
remove **natural** and attendance (−1.6) and rivalry (−0.09) sag. The other
four (killer, stoic, gracious, dramatic) show no clear structural loss at this
horizon and n — **OPEN**, see §12. Death-rate deltas at n=12 are coin-flips;
read the structural columns.

*Top of the ladder (n=24 runs, top-2 cast by elo, slot-adjusted):* every row
reaches the top, so all eight are viable candidates; rates skew natural ≈
killer ≫ scholar ≈ stoic (and warm ≈ dramatic ≫ gracious ≈ puttogether),
roughly 3–4×. Lineage builds can buy the competitive-intensity stats
regardless of row, so the EVO-winner door is open to all eight.

*Monoculture (scratchpad mono.mjs):* originally NOT punished — every
single-row world survived year one and several thrived (a one-note room
generates almost no conflict, so the community pit read it as peace). Now
punished through scene variety gating discovery (`sceneVariety` in social.js,
consumed by `attendChance`) — one mechanism, §6-consistent, routed down the
dynamics funnel. See §12 for the post-fix numbers.

---

## 3. Progression, lineage and the EVO champion

**GOAL — starting over must make it easier.** The number of runs it takes does
not matter; the fact that each run makes the next one easier does.

**GOAL — cumulative time (adding up ALL runs) to produce an EVO winner:**

| difficulty | no less than |
|---|---|
| easy | 2 years |
| normal | 3 years |
| difficult | 4 years |
| **expert** | 5 years |

These are **floors, not targets.** The owner is explicitly not concerned with
the maximum, as long as it is possible.

> **Vocabulary:** the code's four difficulties are `easy` / `normal` /
> `difficult` / `master` (`src/game/constants.js`). The owner's "expert" is the
> one called **`master`**. Do not add a fifth.

**GOAL — the possibility test is simple:** if a max-stat player can reach EVO and
then win it, it is possible. Test that directly rather than inferring it.

**GOAL — allocation points must visibly matter.** A player built with 0, 40 and
100 allocation points should be **starkly different** in skill.

**GOAL — the best players in the world sit around skill 90–99.**

### Measured state

Creation points per player by difficulty (`statPoints`): easy 10, normal 5,
difficult 3, **master 0**. Everything above that is banked legacy/prestige from
previous runs. `STAT_MAX_POINTS` is 5 per stat; there are 17 personal and 8
social stats, so a fully maxed personal build is ~85 points.

Elite skill bands (`src/game/generate.js`): `god` 89–97, `legend` 79–89,
`killer` 65–80, `contender` 48–64. **The 90–99 goal is nearly met already** — the
top band is 89–97.

`skillCeiling` (`src/game/match.js:26`) is documented to produce **~30 at an
empty build, ~72 at forty focused points, ~92 fully maxed** — deliberately short
of 100 so cultivation still has somewhere to go. That is the 0/40/100 goal, and
it is implemented.

### The most important open question in this document

Commit `51cb362` ("A lineage harness, and the answer: never") measured the
answer to "how many runs to an EVO champion" as **never, on any difficulty**,
for three stacked reasons:

1. Banked creation points could not be spent at all — the legacy economy was inert.
2. `skillCeiling` saturated at ~40 points; every point after was dead weight.
3. Skill gain was blind to opponent strength, so a cultivated player stalled at
   50–60 against a local scene regardless of ceiling.

**All three have since been addressed** — (1) by `a6880bd`, (2) by the current
`skillCeiling`, (3) by `4f2f816` (lesson scales with the skill gap, plus
invasions bringing stronger opponents to the arcade).

**MEASURED (post-pass, 6 lineages per difficulty, maxRuns 10, 4yr horizon per
run, 2026-07-28): an EVO champion is reachable, and every floor holds.**

| difficulty | champions | cumulative years at champion | floor |
|---|---|---|---|
| easy | 6/6 | 11.0–19.0 | 2 ✓ |
| normal | 6/6 | 15.0–19.0 | 3 ✓ |
| difficult | 6/6 | 16.6–19.0 | 4 ✓ |
| master | 3/6 (in 10 runs) | 15.2–21.9 | 5 ✓ |

Master's non-champion lineages had banked 40–72 points and were still
climbing — the door is open, it is just long. That is "possible, and very
difficult", which is master working as specified.

The "as it ships" arm (banked points unspendable) still produces 0 champions
anywhere, which confirms the legacy economy is what carries the loop. The
cumulative times sit far above the floors — the owner set floors, not targets,
so this satisfies the goal as written.

---

## 4. The death march

**GOAL — every game is a death march against community interest.** Interest will
ALWAYS kill a game eventually. This is not a failure state to be tuned away; it
is the shape of the game.

**GOAL — patching gets harder and riskier every time.** Each successful patch
should be harder to land than the last, and carry more downside.

The relevant machinery is `src/game/relevance.js` and `src/game/patch.js`.
Relevance decay must stay inevitable — an earlier design note in the project
records this as a tenet, not a knob.

---

## 5. Characters and the meta

**GOAL — there should be character diversity.**

**GOAL — top-tier characters should be more common and win more often,** and
**this effect should intensify as players get better.** Character disparity is
meant to matter more at high level, exactly as it does in real fighting games.

**GOAL — low-tier specialists must stay competitively viable.** A player who
puts the time into a weak character should still be able to compete.

The pieces: `src/game/balance.js` (matchup chart, `computeMatchup`, the explicit
style wheel), `src/game/interest.js` (who gravitates to what),
`src/game/patch.js` (`charPower`), and `matchupWeight` in `src/game/match.js`,
which already scales matchup influence by skill — that is the "intensifies as
players get better" hook.

---

## 6. The three death pits

**GOAL — there are exactly three, and each punishes specific negligence.**

| pit | punishes |
|---|---|
| **economy** | over-extravagance · not caring about your customers' needs |
| **community** | ignoring a toxic environment · prioritising one kind of personality over a diversity of personalities |
| **interest** | unthoughtful patching · lack of pace or urgency · safe play, i.e. not taking risks |

Read the second column as the acceptance criteria. A run that dies to the
economy pit should be traceable to extravagance or ignored customers — if runs
die to it while the owner did neither, the pit is miscalibrated regardless of
what the death rate says.

Note the community pit explicitly punishes **monoculture of personality**, which
is the same requirement as §2's "a run of only one archetype should not be
viable", seen from the other side. They should be satisfied by one mechanism,
not two that disagree.

Implementation: `src/game/danger.js` (the warning rows), `src/game/economy.js`
(foreclosure), `src/game/relevance.js`, and the `gameOver.funnel` field which
already tags which pit ended a run.

---

## 7. What changed most recently (and is least settled)

A pricing overhaul landed on 2026-07-28, immediately before this document. It is
the least-tested part of the game and the most likely to need follow-up.

**Cost per play is now two levers, not one.** `costPerPlay = $/token ×
tokens-per-match` (`src/game/economy.js`). Tokens-per-match (`arcade.prices.play`)
did not exist before — the main game was hardcoded at one token, so a cheap
token necessarily meant a cheap match and "a quarter a game" was unbuildable.
**Every "is this expensive?" question must read `costPerPlay`, never the token
price.**

**Price tolerance is anchored to reality.** Typical comfort is ~$1.20 a match.
The dear side is piecewise on purpose — a grumble up to ~$0.55 over comfort,
vertical past it — because a single slope could not both spare $1.50 and kill
$3. **GOAL: nobody tolerates $3 a match.** That is a closed arcade, not a
pricing strategy.

**MEASURED (post-pass, n=16, 336d, normal, 2026-07-28) — the price curve after
the §12 nut cut:**

| $/play | outcome |
|---|---|
| $0.50–$0.75 | 50–63% deaths — cheap play still needs floor (the venue tip now says so) |
| $1.00 | 25% |
| $1.25 | 13% |
| **$1.50–$1.75** | **0%** — $1.50 banks the most (~$2–3.4k median) |
| $1.80 | 56% |
| $1.90 | 81% |
| $2.00+ | 100% ✓ ($3 remains a closed arcade) |

The dear-side wall now stands exactly where the piecewise tolerance puts it:
typical comfort $1.20 + $0.55 grumble = $1.75 shoulder, vertical past it. The
pre-overhaul "$2.00–$2.50 cliff" question (§10 item 9) is superseded — the
transition $1.75→$2.00 is a designed ramp, measured at three points.

**RESOLVED — the economy-too-tight OPEN above.** The nut cut (see FAIR_WAGE's
comment in economy.js): wages 10/16 → 7/12, restock 6–14 → 4–10/wk, machine
upkeep 8–18 → 6–13/wk. Before it, a competently-run normal room at the BEST
price netted +$1.22/day and the ladder read easy 50% / normal 50% / difficult
100% / master 100% deaths (n=16 — the overhaul had left every difficulty
underwater). **Ladder of record (n=32, 336d, final code): easy 3% ($3,465),
normal 9% ($2,146), difficult 6% ($564), master 53% ($188) — survivor medians.**
Monotonic on money, attendance and skill; the 3-point death-rate wobbles
between easy/normal/difficult are 1–2 runs of binomial noise. Master sits
inside its historical 42–75% band. Survivor banking lands between the old
$4k+ and the broken $200–700, as intended.

**Attractions now have audiences.** Each pack in `ATTRACTION_PACKS`
(`src/game/names.js`) carries `audience`, `footprint` and `pull`. A pack serving
an audience you already have counts a quarter (`audienceMix` in
`src/game/catalog.js`), and rent charges for floor space. Measured: adding
pinball on top of classics (same `oldheads` audience) buys +0.03 draw for
+$26/month rent; adding bowling (new `families` audience) buys +0.14 for +$95.

**The owner's design intent for attractions:** buying a room should be a real
decision about *whose* room it is. A bowling alley is worth it if it opens a
crowd you do not have; buying the pinball collection when the classics wall
already serves the old heads, while you are struggling to make ends meet, should
be a clearly stupid move.

**Built (this pass):** the "cheap play needs floor" venue tip
(`cheap-needs-floor` in venue.js) — fires on costPerPlay < $0.90 with a
negative weekly trend, outranks the generic bleed tip, verified firing day 13
of a $0.50 run.

---

## 8. The lever map

| what | where |
|---|---|
| prices, rent, upkeep, payroll, foreclosure | `src/game/economy.js` |
| attendance, the day loop, awareness, crowding | `src/game/sim.js` |
| arcade opinion, relationships, teams, toxicity | `src/game/social.js` |
| skill ceiling, skill gain, elo, matchup weight | `src/game/match.js` |
| matchup chart, style wheel, `ratings` | `src/game/balance.js` |
| relevance decay, champion dividend | `src/game/relevance.js` |
| patches, `charPower`, patch reception | `src/game/patch.js` |
| difficulties, stats, temperaments, `OPENING_DAYS` | `src/game/constants.js` |
| attraction audiences / footprint / pull | `src/game/names.js` (data) + `src/game/catalog.js` (logic) |
| lineage reset, prestige carry | `src/state/store.jsx` (`resetSaveById`) |
| tab gates (per-run UI unlocks) | `src/game/tabs.js` |
| lineage achievements & permanent unlocks | `src/game/achievements.js` |

---

## 9. How to measure, and how measurement goes wrong here

The harness lives in `tools/balance/`. `policy.mjs` defines **a competent
player** — not an optimal one — and every other tool plays through it.

```bash
node tools/balance/unit.mjs [difficulty]        # one run, economy ledger by label
node tools/balance/playstyles.mjs [n] [days] [difficulty]
node tools/balance/lineage.mjs                  # runs → EVO champion
node tools/balance/ablate.mjs                   # remove a temperament row
node tools/balance/funnels.mjs                  # which pit kills runs
node tools/balance/longarc.mjs
```

### Traps this project has actually fallen into

Every one of these cost real time. They are not hypothetical.

0. **n=16 is still not enough for death rates.** During this pass, two n=16
   batches of the identical configuration read 13% and 50% dead on normal.
   Decide on n≥32, or on structural columns (attendance, money, relevance)
   rather than the death coin-flip.

1. **NEVER measure against autopilot.** A save that opens the doors and touches
   nothing dies 100% of the time on every difficulty, which makes it useless as
   an instrument. That is why `policy.mjs` exists.
2. **n=6 is not a measurement.** On 2026-07-28, n=6 showed buying the streaming
   rig killing 17% of runs; at n=16 it was 0/16 in both arms. Pure noise, opposite
   conclusion. **Use n≥7 and report medians and ranges, not a single number.**
   The `teams` tab gate reads day 186 at the median with a 111–266 range — a
   single run would have "measured" any value in that band.
3. **The harness can silently stop exercising the thing you changed.** `makeRun`
   buys the streaming rig only at opening, gated on affording 1.6× its cost. When
   the price rose, it quietly stopped buying one at all, and every follower/hype
   number afterwards was measuring a rigless arcade. Fixed by also buying it
   mid-run in `manage()`. **After changing a price, check the harness still buys
   the thing.**
4. **`npm run build` passing does not mean the code runs.** A circular-import
   temporal-dead-zone bug built cleanly under Vite and threw immediately under
   Node ESM. Run a harness, not just a build.
5. **Invent targets last, measure HEAD first.** Repeated project experience: the
   invented target was wrong and the pre-change baseline was the real answer.
   Measure the current state before deciding what the new state should be.
6. **Deaths are often a symptom, not the cause.** An earlier calibration record
   states economy deaths were downstream of a skill threshold and nine economy
   sweeps came back flat as a result. Check what is upstream before tuning the
   thing that is visibly failing.
7. **Watch for one-sided formulas.** The token price penalised charging too much
   and gave *nothing* for charging little, which made undercutting strictly
   dominated and a whole playstyle unbuildable. When a lever only ever subtracts,
   ask what the other direction is worth.

### Existing measurements worth keeping

Tab gates, post-pass (2026-07-28, n=7 per difficulty, median run-day — the
teams gate now opens on the friendship precursor, see tabs.js):

| tab gate | normal | difficult |
|---|---|---|
| world / halloffame / vods | day 8 (8–8) | day 8 (8–8) |
| codex | day 31 (6–48) | day 27 (14–62) |
| teams | day 55 (31–62) | day 179 (154–331), 1/7 never |

Beware the unit trap that produced a false alarm during the pass: an earlier
gates harness reported CALENDAR days (the arcade opens mid-June, ~day 155), so
"day 163" was actually run-day 8. Gate measurements are run-days.

Friendship formation speed (n=6, best mutual rel among cast-involved pairs):
normal reaches ~21 by run-day 180; difficult reaches ~21 only by day 336.
That curve is why the teams gate bar is 10/6 — a 20/12 bar left 6/7 difficult
runs locked all year.

---

## 10. Open items inherited by this pass — disposition (2026-07-28)

1. ~~Re-run `lineage.mjs`~~ **DONE** — champion reachable on all four
   difficulties, all cumulative-year floors hold (§3).
2. ~~Re-measure playstyles, re-specify community-first~~ **DONE** — all three
   specs re-written in the two-lever price model and right-sized by lab
   (playstyles.mjs carries the reasoning; §12 has the numbers).
3. ~~Give economy-first a risk~~ **INVERTED AND RESOLVED** — the pricing
   overhaul flipped the table: post-overhaul economy-first was the WEAKEST
   style and competition-first had no sacrifice. The pot (tournament.js), the
   exhibition headroom cap, and the right-sized specs restored
   benefit/sacrifice/risk to all three (§12).
4. ~~Second pass on the early-game nut~~ **DONE** — wages 10/16 → 7/12,
   restock and machine upkeep trimmed (§7, and FAIR_WAGE's comment).
5. ~~Verify the 8 temperaments~~ **MEASURED** — see §2. Residuals: four rows'
   absences are not felt (killer, stoic, gracious, dramatic), and two
   monocultures (natural, puttogether) survive strictly-worse rather than die.
6. ~~Verify character diversity~~ **VERIFIED, no changes** — see §12.
7. ~~Venue tip~~ **BUILT** (§7).
8. ~~Teams tab gate~~ **WIDENED** to the friendship precursor (§9, tabs.js).
9. ~~$2.00–$2.50 cliff~~ **SUPERSEDED** — the wall moved to the designed
   comfort+grumble shoulder; measured as a ramp $1.75→$2.00 (§7).

---

## 11. Standing rules

- **Do not invent a number and tune toward it.** Measure HEAD, then decide.
- **Every threshold in this codebase is meant to be measured, not reasoned about.**
  If you change one, re-measure it and record the sample size.
- **Record what you measured in the code**, next to the constant it justifies.
  Several constants already carry their measurement tables in comments; keep that
  habit. It is why this rebalance starts from facts instead of from scratch.
- **Difficulty sweeps must include `master`.** A change validated on normal has
  repeatedly turned out to delete a system on the hardest setting — a price the
  run can never reach does not make something harder, it removes it.
- The owner is **not against adding new mechanisms** to reach these goals. If a
  goal cannot be met by tuning, propose a mechanism rather than tuning past it.

---

## 12. The 2026-07-28 pass — what changed, and what it measured

Chronological, because the order mattered: each change was measured before the
next was made.

### The instrument was broken first

`DEFAULT_POLICY` still priced at $2.00/play (token 2 × the implicit 1), which
the overhaul had turned into the 100%-death band — every "competent player"
number was measuring an over-pricer. The policy gained `playTokens`, a
competent default of $1.50 (0.5 × 3), and three other instrument fixes found
along the way: it now stages exhibitions (no harness ever had — the whole
media-payoff loop was unmeasured), buys into earned attraction packs
(`attractions: true` on the room-builder style; the §7 audience system was
never exercised), and only runs ad channels the lineage has actually unlocked
(it used to write `arcade.ads` directly and buy achievement-locked radio).

### The nut cut (economy.js, model.js)

At HEAD the ladder read easy 50 / normal 50 / difficult 100 / master 100
(% deaths, n=16, 336d, all economy-funnel) — the overhaul had priced revenue
honestly without repricing costs. Wages 10/16 → 7/12 (FAIR_WAGE, newStaffing;
all downstream formulas are ratio-based), food restock 6–14 → 4–10/wk, machine
upkeep 8–18 → 6–13/wk. Immediately after the cut (n=32): easy 0% / normal 3% /
difficult 0% / master 44%. **Ladder of record (n=32, final code, all of the
below included): easy 3% ($3,465) / normal 9% ($2,146) / difficult 6% ($564) /
master 53% ($188), survivor medians.** Master stays inside its historical
42–75% band; the ladder is monotonic on money, attendance and skill.

### Events got a price (tournament.js)

Brackets were strictly-free upside — the event-heaviest style also banked the
most, which is backwards. The house now stakes the pot:
`TOURNAMENT_POT_PER_HEAD = { weekly: 1, monthly: 4, yearly: 6 }` (a weekly's
pot is mostly entry fees; monthlies and majors are what a venue genuinely
stakes). The first attempt ($3/head weekly ≈ $1,150/yr) regressed normal to
50% deaths and was resized on measurement. A bracket the house can't fund
cancels, so a dying room can't hype itself deeper into the hole.

### Exhibitions got a ceiling (tournament.js)

The showcase's relevance gain was the one pump with no age fade and no
headroom scaling — measured, an event-heavy style pinned relevance 98 for
three straight years and the death march never arrived (its pumps ~0.46/day
beat maximum old-age decay ~0.34/day, forever). The gain now scales by
headroom, same shape as the champion dividend. **After: 5-year
competition-first runs show relevance 33–88 and falling** — decline is
inevitable again; the best style just fights it longest.

### Monoculture finally hurts (social.js, sim.js)

See §2. `sceneVariety` (entropy over the temperament rows of the regulars)
gates first-timer conversion in `attendChance`, hinged so healthy worlds
(measured 0.97–0.99) are untouched and a monoculture (0.5) converts almost
nobody. **After (n=8, 672d): six of eight monocultures die 13–63% with
relevance 61–79, vs full-world 0% and 99.** Residual: only-natural and
only-puttogether survive strictly-worse (their rows' identities — spark,
reliability — are literally "showing up"), which satisfies "very difficult"
loosely at best. OPEN if the owner wants it harder.

### One real bug: invasion ghosts (invasion.js)

The 19-year master lineage crashed the harness: visitors recruited into a team
were deleted at invasion end while still in `team.memberIds`, and the first
relationship scan to touch the ghost id threw. Departures now unwind teams and
mentorships; `checkFallingOut` also filters ghosts for saves that already
carry them.

### §5, verified with no changes

Elite roster mains: 49% top-power-tercile overall, **63% among gods and
legends** (n=8) — top tiers are more common and the effect intensifies with
tier, as specified. Local rooms cluster mid-tier by taste (B 43%, perceived),
which is correct at local skill (~30, where `matchupWeight` ≈ 0.03 by
design). Low-tier specialists reach elo 1600+ with 5–20 tournament wins, and
the lab-monster persona keeps 15% of elites on bottom-tier picks. All three §5
goals hold at HEAD.

### The three styles — final specs, final numbers

Specs right-sized by lab — see the header comment in playstyles.mjs for what
the lab killed (dear food, cabinet walls, over-staffing, bargain food).

**MEASURED (n=16, normal, 2026-07-28, final code):**

| style | died 1yr | $ 1yr | rel 1yr | died 3yr | lasted 3yr | $ 3yr |
|---|---|---|---|---|---|---|
| economy-first | 6% | $1,397 | 92 | 63% | 794d | $326 |
| community-first | 25% | $106 | 51 | 100% | 417d | −$120 |
| competition-first | 6% | $2,145 | 89 | 6% | 955d | $8,770 |

Year one is level, and the three-year ordering matches each style's stated
risk — but the magnitudes still separate: **OPEN (top item): community-first
dies in year 1.5 every time, and competition-first barely dies at all by year
three.** Their attendance is equal; the whole difference is the relevance
flywheel. If this needs a mechanism rather than a number, the natural one is
letting what community-first uniquely builds — teams, mentorships, beloved
regulars — argue relevance in `relevanceDaily`'s sustain, which currently
hears only hype, headcount, and opinion. Economy-first's move from
dead-at-day-340 to 63%-at-day-794 came from exactly such an identity payoff
(attractions + exhibitions funded by its margin).

### Remaining OPEN, ranked

1. Year-2+ viability of economy- and community-first (§1) — the one goal this
   pass measured but did not close.
2. Absences of killer, stoic, gracious, dramatic are not felt (§2).
3. Monoculture residual: natural and puttogether survive-strictly-worse (§2).
4. Nobody retires; money has no late sink (inherited from Phase 7 notes).
5. The teams gate still never opens for ~1/7 difficult runs.
