# The revision — 2026-07-29

Supersedes the trajectory in `FINAL-PUSH.md`. `BALANCE.md` §12 remains the
canonical measurement log; this document is the plan that log will be measuring
against from here.

---

## 0. What changed, in one page

Fifty playtest hours across several people produced one finding that matters
more than the other sixty-four: **the scene homogenises after year one.**
Everyone lands at 40–50 skill and 1600–1700 elo, results go random, and the
game stops having favourites. Every other complaint is downstream of that.

It is downstream because the game's actual pleasure — established by the people
who played it, not by design intent — is: *mythologise the best players in the
world from day one, then watch your own people struggle up to the point where
they can take one down.* That story needs a large, legible, slow-closing gap.
When the gap shuts in year two, there is nothing left to watch.

Six decisions follow from that.

**1. Growth moves inside the run.** No more roguelike meta-progression of
power. A single run can and should produce an EVO champion. Runs feel different
because the *world* differs (region, pantheon, meta) and because your roster's
story diverges — not because run four starts stronger than run one. Meta
unlocks become cosmetic and optional: palettes, sprite packs, rosters, stages.
The instant a returning player starts stronger, the "I beat an elite" moment
dies permanently.

**2. The eureka spine.** Every player carries a breakthrough meter fed by the
gap between ambition and result — losing to people above them, plateauing,
falling out with friends, being denied something they wanted. As it fills,
specific stats begin to *glow*, chosen by who they spend time with, what
archetype they play, and what has happened to them. When it fills, **you**
choose one glowing stat to break through: permanent gain, large mood spike, and
a temporary purple patch.

Breakthroughs raise the **temperament stats**, not skill. Skill then climbs
toward a ceiling derived from those stats. Practice fills toward the ceiling;
eureka raises it. Two currencies, one direction of causation.

Potential comes from a third temperament layer, **spirit** — six choose-ones
that are the complete set of orderings of three axes (skill, love, mana), set in
stone, one per player. Three hidden values on 75–100 are rolled and assigned
highest-to-lowest in that order, ceiling the player's skill, `community` and
`popularity` respectively, and each also *radiating* an effect onto everyone
around them. **The player chooses the shape of their potential; the game rolls
the magnitude.** Nobody rolls a dud, so there is no fatalism — what you discover
over a career is the shape, and the ceilings *steer* development rather than
merely capping it. Talent **breadth** — how many stats glow at once — comes from
how lopsided the roll is, not how high. Fully specified in §1.6.

**3. Eureka and burnout share an input.** Adversity fills the breakthrough
meter *and* drives passion decay toward retirement. Pushing a player is a
genuine wager. This is what turns "everyone retired at once and I didn't know
it was possible" into a bill you can see coming, because you ran it up.

**4. The journal.** Each user-created player keeps a first-person feed. It is
both the UI and the story, and it carries one hard rule: **the journal is the
only place a stat change is announced, and nothing is announced anywhere else.**
No entry means nothing moved. That guarantees the eureka system is auditable,
prevents log-file bloat, and makes reading the journal the way you play two
hands ahead — early warnings arrive as entries you could skim past, and by the
time something is a toast it is nearly too late.

Elites get no journal. They get *fragments* — interviews, tweets, VOD
commentary, quotes in guides. The asymmetry is the mythology. An elite's
journal unlocks when they retire, or when one of your players becomes a genuine
rival of theirs.

**5. Three levers, three latencies.** Your role is a god guiding a community.
You never issue day-to-day orders — you shape conditions and you author
breakthroughs.

| lever | latency | risk | what it touches |
|---|---|---|---|
| **Streaming** | weeks | low | who is visible; whose temperament infects the room; who becomes a fan favourite |
| **Money** | a month-plus | medium | pot size (brings competition to you), travel funding (sends players to it), space, exposure |
| **Patching** | immediate | high, unpredictable | the meta everywhere — the *only* lever that reaches the elites |
| **Eureka** | opportunistic | free, but unrepeatable | one person, permanently — the only lever that is not environmental |

Eureka is a lever and not merely character development: steering a toxic player's
breakthrough into `politeness`, or a burning-out star's into `temperance`, is
crisis management. Its constraint is what makes it fit a god rather than a
manager — **you cannot call it, only answer it when it arrives.**

Everything compounds. Actions land a month out more than they land today.
Anything is fixable **if caught early enough**, and past a threshold nothing is.

**6. Discipline dies.** All three levers already touch room chemistry, so
punishment is unnecessary and unfun. Stream the calm veteran and the room
settles, at the cost of burying your star. Buy a second setup so two rivals
stop queueing for one. Nerf your own best player's character to break the
hierarchy they are poisoning. And the eureka system already resolves social
failure on its own — *"what I said really bothered Roy, I should be more
sensitive"* is a breakthrough trigger.

Exactly one nuclear option survives: **you can ask someone to leave.** It costs
reputation, it costs you with everyone who liked them, and they may resurface
elsewhere and beat you. Rare, painful, always available.

### The threat model, restated

Foreclosure is demoted to a guard rail against extravagance and inattention. It
is no longer the main threat. The three acts become:

- **Act 1 — obscurity.** Nobody comes, no talent arrives, you never get going.
- **Act 2 — decay.** The room sours, players burn out, talent leaves before it
  arrives.
- **Act 3 — succession.** Your generation ages out and the world moved on. Did
  you build the next one while you were winning?

Failure never becomes impossible, but late failure is **recoverable at cost**:
a collapsed dynasty resets you to Act 1 conditions with a famous name.

### Money's new job

Money stops being about survival and becomes about **buying adversity**, in two
directions:

- **Raise the pot** → better fields come to your tournaments → your players
  lose to people above them → the eureka meter fills. Good players stop
  attending if the pot does not keep pace, so this is an endless sink that
  scales with ambition.
- **Fund travel** → your players ask to attend qualifiers, regionals and
  majors; the arcade foots the bill. You can say no, and often you simply
  cannot afford everyone and must choose. Cost scales with distance and
  prestige, which makes your region a standing financial fact.

