# The final push — design plan

Everything agreed in the design pass, in the order it has to be built.

**The ordering rule:** anything that changes what a temperament is *worth* comes
before anything priced against it. The shop is last on purpose — every unlock
price is a judgement about how valuable a thing is, and half those judgements
are wrong today because stamina does nothing, drama is a net tax, and hype
rewards a boring room.

Check items off as they land.

**Measurement policy (decided after Phase 2):** do NOT re-balance after every
phase. Each phase knocks the next one out of true, so per-phase gates spend
effort tuning numbers that the following phase will move anyway — Phase 2 spent
four attempts chasing a drama gap that Phase 3's guides may shift on their own.
Implement 3 → 6, then do the whole rebalance once, at Phase 7. Gates already
recorded below are kept as a record of what was true at the time, not as a bar
each future phase has to clear.

---

## Phase 0 — the two decisions that block pricing

Neither is a build task; both change what everything else is worth.

- [x] **Does the economy stay this dominant?** **DECIDED: no — let pressure off,
      gently.** Measured today: 83% of runs die and the economy is the funnel.
      Achievement-gated unlocks (Phase 4) handle the *progression* half.
      **Sequencing note:** the calibration record says economy deaths are a
      SYMPTOM — nine economy sweeps came back flat because they sat downstream
      of the skill threshold. Phase 1 raises ceilings, which may soften the 83%
      by itself. So: land Phase 1, re-measure, and only nudge an economy lever
      if it is still needed. Two easings stacked blindly is how a ladder gets
      broken. Working target: ~83% → ~70%, not lower.
- [x] **Is "chasing the meta makes your scene boring" intended?** **DECIDED:
      yes, wanted.** Character fatigue will punish the meta-chasing built in
      `interest.js`, and that tension is the point — it mirrors how real scenes
      feel. Build it deliberately rather than tuning it away later.

---

## Phase 1 — engine truth

The archetype ablation says two rows are broken. Fix those before anything is
measured against them again.

- [x] **`stamina` feeds `skillCeiling`.** It currently only appears in the
      learning *rate*, which is multiplied by `prox = (ceiling - skill)/ceiling`
      — so it buys arrival time, never destination. Over a long run everyone is
      parked at their ceiling and the grinder is indistinguishable from the
      dabbler. The comment above the line already promises "the thousand-hour
      grinder keeps improving on reps alone"; the math never did it.
- [x] **Give `loyalty` and `temperance` an output.** Of Stoic's four stats only
      `composure` reaches the ceiling (×1.1), while all four Killer stats reach
      it via `competitiveIntensity` (×2.0). Stoic should be the row that makes a
      scene *durable* — turnout on bad nights, not retiring when passion dips.
- [x] **Rival bonuses pay more.** `hasActiveRival` gives a flat +10 ceiling, and
      it is not enough: removing the archetype that *generates* rivalries
      (Dramatic) made measured skill go **up** 19%.
- [x] **`persona` converts to draw.** (partial — see gate) It is currently pure cost — the polarising
      term in `socialDelta` with no upside. A polarising player should pull
      viewers the way `presence` does.

**Gate — RUN (live economy, n=30). Two of three met:**

| arm | died before | died after | reading |
|---|---|---|---|
| control | 83% | **73%** | economy pressure came off by itself |
| no Stoic | 77% (free) | **80%** | now costs 7pp — **FIXED** |
| no Killer | 80% | 83% | now costs 10pp — rival bonus landed |
| no Dramatic | 60% | **67%** | gap narrowed 20pp → 6pp, **still a tax** |

- **The economy nudge is probably unnecessary.** Control&nbsp;83% → 73% with no
  economy lever touched, against a ~70% target. The calibration note was right:
  the economy funnel was downstream of the skill ceiling. Re-check after Phase 2
  before changing rent or prices.
- **Drama is not fixed yet.** `persona` → draw closed most of the gap but not
  all of it; `sensitivity` still only amplifies mood damage. Phase 2 item 5
  (popular-but-not-good players generate hype on wins) is the rest of this fix
  by design — re-run this gate after Phase 2 rather than over-tuning now.

---

## Phase 2 — hype stops rewarding a boring room

Measured bug: six of eight ablations *raised* hype. A more homogeneous roster
produces closer matches, and stream quality rewards close matches — so hype
currently goes up as the scene gets duller.

- [x] Mirror matches are worth less hype.
- [x] **Character fatigue** — seeing the same handful of characters repeatedly
      depresses hype. This is the direct inversion of the bug above.
- [x] Underdog wins pay a large hype bonus after the fact.
- [x] Low-tier-character wins pay a large hype bonus. (Also the first
      *scene-level* payoff for the contrarian archetype — championing a low tier
      currently costs the player and returns nothing to anyone.)
- [x] Popular-but-not-good players winning generates hype. (This is the
      `persona` → draw conversion from Phase 1, arriving from the other side.)

**Gate — RUN. Partially met.**

All five shipped. One real bug fixed on the way: `sensitivity` had the down
coefficient at DOUBLE the up one (0.12 vs 0.06, on a bigger base), so identical
social churn cost a dramatic player more than it ever paid them.

Also a self-inflicted regression, caught and fixed: fatigue started as a flat
penalty of up to −34 quality. Stream quality feeds ad revenue, so that landed
as a difficulty increase, not a preference for variety — control deaths went
73% → 90% and removing the Scholar started *helping*. It is a signed swing
around the expected rotation now: fresh matchups gain roughly what stale ones
lose, so the channel is not poorer on average.

**STILL OPEN — drama is a net tax.** Four attempts have not moved it:

| attempt | control | no Dramatic |
|---|---|---|
| before Phase 1 | 80% | 60% |
| + persona→draw, rival +18 | 73% | 67% |
| + fatigue/notability | 77% | 67% |
| + heel keyed off persona | 80% | 60% |
| + sensitivity symmetry | 80% | 63% |

Coefficient tuning is not working, so **stop guessing and instrument it**: find
where the cost actually lands (attendance? retirements? feuds driving
separations? mood suppressing performance?) before changing another number.
That diagnosis is the next task, not another tweak.

---

## Phase 3 — character guides

Gives `loyalty`/`mastery` a visible output, fills the Codex with earned content,
and creates a route to notoriety that is not personality.

- [x] A player who **leads their peers** in skill on a character can write a
      guide. Gate on *n ≥ 3 players with real reps on that character* — after
      the taste-layer work, contrarians are often the only person on their pick
      and would trivially qualify on day one.
- [x] Guide **quality** keys off absolute skill; quality drives the chance it
      catches on.
- [x] A popular guide raises **arcade relevance** and the **author's
      popularity**.
