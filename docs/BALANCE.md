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
three.** Economy-first's move from dead-at-day-340 to 63%-at-day-794 came from
an identity payoff being wired up (attractions + exhibitions funded by its
margin); community-first has not had its equivalent.

**Do not act on this without reading §13.** An earlier draft of this section
claimed the two styles run equal attendance and that the whole difference is
the relevance flywheel. That is **false** — the table above shows 15.7 vs 17.8
at year one — and the diagnosis built on it (that relevance is blind to what
community-first uniquely builds) is an unverified hypothesis with a live
confound underneath it.

### Remaining OPEN, ranked

1. Year-2+ viability of economy- and community-first (§1) — the one goal this
   pass measured but did not close. **§13 is the plan for it.**
2. Absences of killer, stoic, gracious, dramatic are not felt (§2).
3. Monoculture residual: natural and puttogether survive-strictly-worse (§2).
4. Nobody retires; money has no late sink (inherited from Phase 7 notes).
5. The teams gate still never opens for ~1/7 difficult runs.

---

## 13. The next pass: why the community route fades

**Status: a plan, deliberately not executed (2026-07-28). Nothing in this
section has been built or measured.** It is written to be picked up cold.

Read §11 before starting. This section is structured as two decision gates
precisely because the obvious fix here is the kind of invented-target tuning
§11 forbids — **there is a real chance the correct outcome of this pass is
"change nothing," and the gates are there to find that out cheaply.**

### The observation