Saying no is itself eureka fuel. *"They wouldn't send me to Stockholm."*

Your books are visible to your players: refusing while broke is understood,
refusing while flush is a betrayal. Funding is a wager — a placing recoups, an
early exit is money burned.

This makes money a **calendar** problem, which is the sharpest expression of the
two-hands-ahead principle in the game. Qualifiers are in month eight. Did you
still have the cash in month eight, or did it go into a pot in month three?

### The calendar

- **Three majors** — autumn, winter, spring. Invitational, double elimination,
  16 players, each in a different city. 4 seats to the host region, 2 each to
  the next four strongest regions, 4 from qualifiers.
- **Qualifiers** — belief-gated self-entry. 32 players, single elimination. One
  seat to the winner, one to the runner-up, **two to fan favourites by vote** —
  which makes stream time and personality into competitive access, and is the
  reason the streaming systems exist at all.
- **EVO** — summer. Unchanged in role, now the summit of a structure rather
  than the only structure.
- **Regionals** — twice a year, between autumn/winter majors and between the
  spring major and EVO. Top 16 of a 64-deep regional ladder, double
  elimination, regional players only. **This is the missing rung** and it
  matters more than majors for mid-game pacing.
- **Squad Showdown** — once, at lunar new year. Eight teams. Survivor format:
  one player continues until knocked out, first team out of players loses.
  Auto-invite if you have a player in the world top 64.

For the first two years your players mostly do not get in, and majors are
something you *watch*. That is the mythology engine working.

### The world regenerates

The game is open-ended — an EVO win is a summit, not an ending, and a
completionist should be able to chase every major, a grand slam, a decade at
world number one, and an evo winner on every seat of the roster.

That makes elite turnover **structural, not optional**. Elites run the eureka
machine offscreen at a cheap rate, age, and retire; new prodigies enter every
year. Otherwise an endless game consumes its own world.

And once a player's sheet is mostly full, **eureka changes kind**: late-career
breakthroughs stop improving the player and start producing techniques, guides,
coaching and meta shifts. Young players grow themselves; veterans grow the
scene your next generation comes up inside.

Success also generates its own difficulty. A champion becomes a target: people
lab them, matchup edges erode, counterpicks sharpen. The second title is harder
than the first for a reason you can read in the journal — which is itself a
eureka trigger.

---

## 1. The eureka spine — the P1 specification

### 1.0 The stat sheet already describes this system

Three of the sixteen competitive stats in `constants.js` are not traits at all.
They are **conversion rates**, and they were written before anything consumed
them as such:

- `determination` — *how much better they get from losing*
- `dominance` — *how much better they get from winning*
- `temperance` — *how much winning/losing impacts their mood*

The spine does not need new fields to express its central idea. It needs a
meter wired to sockets that are already in the file.

### 1.1 Pressure is per-stat, not one number

Do **not** accumulate a single meter and then decide what glows when it fills.
Accumulate **pressure on individual stats**, continuously; the meter is their
sum. Every qualifying event adds pressure to one or two *named* stats.

When the meter fills, the top *K* pressured stats glow, where *K* is talent
breadth — 1 for a journeyman, 3–4 for a generational talent.

Three properties fall out of this and none of them do from a single meter:

- the eureka inspector can show exactly *why* a stat is glowing, which makes
  the most opaque system in the game debuggable;
- the journal can foreshadow — a stat crossing a visible fraction of the
  threshold is *"determination has begun to glow"*, weeks before the payoff;
- what lights up is derived from a player's history rather than rolled, so it
  is always defensible in fiction.

### 1.2 Three channels of pressure

**Wound — what kept costing them.** The dominant channel. A failure implicates
the stat that, had it been higher, would have changed the outcome.

| what happened | implicates |
|---|---|
| Led a set on a big stage and lost it | `composure` |
| Fell apart late on a long tournament day | `stamina` |
| Lost to the same matchup repeatedly | `analysis`, then `adaptation` |
| The scene's tech passed them by | `learning` |
| Playing badly on a character they have had for years | `mastery` |
| Picked something new up and it went nowhere | `aptitude` |
| Tilted; mood cratered after a loss | `temperance` |
| Could not close from ahead | `dominance` |
| Lost and lost and got nothing out of it | `determination` |
| Won something and nobody noticed | `presence` |
| Stopped turning up | `spark` |
| Fell out with someone | `sensitivity` / `politeness` / `sportsmanship`, by cause |
| Denied funding for a tournament they wanted | `determination` |

Every row is causally legible, which is what lets the journal entry write
itself — *"I had it. Game five, I had it."* This table must become exhaustive;
it is the single highest-leverage content artefact in P1.

**One stat needs redefining before this table is usable.** `sensitivity` is
currently *"how much social interactions swing their mood"* — volatility, not
empathy. As written, steering a toxic player's breakthrough into `sensitivity`
would make them *more* explosive, which is the opposite of the intent in §2.6's
counterplay.

**Decided 2026-07-29: the stat keeps its key and its name.** It stays
`sensitivity` in `SOCIAL_STATS` and stays "Sensitivity" on the sheet; only the
*definition* broadens, to carry empathy alongside the volatility it already
had — they read the room and are moved by it.

```
['sensitivity', 'Reads the room and is moved by it — considerate, and easily wounded']
```

That keeps both edges, which is already what the Dramatic social temperament
promises ("feels everything, at volume"), and makes it the one deliberately
double-edged stat on the sheet: the same number that lets someone de-escalate a
room is the number that makes a bad night land twice as hard.

Consequence for §1.2's wound channel: `sensitivity` can be implicated by *both*
a social rupture the player caused (they did not read the room) and one they
merely absorbed (the room got to them). The journal must distinguish those two,
because they are different entries about different people.

**Edge — what keeps working.** Success pressures the stat that produced it.
Won on a hard read → `analysis`. Outlasted someone over two hours → `stamina`.
Popped off and chat detonated → `presence`. Took a bracket on one character →
`mastery`, `loyalty`. Came from behind → `determination`, `xfactor`. Created
something → `innovation`.

