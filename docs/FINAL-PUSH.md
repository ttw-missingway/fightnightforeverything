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
Three new achievements (33 total, still 27 points): thirty tournaments run to a
finish, a 32-entrant field filled, a round robin of eight taken to a finish.

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

Not started. Agreed 2026-07-27; slots after Phase 6.

The cast is high-school and college kids, so the calendar should behave like
theirs. Two changes, one hook:

- [ ] **A run opens in summer**, not on January 1. The arcade's best months are
      its first months, which is also when a new owner most needs the room to
      be full.
- [ ] **Attendance takes a real hit when school goes back.** The summer crowd
      thins in September and the scene has to survive its first winter on
      whoever stayed. This is the first difficulty cliff a new owner meets, and
      it arrives early enough to teach rather than to end the run.
- [ ] **EVO moves to June 22** — days after a run opens. Nobody you made will
      be anywhere near ready for the first one, and that is the point: it is a
      date on the calendar from day one, it happens *to* you while you are
      still learning the room, and everything you do for the next year is
      pointed at the next one.

Depends on: the idle ladder in Phase 4 is already sized to this calendar (62
days = the summer, 175 = New Year's Day) and its names come true when the
start moves. Nothing else reads the season yet.

---

## Phase 7 — verification

The two constraints this entire plan exists to protect:

- [ ] **No archetype superfluous.** Re-run the live-economy ablation. Every row
      must cost the scene something real when removed.
- [ ] **No dominant strategy.** Run several distinct play policies (economy-first,
      community-first, competition-first) to the same horizon. Viability is the
      bar — one being best is fine; a gap that makes the others feel like
      self-kneecapping is not.

---

## Reference — what the measurements actually said

Live economy, 500 days, n≈30, death rate (control ≈ 80–83%):

| removed | death rate | reading |
|---|---|---|
| Dramatic | **60%** | scene is far healthier without them |
| Stoic | 77% | ~free |
| Killer | 80% | ~neutral |
| Natural | 83% | ~neutral |
| Gracious | 83% | ~neutral |
| Scholar | 87% | costly (and the **only** source of tech: −100%) |
| Put-together | 90% | costly |
| Warm | **97%** | load-bearing (mentorships −86%, teams −72%) |

Two traps found while measuring, worth not repeating:

- **Insulating the economy invalidates the arms that operate on it.** A $20k
  float made Put-together and Killer look superfluous; with a live economy both
  are load-bearing and the sign on followers flipped in both cases.
- **Survival confounds every cumulative metric.** Runs that live longer
  accumulate more followers, tech and skill by definition. Trust the death rate
  and the per-run social ratios; treat the rest as directional.