At three years (n=16, normal, §12's table) community-first dies 100% of the
time around day 417 while competition-first dies 6% and reaches day 955. The
relevance gap is visible from year one: 51 vs 89.

### Why the obvious diagnosis is suspect

The tempting story is that `relevanceDaily`'s `sustain` term
([relevance.js:86](../src/game/relevance.js)) is blind to what the community
route uniquely builds. It reads exactly three inputs — stream hype, active
regulars, and `communityGameOpinion`.

**Be precise about what is and is not wired, because it is easy to get this
wrong.** Arcade opinion is NOT ignored by the sim: `arcadeOpinionOf(save,
player)` drives attendance directly and hard in `attendChance`
([sim.js:381](../src/game/sim.js)) as `clamp(0.15 + reputation * 0.16, 0.15,
1.55)` — a ~10× swing on whether someone turns up. A beloved room genuinely
fills. Only the aggregate rollup `communityArcadeOpinion(save)` is unconsumed
by the sim (Feed.jsx reads it for display), and that is a reporting
convenience, not a missing feedback loop.

**The sharper problem is saturation.** The headcount term is
`Math.min(1, activeRegulars / 40) * 0.03`, which caps at 40 regulars. All
three playstyles measured 49–66 regulars (§12's table), so **every style is
pinned at that cap and the term contributes an identical 0.03/day to each.**
It discriminates between playstyles not at all, leaving stream hype and game
opinion as the only inputs to `sustain` that vary by how you play.

**But do not "fix" it by raising the cap — that is a trap, worked through
below so nobody re-derives it.** The `0.03` is the maximum; the `40` only sets
how fast you reach it. Moving 40 → 80 leaves the ceiling untouched and simply
lowers everyone underneath:

| style | regulars | now | at cap 80 | change |
|---|---|---|---|---|
| community-first | 49 | 0.0300 | 0.0184 | **−0.0116/day** |
| economy-first | 63 | 0.0300 | 0.0236 | −0.0064/day |
| competition-first | 66 | 0.0300 | 0.0248 | −0.0053/day |

Nobody gains, and the style that loses most is the one the pass is trying to
help. Raising the coefficient instead (e.g. `min(1, regs/80) * 0.06`) would at
least be a buff — but it would still be **a reward for ROOM SIZE, and
community-first runs the smallest room of the three.** No shaping of a
headcount curve can favour it. Rule this lever out.

**But two facts undercut the story, and both must be cleared first.**

*The confound* — a second difference between the arms, large enough to
explain the result on its own, that was never controlled for. The two
playstyle specs do not differ only in identity. In playstyles.mjs,
community-first runs `patchEvery: 100` with no monthly; competition-first runs
`patchEvery: 70` with a 16-player monthly. Patch cadence resets the staleness
clock and majors generate hype — both feed relevance directly and hard.

Priced out (integrating `staleness` over one patch cycle at patience 1.0 and
multiplying by normal's `relevanceDecayMult` of 1.32):

| game age | patch/70 | patch/100 | gap |
|---|---|---|---|
| 1 yr | 0.0090/day | 0.0595/day | **0.0505** |
| 2 yr | 0.0111/day | 0.0732/day | **0.0621** |
| 3 yr | 0.0132/day | 0.0869/day | **0.0737** |

**The entire headcount term in `sustain` maxes at 0.0300/day.** The cadence
difference is worth about double the mechanism this section proposes, and it
points the same direction as the observed gap. The relevance difference may
therefore be a patch-cadence difference wearing an identity costume — and
those cadence numbers are harness definitions someone typed, not properties
of the game.

*The framing that matters.* Patching less may legitimately BE part of the
community identity (the spec describes competition-first as having "a designer
who keeps the meta moving"). The Studio is available to every style, so
cadence is a player choice. If a community-first owner who patches every 70
days survives, the game is teaching "whatever room you run, you still ship
patches" — a fine lesson, not a balance bug.

*...but cadence is probably NOT the main suspect.* **Economy-first and
community-first run identical `patchEvery: 100`, and their relevance is 92
against 51.** Cadence cannot explain that pair at all. What separates them is
that economy-first runs a 16-player monthly and community-first runs none —
and both high-relevance styles (economy 92, competition 89) have a monthly
while the only style without one sits at 51. **The missing marquee event is
the better-supported suspect.**

*And the arm itself is mis-specified.* Diffed against `DEFAULT_POLICY`,
community-first changes exactly two things: the price ($0.75 vs $1.50) and two
extra food lines. It is not a community-building strategy, it is DISCOUNT
PRICING with a misleading name — and $0.75 sits in the band the price sweep
independently measured at 50% lethal, which the "cheap play needs floor" venue
tip already exists to teach. Its deaths may be a pricing result the game
already models correctly and warns about.

**Revised ranking of suspects, before any mechanism is considered:**

1. The missing monthly major (economy vs community isolates it).
2. The price — $0.75/play is independently measured as ~50% lethal.
3. Patch cadence (still worth controlling; see the table above).
4. The saturated headcount term — possibly not a factor, and per the
   trap above, not fixable by moving the cap regardless.

*The premise may be backwards.* The blind-spot story assumes community-first
builds more social structure. The measured teams column says otherwise: 0.9
teams at three years against economy-first's 2.5 and competition-first's 3.4.
That reading is circular (it dies earlier, so it accumulates less), which is
exactly why gate 2 below normalises per day alive. **If community-first does
not lead on social structure per unit time, wiring teams into `sustain` helps
competition-first most and widens the gap.**

### Gate 1 — is this a design gap at all, or my spec?

Cheapest experiment, run it first. Take community-first exactly as specified
and vary only the levers it is confounded on, n≥32, 1008d, normal. The monthly
and the price arms matter most — see the revised ranking above:

| arm | patchEvery | monthly | $/play |
|---|---|---|---|
| A (as specified) | 100 | 0 | 0.75 |
| B — add the marquee | 100 | 16 | 0.75 |
| C — cadence parity | 70 | 0 | 0.75 |
| D — honest price | 100 | 0 | 1.50 |
| E — all three | 70 | 16 | 1.50 |

Report deaths, day lasted, and relevance at 336/672/1008. Arm E should
converge on competition-first; if it does not, something genuinely
identity-linked is left over and that residue is the real subject.

- **If B or C closes most of the relevance gap:** there is no mechanism to
  build. The styles differ in patch cadence, which is a legitimate player
  choice, and community-first's stated risk ("you patch less, you fade") is
  working as designed. Re-specify the style honestly, record it in §1, and
  **stop.** This is the outcome I consider most likely.
- **If the gap survives cadence parity:** proceed to gate 2.

### Gate 2 — does the community route actually build more?

Instrument social structure *per 100 days alive*, so early death cannot
flatter or damn a style: teams founded, mentorships started, mean
`communityArcadeOpinion`, and count of regulars at "beloved" standing
(`standingOf` ≥ 28, see social.js). All three styles, n≥16, 1008d.

- **If community-first does not lead on these:** the blind-spot hypothesis is
  dead. The real question becomes why the cheap-play route runs a smaller room
  than competition-first at all (attendance 15.7 vs 17.8 at year one) — a
  different investigation, starting at `attendChance` and the cheap-play
  awareness bonus rather than at relevance.
- **If it does lead:** the mechanism below is justified, and gate 2's output
  doubles as the calibration data for it.

### Only then: the mechanism

**Not a headcount lever** — that is ruled out above. The only form worth
building is a term keyed to something the community route actually leads on,
which is exactly what gate 2 exists to identify. If gate 2 finds it leads on
bonds rather than bodies, add a fourth `sustain` term over
`communityArcadeOpinion` (the rollup that already exists and is currently
display-only) or over teams and active mentorships, saturating fast so it
cannot become a late-game stacking engine.

**If gate 2 finds it leads on nothing, build nothing.** Re-specify the style
into something that genuinely expresses community-building — and note that no
such spec exists yet, so writing one is itself the work.

Second form, only if gate 2 shows teams and mentorships specifically are the
distinguishing output: a bonded-room term over team count and active
mentorships, saturating fast (2–3 teams should reach most of it) so it cannot
become a stacking engine late.

Whichever is chosen, it goes **inside** `sustain`, above the age-fade line —
so it is subject to `sustain *= 1 / (1 + max(0, age - 1.5) * 0.5)` like every
other argument the scene makes. It must not be added after the fade, and it
must not touch `timeDecay`.

### Guardrails — what must not regress

The tenet is that relevance decay is inevitable; this pass is the single most
likely way to break it, exactly as the flat exhibition pump did (§12).

1. **Five-year check is mandatory.** Any new sustain term must be measured at
   1680d, not 336d. The exhibition bug was invisible at one year and made runs
   immortal at three.
2. **Compare against maximum decay.** Old-age `timeDecay` reaches ~0.34/day.
   If a well-run scene's total sustain can exceed that indefinitely, the death
   march is gone and the change is wrong regardless of what the death rates
   say.
3. **Competition-first must not improve.** It already survives at 6%. If the
   change lifts the strongest style, it is the wrong lever.
4. **Re-run the ladder (n≥32) and monoculture arms.** Scene variety and this
   term both key off the room's social composition and could interact.
5. **n≥32 for anything expressed as a death rate** (§9 trap 0).

### Practical note

The harnesses this needs do not exist in the repo. `playstyles.mjs` covers the
gate-1 arms if you add the variants; gate 2 needs a new script, as the
per-100-days instrumentation is not in `playRun`'s metrics bundle. The
scratchpad scripts from the 2026-07-28 pass were session-temporary and are
gone — do not go looking for them.

---

## 14. The P0 baseline — the pre-revision game, measured (2026-07-29)

**This is the number the whole revision is judged against.** Captured by
`tools/balance/fingerprint.mjs 24 normal --years 10 --full` on the last
commit before the deprecation lane; committed as
`tools/balance/baseline.json`. Fully seeded — rerunning on the same code
reproduces it byte for byte. Recorded BEFORE §4-of-REVISION's cuts on
purpose: this measures the game the playtests actually complained about,
with discipline and exhibitions still live.

### The disease, at n=24

Separation (metric 1) is FLAT: skill 1.53 → 1.51, elo 1.44 → 1.43 across
seven years. Cast skill stddev collapses 4.4 → 0.9 while the mean converges
on ~55. Everyone lands together, exactly as the fifty playtest hours said.
**P1 exists to move this number and nothing else matters if it doesn't.**

### Headline (metrics 1–10)

| # | metric | baseline reading | target shape |
|---|---|---|---|
| 1 | separation | FLAT 1.53/1.44, cast σ → 0.9 | must widen |
| 2 | first elite win | 88% of runs, median year 4 | year 4–6, majority — *already in band* (EVO pools feed contender-tier elites to qualifiers) |
| 3 | eureka cadence | 0 — no system | 10–12/career, front-loaded |
| 4 | breakthrough : burnout | 0 : 0.37 (37% of cast retires with nothing) | neither ~0 nor ~1 |
| 5 | retirement dispersion | σ = 173 days (n=16 runs) | high / flat |
| 6 | attention | ~6.1 steady decisions/week, flat y1→y7 | ~flat — *shape already right* |
| 7 | journal volume | ~20 moments/player/yr | 15–30 — *in band* (raw memories) |
| 8 | lever latency | stream 8d · patch 0d (+45 relevance) · money NO effect (−4.8 attendance at +56d) | stream ≈ weeks ✓ · patch ≈ now ✓ · money ≥ month — **money's lever doesn't exist yet** |
| 9 | recovery | toxicity **flat 0 at every lag** · burnout flat 0.83 · irrelevance ~0.9 flat · plateau noisy 0.17–0.83 | S-curves with a findable cliff |
| 10 | money's job | survival share 0.67 → 0.88, competition ~0.12, growth → 0 | must invert |

Survival: 100% of 24 runs die by year 7 (median day 1660); funnels
dynamics 15 / opinion 7 / economy 2 — the room and the world's interest
kill runs, not the books, consistent with §12's ladder.

### Metric 9 details worth remembering

- **Toxicity recovers 0% at every lag** with the full discipline toolkit
  (weekly warnings on the chief instigator + separations) — the number
  REVISION §5 predicted, now on record. P3's levers are held against this.
- **No curve has lag structure.** Burnout is 0.83 whether you react on day
  0 or day 112 — "caught it early" is currently meaningless everywhere,
  which is precisely the two-hands-ahead failure the revision claims.
- Natural incidence over 6y (n=4): burnout 0.83, irrelevance 0.83, plateau
  0.83 — injected crises correspond to things that actually happen.
  Toxicity detected 0 naturally at threshold 0.45; either the detector
  threshold is high or natural toxicity is rarer than remembered. Caveat,
  not a finding — revisit when P3 touches chemistry.

### The elite band — §1.6's calibration data (open question 2, half-answered)

| point | skill | elo |
|---|---|---|
| world champion | ~95.4 | ~2533 |
| top-8 mean | ~89.2 | — |
| median elite | ~60.1 | — |
| top-64 cutoff | ~55.2 | ~1607 |

§1.6 hypothesised the top 64 begins around ~85; **it measures ~55.** With
a 75–100 spirit roll, even a tertiary axis (~81 expected) would clear the
current cutoff by 25 points — a Healer wouldn't be fringe-top-64, they'd be
top-20. Before P1 sets the roll range, either the contender band must rise
or the range must be recalibrated against these numbers. Do not set 75–100
by feel; that is now a measured decision.

### Instrument notes

Money's lever latency is measured against TODAY'S money levers (ads +
capacity) and the effect is negative — the dirt/staffing feedback documented
in constants.js eats the extra traffic. When P3 gives money its real job
(pots + travel), latency.mjs's money lever definition changes with it; the
baseline keeps the old reading for comparison.

### P0.4 addendum — what the deprecation cost, measured (2026-07-30)

The six §4 moves landed after the baseline was captured, and the fingerprint
diff is the blast radius (fully seeded, so every line is the change, not the
weather):

- **Runs die about a year earlier.** Median lasted 1660 → 1394 days; year-5
  survivors 18/24 → 1/24; the opinion funnel takes 9 runs instead of 7.
  Cutting exhibitions removed a working relevance pump and nothing has
  replaced it yet — that replacement IS P3's job, and this number is what its
  levers must beat just to break even with the old crutch.
- **Money's competition share collapses 0.13 → 0.03** (only tournament pots
  remain). Metric 10's inversion is now entirely ahead of us.
- **Toxicity recovery stays flat 0** under the surviving counterplay
  (spotlight starvation only). Irrelevance drifts down (~0.9 → ~0.5–0.67)
  without the showcase kick-start; the attraction kick-start carries it alone.
- Separation, attention, journal volume: unchanged within noise. The disease
  does not care which levers exist.

Also in P0.4: schema v2 — pre-revision saves are refused with a working
salvage path (main menu → 🧬 Salvage cast, raw read, no migration);
migrateSave shrank from ~270 lines of era archaeology to a version gate plus
revision-era backfills; prestige is cosmetic currency only, on every path
(PlayerForm, RosterEditor, policy, lineage).

### P0 exit — met

Ten-year run in ~14s. Baseline in git covering all ten metrics and the elite
band. `npm run lint` fails on any live import from `src/game/deprecated/`,
and there are none. Dev suite: fast-forward (competent player in the
browser), seven committed fixtures, journal viewer, eureka inspector
(scaffold with an honest empty state until P1), event timeline — all
operating on copies, verified stripped from the production bundle.

**Next: P1, the eureka spine.** The number to move is separation — flat 1.53
at n=24 — and §14's elite-band table is the input the spirit-roll range must
be calibrated against.

---

## 15. P1 — the eureka spine, built and measured (2026-07-30)

REVISION §1, implemented in full: per-stat pressure (never one bare meter),
the three channels (wound dominant, edge selective, influence = company +
character demands + spirit radiance), the §1.7 conversion split, the §1.8
belief amplifier, thresholds 25 × 1.35, forced resolution at 2.5×,
temperament inertia with the rare identity shift, the spirit layer (six
orderings, hidden 75–100 rolls, three caps, three radiances), and the
breakthrough choice — the sim answers for everyone but YOUR cast, who wait
for you on the Players screen.

### Metric 1 — the disease is no longer terminal

Measured n=24 × 10y. The metric was re-specified to read the LOCAL scene
(cast + filler regulars): with 80 elites in the world ratio, six cast members
could not move the number that was supposed to measure them. The world ratio
(the elite mythology gap) is retained and stable at ~1.53.

| year | local sep (skill) | local sep (elo) | cast mean/top | σ |
|---|---|---|---|---|
| 1 | 2.32 | 1.23 | 25/30 | 4.1 |
| 2 | 2.04 | 1.33 | 44/48 | 2.8 |
| 3 | 1.85 | 1.39 | 52/54 | 1.9 |
| 4 | **1.76 (trough)** | 1.43 | 56/58 | 1.8 |
| 5 | 1.80 | 1.49 | 58/60 | 1.7 |
| 6 | **2.08** | **1.65** | 59/61 | 1.7 |

The shape: a genuine trough in years 3–4 while the cast climbs through the
veteran pack, then RE-STRATIFICATION — the star pulls away and keeps pulling
until the run dies. Local elo separation widens monotonically from year one.
The baseline's shape was converge-and-stay-converged (σ 4.4 → 0.9, forever).
**The full "widens across ten years" claim is now explicitly a survival
problem: every run still dies by year 6 (median 1406d), which is P3–P5's
job.** Two structural causes of convergence were removed on the way: the NPC
skill tether (castTop − 4 → castTop − 12; the old value welded the room to
the cast) and the competent player's egalitarian camera (streams 'best' now —
§1.8 makes exposure the growth gate, so WHO gets the camera is cultivation).

### §1.11, at n=144 careers

- **Cadence (metric 3): 9.4 per career** (2.3 / 3.5 / 2.4 / 1.8 / 1.2 / 0.4
  by year) — in the 8–11 band, front-loaded, thinning. Never zero for an
  active cast player.
- **Wound : edge = 2.3** (588 : 256, influence 503). Wound-dominant with a
  real minority of edges — the §1.3 tension exists. It initially measured
  1:8 edge-heavy with a default every-win edge; the fix (edges only for
  NOTABLE success) is the difference between a spine and a skill tree.
- **Temperament changes: 19 across 144 careers** (~0.13/career) after inertia
  tuning (ROW_OUT 1.5, shift at 7 cross-row breakthroughs into one row).
- **Forced resolutions: 0** with a competent owner answering promptly — the
  deadline exists for the owner who sits on the choice (browser reality, not
  harness reality).
- **Metric 4: burnout 0.25 in the top-adversity quartile** (breakthroughShare
  reads 1 at the ≥3-bt bar — the bar is too low to discriminate; refine when
  retirement matters more, P5).
- **Cap realisation: 0 on every axis.** Careers are 4–5 years and the derived
  ceiling is the binding constraint; the spirit walls sit above what a
  truncated career can reach. The steering exists (the long-plateau
  redirection fires — "months at the same wall" entries are in the
  inspectors), but §1.6's attractor CANNOT be validated until careers extend
  (P5) or the roll range drops. On record as P1's open item, with the roll
  range untouched at [75,100] per §14's elite-band note.
- Metric 2 side-effect: first elite win now 92% of runs, **median year 3**
  (was year 4) — the spine accelerates the climb. Watch in P4 (its exit
  window is years 4–6).
- Metric 6 held ~6 decisions/week flat with eureka choices included; metric 7
  at 21–26/player/year.
- Denied-funding wounds (§1.2's last row) await P3's travel system.

### Instruments

`eureka.mjs` now reports all of §1.11. `metrics.mjs` carries per-career
eureka reads and the local separation views. The dev-suite inspector shows
per-stat pressure with named evidence; determinism invariants hold with the
full spine (400d).

---

## 16. P2 — the journal, built and measured (2026-07-30)

REVISION §0.4 and §5-P2, implemented: `journal.js` (the first-person feed,
temperament-driven voice, open threads, a 3-entries-per-week budget),
`notify.js` (toasts on any screen, all dismissible, sticky ones persisting as
the arcade banner, "See it" navigation), elite fragments by persona
(`fragments.js`) with the journal-unlock hook armed for P5, and the journal
surfaces: the profile feed, the dev-suite viewer with the mechanical-delta
margin, and `journal.mjs` as the content tool.

**The one-announcement rule is enforced by construction**: post-creation
stat changes happen in exactly one function (`chooseBreakthrough`), and that
function writes the journal entry carrying the delta. The chronicle keeps
collective, numberless moments; toasts point at the journal, never repeat it.
Breakthrough prompts are TOASTS keyed to the condition (`verge_<playerId>`)
and are dismissed by the code that resolves the choice — a prompt cannot
outlive its question (this fixed a real bug: answered breakthroughs left
"the choice is yours" banners standing).

### Metric 7 — in the band

Entries per cast player per year, n=24 × 10y: **13.2 / 15.3 / 17.3 / 20.4 /
21.8 / 20.0** (y1 is the mid-June opening's partial year). Target 15–30 ✓.
The exit test — a year reads as a story — holds across voices: the same
world writes a killer/warm career and a stoic/put-together career that do
not sound remotely alike, and threads (rival, slump, grudge, crisis) give
the arcs names. Voice variants were doubled where repetition showed
(rivalOpen, team, innovation) and rival pages throttled to one per person
ever, one per season.

### Two instrument corrections (both matter beyond P2)

- **The harness cast had no spirits.** `makeRun` never called
  `ensureSpirit`, so every §15 number involving cast spirit caps/radiance
  ran spirit-less. Fixed; corrected reads: **cap realisation community 0.69,
  popularity 0.44, skill still 0.00** — the love and mana ceilings are real
  and reachable, the skill wall genuinely sits above a 4–5-year career
  (§15's conclusion stands, now on clean data). Attractor match 0.30 ≈
  chance — §1.6's steering still cannot be validated until careers extend
  (P4–P5).
- **Latency truncated to the shortest-lived seed**, which erased the patch
  lever's window whenever one arm died before the day-400 pull. Now averages
  over surviving pairs (valid while ≥ half live): **stream 5d (+301
  followers), patch 0d (+61 relevance — bigger than the baseline's +45,
  because with exhibitions cut the patch is the only pump left), money no
  measurable effect** (its real job arrives in P3).

### Standing facts

Metric 3 unchanged by P2 (9.6/career, front-loaded); wound:edge 2.47; metric
6 flat at ~6.0–6.2 decisions/week with eureka answers counted; survival
median 1442d, all runs dead by y6 — the widening-across-TEN-years claim
remains a survival problem and remains P3–P5's job. Fragments generate (17
of 80 elites carried one after two years; EVO, patch and monthly-drip
sources), and the dialogue corpus was deliberately NOT mined for journal
prose — single-voice entries sidestep the coherence problem, so they were
written native.

---

## 17. P3 — the levers, built and measured (2026-07-30)

REVISION §5-P3: money became pots (POT_STAKES ×1/×3/×8/×20 per schedule
entry; outside entrants from the contender tail come for a pot worth the
trip, and your own stars skip scraps-tier weeklies) plus the travel ask/deny
loop (travel.js — away events on a cadence, asks with the books on the
table, distance-scaled cost, placing recoups / early exit burns, denial = the
§1.10 determination wound at weight 4, or 6 while flush). Streaming became
affect influence (room mood drifts toward the streamed pair weighted by
viewers; the recently-streamed pull ×1.6 in eureka's company channel — who
is visible is who the room learns from). Patching gained knowledge
invalidation (charSkill dents on changed characters; learners keep more) and
elite reach (persona-driven skill shifts — the only lever that touches the
world's best). Foreclosure demoted to guard rail (grace 50/35/28/21, was
30/21/17/13). Banishment priced: relevance −2.5, friends take it personally
in their journals, and the banished can resurface behind a big pot as
returnee outsiders.

### Metric 10 — money's job is changing ✅

Competition share of spend by year: **0.09 / 0.22 / 0.26 / 0.29 / 0.30 /
0.33** (survival 0.69 → 0.67). The baseline read a flat ~0.12 with survival
rising to 0.88. Monotone climb every year of the run — the inversion has
begun; the crossover waits on P4's calendar giving the money more to buy.

### Metric 8 — the three latencies ✅ (with the money finding)

stream **6d** (+308 followers) · patch **0d** (+58 relevance) · money **no
clean day-count**. The money finding is the §17 headline: **money is the
belief-gated lever.** Staked pots pulled at day 120 measurably REDUCE
adversity intake — outsiders displace close peer matches with near-free
underdog losses, exactly as §1.8 prescribes (no expectation, no suffering).
Even pulled at day 400 the A/B effect is small against ~1000 ambient intake
at n=6. And the tier-3 'max' arm read NEGATIVE outright: pots the house
cannot keep staking CANCEL brackets — overreach buys less adversity than
thrift. "Money ≥ a month" holds trivially; its real payoff compounds through
belief and arrives with the P4 calendar.

### Metric 9 — the cliff still does not exist ❌ (carried to P4)

toxicity 0/0/0/0/0/0.17 · burnout 0.67/0.33/0.5/0.5/0.5/0.5 · irrelevance
~0.33–0.5 flat · plateau 0.33→0.83 (rises WITH lag — later windows are
richer rooms, not better counterplay). Even with the full §2.6 kit —
eureka steering (policy.eurekaPrefer), spotlight starvation, targeted
nerf/buff patches (shiftMain), pot-and-travel plateau breaking — no crisis
resolves an S-curve. Two named suspects, in order: (1) instrument power
(n=6 per lag cannot resolve differences under ~0.2; the burnout 0d:0.67 vs
7d+:0.5 hint is one seed), and (2) injected feud triads at −80 outlive every
lever inside 180 days — formed grudges currently have no counterplay and no
untreated COMPOUNDING either, and a cliff needs the disease to progress.
P4 owns both. Natural incidence stays honest (burnout 0.5, irrelevance 1.0,
plateau 1.0; toxicity detector still reads 0 — threshold audit also carried).

### Standing facts and watch items

Survival median 1391d, all dead by y6; the killer funnel flipped to OPINION
(17/24, was 7) — pots and trips spend the cash that used to sit against
relevance decay, and the calendar (P4) is the structural answer. Metrics
1/3/7 hold through P3 (local separation trough-and-restratify 1.78→1.82;
cadence 9.9/career; journal in band, though y4+ runs hot at ~34/yr — trim
in P4 if it holds). Watch: influence chosen-kind share is now the largest
(730 vs wound 483) after the visibility multiplier — §1.2 wants wound
dominant; dial the company base down when P4 recalibrates pacing. Cap
realisation unchanged (skill 0 — careers still end before the wall).

## 18. P4 — the calendar, built and measured (2026-07-30)

REVISION §5-P4: the world grew a real competitive calendar (`circuit.js`).
Ten fixed Sunday dates a year: three invitational majors (16, double elim;
4 host-region seats, 2 each to the next four strongest regions, 4 from the
qualifier), a qualifier a month before each (32, single elim, belief ≥ 40
self-entry; two seats by bracket, **two by fan vote** — stream visibility
and personality are competitive access, which is what the streaming systems
were always for), two regionals (top 16 of a 64-deep national board, double
elim), and the Squad Showdown at lunar new year (eight crews, survivor
format, gated on a world-top-64 player). EVO unchanged at day 162. Hosts
rotate yearly through the eight strongest scenes, and your cast's elo counts
toward your own country's strength — a small scene can be dragged up the
table by the arcade that builds champions in it.

The regional board is the missing rung: 56 generated national competitors
(`rc_*`, banded by country weight — a US board's top rivals the contender
tail, a Malawi board is winnable in year two) plus your country's elites
plus your cast, on one elo ladder. It is an OPEN pool, which the sealed room
needed (§2.6 plateau); it drifts and churns yearly like the world roster.

Travel (`travel.js`) was rewritten onto the circuit: generic away events are
gone; every ask is a real date with a real field, and a funded player
actually appears in it. Eligibility is the event's own entry rule read three
weeks early. Denying a held MAJOR seat is always the flush-weight wound (6)
— the world said yes and the front counter said no. Overlaps fixed:
`whatHappensToday` resolves collisions by rarity (yearly > monthly >
weekly), the circuit pre-empts local events, and the editor warns at booking
time. Backlog landed: per-event first-to-2/first-to-3, round robins carry
the EVO-pool group table, achievements no longer credit the world's events
as yours.

### Metric 2 — first elite win ✅ (re-specified, and the window holds)

**Top-32 first win: share 0.83, median year 4** (n=24 × 10y; per-seed probe
at n=10 read [3,3,4,4,4,4,4,4,5,5] — never year 1–2). Context metric
`firstRankedWin` (any rank ≤ 64): share 0.83, median 3.5 — the contender
tail is the rung under the moment, as intended.

**The re-spec, on the record.** Measured at the rank-64 boundary the metric
collapsed to year 2 — and the first probe showed why: it was ALREADY
collapsed in P3 (pot outsiders drawn from the weakest 20 elites were being
beaten at the local Weekly in year 2; the committed baseline's median-4 was
P0 scarcity, not difficulty). §14's own calibration puts the top-64 cutoff
at ~56 skill — par for a year-3 cast — so a boundary-rank scalp cannot be
"the impossible moment" once the calendar densifies contact, which is the
entire point of P4. The moment is re-specified as a set off a **top-32**
name (killer tier and up, skill 65+). The engine stamps every ranked scalp
itself (`listScalp` = the loser's rank when the field was DRAWN,
`stampRanked` in tournament.js) so the instrument and the in-game moment
cannot drift; rank-at-draw also kills the boundary jitter where an outsider
crossed onto the list mid-bracket and handed out a technicality scalp.

Three engine changes moved the needle honestly rather than by instrument
fiat: (1) pot outsiders now come from the DEEP unranked tail (bottom 10; a
ranked name doesn't drive three states for your Saturday pot — though a
tier-3 pot tempts one 20% of the time), (2) national elites attend
regionals only 25% of the time, and the board's rc names carry a distinct
entrant kind so beating one never fires the eliteWin page, and (3) **the
world list now ranks only cast the world has SEEN** — `WORLD_SEEN_GAMES =
20` road sets (any set vs a non-arcade entrant) before a rank exists. The
closed-room elo-farming inflation (the entrantPerformance comment's old
enemy) stops mattering: by the time the road record exists, the road has
corrected the elo it ranks. EVO qualification inherits the gate, so year-2
EVO trips via farmed elo are gone and "for the first two years you mostly
watch" is now structurally true.

### What the calendar did to everything else

Survival median 1444d (§17: 1391), funnels opinion 13 / dynamics 9 /
economy 2. Burnout share 0.37 → 0.17 (road placings feed passion).
Metrics 1/3/7 shapes hold. Elite band drifts up slightly (champion 97.9,
median 63.4) — the circuit gives elites more games against each other.

**Metric 10 regressed and is carried.** Competition share of spend reads
0.03/0.11/0.12/0.10/0.10/0.10 by year — DOWN from §17's climbing
0.09→0.33. The cause is the point: asks are now merit-gated (top-16 board
spot, belief 40, a held seat), so the early game has almost nothing to buy
— correct for Act 1, but the inversion §0 promises must now come from the
mid/late game and it is not there yet. The money finding of §17 stands
(belief-gated lever); the crossover now waits on more eligible players per
year — which is P5's succession/regeneration work by construction.

### Two determinism-class leaks (the P3 lesson, third and fourth sightings)

Both caught before shipping: (1) `regionalRankings` originally MINTED the
board lazily — a World-tab render would have drawn from the save's rng
stream at user-timed positions. It is now read-only; the engine mints the
board on travelDaily's tick and at save load. (2) `hostsForYear` caches
from CURRENT region strength, so WHEN it runs is part of the answer — a
render could commit different hosts than the engine would have. Hosts for
this year and next are now precomputed on the engine's clock. Rule extended:
**no UI render may be the first caller of anything that writes to the
save.** Determinism suite green (same-seed, serialize+resume).

### Standing facts and watch items

Journal volume y5 32/yr, y6 39/yr — the §17 watch item worsened with the
circuit's away pages; trim in P5 (candidates: travelAsk pages, weekly-out
aways). Influence chosen-kind still dominant (793 vs wound 371) — carried
again; P4 did not touch the company base. Metric 9 (recoverability cliff,
feud compounding) was NOT addressed this phase despite §17 assigning it —
carried to P5 explicitly, not silently. Deferred from the backlog: the
opening-day promotional build-up (Act 1 pacing) — better built with P6's
notification/idle sweep; on the record here so it isn't dropped. Baseline
remains the P0 commit; do not re-bless until the P5 world-regeneration pass
so every phase diffs against the same origin.

## 19. P5 — the world regenerates, built and measured (2026-07-30)

REVISION §5-P5. The phase opened with a measurement that changed its shape:
**every competent run died between year 4 and year 6, and none of them died
of anything they had done wrong.** Cast healthy at 6/6, $5–10k banked, 30
regulars on the floor — killed purely by the world losing interest in the
game. The right pressure was producing the wrong ending, and the P5 exit
(metrics 2 and 5 at year 15) was not merely unmet but unmeasurable.

### What was built

**Ageing, on both sides** (`career.js`). Passion asks "do they still want
this"; age asks "can they still do it", and nothing tops age back up. Every
person rolls their OWN `peakAge` (25–31) and `hangUpAge` (peak + 4–14) —
rolled in `newPlayer` itself rather than defaulted, because a shared default
is precisely how metric 5's bulk-exodus bug returns. Past their peak,
execution erodes toward a floor at 55% of their high-water skill (the head
outlasts the hands). Retirement gains a second, independent door: the age
door fires on a clock rolled at birth, the passion door on the run's events,
and the two never line up across a cast. Legibility: a career-stage pill on
the player card, journal warnings at `late` and `twilight`, and separate
endings for burning out and ageing out.

**Eras — Act 3's recoverable collapse** (`era.js`). The relevance tenet is
untouched: decline stays inevitable and nothing in the new code softens the
slope. What changed is the bottom of it. A scene with a real legacy does not
die when its game does — **a sequel ships**. Game age becomes era-relative,
the world's attention resets scaled by your legacy (45–84, the famous name),
the matchup chart is redrawn, and everyone's hands go back to zero.
Knowledge transfers and execution does not, so retention is highest for
guide-writers and veterans. The people furthest past their peak mostly
decline to start over — which is the succession question asked in the one
way that cannot be ignored. Each era scores its OWN legacy delta, so a
dynasty must keep earning its continuations; the first world title does not
buy immortality.

**Succession** (`succession.js`). The diagnosis that made this file: with
ageing and eras in, runs still died — every one down `dynamics`, in a room
holding sixty regulars, to the text "every player you brought into this
arcade has hung it up." That was literally true and nothing could be done
about it, because the roster window closes on day one and a cast could only
ever shrink. Now: **prodigies** walk in a few times a decade (rare, flagged,
sticky-toasted, and they drift to another scene if ignored), and **the
handoff** lets a mentor — anyone past their peak, i.e. exactly the people who
can no longer win — take one under their wing, passing on a character, a head
start and a piece of who they are. Cast capped at 8. Talent is never
manufactured: the inheritance is knowledge, never ceiling.

**Veteran-tier eureka** (§1.9), **offscreen elite careers** (elites now age,
grow toward their spirit ceiling while young, decline after, and turn over by
clock rather than by weakness, with prodigies entering at 16–21), and
**champion-as-target** (`targetBurden` in match.js — titles cost real
performance, capped so a decade at number one stays reachable; readable in
the journal and itself a eureka trigger).

### The exit: metrics 2 and 5 at year 15 ✅

n=24 × 15y, normal. **Survival median 4291 days — 12.8 years, up from
P4's 1444 (4.3).** 24/24 alive through year 10; 13/24 at 13; 2/24 at 15.

- **Metric 2 — first elite win: share 1.0, median year 4.** Holds exactly
  where P4 put it, across a run three times longer. ✅
- **Metric 5 — retirement dispersion: 976 days, 24/24 runs measured** (P4:
  100 days over 2 runs; P0 baseline 173 over 16). The per-person clocks did
  their job — a genuinely flat distribution, which is the whole point of the
  metric. ✅

Metric 1's LOCAL separation (the disease) runs 2.51 → 1.80 (y4 trough) →
2.73 → oscillating 2.0–2.5 → 2.02 at y15, with cast σ widening 4.7 → 17.7.
It re-stratifies and never converges — the P1 shape, holding over fifteen
years instead of six.

### The error worth recording

The first cut of the era reset applied the same 0.55–0.75 skill cut to
elites that it applied to the cast. Measured over fifteen years and three
eras, **the world's champion fell from skill 98 to 71 and the top-64 cutoff
from 56 to 45** — the exact failure `driftEvoRoster`'s comment was written to
prevent, reintroduced from a new direction. It also converged metric 1's
world ratio (1.51 → 1.30) by dragging the top of the ladder down to meet a
cast that had not actually climbed: the disease wearing a disguise.

Fixed by treating the elite band as the calibration constant it is (§1.6): a
sequel shuffles standings (elo → 0.55 of distance from 1200) and dips skill
only 10%, small enough that the existing 25%-a-year band regression restores
it before the next sequel. Champion skill recovered to 83.8. **Standing rule:
the elite band is a constant, not a variable — anything that edits elite skill
in bulk must show its effect on `eliteBand.final` before it lands.**

The cast's retention was raised to 0.45–0.8 in the same pass: at 0.25–0.62 it
was strictly worse than what elites kept, which meant every sequel cost your
cultivated cast more than it cost the people they were chasing, and nobody
could build toward the ceiling §1.6 gives them.

### Carried, with causes

- **The late economy is the new frontier.** 23/24 runs now end in
  foreclosure, at years 11–15. The arcade runs at break-even (−5 to +9 a day)
  from year 2 onward with attendance pinned near 20, so a mature run is a
  random walk that eventually loses. P3 demoted foreclosure to "a guard rail
  against extravagance and inattention" and it is now the primary killer of
  every mature scene — that contradiction is real and is P6's to answer.
  `arcadeRenown` (titles draw pilgrims, capped at +35% attendance) was added
  as the famous name's attendance-side counterpart and is not sufficient
  alone.
- **Metric 4 reads 0.97 burnout share and is now an instrument artifact.**
  Over fifteen years essentially everyone eventually retires, so "share who
  retire" trends to 1 by construction. It needs re-specifying as a rate per
  active career-year before it means anything again.
- **Metric 10 still does not invert** (competition share 0.03–0.10, falling
  late as survival spending dominates). Carried from P4; the late-economy
  work above is now its blocker too.
- **Journal volume runs 26–43/yr against a 15–30 band** — worse than P4's
  warning, driven by circuit and era pages. Trim in P6.
- **Influence still outweighs wound** (1974 vs 1183) against §1.2's intent.
  Carried a third time; untouched again this phase.
- **Cap realisation on skill is still 0.** Nobody reaches their spirit
  ceiling even in a fifteen-year run, so §1.6's immutability promise remains
  unexercised in practice and veteran tier fires through the age door rather
  than the topped-out door.
- **Metric 9 (recoverability cliff)** was assigned to P4, carried to P5, and
  is untouched again. It is now the oldest open item in the plan.

Baseline remains the P0 commit; still not re-blessed, so every phase diffs
against the same origin.

## 20. P6 — the sweep, built and measured (2026-07-30)

REVISION §5-P6 plus the metric debt carried out of P3, P4 and P5. The headline
is not a feature: **metric 1 finally holds its target shape.** Separation runs
1.51 → 1.48 → 1.55 across fifteen years — it *widens*, which is what §2.3 has
asked for since the beginning and what every previous phase failed to deliver.

### The late economy — the contradiction resolved

P5 left 23/24 runs ending in foreclosure at years 11–15, against P3's explicit
demotion of foreclosure to "a guard rail against extravagance and
inattention". The cause was structural, not tuning: **rent compounds 12% a
year forever** (1.12¹² = 3.9× by year thirteen) while attendance is capped and
relevance inevitably declines — and there was no `sellSetup` anywhere in the
codebase, so a room that grew could never shrink. Every cabinet bought at the
peak was a permanent line on the rent for the rest of the lineage.

Two fixes. The escalator now runs for **eight years and then plateaus**
(`RENT_ESCALATION_YEARS`) — the pressure lands where it was designed to,
inside the early game, and stops being a countdown after. Note the first cut
capped the *multiplier* at 2×, which lands at year six on normal but year four
on master, so the harder the difficulty the sooner its pressure switched off;
capping years instead keeps the ordering (2.5× normal, 4.3× master). And
`sellSetup`/`closeAttraction` give the room the verb it never had. The
harness's competent player now downsizes — measured against a **sustained
28-day average**, after the first attempt read `history.at(-1).attendance`
(null on every tournament day, so it sold a cabinet after each bracket night)
and took median survival from year 13 to year 4.

Result: 15/16 alive at year 15, median 5041 days. Failure remains real —
careless play still dies in year 1, master in years 1–2, and one run died to
the opinion funnel.

**Difficulty note, per the standing finding** that "the ladder rides the
creation-budget threshold via skillCeiling, NOT the economy; economy deaths
are a symptom": normal and hard now both survive economically, which is
consistent with that. But they also produced *identical* titles (4 EVO, 16
major over 4 seeds × 12y), so difficulty is not currently expressing itself in
achievement either. That is a real open question and is recorded, not fixed.

### The band was decaying, and it was our own turnover doing it

P5 declared the elite band a calibration constant and still lost it: champion
skill drifted 98 → 84 → 77 across long runs. Two causes, both introduced by
P5's own regeneration. The era reset still dipped elite skill 10%, which
compounds when eras arrive every three years and band regression closes only a
quarter of the gap annually — removed entirely, since what a sequel actually
shuffles is who is on top, which is elo. And **every retiring elite was
replaced by a `contender`**, so the roster's tier composition ratcheted
downward forever while the band regression faithfully pulled each elite toward
a tier that was itself decaying. Elites are now tiered **by rank** (top 3 god,
next 9 legend, next 20 killer, rest tail), which preserves
`generateEvoRoster`'s designed pyramid permanently and is self-correcting.
Band restored: champion 98.3, top-8 90.5, cutoff 52.8 — matching the P4
baseline (97.9 / 90.9 / 55.9). This is what moved metric 1.

### The carried metric debt

- **Journal volume ✅ back in band: 22–29/yr** (was 38–43 against 15–30). The
  dominant kind was `elimination` at 430 entries across 17 careers — 23% of
  every journal in the game — fired on every weekly bracket exit, despite the
  comment directly above it reading "a weekly out means little". Now gated to
  brackets of 16+ or non-weekly cadence. `travelAsk` gated to majors and the
  Showdown; routine circuit exits compete for the weekly budget instead of
  bypassing it with `always: true`.
- **Wound is dominant again ✅: 1944 wound vs 1172 influence** (was 1183 vs
  1974, inverted against §1.2 and carried unaddressed through three phases).
  The company channel fired per relationship per attended day, so in a full
  room it out-volumed wounds, which need an actual loss. Halved (0.28 → 0.15)
  rather than removed — "the arcade is the growth engine" depends on the
  channel existing, not on it winning.
- **Metric 4 re-specified, and it still fails.** Retirement now records which
  door it left through (`retiredVia`), so burnout can be counted separately
  from a career simply ending. The re-spec barely moved the number — 0.85 vs
  0.90 for all-retirements — which means the pushed cohort genuinely does burn
  out, and this is a real failure rather than the instrument artifact P5
  assumed. `anyRetiredShare` is reported alongside so the redefinition is
  auditable. Open.

### The bug list

Nine of eleven fixed; two were already fixed (back-to-school attendance,
NPCs taking bracket seats). Fixed: the "better than ours" rumor now
intersects the player's favourite with what the counter actually stocks;
elite portraits (`MatchHud` looked only in `save.players`, so every elite fell
through to the id-hashed fallback and wore a different face than on the World
tab); money-match VODs now mark themselves watched (completion set React state
only and never wrote the cursor, so watched matches sat in the list as new
forever) plus the `?? 0` / `|| 1` threshold mismatch that made a
narration-less match unmarkable; "final exam" excuses are term-time only
(`lifeEventsFor`); world-scope posts get world-sized engagement (a post
reading "ranked #3 in the WORLD" collected the same hearts as a note about
your Tuesday weekly); cabinet repairs priced off the cabinet (8–22% of
`SETUP_COST`, floor $18 — was a flat $12–32 against $180–420 machines); teams
prefer the cast in recruiting, co-founding and crew-battle squad selection (a
higher-elo NPC teammate could bench the user's player from the one event they
are guaranteed to appear in); and staff morale finally has a workload term
(`staffStrain` — one employee covering a sixty-head night sat at the same
target as one covering an empty Tuesday, and the causality was inverted:
morale raised cleaning throughput but traffic never cost morale).

Bug 8 ("losing to X should award double the arcade tokens") is deliberate
satire in a fan post, not copy for a bonus that exists. Left alone; recorded
so it is not re-reported.

### Not done in P6, carried to P7 or later

- **The navigation and notification leftovers** (win/loss history and elo
  trajectory per player, golden outline on newly unlocked tabs, next button on
  player cards, clickable NPC name pills, show/show-all in VODs).
- **The idle shrink** — AFK catch-up, separating auto-stream from idle mode,
  follow-a-specific-player. §6 calls this structural rather than
  quality-of-life because an endless dynasty requires a good let-it-run mode,
  so it should not be squeezed in.
- **Unlockables** (palettes, sprite packs, rosters, stages) — the only meta
  layer the revision keeps.
- **Metric 9 (the recoverability cliff)** is untouched for a fourth phase and
  is now comfortably the oldest open item in the plan.
- **Metric 10** still does not invert (competition share 0.05–0.07).
- **capRealisation.skill is still 0** — nobody reaches their spirit ceiling
  even in a fifteen-year run.

Baseline remains the P0 commit and is still not re-blessed.

## 21. P7 — sound, and the revision closed (2026-07-30)

REVISION §5-P7: "the most-requested item on the list, and every landmark this
revision builds is weaker without it."

**Synthesized, not sampled** (`src/audio/sound.js`). Sampling was available and
was declined for a design reason, not a practical one: synthesized cues can be
**procedural**. A hit's body and volume scale with the damage the narrator just
described, and EVO does not sound like a Tuesday weekly. A sample library gives
one recording of a punch; an oscillator gives the punch that actually landed —
and the whole revision is about consequences being legible. Square waves are
also the native voice of the thing being simulated. Zero bundle cost, zero
licensing, works offline.

**Two rules the audio layer obeys**, both load-bearing:

- *Sound never touches the save and never draws from the seeded rng.* The
  balance harness rests entirely on determinism, and P3 and P4 each found a
  leak where a non-engine caller forked the stream. Noise generation uses
  `Math.random` **deliberately**, precisely because it must not be accounted
  for. Determinism suite re-run and green after P7.
- *Sound never throws.* Every entry point is wrapped; a missing Web Audio
  implementation or a mis-guessed autoplay policy can never interrupt a game
  that is otherwise fine.

**The layer observes rather than being called.** `useSound.jsx` watches the
notification layer, which already enumerates every landmark the revision built,
and voices what arrives. That direction of dependency means the engine has no
idea sound exists, and the enumeration §5-P7 asks for cannot drift out of sync
with the one notify.js already maintains: a landmark that pushes a toast is a
landmark that makes a sound, by construction.

23 cues: the verge and the breakthrough (the signature sound — a rising major
arpeggio that *resolves*), the first elite win, titles, EVO, the sequel (falls
away, then climbs back out somewhere new), a prodigy walking in, the coaching
handoff, veteran-tier output, retirement, the danger rail, and game over — plus
match hits scaled by damage, KOs, and light UI feedback. Volume and mute live
in localStorage rather than the save: how loud a laptop is has nothing to do
with an arcade, and it must not ride along inside an exported world.

Verified in-browser: all 23 cues fire without error, the AudioContext reaches
`running` after a gesture, settings round-trip, console clean.

---

## The revision, closed

Seven phases, P0 through P7, each measured against §2.3 before it was called
done. Where the metrics landed:

| # | metric | verdict |
|---|---|---|
| 1 | Separation | ✅ **widens** — 1.51 → 1.48 → 1.55 over 15y (P6) |
| 2 | Time to first elite win | ✅ median y4, share 0.94, never y1–2 |
| 3 | Eureka cadence | ✅ ~9.9/career, front-loaded and thinning |
| 4 | Breakthrough : burnout | ✅ **re-specified §22** — conversion 0.75, spread 0.19, room-driven |
| 5 | Retirement dispersion | ✅ 1160 days, all runs measurable |
| 6 | Attention cost | ✅ ~6.7–7.2 mutating decisions/week, flat y1→y15 |
| 7 | Journal volume | ✅ 22–29/yr, back inside the 15–30 band |
| 8 | Lever latency | ✅ stream ≈ 6d, patch ≈ 0d, money belief-gated |
| 9 | Recoverability curve | ⚠️ **partial (§24)** — crises now recover at all (0% → ~0.5); the CLIFF is NOT demonstrated at n=24 |
| 10 | Money's job | ⚠️ **partial (§23)** — 0.03 → 0.40, but never crosses survival |

Seven of ten hold. The three that do not are recorded with their causes rather
than quietly dropped, and metric 9 — the one that most directly tests §0's
"fixable if caught early, hopeless past a point" claim — was deferred in P4,
P5 and P6 and is the single largest piece of unfinished work in the plan.

Also carried, and NOT done: the navigation/notification leftovers, the idle
shrink (§6 calls it structural, not quality-of-life, because an endless dynasty
requires a good let-it-run mode), and the unlockables layer. One open question
found late in P6: normal and hard now produce identical achievement, so
difficulty is not currently expressing itself in the ladder — read
`difficulty-calibration` before touching any difficulty number.

The committed baseline is still the P0 commit and has never been re-blessed, so
every phase in §§14–21 diffs against the same origin.

## 22. Metric 4 — re-specified, and the wager made real (2026-07-31)

Post-revision follow-up, taken first because it is the measuring stick the
other two open metrics are judged with.

### The re-spec

§2.3 asks whether pushing a player is a genuine GAMBLE — "neither near 0 nor
near 1". It was read as career ENDPOINTS: did they eventually break through,
did they eventually retire. That reading died with P5's long runs, because
over fifteen years a pushed player does both. Breakthrough share pinned at
1.00 (≥3 breakthroughs is automatic across a long career) and burnout sat at
0.85–0.97. Two numbers, both near 1, measuring longevity rather than risk.
P6's first attempt fixed only the denominator (burnout vs merely retiring) and
moved it 0.90 → 0.85.

The wager does not happen across a career. It happens at **every adversity
event**, and §1.7 already computes it there — `productiveShare` splits each
event between eureka and passion drain, and `eureka.js` has been banking both
halves all along (`e.adversity`, `e.burnout`). So metric 4 now reads the split
where it is actually made. **No engine change was required to measure it**,
which is what made this the cheap one to do first.

Reported: cohort `conversion` (mean, p10, p90, spread) plus
`breakthroughsPerCareerYear`, with the two saturated legacy shares kept
alongside so the redefinition stays auditable.

### What it immediately found

**conversion mean 0.87 · p10 0.81 · p90 0.91 · spread 0.10.**

Suffering essentially always paid, for everybody, at about the same rate.
Split by career length: 0.77 for careers under two years, 0.83 for two-to-five
— the compounding curve §1.7 promises is real — but with a **floor of 0.50**.
§1.7's own claim that "a miserable, isolated player converts adversity almost
entirely into burnout" described a player who did not exist in the data.

Two causes. The base (0.16) started a beginner with nothing over two-thirds of
the way up. And the INNATE terms — determination, temperance, composure, max
0.64 between them — outweighed the ROOM terms — mood, relationships, love aura,
max 0.29 — by more than two to one. That inverts the thesis: §1.7 is the
equation for *"suffering is only productive in a well-run room"*, and the room
was the smaller half of it.

### The fix, and the blast radius

Base 0.16 → 0.08; innate coefficients cut ~30%; room terms raised (mood 0.028
→ 0.030, relationship health 0.10 → 0.18); clamp 0.06–0.92 → 0.05–0.88.

**conversion mean 0.75 · p10 0.65 · p90 0.84 · spread 0.19** — the spread
nearly doubled, which is the number that makes it a wager rather than a tax.

And the thesis now holds where it is supposed to. Same seeds, four years, one
policy well-run and one neglecting the room (no camera, no staff, thin menu,
overpriced):

| room | conversion | min |
|---|---|---|
| well-run | **0.59** | 0.42 |
| neglected | **0.38** | 0.32 |

A twenty-one point gap driven purely by how the place is run. That is §1.7
being true in the numbers rather than in the comment above it.

Nothing else moved: separation 1.52 / 1.51 / 1.55 (unchanged to slightly
better), journal 29.1/yr, metric 5 at 1243 days, metric 2 share 1.0 at median
year 4, eureka cadence 9.4 per career (target 8–11), survival median 5041 days
with no deaths. Determinism suite green.

**Metric 4 now passes** — with the honest note that the pushed cohort's 0.75
is still on the high side, and what earns the pass is the spread and the
room-sensitivity rather than the mean.

Open metrics are now **9 and 10**. The recommended order stands: metric 10
next (its spending sink is a prerequisite for one of metric 9's four
counterplays), then metric 9, whose fix is making crises COMPOUND — its
instrument works and has twice returned a null result because a static crisis
cannot have a lag structure.

## 23. Metric 10 — money's job (2026-07-31)

### It was mostly an instrument bug, and the smoke alarm was working

The spend classifier buckets every economy log line into survival /
competition / growth, with anything unmatched landing in `other` **so that a
renamed label can never silently vanish from the books**. That safeguard did
its job perfectly and nobody looked at it.

P4 rewrote travel onto the real calendar and changed its log label from
`trip to X` to `funded NAME — EVENT`. The `/trip to/` pattern stopped matching
that day, and **every dollar of travel funding — the entire second half of what
§0 calls money's new job — has been reported as unclassified ever since.**
`emergency cabinet repair` was never matched either. Metric 10 has been
under-reporting competition spend for three phases.

It hid well because every travel line is a unique string (`funded TheReads —
Autumn Major · Japan`), so a top-N-by-label breakdown shows hundreds of tiny
rows and never a total — while `other` quietly held a third of all spend.

Fixed: SURVIVAL gains `/cabinet repair/`, COMPETITION becomes
`[/pot & trophies/, /^funded /, /trip to/, /exhibition/]`, and `aggregate` now
reports the `other` share alongside the three real buckets so the alarm is
audible next time.

**The correction is most of the metric.** Competition share by year, n=6 × 20y:

| year | 1 | 3 | 5 | 8 | 12 | 16 | 20 |
|---|---|---|---|---|---|---|---|
| survival | 0.73 | 0.71 | 0.57 | 0.61 | 0.61 | 0.65 | 0.59 |
| competition | 0.03 | 0.28 | 0.42 | 0.38 | 0.39 | 0.35 | 0.40 |
| other | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Previously reported: 0.03 → 0.07, flat. Actual: **0.03 → ~0.40**, a
thirteen-fold climb with survival falling 0.73 → 0.59. Money's job *does*
change across a run, and the game has been doing it since P4.

### Verdict: partial. It changes job; it does not invert

§2.3's literal target is that the shares **invert**. They converge and
plateau — competition never exceeds survival — so this is a partial pass, not
a pass. Competition plateaus because everything competitive has a ceiling: pot
stakes cap at ×20 and a trip costs what a trip costs.

### The sink I recommended was built, measured, and cut

Per §22's recommendation I built the training program — tiered monthly
coaching/lab investment (PROGRAM_TIERS), billed with the rent, feeding §1.7's
room half so that money → conditions → conversion → champions. It was
thematically right and it did not survive contact with measurement:

- **It bought metric 10 nothing.** Competition sat at ~0.40 with it and ~0.40
  without — pots and travel already dominate, and the policy can only afford
  the top tier late.
- **It cost metric 4 its spread.** A flat bonus lifted every player equally,
  compressing conversion spread 0.19 → 0.12 — money buying its way out of the
  wager §22 had just restored. Re-shaping it to *amplify* the room half rather
  than add to it (money amplifies a room, it cannot substitute for one)
  recovered only part of that: still 0.12.

Trading a fixed metric for an unfixed one is a bad trade, so it was reverted
in full. Post-revert, metric 4's spread is back to **0.18** and metric 10 is
unchanged, which is the confirmation that the program was buying nothing.
Recorded rather than quietly deleted, because "we tried the obvious sink and
it did not earn its place" is the useful finding.

### What strict inversion would actually require

For competition to exceed survival, an arcade would have to spend more on its
competitive program than on rent, payroll and upkeep combined. That is not a
tuning problem — it is a question about what the arcade fundamentally IS, and
it belongs to the designer rather than to a balance pass. The options are
roughly: make competition unbounded (appearance guarantees, funding whole
seasons, a paid stable), or re-specify the metric against DISCRETIONARY spend
(after the nut), which is the number that actually answers "what is money
for".

Nothing else moved: separation 1.52 / 1.53 / 1.54, metric 5 at 1703, metric 2
share 1.0 at median year 4, journal 29.1/yr, survival median 6721 days.
Determinism green.

**Open: metric 9 only.** Its fix is making crises compound — the instrument
works and has twice returned a null result because a static crisis cannot have
a lag structure.

## 24. Metric 9 — the cliff exists now, for one crisis (2026-07-31)

The oldest open item in the plan, carried through P4, P5 and P6. Six steps,
in the order they were recommended.

### 1. Verify the premise first

Deliberately ahead of any building, because §23's lesson was that a confident
diagnosis can be wrong. Inject a crisis, do **nothing**, log severity weekly
for 112 days:

| crisis | wk 0 | wk 2 | wk 4 | wk 8 | wk 12 | wk 16 |
|---|---|---|---|---|---|---|
| toxicity (scene) | 0.10 | 0.12 | 0.12 | 0.13 | 0.15 | 0.13 |
| burnout (star passion) | 10 | 20 | 34 | 41 | 41 | 40 |

Half the diagnosis was right and half was wrong, which is exactly why the
probe was worth doing. **Toxicity is static** — 0.10 to 0.13 in four months,
confirming the compounding theory. **Burnout is not static, it is
SELF-CURING**: a star injected at passion 10, deep inside the retirement zone,
climbs back to 40 untouched. The counterplay was never doing the work; the
crisis was fixing itself. A flat curve was guaranteed either way, but for two
different reasons.

### 2–3. The two engine changes

**Feuds recruit** (`spreadFeuds`, social.js). Bystanders with ties to one side
take it, and toxicity is measured as the share of the room in bad blood — so a
faction is a rising number. **And wounds close**: feuds cool on their own, but
at a rate suppressed by the scene's own toxicity. That pairing is the cliff's
actual mechanism — early, cooling beats spreading and catching it works; late,
the room is poisonous enough to throttle cooling and the faction outruns it.
The first cut only spread, and produced 0% recovery at every lag: a crisis
that can only grow is a wall, not a cliff, and reads exactly as flat.

**Burnout sticks** (career.js). The file's own thesis — "burnout is not bad
things happening, it is good things stopping working" — was modelled for
tenure and not for burnout itself, so somebody already checked out still got
the full lift from a good night. Gains now fade as passion falls. Plus
departures cost their friends passion, kept deliberately small because metric
5 is the bulk-exodus alarm.

Post-change, untreated severity now moves: toxicity **0.24 → 0.54** across the
window (crossing its own 0.45 detection threshold), and burnout sits *below*
the retirement line for weeks instead of curing itself.

### 4. Plateau left the curve

§2.6 always said plateau is an equilibrium rather than an event, and its
measured recovery *rose* with lag (0.33 → 0.83) because later windows are
simply richer rooms. Asking "did it recover given you waited" of a steady
state is a category error. It is now `measurePlateauIncidence` — the share of
runs sitting in the §0 equilibrium at years 4, 8 and 12 — and `curveExempt`
keeps it out of the sweep.

### 5–6. The control, and raising n

Irrelevance was left untouched as the positive control. And §17's first named
suspect — instrument power — was correct: at six seeds one run is 0.17, so
nothing below ~0.2 was resolvable and every curve was being read through
noise. SEEDS doubled to twelve.

**The sweep, n=12:**

| crisis | k0 | k7 | k14 | k28 | k56 | k112 |
|---|---|---|---|---|---|---|
| **burnout** | **0.75** | **0.67** | **0.58** | 0.58 | 0.58 | 0.58 |
| toxicity | 0 | 0.08 | 0 | 0.08 | 0.08 | 0.17 |
| irrelevance | 1.00 | 0.58 | 0.67 | 0.75 | 0.75 | 0.83 |

### The verdict: partial, and the failure is now a different failure

**Burnout is a cliff.** Monotone decline to a floor: react immediately and
three runs in four recover; wait a week and it is two in three; past a
fortnight it settles at 0.58 and waiting longer costs nothing more because the
damage is done. That is the first genuine lag structure this metric has ever
produced, and it means §0's "fixable if caught early" is now literally true of
at least one crisis.

**Toxicity has no counterplay at all.** ~0 recovery at every lag — but the
reason has changed, and that is the progress. It used to be unmeasurable
because nothing got worse; now the disease progresses correctly and the §2.6
kit (starve the spotlight, steer breakthroughs into sensitivity, nerf the
instigator's character) simply cannot reverse a spreading faction. That is a
real design gap with a clear shape, not an instrument artifact.

**Irrelevance is odd**: perfect at k0, then 0.58–0.83 with no monotone order.
Immediate action always works; after that the shape is not a cliff. Untouched
this pass by design, so it stands as the honest control.

Metric 9 moves from ❌ to ⚠️. What remains is a counterplay problem for
toxicity — plausibly that the room needs a way to actually break a faction
(mediation, separating the parties, or paying the cost of losing somebody) —
rather than a measurement problem.

Determinism green. Separation, metric 2, metric 4, metric 5 and journal volume
re-checked in the same pass and unmoved.

### §24 addendum — the toxicity counterplay (2026-07-31)

Toxicity went from 0% recovery at every lag to **0.42 / 0.42 / 0.50 / 0.33 /
0.33 / 0.33**. Two changes, and the second one is the interesting bug.

**Cutting out the source now breaks what they built.** Banishment removed a
person and left every grudge they had spread exactly where it was — so the
room stayed split over an argument whose author had left. Grudges now carry
PROVENANCE (`feudOrigin`, social.js): a recruited grudge remembers who talked
them into it, and banishing that person mostly dissolves the grudges they
seeded, because nobody can quite remember what they were defending.

That is where the cliff comes from. Early, nearly every grudge traces to one
person and cutting them out genuinely fixes the room. Late, the recruits have
started feuds of *their own* — second-generation grudges name the RECRUIT as
their origin — so removing the original author leaves a room full of quarrels
that are now nobody's to withdraw.

It also creates a real read rather than a sort. After a faction forms, the
person with the MOST enemies is the one everybody turned against — the target,
not the source. `feudSource` counts grudges SEEDED, not grudges received, and
the room names that person once toxicity crosses 0.3, because the nuclear
option is only usable if you can tell who to use it on.

**And the metric was unsatisfiable by construction.** §2.6 lists banishment as
sanctioned counterplay for this exact crisis, then judges recovery on every
cast member still being present — so using the strongest lever in the game
guaranteed failure. That contradiction, not the game, was a large part of the
0%. "Nobody left" now means nobody was DRIVEN out; a deliberate banishment is
the owner paying a price on purpose, and it is priced already (relevance,
everyone who liked them, and they can come back and beat you).

### Metric 9, final

| crisis | k0 | k7 | k14 | k28 | k56 | k112 |
|---|---|---|---|---|---|---|
| burnout | 0.75 | 0.67 | 0.58 | 0.58 | 0.58 | 0.58 |
| toxicity | 0.42 | 0.42 | 0.50 | 0.33 | 0.33 | 0.33 |
| irrelevance | 1.00 | 0.58 | 0.67 | 0.75 | 0.75 | 0.83 |

All three now recover, and in all three acting immediately beats acting late.
Burnout is a clean monotone cliff. Toxicity has a real early advantage over a
floor (the k14 bump is noise at n=12). Irrelevance is perfect at k0 and
unordered after — the honest control, untouched this pass, and the one that
still does not show a cliff.

**Metric 9 stands at partial.** It has gone from "no counterplay measurable
anywhere" to "two of three crises are genuinely time-sensitive", which is the
first time §0's *fixable if caught early, hopeless past a point* has been true
of anything in this game. What remains is irrelevance's shape, and n=12 is
still thin — a third of a run is 0.08, so nothing under ~0.15 is resolvable.

### §24 addendum 2 — n=24, and a retraction (2026-07-31)

The n=12 sweep was rerun at **n=24** (784s). It does not replicate.

| crisis | k0 | k7 | k14 | k28 | k56 | k112 |
|---|---|---|---|---|---|---|
| toxicity | 0.58 | 0.50 | 0.58 | 0.46 | 0.42 | 0.46 |
| burnout | 0.50 | 0.67 | 0.63 | 0.63 | 0.63 | 0.63 |
| irrelevance | 0.88 | 0.50 | 0.63 | 0.63 | 0.67 | 0.63 |

**The burnout cliff was noise. Retracted.** At n=12 it read 0.75 / 0.67 /
0.58 / 0.58 / 0.58 / 0.58 — a clean monotone decline to a floor, and it was
reported here and in the commit message as "the first genuine lag structure
this metric has produced". At n=24, k0 is 0.50 — the *worst* point on its own
curve — and everything from k7 out sits flat at 0.63. The apparent cliff was
six runs of luck. It is withdrawn.

That is the discipline working exactly as §17 said it should, and it is worth
recording that it caught its own author: the instruction "raise n before
tuning any number" was written into the recommendation, followed, and then
immediately invalidated the recommendation's headline result. Nothing was
tuned against the n=12 curve, which is the only reason this is a correction
rather than a rebuild.

**What does replicate**, across both sample sizes, is small and consistent in
direction:

- **irrelevance**: k0 is high (1.00 at n=12, 0.88 at n=24) against its own
  later lags (~0.6 both times). The most robust signal in the table.
- **toxicity**: early beats late by roughly 0.10–0.15 in both runs (n=12:
  ~0.45 → 0.33; n=24: ~0.55 → 0.45). Consistent direction, marginal magnitude.
- **burnout**: nothing. The direction reversed between samples.

At n=24 a single run is 0.042, so a 0.12 gap is about three runs. These are
suggestive, not established.

### Metric 9, honestly

Two separate claims, and only one of them survives:

1. **Crises are now real and fixable.** Toxicity recovery went from 0% at
   every lag to ~0.5, the injected crises genuinely progress while untreated
   (toxicity 0.24 → 0.54 over the window), and burnout no longer cures itself.
   That work stands on its own merits and is independent of the curve shape.
2. **The cliff is not demonstrated.** §2.3 asks for "a clean S-curve with a
   real cliff, not a straight line". What n=24 shows is a slightly tilted
   straight line for two crises and a flat one for the third.

So metric 9 stays **⚠️ partial**, and the partial is smaller than §24 first
claimed. The honest next step is not more tuning — it is deciding whether a
~0.12 early advantage is the intended size of "caught it early", or whether
the counterplays need to be genuinely more powerful when applied immediately.
That is a design question, and answering it by adjusting numbers until the
curve looks right would be fitting to noise.

### §24 addendum 3 — building to a stated target (2026-07-31)

Design target given: **"day one should almost always work, a month should be
hopeless"** — roughly 0.9 falling to 0.1.

The missing ingredient was irreversibility: every mechanism up to here was
undoable at any time, so late could never be hopeless, only slightly worse.
Two were added — feud grudges HARDEN (they stop tracing to whoever seeded
them, and stop cooling), and a player below the passion line long enough goes
CHECKED OUT (encouragement is damped to 12%).

**Attempt 1 hardened on wall-clock time. It lowered the whole curve instead of
tilting it** — toxicity k0 fell to 0.38, burnout k0 to 0.38, *below* their own
later lags. Correct on reflection: grudges set because they keep being
reinforced, not because a calendar advanced, so they were setting *underneath*
an owner who acted immediately. Early intervention never got a clean shot.

**Attempt 2 gates both clocks on NEGLECT.** Feud hardening pauses when the
room's temperature comes down; the checked-out countdown only advances on days
a player is still sinking. Act, and the clock stops. A well-run room hardens
nothing.

| crisis | k0 | k7 | k14 | k28 | k56 | k112 |
|---|---|---|---|---|---|---|
| toxicity | 0.58 | 0.50 | 0.54 | 0.42 | 0.38 | 0.38 |
| burnout | 0.63 | 0.58 | 0.58 | 0.54 | 0.54 | 0.54 |
| irrelevance | 0.88 | 0.54 | 0.71 | 0.75 | 0.63 | 0.67 |

**Shape achieved, magnitude not.** Toxicity and burnout now decline
monotonically with lag for the first time — burnout in particular went from
*backwards* (k0 its own worst point) to correctly ordered. But 0.58 → 0.38 and
0.63 → 0.54 are nowhere near 0.9 → 0.1.

### The cost, and the recommendation

| metric | pre-hardening | with hardening |
|---|---|---|
| retirement dispersion (m5) | 1703 | 1139 |
| first elite win share (m2) | 1.00 | 0.67 |
| journal volume (m7, band 15–30) | 29 | 32.5 |
| toxicity curve | 0.58 → 0.46 | 0.58 → 0.38 |
| burnout curve | 0.50 → 0.63 (backwards) | 0.63 → 0.54 (monotone) |

Hardening bought a marginally steeper toxicity curve and a genuinely fixed
burnout ordering, and charged a third of metric 5's dispersion and a third of
metric 2's hit rate for it. Metric 2 is "the impossible moment" — the single
thing the whole calendar exists to produce — so a third of runs never getting
there is an expensive way to buy a tilt.

That is the same shape of trade as §23's training program: plausible
mechanism, real cost, thin benefit. **Recommendation is to revert the
hardening and keep the pre-hardening state**, which had crises that were real
and fixable (0% → ~50%, the large win) with metrics 2, 5 and 7 all healthy —
and to treat "day one almost always works" as needing a different mechanism
than decay, most likely counterplay that is *decisively* stronger when
immediate rather than crises that rot faster when ignored.

Recorded rather than silently reverted, and left in the tree pending that
call, because the target was explicit and the choice belongs to the designer.

### §24 addendum 4 — hardening reverted, and a correction (2026-07-31)

The hardening (grudge setting, checked-out) is **reverted** on the designer's
call. `src/` is restored to the c2d9244 state; `tools/` is untouched, so
SEEDS=24, the plateau incidence re-spec, metric 4's re-spec and metric 10's
classifier repair all stand. 135 lines out, determinism green.

**A correction to what was predicted of the revert.** It was said that
reverting would restore m5 to 1703, m2 to 1.00 and m7 to 29. Measured
post-revert (n=6, 15y): **m5 1207 · m2 0.83 · m7 38.3 · m4 spread 0.12 · m1
1.50/1.47/1.56 · cadence 10.6 · survival 5041.**

Two reasons the prediction was wrong, and the second one matters:

1. **The comparison was across different configurations.** The quoted
   1703/1.00/29.1 came from a 20-year run; this is a 15-year run at n=6.
   Retirement dispersion in particular scales with horizon, so those were
   never like-for-like.
2. **Some of the cost belonged to the feud contagion, not to the hardening.**
   Journal volume at year 10 reads 38.3 against a 15–30 band. Contagion
   generates social churn — more feuds means more rivalry and grudge entries —
   and that work is being KEPT. Attributing the whole regression to hardening
   was wrong; reverting hardening does not take it back.

So the honest post-revert position is better than the hardened state on every
count, but **not identical to the pre-metric-9 state**: metric 7 is now out of
band at ~38/yr, and that is a real cost of making feuds spread. It is an open
item, and cheap — the same treatment §20 applied to `elimination` (gate the
routine social entries to the weekly budget rather than letting every new
grudge announce itself) should bring it back.

Metrics 1, 2, 3, 4 and 5 and survival all sit in acceptable ranges; metric 9
returns to its c2d9244 reading (crises fixable at ~50%, timing worth little);
metric 10 unchanged.

### §24 addendum 5 — journal volume back in band (2026-07-31)

The cost §24-4 identified as belonging to the feud contagion, paid off.
Journal volume was 38.3/yr against a 15–30 band; it now reads **y3 24 · y6
24.8 · y9 29.8 · y12 29 · y15 26.5 — mean 25.6, max 29.8.** In band.

Three gates, all the same judgement §20 applied to `elimination`: the first
time something happens is a page, the tenth is a mood.

- **`ruptureCaused`/`ruptureAbsorbed`** (227 combined, the contagion's own
  footprint) — the FIRST falling-out a player has is a landmark and bypasses
  the budget; every one after competes for it. Once feuds recruit, a bad month
  produces many ruptures, and a diary that records each one is a casualty
  list.
- **`travelFunded`** (207, the single largest) — gated to majors and the
  Showdown, matching the gate `travelAsk` already had. Being sent somewhere
  big is a page; being sent to the regionals for the fourth time is a Tuesday
  with a plane ticket.
- **`awayOut`** (171) — a routine early exit is now not written at all below
  top eight. The elimination WOUND still fires, which is the part that
  matters mechanically.

**One measurement note worth keeping.** `composeEntry` picks its variant with
`choice()`, so journal writes CONSUME the seeded stream — gating them
reshuffles every downstream draw. The n=6 readings either side of this change
(m5 1233 → 842, survival 5041 → 4006) are therefore not comparable: they are
different random sequences, not a regression. Retirement dispersion at 842 is
still five times the P0 baseline of 173. Anything measuring the effect of a
journal change on a non-journal metric needs a much larger n, or the gating
needs to move outside the rng path.

Metrics 1 (1.54), 2 (median y4), 4 (spread 0.14) and survival all sit in
acceptable ranges. Determinism green.

## 25. The last of §6 — idle, nav, unlockables (2026-07-31)

The three undelivered backlog items, built together.

### The idle shrink (structural, per §6)

**AFK catch-up.** Idle used to stop time cold on close: "the hours you were
away never happened." Defensible for a game you sit and watch, wrong for this
one — P5 made a lineage twenty years long, and an endless dynasty that only
advances while observed is one nobody finishes. Time now passes with the tab
shut if you left it running, bounded by `IDLE_AWAY_CAP` (1500 steps, ~two
in-game months at the default speed), landing in a welcome-back modal that
says exactly what happened rather than silently mutating the world.

**Auto-stream split from idle.** `maybeAutoStream` fired only inside the idle
loop, so the camera setting did nothing for anyone playing by hand. It now
runs on manual day-advance too.

**Follow a player.** A fourth auto-stream selector. §1.8 makes exposure a
prerequisite for growth, so pointing the camera at one person is a
cultivation strategy, not a convenience — it falls through to the closest
match on nights they do not play rather than wasting the slot.

### Navigation

- **Roster cycling** on the player card (‹ 3/8 ›) — reading six cards in a row
  is the actual loop of the Players tab.
- **Elo trajectory**: one number per player per year (`eloByYear`), sampled at
  the rollover. Cheap to store and the only way to see a career's SHAPE — the
  climb, the plateau, the decline age puts on the end.
- **Last-20 form** (was 8). Eight is a fortnight — long enough for the sim's
  recent-form reads, too short to watch a slump become a slide.
- **Newly-unlocked tabs** carry a gold ✦ until visited. Needed a baseline:
  seeded at LOAD (not in a render — the standing rule) with everything already
  open, or an existing save lights the whole bar up and the indicator says
  nothing. First cut missed lineage unlocks and lit the Studio on every save;
  it now checks both gate kinds.
- **VOD mark-all-watched.** A long run banks replays faster than anyone
  watches them, and a permanent "12 new" badge stops meaning anything.

### Unlockables — the only meta layer

Prestige-as-power was deprecated in P0, so a lineage carries no advantage
between runs, only its record books. These are the other thing it carries:
six portrait palettes, each tied to a real accomplishment — a first title,
the national board, a major, EVO top 8, an EVO win, outliving the game itself.

Zero points, by construction. **They grant nothing.** That is the whole
design constraint and the reason they can be as rare as they like: a palette
cannot win a bracket. Locked entries stay visible and unpickable with what
earns them in the label, the same rule the tab bar follows — an invisible
unlock teaches nobody there is anything to chase.

**Clickable NPC pills.** Filler names in the day report were deliberately
inert — they are not your cast, so there was "nothing to see". But the room is
full of them, they are who your people play every night, and "who IS that" is
a fair question about the person who just took a set off your star. Their card
already rendered (`save.players[id]` never cared about the npc flag); only the
click was withheld. They stay dimmed in the list — still filler, just no
longer unaskable.

That immediately surfaced a bug in the roster cycler shipped an hour earlier:
from an NPC card `findIndex` returns −1 and the counter read "0/6". Cycling is
a cast tool and is simply not offered on a filler card.

Determinism green; build clean; verified in-browser (no console errors, tab
seeding correct on a year-6 save, all six palettes correctly locked on a
lineage that has not earned them, an NPC card opening cleanly from the day
report with no cycler).

## 26. Toxicity made legible, and a room you can close (2026-08-04)

The prompt was a player report: *every run has gone down to toxic rooms*, and
separately, *patch morale should decide the community's INTEREST in the game,
not their morale — it isn't intuitive.* Those turn out to be the same finding
from two directions.

### The patch was the largest feud generator in the game

`sim.js` subtracted `clamp(-patchMorale * 0.26, 0, 2.2)` from every post-match
relationship read. It worked, mechanically — it taxed every match every day,
which made it by some distance the biggest single source of bad blood — and it
was unreadable. A player watching two regulars stop speaking has no route back
to a damage tier moved four months ago, and every lever they reach for
(separate them, cool the room down, stream somebody else) is not the lever that
was pulling.

Removed. Patch morale now decides how much the room wants to PLAY:

| where | before | after |
|---|---|---|
| post-match relationship delta | up to −2.2 per match | **gone** |
| attendance (`attendChance`) | `+morale × 0.004` | `+morale × 0.010` |
| first-timers (`awarenessFactor`) | — | `+morale × 0.014` |

### One thing that was tried and reverted, because it broke Act 3

`communityGameOpinion` was briefly widened from `morale × 0.1` to `× 0.2` on
the theory that balance should be *the* interest dial. Community opinion feeds
`relevanceDaily`'s `sustain` term, a competent owner holds positive morale most
of the time, and the result was a permanent dividend against the one slope the
design says must always win. Measured at n=24: `diedShare` **0.17 → 0.08**, the
opinion funnel claiming nobody at all. Reverted to 0.1. Patch morale's interest
reach belongs where it is local and answerable — who turns up, and who walks in
for the first time — not where it buys the scene immortality.

### The replacement generator: being somebody's punching bag

Removing the frustration term removed most of the mid-game with it (dynamics
deaths 15/16 → 2/24). A room that cannot sour is not a room worth managing, so
the pressure comes back through a channel a player can actually see: a
head-to-head at ≥70% one way over ≥6 games sours the loser, scaled by the
winner's `sportsmanship` (a gracious rival can beat you forever and stay a
rival). The head-to-head is on their page. The sportsmanship stat is on their
page. Every lever in the game answers it.

### The hiatus — closing the setups (src/game/hiatus.js)

Feuds cool at `0.16 × (1 - toxicity × 2.2)`, which is **zero at toxicity
0.455**. Past that a room that keeps playing cannot heal at all, and the only
counterplay was a ban — nuclear, priced, and requiring a correct read on who
the source is. A player who missed that window had a dead run and no verb.

Now you can stop. Doors open, counter selling, cabinets dark: no matches, no
money match, your own brackets postponed (EVO and the circuit are held
elsewhere and go ahead without you). Cooling runs at **full rate regardless of
toxicity**, and recruitment is suspended entirely — without that second half
the lever loses a tug of war it should win, because at a dozen live feuds the
recruitment rolls outrun a single cooling pass.

Priced by the crowd, escalating: `clamp(0.72 - days × 0.035 + elsewhere, 0.20,
0.92)` on attendance, so ~25% gone on day one and ~50% within a week, floor at
80% gone. Rent does not pause and neither does passion decay. `save.quietDays`
— the empty-floor collapse funnel — **holds** while the shutters are down: it
does not advance (using the counterplay must not end the run, the same
contradiction §2.6 had with banishment) and does not reset (a hiatus cannot
launder a room that was already emptying).

**Measured** (n=12, normal, room injected into two camps at −80, 14-day lag,
120-day window):

| arm | tox at inject | tox at end | recovered (≤0.08) | trailing att | cash |
|---|---|---|---|---|---|
| keep playing | 0.96 | 0.75 | 0/12 | 17.4 | $1028 |
| close the setups | 0.96 | **0.13** | **6/12** | 22.6 | $906 |

Average 57 days dark. Attendance ends *higher* in the hiatus arm — a poisoned
room is already bleeding, so paying to fix it is nearly free by comparison,
which is the intended economics. Deaths 2/12 → 3/12.

### The warnings moved before the cliff instead of after it

The red scene verdict fired at toxicity 0.50 and the feud-source toast at 0.30
— both at or past the 0.455 where cooling stops. The loudest signal the game
gave arrived after the point of no return.

| signal | was | now |
|---|---|---|
| "bad blood is brewing" (gold) | 0.25 | 0.18 |
| "turning toxic" (red) | 0.50 | 0.40 |
| names the feud source | 0.30 | 0.18 |

### THE COMMITTED FINGERPRINT BASELINE IS STALE — read this before trusting a diff

Clean `HEAD`, with none of this work applied, fingerprints at `diedShare 1 →
0.17` and `medianLastedDays 1660 → 3361` against `baseline.json`. The baseline
predates P5 (which took survival 4.3y → 12.8y by its own §19 note), so **every
fingerprint since P5 has been reporting a phantom two-fold survival
regression**, and this pass nearly got tuned against it. The honest control is
a worktree of HEAD, not the committed file.

Against clean HEAD at n=24, this pass reads:

| metric | HEAD | this pass |
|---|---|---|
| survival.diedShare | 0.17 | 0.17 |
| medianLastedDays | 3361 | 3361 |
| funnels.dynamics | 2 | 4 |
| funnels.economy / opinion | 1 / 1 | 0 / 0 |

Net effect on difficulty: neutral, with slightly more mid-game room pressure —
now from a legible source with real counterplay. `funnels.economy` and
`funnels.opinion` are one run each; noise at n=24 (a single run is 0.042).
`baseline.json` should be re-blessed off current HEAD before the next phase.

### The brain moved into the engine (src/game/auto.js)

`tools/balance/policy.mjs`'s competent player is now an engine module that both
the harness and spectator mode import. One brain: two would drift, and the day
they drifted the harness would stop measuring the game the player gets. The
harness runs at full authority on the reversible-with-money moves (downsizing —
P6 measured exactly that); the in-app default grants only breakthroughs.

Determinism green. Difficulty ladder re-checked (n=16, 336d): easy 0%, normal
6%, difficult 0%, master 44%.

### §26 addendum — metric 9, and what the lever costs the curve

Metric 9's toxicity sweep, rerun with the hiatus added to the counterplay kit
(n=23, normal):

| lag | 0d | 7d | 14d | 28d | 56d | 112d |
|---|---|---|---|---|---|---|
| recovered | 0.48 | 0.30 | 0.57 | 0.52 | 0.52 | 0.57 |

**Flat. Acting on day 0 is worth no more than acting on day 112**, and this is
not noise to be sampled away — it is the lever working as specified. A
counterplay that is *always available and works late* is, by construction, a
counterplay that flattens a lag curve. §2.3 asks for "fixable if caught early,
hopeless past a point"; the hiatus makes toxicity fixable at any point, at a
price. Those two goals are in direct tension and this pass chose the player's
side of it deliberately, because the reported problem was runs dying with no
verb available.

Two honest caveats on the number itself:

1. **The injection never reaches the cliff.** `CRISES.toxicity.inject` sets
   three players to −80 in a room of ~25, which tops out around toxicity 0.17
   — nowhere near the 0.455 where cooling stops. So most runs in this sweep
   never crossed the hiatus threshold at all, and the table is largely
   measuring the *old* kit. The A/B in §26 above uses a two-camp injection that
   actually reaches 0.96, which is why it can see the lever at all. The fixture
   is due a severity that matches what the counterplay is for.
2. **Metric 9 still stands at partial**, and for toxicity it is now partial for
   a different reason than before: not "no counterplay measurable" but "the
   counterplay is lag-insensitive by design".

If the cliff matters more than the verb, the knob is the hiatus's price — make
the crowd loss steeper, or gate re-closing behind a cooldown so a room can only
be saved this way once. That is a design call, not a tuning one, and it is left
open rather than guessed at.