**Influence — what is rubbing off.** Two sources:

- *Company.* A sustained relationship — friend **or** rival; it needs
  intensity, not warmth — with someone materially stronger in a stat makes that
  stat glow-eligible. Neutral acquaintances teach nothing. This is why rivalry
  is productive and a room of strangers is not, and it is mentorship without a
  mentorship system.
- *Character.* What they play makes demands. A grappler pressures `dominance`,
  `composure`, `temperance`. Rushdown pressures `mojo`, `spark`, `xfactor`. A
  technical zoner pressures `analysis`, `mastery`. Playing against the grain of
  their own sheet generates more friction *and* opens glows otherwise out of
  reach — which turns pocket-pick rotation and character crisis into build
  decisions rather than flavour.

### 1.3 The choice is wound versus edge

The trap: if pressure came only from failure, every player would round out
their flaws and by year six every sheet would be balanced. That is
homogenisation returning in a different coat.

The edge channel is the counterforce. **Every eureka is a choice between fixing
the flaw and sharpening the blade.** There is no dominant answer, it produces
materially different players, and it matches how competitors actually think.

Wounds and edges must be visually distinct at the moment of choosing.

### 1.4 Ignoring a wound has a deadline

Unselected candidates do not fully clear their pressure. A wound passed over
keeps returning, more insistently, and the journal grows louder about it.

Past a second, much higher threshold (hypothesis: ~2.5× normal) it stops being
a choice. The player resolves it themselves — badly, at a cost — or it converts
into a crisis: character abandonment, a relationship rupture, drift toward
retirement. *"I kept picking his edge over his composure, and eventually he
just broke."*

This is the too-late threshold of §0 applied at the scale of one person, which
is where it will be felt hardest.

### 1.5 Temperament is inertia

Breaking through **inside** their temperament row is cheaper. Breaking through
**outside** it costs more and is treated as an identity event — a Killer
breaking through into stoic stats is becoming someone else, and the journal
says so in those terms.

Accumulate enough cross-row breakthroughs and their **temperament changes**.
Rare, expensive, and among the largest things that can happen to a person in
this game.

### 1.6 Spirit — the third temperament layer, and where potential comes from

Creation gains a third choose-one alongside the competitive and social rows.
Six **spirit temperaments**, and six is not an arbitrary count: it is the
complete set of orderings of three axes, so nothing is missing and nothing is
redundant.

| spirit | order |
|---|---|
| The Guru | love · skill · mana |
| The Fool | mana · love · skill |
| The King | mana · skill · love |
| The Hero | skill · love · mana |
| The Outlaw | skill · mana · love |
| The Healer | love · mana · skill |

Spirit is **set in stone**. It does not grow, it is never rerolled, and each
player has exactly one. It gives creation a clean three-layer shape:
**competitive temperament is how they play, social temperament is how they
relate, spirit is what they could become.**

#### The three axes: a cap and a radiance each

Every axis ceilings one of the player's own quantities *and* radiates an effect
onto everyone around them. Keep both, and keep them symmetric — the effects were
implicit in the original sketch for love and mana only, and skill needs one for
the same reason the others have one.

| axis | caps | radiates |
|---|---|---|
| **skill** | skill ceiling | *standards* — proximity raises what the room believes normal is |
| **love** | `community` ceiling | *cohesion* — suppresses hatred and burnout in others |
| **mana** | `popularity` ceiling | *attention* — people want to be like them |

**Radiance is the influence channel of §1.2.** "People want to be like them" is
precisely the mechanic by which a high-mana player's stats become glow-eligible
for everyone nearby; skill radiating standards is how one great player in a room
makes everyone else's sheet start glowing. The spirit layer is therefore not a
separate system bolted on — it is what decides *who teaches whom*, which the
eureka spine already depends on.

Caps and radiances must be tuned on separate knobs. Conflated, tuning one
silently breaks the other.

#### The rolls

Three hidden values, each uniform on **75–100**, assigned highest to lowest in
the spirit's order. So the player chooses the *shape* of their potential and the
game rolls the *magnitude* — which is the whole reason this layer works.

In expectation, from the order statistics: **primary ≈ 94, secondary ≈ 87.5,
tertiary ≈ 81**, with a best-to-worst spread near 12.5.

Whether that spread is tight or enormous is entirely a function of where the
elite band sits. If world champions measure ~95 and the world top 64 begins
around ~85, then primary ≈ 94 can be world number one, secondary ≈ 87 is top
twenty, and tertiary ≈ 81 is the fringe of the top 64 — meaning **a Healer can
make the world leaderboard and will never win EVO**, permanently and legibly.
That is the shape to aim for.

**The range must therefore be calibrated against measured elite skill, not
chosen in isolation.** It is a claim about the elite band, and it is a
`fingerprint.mjs` question.

#### Caps do not merely limit — they steer

This is the most important consequence and it is not obvious. Under §1.1, a
player who stops converting adversity into skill gains has hit their skill
ceiling, and **that plateau generates pressure on their other axes.** A Healer
keeps running into a competitive wall, so their breakthroughs get pushed toward
love and mana instead. They *become* a community pillar — not by script, but
because their ceiling redirected them there.

The spirit temperament is a **narrative attractor**, not a limit. The Fool
becomes beloved and mediocre. The Outlaw becomes great and isolated. The King
becomes famous first and good second. The dice set the magnitude, the ordering
sets the destiny, and the eureka spine walks them there unaided.

#### This answers talent breadth: breadth is flatness, not height