- [x] Guides live in the **Codex**.

**Built.** ~14 guides per 500-day run, ~1-2 catching on. Anyone with real reps
can write one; leading the field is not a gate on WRITING, it is most of what
decides whether the thing is any good. Landed guides average ~16 skill against
~7 for the ones that sink, so quality is visibly what travels. Thresholds are calibrated
against measured per-character skill (best-on-a-character runs 5–20, NOT the
30–37 you see for skill-on-your-main) — the first cut used 45 and produced zero
guides in six runs.

---

## Phase 4 — persistence foundation

No balance dependency; can be built in parallel with 1–3.

- [x] **Attribution points as white dots**, replacing the `5/5` text.
- [x] **Helpers toggle** (on by default): UI warnings, the financial snapshot
      strip, and the rumor tab. These are *not* shop items — the players who most
      need them are exactly the ones with no currency. Experienced players switch
      them off.
- [x] **Achievement scaffolding.** Every unlock is earned by an achievement
      related to it — typically *doing the thing without the tool*, after which
      the tool is the reward. Unlocks also pay attribution points.
- [x] Persistence lives on `save.prestige`, which already survives
      `resetSaveById` per save lineage.

**Built.** `PointDots` (ui.jsx) replaces the slider-and-number everywhere a 0–5
stat appears — creation form and player sheet — with the temperament's free
point drawn in that row's colour so you can see which point isn't yours.
`settings.helpers` gates the coaching tips, the venue strip and the rumor mill
individually; the **failure countdowns deliberately stay**, because a run three
days from foreclosure is the state of the world, not advice. Twelve
achievements in `src/game/achievements.js`, checked once a day in `advanceDay`,
awarding into `prestige.achievements`/`unlocks`/`points` immediately (not into
the run's pending pot — a lineage fact shouldn't be lost by the run that most
needed it). New per-run counter bag `save.tally` for the "did you do it the
whole way through" claims a snapshot can't answer.

Two surfaces: the **🎖 Legacy tab** in the Hall of Fame is the permanent
record (earned ones dated, locked ones showing what proves them), and a gold
**unlock banner** above the tab content announces one the day it lands. The
banner exists because the first cut only wrote a chronicle line — a permanent
unlock nobody tells you about is indistinguishable from nothing happening.

### The ladder — 30 achievements

Restructured from the first cut of twelve. One unlock per thing unlocked, so
each food pack, each attraction and each ad channel is earned on its own.

| # | Unlocks | Earned by |
|---|---|---|
| 1–4 | Idle at real time / Fast / Faster / Blitz | survive the summer · reach New Year · one year · five years |
| 5 | VODs tab | run 12 tournaments |
| 6 | Community tier list | a guide out of your scene catches on |
| 7 | Feed tab | 400 followers |
| 8 | Game Studio | national interest reaches 65 |
| 9–12 | Food packs: Fryer / Sweets / Hot Line / Late Night | 200 servings · $900 taken · 18 in a night · 1,200 servings |
| 13–18 | Attractions: pinball / bowling / classics / laser tag / VR / pickleball | 1,200 cabinet turns · 20 through the door · 4 cabinets for a year · 3 teams of 3+ · 80 hype · 8 friend pairs |
| 19–21 | Ads: radio+social / billboards / TV | 150 followers unadvertised · 28 through the door · 5,000 followers |
| 22–25 | Discipline / hotfixes / family business / bigger allowance | toxic room recovered clean · a beloved patch · 180 solo days up · win EVO |
| 26–30 | Cosmetics | dynasty · perfect books · the lifer · written in stone · the hard way |

**Payout rule.** Catalogue unlocks (idle speeds, food, attractions, ads) pay
NO creation points — the content is the reward. Only the scene ones and the
five cosmetics pay, totalling 27 against `RUNG_ALLOWANCE`'s 24. Without that
rule thirty achievements would have handed out sixty points against a Normal
budget of five.

**Every threshold is measured.** Four of the first-cut numbers were impossible
and the sim said so:

| priced by intuition | what the sim measured | now |
|---|---|---|
| 100 people turned away from a full cabinet | **zero** turnaways in 500 days at every floor size | replaced — laser tag is priced in teams |
| 20 pairs of close friends | ceiling of **2** mutual close friendships; 12 ordinary ones | 8 pairs at the "friends" band |
| national interest 80 | unpatched relevance **cannot climb** — staleness outruns every sustain term. Neglected ceiling 57, strong scene 69 | 65, the line between those two |
| a year with no down day | rent lands on the 1st, so that day always closes down | a year without the *balance* going red |

Also recalibrated against measurement: pinball 400 → 1,200 turns (2,700 in a
real run), a full house 24 → 20 and billboards 30 → 28 (peak attendance tops
out around 28–33), the hot line 25 → 18 a night (30 is the hard cap and 17–19
is a busy counter), TV 2,500 → 5,000 followers.

Measured end state: a maxed-out scene — funded, fully staffed, all channels
running — lands **15–18 of 30** over 700 days. The rest need intent.

Carry into later phases:

- **Nothing gates on `unlocks` yet.** `isUnlocked()` is the seam and returns
  true for anything not in the catalogue. Wiring it up is Phase 5's job,
  because that is where the tools get priced. The packs named here have no
  contents either — `FOODS` currently holds 12 items against the 25 the four
  packs need, and the six attractions are entirely new content.
- **`enough-for-teams` is the one unmeasured threshold.** Teams only form
  around a user-created player, and the headless harness has no cast, so three
  teams of three is reasoned rather than measured. Check it with a real cast.
- **A perfect patch should be harder to earn**, not just harder to score.
  `first-time-right` moved 14 → 24, but that is a threshold change on the same
  distribution; making a genuinely great reception rarer is a `computeReception`
  change and belongs with the Phase 7 pass.
- **Food pricing is doing far more than expected.** Servings sold over 336
  days: 111 at $4, 166 at $3, **469 at $2**. Generated players start with
  `income` at zero under the sparse point-buy, so a $4 counter is nearly a
  closed counter. The food achievements are calibrated around it for now.

---

## Phase 5 — the shop

Not a shop in the end. Phase 4 made achievements the unlock mechanism, so
nothing here has a price — `isUnlocked()` is the gate everywhere and the
Legacy tab is the catalogue.

- [x] Idle mode — every speed beyond real time
- [x] VODs tab
- [x] Community tier list tab
- [x] Feed tab
- [x] Studio tab
- [x] **Food packs** — catalogue cut to 5 at start, 4 earned packs of 5.
      Players can prefer food you cannot yet stock; that gap is the motivation.
