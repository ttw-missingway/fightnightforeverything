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
whole way through" claims a snapshot can't answer. Legacy tab in the Hall of
Fame.

Two things to carry into later phases:

- **Nothing gates on `unlocks` yet.** `isUnlocked()` is the seam and returns
  true for anything not in the catalogue. Wiring it up is Phase 5's job,
  because that is where the tools get priced.
- **The payouts are first numbers.** The whole ladder pays 23, pitched against
  `RUNG_ALLOWANCE` (24) rather than against a Normal creation budget of *five*.
  Measured on a 400-day autopilot run, six of twelve land from just surviving;
  the other six need intent (a room brought back from toxic, a loved patch, 60
  solo days in the black, an EVO title). Recalibrate at Phase 7.
- **Food pricing is doing far more than expected** — noticed while calibrating
  `short-order`. Servings sold over 336 days: 111 at $4, 166 at $3, **469 at
  $2**. Generated players start with `income` at zero under the sparse
  point-buy, so a $4 counter is nearly a closed counter. Worth a look in the
  Phase 7 pass; the achievement is calibrated around it for now.

---

## Phase 5 — the shop

Priced only after Phases 1–2 land, because the prices encode what things are
worth.

- [ ] Idle mode — every speed beyond real time
- [ ] VODs tab
- [ ] Community tier list tab
- [ ] Feed tab
- [ ] Studio tab
- [ ] **Food packs** — cut the catalogue to 5 at start, 4 purchasable packs of 5.
      Players can prefer food you cannot yet stock; that gap is the motivation.
- [ ] **Arcade attraction packs** — pinball, bowling, VR, pickleball, laser tag,
      classic games, touch-screen. Passive revenue scaled by arcade popularity,
      each targeting a different demographic. No NPCs needed.
      *Buying the pack persistently unlocks the **option**; you still install it
      per-run — but the purchase grants the first installation free in the run
      where it is bought.*
- [ ] Separate / ban players
- [ ] Hotfixes from the Studio — small changes only, to correct an overlooked
      problem without the community irritation of a full patch
- [ ] Family business — start with a small staff who never quit and need no pay
- [ ] Extra allocation points (expensive)
- [ ] Advertising options — start with flyers and word of mouth only
- [ ] **Streaming setup** — per-run purchase, not persistent. You cannot stream
      until you buy it.

---

## Phase 6 — tournaments

Self-contained subsystem; slot anywhere after Phase 4.

- [ ] Formats: double elimination, 16 / 32 player, team, 8-team, round robin
- [ ] **Bandwidth meter at world creation.** Tournament count × frequency ×
      duration (a product of player count and format) consumes bandwidth.
      Starting bandwidth ≈ one weekly 8-player plus one monthly 16-player.
- [ ] Bandwidth is purchasable and persistent
- [ ] Tournaments cost cleanliness, scaled by size

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