Glow breadth (§1.1's *K*) derives from **how lopsided the roll is, not how high
it is.** A lopsided player (94/85/76) is a specialist and gets few, focused
glows. A flat player (90/88/86) is a generalist and gets wide ones.

That uses information already present in the dice, it is orthogonal to power so
there is no rich-get-richer loop, and it makes roll *variance* do real work
instead of sitting there as noise.

#### Reconciling this with §0

An earlier draft of §0 committed to "no hidden caps, no fatalism," on the
grounds that a hidden ceiling means most players cap at 50, you cannot tell, and
nothing you do matters. This layer is not that, for three reasons: the player
chooses the shape, the range sits entirely in the upper band so **nobody rolls a
dud**, and the ceiling is on *potential* while realisation remains the eureka
spine's job. Everyone here is capable; what you discover is the shape.

#### Two obligations this creates

**The price is the tertiary slot, and nothing is to be added to it.** Being a
Healer costs a competitive ceiling; being an Outlaw costs a room. That is a real
cost, carried entirely by the ordering. No axis gets an additional penalty — the
layer stays clean, and the only lever on how much the third slot bites is the
range.

**Immutability obligates the journal.** A hidden, permanent ceiling is
infuriating unless the game says so in fiction. Hitting a cap must arrive as
*"I don't think I'm getting any better at this"* — never a revealed number and
never silence. And it means a topped-out competitor is genuinely finished as a
competitor, which is exactly what veteran-tier eureka (§1.9) and the coaching
handoff (P5) exist to catch. Immutability is what makes the discovery worth
anything, so it stays — but it is a promise about the late game, not only a
creation rule.

#### Where it lives

`constants.js` gains `SPIRITS` (the six orderings and the three axis
definitions). `model.js` gains the spirit key plus the three rolled ceilings on
the player, stored but never surfaced. `generate.js` assigns spirit and rolls to
NPCs and elites. `PlayerForm.jsx` gains the third choose-one at creation.

### 1.7 The conversion formula — where the three levers enter

The most important equation in the design. An adversity event does not go
straight into the meter. It is **split** between eureka and passion drain:

```
split = f(determination | dominance, temperance, composure,
          current mood, relationship health, belief)
```

Therefore **suffering is only productive in a well-run room.** A miserable,
isolated player converts adversity almost entirely into burnout. A player with
good mood, someone to talk to, and the stats for it converts most of it into
growth.

Streaming sets mood and exposure. Money sets conditions and access. Patching
sets what losing even means. **All three levers land in this split** — which is
why they are not decoration, and why the game's thesis can be written as an
equation.

It compounds in the right direction, too: early breakthroughs into resilience
stats make all *later* adversity more productive. Investing in `determination`
early is a genuine strategy with a real payoff curve.

### 1.8 Belief is the amplifier, and it explains why NPCs stall

Adversity is a function of **expected result minus actual result**, and belief
sets the expectation. A player who does not think they can win does not suffer
meaningfully when they lose, and therefore does not grow. **Exposure is a
prerequisite for growth.**

This answers a question the design must answer: why do NPCs never become
monsters? Because nobody streams them, funds their travel, seats them beside a
great scholar, or chooses their breakthroughs. **The arcade is the growth
engine.** That is not asserted flavour — it falls out of the mechanics.

It is self-limiting rather than a degenerate maximise-belief loop, because high
belief also means a larger burnout hit on failure. Belief is the risk dial.

### 1.9 The point cap performs the late-game phase transition

Two different caps are now in play and must not be confused. The **spirit
ceilings** of §1.6 bound the outcomes — skill, community, popularity. The
**point cap** here bounds the sheet itself.

`STAT_MAX_POINTS = 5` means a stat can break through five times. As a career
runs on, candidates thin — which forces breadth late and eventually leaves a
veteran with nothing left to glow.

**That is the trigger for veteran-tier eureka** (§0, P5): breakthroughs stop
improving the player and start producing techniques, guides, coaching and meta
shifts. The existing cap delivers the transition with no new mechanism.

For scale: 24 stats × 5 points = 120, against a creation budget near 20 and a
career of 10–12 breakthroughs. A great player finishes around 30–35 of 120.
There is no risk of running out of sheet; the risk is running out of
*pressured, unfilled* stats, which is the point.

### 1.10 Numbers, as a starting hypothesis

Stated only so the harness has something to shoot at:

- Event weights — loss to someone above them 1–2 · elimination when they
  believed 3–5 · plateau week 1 · social rupture 3 · denied funding 4–6
- First threshold 25; each subsequent × 1.35 → 25, 34, 46, 62, 84, 113, 152…
- At 2–4 adversity/week (≈110–220/year), a six-year career yields **8–11
  breakthroughs**, landing on the 10–12 target
- Same-stat repeats escalate faster than new stats — monomania stays possible
  and becomes expensive
- Forced-resolution threshold ≈ 2.5× the normal one

### 1.11 What settles it

`tools/balance/eureka.mjs` must report, per run:

- breakthroughs per player per year (metric 3)
- the **wound : edge selection ratio** — if it collapses to one side, the
  tension in §1.3 is fake and the system is a skill tree
- cross-row breakthrough frequency, and temperament-change rate
- forced-resolution rate (§1.4)
- the breakthrough : burnout split (metric 4)
- **cap realisation** — the share of players who reach each spirit ceiling, and
  how long it takes. If most players top out, the ceilings are too low or the
  spine too generous; if almost none do, the spirit layer is invisible and
  §1.6's steering never happens
- the distribution of *which* axis a player tops out on first, against their
  spirit ordering — the narrative attractor of §1.6 either shows up here or is
  not real

Metric 1 — separation — is downstream of every one of these.

---

## 2. The instrument

Nothing in §0 can be tuned by feel. The existing harness (`tools/balance/`,
a headless *competent player* in `policy.mjs`) is the right foundation and the
right philosophy — measure a player who has read the tooltips, never autopilot.
It needs new instruments because it currently measures an economy, and the
questions above are about people.

### 2.1 Seeded determinism — prerequisite for everything else

18 `Math.random` call sites across 11 files; `src/game/util.js` holds six of
them and `fight.js` already carries a mulberry32 with the comment *"the engine
must never touch Math.random."* Route every site through a save-scoped seeded
RNG and honour that comment everywhere.

Buys: reproducible runs, diffable baselines, bug reports that replay, and A/B
comparison where the only difference is the change under test.

### 2.2 Run fingerprints and a committed baseline

The single highest-value addition. `tools/balance/fingerprint.mjs` runs N
seeded runs, emits one JSON of every headline metric, and diffs against a
committed `tools/balance/baseline.json`. Every balance change then shows its
blast radius before it is argued about.

### 2.3 The metrics that decide whether this is working

| # | metric | why | target shape |
|---|---|---|---|
| 1 | **Separation** — top-5% skill ÷ median skill, and the same for elo, per year | the disease | must *widen* over the run, never converge |
| 2 | **Time to first elite win** | the impossible moment | never year 1–2; lands year 4–6; happens at all in a majority of runs |
| 3 | **Eureka cadence** — breakthroughs per active player per year | is the spine paced | front-loaded, thinning, never zero for a focused player |
| 4 | **Breakthrough : burnout** — of high-adversity players, share who break through vs retire | the wager must be a wager | neither near 0 nor near 1 |
| 5 | **Retirement dispersion** — stddev of retirement day | the bulk-exodus bug | high; a flat distribution, not a spike |
| 6 | **Attention cost** — *mutating* decisions per in-game week, by year (§2.5) | depth may grow, clicks may not | ~flat from year 1 to year 10 |
| 7 | **Journal volume** — entries per player per year | it must not become a log file | roughly 15–30 |
| 8 | **Lever latency** — lag between each lever and its measurable effect | the compounding principle | stream ≈ weeks, money ≥ a month, patch ≈ now |
| 9 | **Recoverability curve** — put a run into a crisis, apply best counterplay *k* days later, measure recovery vs *k* (§2.6) | the too-late threshold | a clean S-curve with a real cliff, not a straight line |
| 10 | **Money's job** — share of spend on survival vs competition (pots + travel), by year | money must change job, not fade | inverts across the run |

Metrics 9 and 6 do not exist in any form today and are the two that most
directly test what this revision claims. Metric 1 is the one that says whether
the revision worked at all.

### 2.4 Harness scripts

Keep: `policy.mjs`, `funnels`, `longarc`, `ablate`, `playstyles`, `books`,
`unit`, `lineage`. Add:

```bash
node tools/balance/fingerprint.mjs 24 normal      # headline metrics → JSON
node tools/balance/fingerprint.mjs --diff         # vs committed baseline
node tools/balance/separation.mjs 12 10 normal    # metric 1, ten years
node tools/balance/eureka.mjs 12 normal           # metrics 3 and 4
node tools/balance/latency.mjs stream|money|patch # metric 8
node tools/balance/recovery.mjs toxicity|burnout|irrelevance|plateau  # metric 9
node tools/balance/attention.mjs 8 normal         # metric 6
node tools/balance/journal.mjs <playerIdx>        # dump one career, read it
```

`journal.mjs` is a content tool, not a balance tool: the journal is the front of
the game now, and prose quality decides whether the eureka system sings or
embarrasses. It must be readable without playing.

---

### 2.5 Attention cost, defined

**Decided 2026-07-29.** Attention is **mutating** interactions only —
write/update/delete. Reads are free.

Choosing to stream a player counts. Allocating a point counts. Spending money to
enlarge the arcade counts. Switching tabs does not. Clicking into a match to
watch it does not. Opening a profile does not.

The virtue of this definition is that it is **derivable from the store boundary
rather than judged per button**: instrument the mutation path in
`state/store.jsx` once, and every future feature is measured automatically
without anyone remembering to tag it. Headlessly, `policy.mjs` counts the
mutating decisions it makes as it makes them.

Two rulings that follow:

- **Acknowledgements do not count.** Dismissing a toast, closing a banner and
  advancing the day all write to the save but are not choices. They are excluded
  by an explicit list, and that list is reviewed whenever it grows.
- **Report two numbers.** Total, and *steady-state* excluding creation and run
  setup. Point-buy at creation is a legitimate one-off spike that would
  otherwise swamp a per-week average and hide the thing being measured.

### 2.6 The four crises, and what recovery means

**Decided 2026-07-29.** Metric 9 sweeps a lag: put a run into a crisis, wait *k*
days, apply the best available counterplay, run 180 more days, ask whether it
recovered. Sweep *k* over 0, 7, 14, 28, 56, 112 and plot recovery rate.

The shape is the finding. An **S-curve** means §0's "fixable if caught early,
hopeless past a point" is literally true and we know where the point is. A
**straight line** means there is no threshold and catching it early was
meaningless flavour. **Flat zero** means there is no counterplay at all.

| crisis | recovered when | counterplay the harness plays |
|---|---|---|
| **Toxicity** | room chemistry back above its pre-signal level **and** nobody left over the window | remove the spotlight — never reward toxicity with attention; buy more setups; nerf the dominant player's character; steer breakthroughs into `sensitivity`, `politeness`, `community`; banish only if necessary. *If they cannot be kept out of the spotlight, sabotage them.* |
| **Burnout** | that specific player still active a year later | more spotlight, not less; buff their character; fund every opportunity that arises for them; steer breakthroughs into `temperance`; last-ditch, into `mojo` or `xfactor` and hope a spike buys a win |
| **Irrelevance** | attendance back above where it stood when the signal fired | patch to address what the community is complaining about, *even when the community has it wrong and the patch destabilises*; a new attraction as a temporary kick-start; ensure a fresh wave of interesting players is ready to take over |
| **Plateau** | a player past 1700 elo **and/or** community average elo up substantially | raise the pot; fund travel; stream for popularity, since fan-favourite seats are access without results; recruit upward so §1.6 radiance raises the room's standards; patch to destroy the solved matchup state |

**Separation is not in that table.** It is deprecated in §4. But the *baseline*
measures with today's tools, warts included — warn, separate, banish — because
the point of the baseline is the game the playtests actually complained about.

#### Injection for the curve, detection for validity

Both are needed and they answer different questions. **Injection** starts every
run at identical crisis severity, so lag is the only variable and the curve is
clean. **Detection** lets runs play until a crisis arises naturally, then checks
that natural crises resemble injected ones. Without detection the curve may be
measuring a synthetic problem that never actually occurs.

#### Plateau is not the same kind of crisis as the other three

Toxicity, burnout and irrelevance are *events*. Plateau is the game's current
**equilibrium** — it is the disease of §0, not an accident.

The diagnosis is topological rather than numerical: elo among eight players who
mostly play each other is zero-sum, so the community average cannot rise; and
under §1.7 losing to a *peer* generates almost no adversity, so the room
produces almost no eureka either. The room is sealed, and every counterplay above
is a way of opening it.

Which means plateau needs **two** numbers, not one: recoverability *and*
incidence. A healthy recoverability curve on a game that still plateaus every
run means only that a good escape hatch was built for a problem that should not
exist. **Metric 1 remains the real test.**

Note also that the success criterion is well chosen for a structural reason:
community average elo can only rise by importing elo from outside, so it measures
*openness* directly rather than a number going up.

---

## 3. The dev suite

`src/screens/DevSuite.jsx` at `/#dev` is currently read-only — cinematics,
gates, save-state — and is correctly stripped from production by
`import.meta.env.DEV`. Preserve both properties. Add:

- **Fast-forward.** Sim the loaded save forward N days using `policy.mjs`'s
  competent player and hand back the result. This is the feature that stops
  late-game testing from costing a week of play, and it is nearly free because
  the harness already imports `src/game` directly.
- **Scenario fixtures.** Committed JSON saves, one click to load: *year 5
  dynasty*, *toxic room at day 400*, *star player at ceiling with belief 90*,
  *defending champion, meta adapting*, *qualifier season with no money*, *the
  succession cliff*. Generated by the harness, regenerated when the save schema
  moves.
- **Journal viewer.** Any player's full feed from a simmed run, with the
  mechanical deltas shown in a margin, so entry quality can be judged in bulk.
- **Eureka inspector.** For a selected player: current meter, what fed it and
  when, which stats are glowing and why. This is the debugger for the most
  opaque system in the game.
- **Event timeline.** A simmed run's whole event log, scrubbed, so a year reads
  in thirty seconds.

Standing rule, inherited and kept: **nothing in the dev suite writes to a real
save.** Fast-forward and fixtures operate on copies.

---

## 4. The deprecation lane

Dead systems must stop constraining refactors of `sim.js`, `tournament.js` and
`model.js`.

**Mechanism.** `src/game/deprecated/` plus a registry at
`docs/DEPRECATED.md`, and `scripts/check-deprecated.mjs` wired into
`npm run lint` so live code importing from the lane fails the build.

**Old saves break.** Decided 2026-07-29: `migrateSave()` does not carry pre-
revision saves forward. The schema version bumps and older saves are refused
rather than migrated. Migrating through a change this size would mean holding
dead shapes in `model.js` indefinitely, which is the exact thing the lane exists
to prevent. Playtest *identities* can still be salvaged through the existing
roster export path — but that has to happen before P0 lands.

**What moves, and what survives:**

| system | files | disposition |
|---|---|---|
| Warnings and separations | `discipline.js` (`warnPlayer`, `separate`, `areSeparated`, `unseparate`, `pruneSeparations`, `warnableBehaviors`, `receptiveness`, `pride`), `Players.jsx`, ~15 readers | **deprecate** |
| Banishment | `discipline.js` (`banish`) | **keep and promote** — the one nuclear option; gains reputation, social and rival-resurfacing consequences |
| Exhibitions | `tournament.js` (`canStageExhibition`, `runExhibition`, `EXHIBITION_*`), `stream.js`, `sim.js`, `editors.jsx`, `EvoWeek.jsx`, `policy.mjs`, DevSuite gate | **cut** — the calendar and streaming cover both jobs |
| Prestige as power | `model.js` (`RUNG_ALLOWANCE`, `rungPointsThisRun`, `rungAllowanceLeft`, `EARLY_RUNGS`), `Setup.jsx`, `PlayerForm.jsx`, `RosterEditor.jsx`, `lineage.mjs` | **deprecate the power path**; keep `prestige.points` as a cosmetic unlock currency |
| Idle time-locks | `constants.js`, `model.js` (`newIdleState`), `store.jsx`, `Arcade.jsx` | **deprecate the locks**; idle becomes free at all speeds from the start |
| Amenity expansion | `catalog.js`, `names.js` (`ATTRACTION_PACKS`), `economy.js` | **freeze, do not delete** — no new attractions, no construction system, until the core lands |

Deprecation happens in **P0, before any new system is built**, so the eureka
and journal work is not written around code that is on its way out.

---

## 5. Phases

Each phase ends by running `fingerprint.mjs --diff` and recording the result in
`BALANCE.md`. A phase that moves a metric the wrong way is not finished.

### P0 — Instrument and isolate

No gameplay change. **The order is a hard constraint, not a preference:**

1. **Seeded RNG** through every call site. Goes first because it does not change
   the distribution, only makes it reproducible — and nothing downstream is
   trustworthy until runs replay.
2. **Metric scripts.** Requires two operational definitions settled first: what
   counts as *a decision* (metric 6), and the shape of the crisis-injection API
   (metric 9).
3. **Capture the baseline** of the game *as it stands*, so the revision can be
   measured against the thing it is replacing.
4. **Deprecation lane**, and all six systems of §4 moved into it.
5. **Dev suite** — fast-forward, fixtures, journal viewer, eureka inspector,
   timeline.

**3 must precede 4.** Cut exhibitions and discipline first and the baseline
measures a game nobody played, destroying the only chance to compare against
what the playtests actually complained about. This matters most for metric 9:
the current game's only counterplay to a toxic room *is* discipline, so
recoverability has to be measured with discipline still in place. That number —
almost certainly a flat zero at every lag — is what P3's levers get held
against.

The baseline must also include the **elite skill distribution**: where world
champions and the world top 64 actually measure today. §1.6's 75–100 roll range
is a claim about that band and cannot be set until it is known.

*Exit:* a ten-year run measured in seconds, a baseline in git covering all ten
metrics and the elite band, and no live imports from `deprecated/`.

### P1 — The eureka spine
**Specified in full in §1.** New `src/game/eureka.js` carrying per-stat
pressure, the three channels, the conversion split, deceleration, forced
resolution, and temperament inertia. Skill ceiling becomes derived from the
stat sheet rather than set independently.

Touches `model.js` (player fields: pressure map, meter, breakthrough log, spirit
key and the three hidden ceilings), `constants.js` (the wound→stat mapping,
thresholds, and `SPIRITS`), `sim.js` (event emission), `social.js` (company
channel and radiance), `match.js`/`tournament.js` (wound and edge emission at
the point of the result), `career.js`, `interest.js` (character channel),
`generate.js` (spirit and rolls for NPCs and elites), `PlayerForm.jsx` (the
third choose-one at creation).

*Exit:* metrics 1, 3, 4 in range; the wound : edge selection ratio is genuinely
split; separation widens across ten years. **This is the phase that either
fixes the game or does not** — nothing after it is worth building if separation
does not move.

### P2 — The journal
Promote `memories[]` and `remember()`/`witnessed()`/`chronicle()` into a
first-class per-player feed in a new `journal.js`. Enforce the one-announcement
rule engine-wide. Open threads (rival, slump, goal, grudge, crisis) for
continuity. Voice driven by temperament, so two players write the same loss
differently. Post-choice aftermath entries. Toasts on any screen, all
dismissible, persistent banner on the arcade screen. Elite fragments —
interviews, tweets, guide quotes — and the retirement unlock.

The `tools/dialogue/out/corpus` situations are largely reusable; journals are a
single voice with no turn-taking, which sidesteps the coherence problem that
stalled conversations.

*Exit:* metric 7 in range, and a year of one player's journal reads as a story
when dumped by `journal.mjs`.

### P3 — The levers
Discipline removed from play. Streaming becomes affect influence, weighted by
who is visible. Money becomes pots plus the travel-funding ask/deny loop, with
visible books and distance-scaled cost. Patching gains meta shock, knowledge
invalidation and community backlash, and becomes the only lever that reaches
elites. Foreclosure demoted to guard rail. Banishment gains real consequences.

*Exit:* metrics 8, 9, 10. The recoverability cliff must exist and be findable.

### P4 — The calendar
Regionals first — the 64-deep regional ladder and two tournaments a year — then
majors and qualifiers with fan-favourite voting, then Squad Showdown with the
survivor format. Overlap prevention and the Sunday collision fixed here.
Region becomes run-shaping, with `geo.js` carrying travel cost.

*Exit:* metric 2 lands in the year 4–6 window.

### P5 — The world regenerates
Cheap offscreen eureka for elites. Ageing on both sides. Pantheon turnover and
new prodigies entering yearly. Veteran-tier eureka producing techniques,
guides, coaching and meta shifts. Champion-as-target. Succession, the coaching
handoff, and dynasty collapse as a recoverable failure state.

*Exit:* metrics 2 and 5 hold at year 15, not just year 6.

### P6 — The sweep
The bug list, the notification and navigation layer, the idle shrink. Detailed
in §6.

### Status — the revision is complete (2026-07-30)

All seven phases are built, measured and committed. Per-phase measurement
records live in `docs/BALANCE.md` §§14–21; §21 closes the plan with the
final metric table.

| phase | status |
|---|---|
| P0 baseline | ✅ committed, never re-blessed (every phase diffs against it) |
| P1 the eureka spine | ✅ |
| P2 the journal | ✅ |
| P3 the levers | ✅ |
| P4 the calendar | ✅ metric 2 re-specified to top-32; see §18 |
| P5 the world regenerates | ✅ survival 4.3y → 12.8y; metrics 2 and 5 hold at y15 |
| P6 the sweep | ✅ metric 1 finally widens; 9 of 11 bugs; see §20 |
| P7 sound | ✅ synthesized, 23 cues |

**Eight of ten metrics hold**, plus metric 10 partial (seven at the close, metric 4 fixed in §22, metric 10 corrected in §23).
Open, with causes recorded in §§21–22:

- **Metric 9 (the recoverability curve) returns a NULL RESULT.** The instrument
  exists and works; it has run twice and found no lag structure, because
  injected crises are static — severity on day 112 equals day 0, so timing
  cannot matter. The fix is making untreated crises COMPOUND, not building a
  tool. Deferred in P4, P5 and P6. It is the metric that most directly tests §0's central claim that
  failure is "fixable if caught early, hopeless past a point", and it is the
  largest single piece of unfinished work in this plan.
- **Metric 4 — RESOLVED (§22).** Re-specified to read §1.7's conversion split
  where it is actually made rather than at career endpoints, which exposed a
  real failure: suffering paid at ~0.87 for everyone, spread 0.10, floor 0.50.
  The room terms had been outweighed 2:1 by innate stats, inverting the
  thesis. Re-weighted; conversion is now 0.75 with spread 0.19, and a well-run
  room converts 0.59 against a neglected room's 0.38.
- **Metric 10 — PARTIAL (§23).** The reported failure was mostly an instrument
  bug: P4 renamed travel's log label and the classifier stopped matching it, so
  three phases of travel funding were reported as unclassified. Corrected, the
  competition share reads 0.03 → 0.40 rather than 0.03 → 0.07. Money demonstrably
  changes job; it does not strictly INVERT. Closing that needs a design decision
  about whether an arcade should spend more on competing than on existing — the
  obvious sink was built, measured, found to buy nothing, and cut.

**Backlog items NOT delivered**, all from §6 and all still wanted: the
navigation and notification leftovers, the **idle shrink** (which §6 itself
calls structural rather than quality-of-life, since an endless dynasty
requires a good let-it-run mode), and the unlockables layer.

**One open question found late:** normal and hard now produce identical
achievement, so difficulty is not currently expressing itself in the ladder.
See the difficulty-calibration note before changing any difficulty number —
the ladder is supposed to ride the creation-budget threshold, not the economy.

---

### P7 — Sound
Not last by importance — the most-requested item on the list, and every
landmark this revision builds is weaker without it. Can start any time after
P2, once the moments exist and are enumerable.

---

## 6. The backlog

All 65 requests from the 2026-07-29 playtest and friends' feedback, sorted.
Nothing dropped silently.

### Promoted — now load-bearing
- Top players discover techniques → veteran-tier eureka output (P5)
- Character crisis after losing with a character a lot → plateau beat (P1)
- Pocket picks rotate freely; mains overwritable, personality-driven (P1)
- Elites follow the same pocket/main logic (P5)
- Age of player → retirement legibility, succession (P5)
- Warning as passion nears retirement (P1/P2)
- Stream time improves mood → mood offsets burnout (P1/P3)
- Players shouldn't start off obsessed → belief is earned, and throttles eureka (P1)
- Character guides findable, openable, readable → eureka trigger and veteran output (P2/P5)
- Team battles → survivor format → Squad Showdown (P4)
- Palettes, sprite packs, rosters, stages as unlockables → the *only* meta layer (P6)
- Skill jams up in year 3, scene homogenises → the disease (P1)
- Location RNG / use-my-IRL-location buttons → region is now run-shaping (P4)

### Mythology texture
- Players not at the arcade sometimes appear in chat (P2)
- People react to them **if famous at that point** (P2)
- VODs occasionally show money matches between great players (P2)
- Players and elites post on twitter → the elite fragment layer (P2)
- Banner: new best player in the world (P2)
- Banner: one of your players makes top 64 → also the Squad Showdown gate (P2/P4)

### Calendar and competition
- Smaller tournaments between EVOs → **absorbed** by regionals and qualifiers (P4)
- All round robins use the EVO format (P4)
- Choose best-of-2 or best-of-3 (P4)
- Prevent overlapping tournaments; the 1st is always a Sunday (P4)
- Sunday tournament day-1 nuisance (P4)
- Good players stop attending if the pot doesn't grow (P3)
- Tournament bandwidth scales with employees; schedule mid-run with a pot (P3/P4)
- "I miss when it took patience to get people through the door" + **promotional
  build-up for opening day set in world creation** — one feature, Act 1 pacing (P4)

### Bugs and wrong behaviour (P6, or earlier if cheap)
- "Said their X is better than ours" shows when you don't have X
- Elite profile pictures differ between game and leaderboard
- Money matches re-added to VODs as unwatched after being watched
- Final exam scheduled during summer
- Back to school doesn't affect attendance — it should, and hard
- Hearts/retweets too small for nationally recognised players
- $14 to restore a cabinet
- "losing to X should award double the arcade tokens" — bad copy
- NPCs taking seats from user-created players
- NPCs over-prioritised for teams
- Employees hold high morale while understaffed and overworked

### Journal and notification layer (P2)
- Many banners become toasts, firing on any screen; banner persists on arcade screen
- **All banners dismissible**
- Banners for teams formed, guides created, employees quitting
- Win/loss history (last 20) and elo trajectory per player
- "See it" button goes to the actual thing; omitted when there is nothing to show
- Golden outline on newly unlocked tabs, clearing on visit
- Next button on player cards to cycle the roster
- Click NPC name pills to open their profile
- Show / show-all buttons in VODs
- Daily recap with charts and pie graphs

### Shrink (P6)
- Restore AFK (tab closed) for idle
- Separate auto-stream from idle mode; add follow-a-specific-player
- Idle time locks far too hard → deprecated in P0
- Idle free from the start at all speeds

Given an endless dynasty *requires* a good let-it-run mode, this is structural,
not quality-of-life, and should be built properly rather than patched.

### Frozen until the core lands
- Prices and maintenance reflecting real values; construction periods for
  pickleball, bowling, VR, pinball, laser tag
- "Installing a thing closes it off for a construction period" — good idea, wrong act
- Demographics chart
- BOGO and promotional options for a dying arcade
- Siblings
- Dating

The fix for "prices and maintenance feel random" is not better numbers on
amenities; it is fewer amenities to get wrong.

**Frozen is not removed.** Attractions stay *usable* — a new one is the
kick-start response to irrelevance in §2.6's counterplay table, and the
recoverability curve for irrelevance depends on it existing. The layer stops
growing; it does not go to zero.

### Cut
- **Exhibition showcase.** Streaming already showcases; the new calendar
  already generates low-stakes matches. Removed rather than fixed.
- **Disciplinary warnings and separations.** Replaced by influence: streaming,
  conditions, patching, and eureka's own resolution of social failure.

### Sound (P7)
The most-requested item. Its own phase.

---

## 7. Open questions

1. **The wound→stat mapping must become exhaustive.** §1.2 gives thirteen rows;
   the real table needs to cover every way a player can fail. It is what makes
   journal entries write themselves, so a gap in it is a gap in the prose, not
   just the mechanics. Highest-leverage content work in P1.
2. **The spirit roll range (§1.6).** 75–100 is a *claim about where the elite
   band sits* — it only produces the intended shape (primary can win EVO,
   tertiary is fringe top-64) if elites measure around 85–95. Must be calibrated
   against measured elite skill in P0's baseline, never set by feel. Talent
   breadth is now answered — it is roll flatness — but the range is not.
3. **Eureka fill rate and the deceleration curve.** §1.9 is a hypothesis, not a
   finding. Target is 10–12 breakthroughs over a 6–7 year career, front-loaded.
4. **How much adversity is too much.** The breakthrough : burnout ratio decides
   whether the game is cruel or toothless, and there is no prior art in this
   codebase for it.
5. **Glow legibility.** Whether "choose a glowing stat" reads as authorship or
   as a skill tree is a prose problem, and it decides the revision.
6. **Whether the 16+8 stat sheet is the right resolution** for a system that
   now writes to it 10+ times a career. Unknown until P1 is measured.
7. **What a completionist ladder looks like** without becoming an achievement
   panel — it should surface through the journal as things the world notices.