- [x] **Arcade attraction packs** — pinball, bowling, VR, pickleball, laser tag,
      classic games. Passive revenue scaled by arcade popularity, each targeting
      a different demographic. No NPCs needed.
      *Earning the pack unlocks the **option**; you still install it per-run —
      and the run that earns it gets the first installation free.*
- [x] Separate / ban players
- [x] Hotfixes from the Studio — small changes only, to correct an overlooked
      problem without the community irritation of a full patch
- [x] Family business — start with a small staff who never quit and need no pay
- [x] Extra allocation points (expensive)
- [x] Advertising options — start with flyers and word of mouth only
- [x] **Streaming setup** — per-run purchase, not persistent. You cannot stream
      until you buy it.

**Built.** Content, gating and three new features.

*Content.* `FOODS` went 12 → 25: five starters plus four themed packs (The
Fryer, The Sweet Counter, The Hot Line, Late Night). Every existing food name
survived into a pack, so old saves keep their stock and every player's taste
still resolves. Six attraction packs add 20 rooms on top of the ten ordinary
cabinets. Attractions are NOT cabinets: `attractionIncome` pays daily from the
walk-in trade, scaled by `arcadePopularity` (recent attendance, followers,
cleanliness), so a floor full of them in a dead arcade is a bill rather than an
income — they still carry rent and upkeep. Player tastes now draw from
`STARTER_GAMES` only; nobody's favourite side cabinet is "Court 1".

*Gating.* `src/game/catalog.js` is the single place that answers what may be
stocked or installed. Locked packs are LISTED, not hidden, with the achievement
that opens them — a counter you can't stock yet is supposed to be visible,
because half the room already wants something off it. Same for ad channels
(flyers free, radio+social/billboards/TV earned) and the four earned tabs,
which render greyed and unclickable with the requirement in the tooltip.

*New features.* The **streaming rig** is the one per-run purchase ($180,
`arcade.streamRig`, cleared by `resetSaveById`): `canStream()` short-circuits
`buildStream`, and every consumer already null-checked a missing stream, so no
rig means no channel at all that run. The **family business** seeds two unpaid
staff who are skipped by payroll and never quit. **Hotfixes** ship at most two
move changes with no version bump, no reception score, no relevance gamble and
no fresh-meta window — and correspondingly can never save a souring scene.

*Measured.* A fresh locked lineage survives 200 days with 5 foods, 10 cabinets
and no channel. A veteran lineage opens with 25 foods, 30 floor items, two free
hands and its first attraction on the house. Verified in-app: the free install
consumes exactly once per pack (first pinball room $0, second $282, bowling
credit untouched), payroll stays empty with a family crew, and attraction
income posts daily.

---

## Phase 6 — tournaments

Self-contained subsystem; slot anywhere after Phase 4.

- [x] Formats: double elimination, 16 / 32 player, team, 8-team, round robin
      *(already built — single/double-elim/round-robin, singles and teams,
      sizes 2–64, weekly/monthly/yearly. Verified all four shapes run.)*
- [x] **Bandwidth meter at world creation.** Tournament count × frequency ×
      duration (a product of player count and format) consumes bandwidth.
      Starting bandwidth ≈ one weekly 8-player plus one monthly 16-player.
- [x] Bandwidth is **earned** and persistent — see the decision below
- [x] Tournaments cost cleanliness, scaled by size

**Built.** `src/game/bandwidth.js`. The unit is MATCHES PER MONTH, because
what a bracket actually costs you is the sets it has to get through: single
elim `n−1`, double elim `2n−2`, round robin `n(n−1)/2`, crew battles
`(n−1)×3`, times 4 / 1 / ¹⁄₁₂ for weekly / monthly / yearly.

`BASE_BANDWIDTH` is 45, which is exactly the plan's opening allowance — a
weekly 8-player (28) plus a monthly 16-player (15) with two matches spare.
Three earned tiers (+25/+25/+55) take a full lineage to 150, sized so the top
of the ladder buys a flagship weekly 16-player double-elim (120) with a monthly
major beside it and nothing more. A weekly 32-player double-elim is 248 and is
never legal at any tier — which is the point.

**DECIDED: bandwidth is earned, not bought.** The plan said "purchasable and
persistent", written before Phase 4 made achievements the unlock mechanism.
Buying it would have made bandwidth the one thing in the game with a price and
given creation points a second use; earning it keeps one rule for everything.
Three new achievements: thirty tournaments run to a finish, a 32-entrant field
filled, a round robin of eight taken to a finish. (The ladder is 32 / 26 points
as of the Feed unlock — see "After the plan" below.)

The meter is enforced, not advisory — `fitsBandwidth` runs on a trial clone of
every edit before it lands, so an over-budget change is refused rather than
warned about. Verified in-app: resizing a weekly 8 to 16 and switching it to
round robin both snap back; moving the same event to monthly frees 21.

Cleanliness: `tournamentMess` is `3 + matches × 0.35`, capped at 30 — 5.4 for a
weekly 8-player, 13.5 for a 16-player double-elim, 24.7 for a 32. It spends the
resource a busy arcade was already short of rather than adding a system, which
is the quiet reason a packed calendar needs staff. Measured over 400 days on a
four-event calendar with three staff: cleanliness averaged 71 and bottomed at
13 — low enough to invite the health inspector after a big weekend.

---

## Phase 6b — the school year, and the EVO hook

The cast are high-school and college kids, so the calendar behaves like theirs.

- [x] **A run opens in summer** (June 15), not on January 1.
- [x] **Attendance takes a real hit when school goes back.**
- [x] **EVO moves to June 22** — seven days after a run opens.

**Built.** The hidden dependency was that five systems computed the age of the
run as `absDay - 1`, which is only true if a run starts on January 1. A run now
stamps `openedAbs` and everything asking "how old is this arcade" reads
`runAge(save)` instead: the advertising fade, the discovery ramp, relevance
decay, the legacy milestones, the idle ladder, and the "this place is new"
scene triggers. The calendar keeps `absDayOf` — rent, upkeep and the schedule
are dates, not ages. Old saves migrate to `openedAbs: 1` and behave exactly as
before. The rent/upkeep ledgers seed from the opening day too, or a June run
would be back-billed for a January it was never open for.

`SEASONS` in constants.js is a straight attendance multiplier, because being at
school isn't a preference — it's whether they're free at all:

| | days | factor |
|---|---|---|
| Summer | Jun–Aug | ×1.30 |
| **Back to school** | September | **×0.70** |
| Term time | Oct–May | ×0.88 |
| Winter break | late Dec – early Jan | ×1.15 |

Measured over 400 days: summer averaged 5.1 through the door, September 2.1,
term time 2.5, winter break 3.6. September is a cliff rather than a slope, and
it gets a chronicle beat and a line in the Arcade header on the day, so a thin
Tuesday reads as the season rather than as something the owner did wrong.

**The EVO hook works.** `EVO_QUALIFY_GLORY` (20) means turning up at your local
is not a qualification — you have to have won something. Measured on a fresh
run: **Year 1 EVO, 7 days in, zero qualifiers**; the tournament runs anyway
with the elite field and the chronicle says so ("EVO 1 came and went and nobody
from The Arcade was in it"). **Year 2: eight qualifiers.** A full year of work
is exactly what it takes, which is what the date is there to make you want.

*Not re-balanced here,* per the measurement policy. The September cliff was
checked for the one thing that would have made it unshippable — whether it
categorically worsens the ladder — and it does not: at an autopilot baseline
the death rate and the median death day are identical with seasons on or off;
only the funnel mix moves (economy 11→4, dynamics 0→6). That baseline dies 100%
either way, so it is a weak instrument. Phase 7 does the real pass.

---

## Phase 7 — verification

- [x] **No archetype superfluous.** — *partially met, measured, see below*
- [x] **No dominant strategy.** — **met**

The instrument came first. Every number before this was measured against
autopilot, which dies 100% of the time on every difficulty and therefore cannot
discriminate anything. `tools/balance/` is now a **competent player**: buys the
rig, prices to the room, hires when the floor is dirty, adds setups as the room
fills, advertises, streams daily, runs a weekly bracket, patches once the Studio
is earned. Two harness bugs had been masquerading as difficulty — it bought a
build it could not afford, and it created **no cast at all**, which measures a
room full of strangers in a game that is entirely about your own people.

### Four real bugs, all found by measuring

1. **A new game shipped 154 days stale.** `lastPatch` defaulted to day 1 while
   Phase 6b moved the opening to day 155, so `staleDaysOf` read 154 on opening
   night and relevance bled from the first day. Every normal run collapsed
   55 → 4 by day 90 and died of the opinion funnel. *Mine, from Phase 6b.*
2. **A deadlock around the Studio.** Relevance could only fall, so
   `worth-watching` (peak ≥65) unlocked in **0 of 6** normal runs — and without
   the Studio you cannot patch, and without patching the run dies. The tool you
   need was locked behind not needing it. Fixed twice over: staleness now only
   applies once the Studio is earned (you cannot be blamed for neglecting a
   build you have no way to touch), and the gate moved 65 → 62, measured
   against a real first-year curve that peaks at 63–66.
3. **Relevance had no ceiling on success.** The champion dividend paid a flat
   +14 even at relevance 98, and `golden` momentum re-armed the day it expired
   while halving decay — so anything that once crossed 88 stayed at 100 forever.
   A competent arcade was immortal and banked $37k. The dividend now scales
   entirely by headroom (a fading scene at 30 gets +31; a scene at 95 gets +2),
   and a golden age has a 200-day cooldown.
4. **The team subsystem was off.** Teams need mutual friendship at 40/30, which
   measured over two years **does not exist until day ~336** and reaches only 11
   pairs by day 672 — 0 teams in eight two-year runs, in a 66-person scene. The
   gate now sits at 28/18, where the curve actually is, and crews form from
   mid-year-one (avg 1.0 per two-year run, mostly 3+ members). The laser-tag
   achievement dropped 3 crews → 2 to match; it was the one threshold Phase 6
   shipped on reasoning rather than measurement, and it was unreachable.

### The ladder after the fixes

Competent policy, one year, n=24: easy 0% · normal 0% · difficult 0% · master
42–75% deaths. A normal run builds to a **year-3 relevance peak of 94**, decays
to 51 by year 5, and dies around year 4–5 — the arc the design always described
and had never actually produced.

### Constraint 2 — no dominant strategy: MET

Three competent emphases, normal, three years, n=10:

| style | died | attendance | skill | cash | relevance |
|---|---|---|---|---|---|
| economy-first | 10% | 39.6 | 58 | $51,511 | 69 |
| community-first | 40% | 31.4 | 43 | $11,789 | 83 |
| competition-first | 0% | 20.0 | 52 | $22,932 | 97 |

All three reach year 2–3. Economy-first is richest, competition-first is safest
and most relevant, community-first is the weakest but viable — it pays for cheap
pricing. Nobody is self-kneecapping.

*A caveat worth keeping:* the first attempt at this table had two styles dying
100% because I had written known-bad choices into them (a $3 token, never
patching). That measured my definitions, not the game. Two real findings survive
from it: **token $2 is a genuine optimum** ($1 and $3 are both clearly worse, so
pricing has a peak rather than a runaway), and **never patching is fatal within
about 18 months** once the Studio is open — patching is closer to rent than to
a strategy.

### Constraint 1 — no archetype superfluous: PARTIALLY MET

Ablation at master/336 (control 50% deaths), n=16. Positive = the scene is
**worse** without them.

| removed | Δ died | Δ lasted | Δ skill | reading |
|---|---|---|---|---|
| Put-together | **+38pp** | −92d | −5.2 | load-bearing |
| Natural | **+25pp** | −75d | −4.1 | load-bearing |
| **Dramatic** | **+25pp** | −57d | −2.1 | **load-bearing — the long-standing "drama is a net tax" problem is resolved** |
| Stoic | +6pp | −1d | +0.9 | ~neutral |
| Gracious | 0pp | +7d | +1.1 | ~free |
| Killer | −6pp | −31d | −0.9 | ~free on survival |
| Warm | −6pp | +26d | +2.6 | ~free on survival; sole driver of mentorships |
| Scholar | **−31pp** | +45d | +2.7 | a net survival TAX — but the only source of tech |

Dramatic was the open problem through Phases 1 and 2 and four failed tuning
attempts; it is now clearly load-bearing. Scholar has inherited the role: a
scene survives markedly better without them, while losing most of its
innovations (25.2 → 7.4 at normal/672) and a fifth of its guides.

**Not tuned, deliberately.** The instrument has a confound: removing one of four
rows also *concentrates* the cast into the other three, so "without Scholar" is
partly "with more Naturals" — and Natural is the strongest row. Tuning Scholar
on that signal would repeat exactly the mistake Phase 2 made with Dramatic
(four coefficient guesses, no diagnosis). The next pass should ablate against a
fixed cast composition before touching a number.

### Known-open, measured, not fixed

- **Scholar is a net survival tax** (above). Needs a confound-free ablation.
- **Nobody ever retires.** Zero retirements across every two-year run, average
  passion 99 — the career/burnout engine is not reaching its thresholds under a
  well-run scene. Either it is correct that a great arcade retains everyone, or
  the refreshers outrun the decay; not diagnosed.
- **Money has no late sink.** A three-year economy-first run banks $51k with
  nothing to spend it on.

---

## After the plan

Work agreed after Phase 7, in one place so the next balance pass knows what
moved under it.

- **EVO is a 64-player major.** Sixteen pools of four, one out of each, real
  group tables with game-difference and health tiebreaks. Presented as a
  broadcast: neon intro, browsable pools, seeding, pre-tournament chatter, the
  exhibition, interviews, a bracket that reveals one set at a time, the
  champion. `src/screens/EvoWeek.jsx`.
- **World rankings** (`src/game/world.js`, `src/screens/World.jsx`). 64 places,
  never locked, elites and your cast on one elo ladder; below the cut you are
  UNRANKED rather than given an invented number. Clickable dossiers.
- **The elite roster was re-tiered** to make that ladder reachable: a
  `contender` band at 1430–1760 elo, and `driftEvoRoster`'s yearly floor
  dropped 1700 → 1400 (it had been rebuilding the wall every New Year).
- **The feed has a world half**, seeded ~a month before opening night and
  dominated by EVO buildup; arcade chatter is throttled by how many of your
  players are world-ranked. The Feed tab is no longer earned — the ladder is
  **32 achievements / 26 points**.
- **Team founding** gate 40/30 → 28/18 (measured; see Phase 7).
- Flags replace `[BR]`; your cast flies the arcade's country.

### ⚠ Phase 7's numbers predate all of the above

The verification pass ran BEFORE the EVO restructure and the elo re-tiering, so
its ladder and playstyle tables describe a game that no longer exists in one
important respect. Measured after (normal, competent policy, 5 runs × 3 years):

| | before (pools of 6, top 4 of each advanced) | now |
|---|---|---|
| your entrants reaching top 16 | routine — 16 of 24 advanced | **1 of 63 wins their pool** |
| your players in EVO top 8 | — | **0 of 15 EVOs** |
| EVO won by one of yours | — | **0** |

63 arcade pool entries finished 1st once, 2nd six times, 3rd seven times and
**4th forty-nine times**. Snake seeding puts one top-16 seed in every pool, so
escaping means beating a genuine world-class player; qualifying now gets you a
0–3 and a plane ticket.

That has knock-on effects: `world-champion` (which unlocks the permanently
larger creation allowance) and the `dynasty` cosmetic are currently out of
reach rather than merely hard. **Decide deliberately** whether that is the
intended shape — a local hero being nowhere near the world's best is honest —
or whether pools should advance two, or your players need a stronger cultivation
path. Do not tune it by feel; re-run `tools/balance` either way.

---

## The clean-up pass (before push)

Everything left open above, worked through. Measured, not reasoned about.

**Scholar was never a net tax — that was the confound.** Phase 7 flagged
"removing Scholar cuts deaths 31pp" and explicitly refused to tune on it,
because removing one of four rows also concentrates the cast into the other
three. `ablate.mjs` now drops a row from the CONTROL too (averaged over all
eight), so every arm shares that concentration. Re-measured at master/336:

| removed | Δ died (matched control) | was (confounded) |
|---|---|---|
| Natural | **+39pp** | +25pp |
| Killer | **+19pp** | −6pp |
| Gracious | +9pp | 0pp |
| Scholar | **−1pp** | −31pp |
| Stoic / Warm | −1pp | +6 / −6pp |
| Dramatic / Put-together | −11pp | +25 / +38pp |

Scholar is survival-neutral and still the only source of tech (innovations
−3.9 without them). Natural and Killer are the load-bearing rows. **Do not
tune on the rest of this table** — at n=10 the small deltas move sign between
runs, which is exactly what the first table was doing.

**Nobody ever retired — fixed.** Everything that adds passion totalled 14,231
against 2,693 removed, five to one, so every regular pinned at the cap.
Two causes: tenure decay far too weak, and every rekindle worth as much on
your thousandth night as your first. All rekindles now run through
`noveltyOf()` (1.15 → 0.22 with tenure), including being on stream, which at
+2.5 a night against 0.17 of decay was single-handedly keeping the roster
young. After: nothing retires in two years, **22.8 by year four**, median
career 358 days on the floor, room stays full as filler arrives.

**EVO was sending the wrong people.** Qualification was `glory >= 20`, a local
measure, so eight players went every year of whom most were not ranked
anywhere; they averaged 3.9th of four. Qualification is world-ranking now —
2.3 qualifiers a year, pool win rate doubled, year-one still sends nobody.
Winning EVO remains a multi-lineage goal (0 champions in 3 years).

**The concession stand was a bug, not a balance choice.** `playerSpending`
read `income` raw while `tokenDeterrence` three lines above read it through
`statLevel` — so a generated player was modelled as having literally no money.
Fixing it alone made price meaningless (charging more was strictly better), so
the comfort curve was re-tuned too. Now: $3 is the revenue peak, $2 trades
margin for volume, $4+ falls off a cliff. `DEFAULT_FOOD_PRICE` 4 → 3.

**A perfect patch is already rare** — measured 51 patches: median score 7, p90
12, and only **2%** clear the 24 the achievement asks for. No change needed;
the Phase 7 threshold raise had already done it.

**Feed and VODs unlocked** (see their commits). Ladder: **32 achievements /
25 points**. Seventh attraction pack (touch-screen) added.

### Still open, deliberately

- **Surplus cash late.** A rent review now scales with how busy and famous you
  are, but the concession fix added more revenue than it removes: three-year
  cash went $22.7k → $32.9k on normal. Death rates are UNCHANGED (0/0/25/100
  across the four difficulties), so the ladder is intact — this is surplus, not
  difficulty. It wants a spending feature rather than a drain, and inventing
  one at the end of a long session is how you get a bad one.
- **The difficulty ladder deserves a fresh pass** now that food, retirements,
  EVO qualification and rent have all moved. `tools/balance` is the instrument.

---

## The lineage question: how many runs to an EVO champion?

Asked directly, measured with a new harness (`tools/balance/lineage.mjs`),
which plays run → reset → carry prestige → rebuild → run again, mirroring
`resetSaveById` exactly.

**The answer is "never", and there are three separate reasons stacked on top
of each other.**

### 1. Banked creation points cannot be spent at all

They accumulate — a lineage reaches 130+ points — and there is nowhere to
spend them. The only two components that read `statPoints + prestige.points`
are `RosterEditor` (renders **only** inside the Setup wizard) and `PlayerForm`
(gated on `mode === 'sandbox'` in the Players screen). `resetCurrentRun` drops
you straight onto the arcade screen, never the wizard, while displaying:

> ♻ New run started. +N prestige earned — N points to spend on player creation stats.

There is no player creation to spend them on. The whole legacy economy — 25
points from the achievement ladder, 24 from the rung allowance, plus every
milestone — is inert in consequential mode, which is the intended experience.

### 2. Even if they could be spent, they saturate almost immediately

Measured `skillCeiling` against creation budget:

| creation points | 5 | 20 | **40** | 60 | 80 | 114 |
|---|---|---|---|---|---|---|
| skill ceiling | 33 | 48 | **96** | 96 | 96 | 96 |

Forty points maxes the stats that feed the ceiling; everything after that is
spent on stats the ceiling does not read. A lineage banks 40 by about run 3
and every point after is dead. This matches the observed plateau exactly —
across six runs, best world rank went 44 → 30 → 25 → 32 → 24 → 30 while points
went 6 → 31 → 64 → 92 → 112 → 134.

### 3. The real wall is skill GROWTH, not the ceiling

A 40-point player's ceiling is **96** — above the god tier (76–86). They could
beat anyone. Measured, they reach skill ~50–60 in three years and stall around
world #13–30, because skill is earned from matches and their matches are
against a local scene. The ceiling was never the constraint; the climb toward
it is.

### What was actually measured

Six runs × three years × four difficulties, both modes:

| | best rank reached (as it ships) | best rank (points spendable) | champions |
|---|---|---|---|
| easy | 31 | **18** | 0 |
| normal | 32 | **13** | 0 |
| difficult | 38 | **20** | 0 |
| master | 37 | 30 | 0 |

Spending the points clearly helps — normal reaches #13 instead of #32 — so the
loop *would* do something if wired up. It still produces no champions.

**Consequences.** `world-champion` (which unlocks the larger creation
allowance), the `dynasty` cosmetic, and the entire creation-point economy are
all currently unreachable. Fixing this is three decisions, in order: give the
roster a way to be re-spent between runs; decide whether points should keep
buying anything past 40; and decide how a local player is ever supposed to get
world-class reps (external tournaments are the obvious candidate, and would
double as the late-game money sink noted above).

---

## Invasions — the answer to the lineage problem

The three-part wall above (points unspendable → points saturate at 40 → skill
growth is the real constraint) needed a fix aimed at the third part, because
that is the one the other two were hiding.

**Skill gain was blind to the opponent.** Being three-oh'd by the best player
alive taught your regular exactly as much as beating the worst filler in the
room. `lessonFactor(self, opp)` scales it by the gap — 0.35 for farming
somebody far worse, 1.0 for an even set, 2.2 for being taken apart by somebody
far better.

**On its own that makes the wall worse**, because a big fish in a small pond
now learns nothing from the pond. So invasions: a crew from one region visits
for a day (up to a week as the arcade becomes a destination), plays your
regulars through ordinary matchmaking, and goes home. Elites are materialised
as temporary players, so matchmaking, dialogue, the rumor mill and the counter
all work unchanged; their elo writes back to the world roster on the way out,
so your scene can knock somebody down the world rankings.

Elo makes it nearly free — losing to somebody 600 points above costs about ONE
point, stealing a set pays about THIRTY. Gated on having EVER put somebody in
the world top 64 (high-water, so a bad month can't switch it off). Measured:
first crew around run-day 125, sixteen visits across four years.

### Measured: does it produce a champion?

Lineages of up to 6 runs × 3 years each, via `tools/balance/lineage.mjs`:

| | as it ships (points unspendable) | points spendable |
|---|---|---|
| easy | 0/3 · best rank **28** | 0/4 · best rank **16** |
| normal | 0/3 · best rank **26** | 0/4 · best rank **19** |
| difficult | 0/3 · best rank **51** | **1/4 champion (run 2)** · best rank **13** |
| master | 0/3 · best rank **60** | 0/4 · best rank **29** |

**The first EVO champion this harness has ever produced.** Before invasions it
was zero in every configuration; now it is roughly one lineage in sixteen —
still the rarest thing in the game, which is right for a world championship.

**But it only happens when creation points can be spent**, and in the shipped
game they cannot (see the section above). As it ships, invasions raise the
ceiling on world rank — best rank 28 instead of the old 31–38 — and still
produce no champions. The roster re-spend is the load-bearing fix; invasions
are what makes it pay off.

### Fixed: the roster re-spend

The rule was always "players lock in once the run has STARTED" — but it was
written as `mode === 'sandbox'`, which never checks whether a run has started.
Fine while the only way into a consequential world was the creation wizard;
then resets arrived and produced the state the rule never anticipated — a new
run that has not begun, on a screen that is not the wizard. So the lock, meant
to stop mid-run editing, silently became permanent, and the game announced
"N points to spend on player creation stats" with nowhere to spend them.

`rosterOpen(save)` now says what the comment always said: the roster is yours
until the doors open for the first day. True on day one of a fresh world, true
again the morning after a reset, false the moment a day has been closed. The
Players tab carries a banner in that window, and the reset notice points at it.

Verified in-app end to end: reset a lineage with 28 banked points → the notice
names the Players tab → the banner reads "47 banked points to spend" → the
editor opens with "+47 legacy" in the budget and spending visibly draws it down
→ close one day and it locks, banner gone, edit button gone.

## The champion rate, and four bugs under it

Both of the questions above turned out to be the same question, and answering
it properly meant finding four separate places where the game was not the game
we had been measuring.

**The harness was throwing away most of the budget.** `makeRun` spent creation
points by cycling a ten-key pool and capping each key at five, so any budget
over ~50 was silently discarded. Every lineage measurement past run 2 was a
re-measurement of the same build — which is why banked points looked inert. Any
conclusion drawn from those runs was worthless, including "points go dead past
40". Fixed: the spender fills the chosen rows first and then spills into every
other stat, which is what a competent player does with a hundred banked points.

**Half of `match.js` was reading stats raw.** Under the sparse point-buy an
unspent stat is `0`, not `undefined`, so the `?? 5` fallbacks written for the
old always-5 stats never fired once:

- `skillGainMultiplier` — an uninvested player learned at rate 0.5 instead of
  the 1.29 the formula was written for. Two and a half times slower than
  designed, forever.
- `performance` — `xfactor` is the ONLY randomness in a match, so two players
  with no x-factor points resolved **deterministically**: higher performance
  won 100% of the time. The only upsets in the game came from whoever happened
  to have bought the stat, and it was a flat buff (`rand() * xfactor`, never
  negative) rather than variance.
- `resolveEntrantMatch` in `tournament.js` — same, on `dominance`/`determination`.

All now go through `statLevel`, the same adapter everything else uses. Absence
is average, not crippled.

**EVO weighted your inflated elo above the world's real one.** Elite entrants
scored `skill * 0.72 + elo / 70` while your own players scored `skill * 0.75 +
elo / 40` — a world number one's rating was worth a bit over half of your local
hero's. Your arcade is a CLOSED elo pool: your cast farms rating off your own
regulars, who sink to pay for it, so somebody who has never played outside the
building arrives at 2000. That asymmetry was the single reason a **skill-65**
player could win EVO against a field of 76–83. The two formulas now mirror each
other exactly, and champions come in at skill 82–86.

**Cultivation was erased by the level cap.** An active rival, earned belief and
character tech added a flat **+38** against a hard ceiling of 100 — so a
forty-point build and a fully maxed one both landed on exactly 100. Points went
dead at the top of the curve for the same reason they went dead at 40. It is
now a share of the REMAINING HEADROOM (half the gap to perfect, at most), which
cannot erase the difference between builds no matter how cultivated they are.

### The real problem: the grind wasn't a grind

With those fixed, the champion rate was still ~3 runs on every difficulty, and
the shape was wrong in a way the rate alone doesn't show:

| banked points | 20 | 40 | 60 | 80 | 114 |
|---|---|---|---|---|---|
| lineages producing a champion | 0/10 | 0/10 | 9/10 | 9/10 | 10/10 |

A cliff, not a curve. Below ~50 points, never; above it, almost always; and
114 bought nothing that 60 didn't. The cause: **skill saturated to its ceiling
inside year one** and then flatlined — years two and three added a single point.
So skill *equalled* ceiling, ceiling is arithmetic on creation points, and the
whole lineage was a step function with a bracket's sequential elimination
sharpening it into a cliff.

The asymptote exponent in `skillGainMultiplier` went 1.15 → 2.4. The first half
of the climb is barely slower; the last quarter costs years. Measured, a cast
now reaches ~72% of its ceiling in year one and ~90% by year three, and the
points→skill curve is monotone the whole way: 61 / 66 / 74 / 76 / 86.

That is also what promotes `lessonFactor` and invasions from flavour to
necessity — finishing the climb inside a career requires reps against people
better than you, which a local scene cannot provide.

### Pacing: one number, not fifteen

Milestones live on the save, so they reset with the run — a competent player
collected the same flat ~29-point stipend every single time, whether the
lineage was climbing or treading water. Two changes:

- `prestige.milestonesEver` carries across resets, and a milestone this lineage
  has already banked pays a third. Reaching somewhere new pays full. This is
  also what makes ADDING sources safe: a new milestone raises how high a
  lineage can reach, not how much the treadmill pays.
- `LEGACY_PACE` sets the schedule in one place. Every `points` value passed to
  `awardMilestone` expresses what a milestone is worth RELATIVE to the others;
  this constant turns those relative worths into a calendar. Tuning fifteen
  individual awards to fix a pacing problem destroys an ordering somebody sat
  down and thought about.

It is set from the far end: a build cannot absorb more than **114** points (24
stats x 5, less the six free row points), so a fully maxed cast is the end of
the ladder and how long it takes to get there is the length of the game.

New sources, so there is more than one road up: the five world-ranking rungs
(top 64 / 32 / 16 / 8 / #1), skill 85 and skill 95, and a ladder for taking
sets off visiting elites (1st, 5th, 20th — a ladder rather than one award per
elite, because there are sixty-four of them).

### The maxed build

`the-complete-player` — every stat at five on one person. That is 114 points,
more than any single run can bank, so it is the capstone of a whole lineage
rather than a run. Verified it fires at exactly 114 and not at 100.

## Three bugs from playtest

**Pools spoiled the round you were on.** `aired = ri <= round` treated the
current round as already broadcast, so its winners were in gold with the set
score printed before you clicked anything — and the grid flipped to final
standings and "→ X advances" the moment you reached round three. `poolRound`
now counts rounds you have finished WATCHING (0-3), not the round you are
looking at; a match reveals when its round is behind you or when you actually
sat and watched it, tracked in `evoWeek.watched`.

**EVO's broadcast was being credited to your channel.** Every EVO set ran the
full `buildStream` crediting path: follower growth, `3 + quality/50` hype apiece
across ~100 sets (enough to pin a channel at the hype cap in one week), a
peak-viewer record in the thousands, and ad revenue into your register. Its
viewer count also read `followers * 0.15 + hype * 8`, making the world
championship's audience a function of how big YOUR channel was. `viewersFor`
already carried the comment "EVO is the one exception: it's the world's
broadcast, not yours" — the code just never acted on it. EVO now builds a full
production (crowd, chat, narration) that touches nothing of yours, which also
means you can watch it without owning a rig. Verified: followers, hype,
peakViewers, totalStreams and money are all identical either side of `runEvo`.

**The Studio arrived in week one.** `peakRelevance >= 62` is a HIGH-WATER mark —
the opposite of the problem the Studio solves — and relevance spikes around EVO,
which lands seven days after opening, so a first EVO handed over the biggest
tool in the game before the arcade had a second cabinet.

An intermediate version priced it on the NEED (sixty days at interest ≤ 50, or
a year), which fixed the timing but priced the tool on suffering — measured, a
competent scene never goes stale at all, so the owner running the place well
was the one who never got it. The gate is now simply A FULL YEAR OPEN. It can't
fire in the first fortnight, it doesn't require the run to be dying, and it
lands well before the death march starts biting around year three: you get the
tool before the war it's for. The `worth-watching` key is unchanged so lineages
that already earned it keep it.

Worth recording from that pass — a competent scene never goes stale at all.
Interest climbs to ~100 by the end of year one and stays, and across five
two-year runs not one spent a single day twelve points below its own peak.

## Where the champion rate landed

6 lineages x up to 16 runs x 3 years, banked points rebuilding the cast:

| difficulty | runs to an EVO champion |
|---|---|
| easy | 5.8 |
| normal | 6.7 |
| difficult | 6.5 |
| master | 15 (4 of 6 lineages got there at all) |

Ordering is right — easy first, master last, which is what started this. The
last piece was the world itself: `driftEvoRoster` clamped elite skill to 90
while the top of the roster generates above that, so every New Year sanded the
gods down and nothing ever put them back. A lineage was fighting a world its own
earlier runs had worn out. The world now regresses a quarter of the way toward
its tier each year, so it recovers from a beating in three or four — measured,
the top three hold 90-96 across twenty years, and bounce back from a 12-point
hit in four.

## The death march

The measurement above — a competent scene never goes stale — was not a
curiosity, it was a missing third act. The design is three threats in order:
the economy (early), the community (mid), and relevance (late), and the third
one is supposed to be INEVITABLE. The Studio doesn't beat it; it buys time.

The architecture was already there — patch stakes scale with age, franchise
fatigue, headroom-scaled dividends — but the daily equation had no
inevitability: max sustain (~0.30/day out of a beloved, full, streamed room)
beats `timeDecay` until age six, and a competent scene holds opinion high
forever. So the fix is one term: SUSTAIN FADES WITH GAME AGE. The world's
willingness to keep listening is the thing that runs out — full strength
through year one and a half, 2/3 by 2.5, half by 3.5, a third by 5.5.

Nothing restores it. Patches reset the staleness clock, a champion is a
+45%-of-headroom event, a golden age halves decay — every tool buys time
against the same slope, and everything you do decides WHEN, not WHETHER.

Measured (competent normal runs, six years, 9-14 patches shipped): relevance
climbs through year one, peaks at 100 in years two-three, declines visibly
from three and a half, and every run dies between day 1174 and 1673. The
champion window (years two-three, relevance still 90+) is untouched — the
lineage sweep re-ran with the fade in place: easy 5.5, normal 6.0, difficult
6.8, master 13.4 runs to a champion. Within noise of the pre-fade numbers,
ordering intact.

## The world got real

One batch, all landed together:

**Every country is a region.** `src/game/geo.js` is the atlas: 199 countries
with FGC-realistic weights — US/JP/KR/FR/BR/GB/CA carry the top, and the tail
holds everyone, so a Malawian or Palauan contender is possible and an event.
Legacy bloc regions (US-East/West, EU, CIS, AF, ME) migrate to real countries;
the AF/ME keys collide with Afghanistan/Montenegro's ISO codes, so migration
reads the row's era (old rows lack `gender`) to tell bloc from country.

**Names make sense now.** Seventeen gendered name pools by cluster; every
country resolves to a pool or a mix (America is EN-heavy plus a diversity
card; Singapore mixes CN/IN/EN; Canada carries French). Non-binary fell from a
uniform third to ~3%. Arcade walk-ins are LOCAL — the pool follows the
arcade's country setting.

**Elites are people.** Eighty of them (rankings still cut at 64, so the bottom
sixteen fight to get ON the list), each with a gendered, region-true name, an
appearance, a catchphrase, and a persona — loyalist / meta-chaser /
lab-monster / showman / veteran — that decides who they play: gravitateElites
pulls top players toward top-tier characters on every patch and New Year,
with loyalty as the resistance. Two to four retire every year and rookies
take their slots, so a lineage keeps meeting new names.

**The world plays without you.** worldMatchesDaily runs a few unwatchable
background sets a day among the eighty (near-neighbour pairing, zero-sum elo,
K=16), so the top 64 shifts continuously instead of holding still between
EVOs. Genuine shocks (sub-25% upsets over top-12 players) hit the feed.

**The room talks about the world.** Concession-stand exchanges about the top
eight and the hot newcomer, and in the fortnight before EVO the chance
quadruples and the material is all EVO.

**Combos play out beat for beat.** A landed route is no longer one sentence:
one line per hit at rapid-fire pace (`pace: 'combo'`, ~250-700ms vs the
900-3200ms turn-taking), route move names read out, the bar stepping with
each line. Some routes open ON BLOCK — two hits into a solid guard, then the
overhead/low/throw cracks it and the rest cashes out. Blocking got its own
screen time besides: whole strings that just get held, at real momentum cost.

**Chat matches the energy.** The narration marks its own biggest moments
(comeback, blocked-out, super) and chat reacts to those first — a one-pixel
comeback triggers a SPAM BURST (3-9 near-duplicate "oh my god" / "no way" /
"is this really happening?" messages piled on the line where the arc starts;
the dedupe is deliberately off, duplicates are the point). Channel-flavored
lines ("this arcade always delivers") air only on your streams, never under
EVO.

**"Run it back"** replaced "Start a new run" everywhere.

Verified: migration repairs a 64-man bloc-region roster in place (aliases,
elo, titles untouched; 0 stale regions), EVO fields 64 of the 80 with atlas
flags, champion spot-check unchanged (6, 8, 6 runs on normal), economy
harness steady, build green.

## Faces

The player mugshots are photo-derived now (characters untouched). Thirty
headshots, ages ~15-30, pulled from thispersondoesnotexist.com — StyleGAN
faces, so they are free to use and, more importantly, NO REAL PERSON'S
LIKENESS ships with the game. Each is cropped to the head, pixelated to 26px,
and reduced to exactly three values (dark / medium / light) with per-image
percentile thresholds — the Game Boy Camera look.

Twelve palettes recolor those three values: Game Boy, Black & White, Sepia,
Red & Blue, Virtual Boy, Amber CRT, Green Terminal, Synthwave, Ice, Blossom,
Sunset, Grape. The choice lives at Manage → Settings → Portrait palette
(per-save, cosmetic, never locked) and re-skins every portrait at once —
art.js holds the current palette as module state set by App, because the
Portrait call sites don't carry the save.

Auto-picked faces are GENDER-MATCHED — men draw from the 13 male heads, women
from the 17 female, non-binary from the whole pool — and the hand-pick catalog
in the player form shows the new pool in the current palette. Old saves keep
working: legacy spriteKeys still resolve against the old pixel-art faces.

Gender ratio itself went from 55/42/3 to Dylan's 60/30/10.

The pipeline (scratchpad/process.py) is source-agnostic: swap the raw folder,
re-run, and the whole set regenerates. Masters are 26x26 three-value indexed.

### The heritage guide

Faces follow HERITAGE — the name cluster an identity rolled from, persisted as
`player.heritage` / `elite.heritage`. One roll decides both name and face, so
a Kenji Tanaka in Los Angeles reads East Asian on the card, an arcade in Osaka
never hands its regulars mismatched mugshots, and a melting-pot country is
exactly as mixed as its NAME_MIX says. FACE_GUIDE (components/art.js) tags all
45 heads with gender + the looks they can pass for (generous on purpose — a
26px three-value mugshot abstracts a lot); CLUSTER_ETH maps each name cluster
to its looks (JP/KR/CN/VN/TH → East Asian, IN → South Asian, ARB → MENA, AFR →
Black, the European clusters → white, ES → Latin, BR → mixed, EN → anyone).
Selection filters by both and falls back to gender-only, then to the whole
pool, so nothing ever strands.

The first 30 heads skewed white (the generator's bias), so a second batch of
72 was fetched and 15 gap-fillers curated in: every cluster x gender pool now
holds at least two heads. Old saves backfill heritage on load — elites from
their own region, players from the arcade's country. Verified in-app: the
world number one rolled as Nanami "Basilisk" Takahashi of Japan, East Asian
face, Japanese name, one roll.
