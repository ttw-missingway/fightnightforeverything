// THE COMPETENT OWNER, as an engine module.
//
// This is the brain that runs the arcade when you are not: spectator mode's
// decision layer, and — via tools/balance/policy.mjs, which now imports it
// rather than owning its own copy — the headless player every balance number
// in BALANCE.md is measured against. One brain, deliberately. Two would drift,
// and the day they drifted the harness would stop measuring the game the
// player actually gets.
//
// It is not optimal. It plays the way someone who has read the tooltips plays:
// buys the rig, stocks the counter, prices to the room, hires as the money
// allows, advertises, grows the floor when the room fills and shrinks it when
// the room thins, answers the road, patches the game, and picks breakthroughs
// promptly. Competent is the point — an optimal autopilot would make spectator
// mode a demonstration of solved play rather than a run you can take over.
//
// WHAT IT MAY DO IS NOT WHAT IT CAN DO. Everything irreversible is gated
// behind `authority` (see DEFAULT_AUTHORITY): by default the computer will
// spend breakthroughs, because that is a decision the cast is waiting on and
// stalling it is worse than answering it — but it will not throw anyone out,
// will not close the setups, and will not sell the floor out from under a run
// you are going to take back. Those are yours.

import { clamp } from './util.js'
import { AD_CHANNELS, HOURS_PER_DAY } from './constants.js'
import { ATTRACTION_PACKS, STARTER_FOODS } from './names.js'
import * as eco from './economy.js'
import { audienceMix, hasFreeInstall, claimFreeInstall } from './catalog.js'
import { buildStreamForPlayers, pickAutoStreamSetup, STREAM_RIG_COST, canStream } from './stream.js'
import { releasePatch, daysSincePatch, charPower } from './patch.js'
import { applyMoveDescriptors, DAMAGE_TIERS } from './design.js'
import { isUnlocked } from './achievements.js'
import { selectableChars } from './forms.js'
import { noteDecision } from './attention.js'
import { autoPickStat, chooseBreakthrough } from './eureka.js'
import { pendingAsks, fundAsk, denyAsk } from './travel.js'
import { prospectsFor, canTakeOn, takeUnderWing, mentorsFor } from './succession.js'
import { displayName } from './util.js'
import { feudSource } from './social.js'
import { banish } from './discipline.js'
import { hiatusActive, hiatusDays, setHiatus } from './hiatus.js'

export const DEFAULT_POLICY = {
  rig: true,              // buy the streaming setup as soon as the books allow
  stream: true,           // put a match on the channel every day
  // WHO gets the camera is the first real cultivation decision (REVISION
  // §1.8: exposure is a prerequisite for growth — belief gates the eureka
  // split). 'closest' spread the spotlight evenly and the cast rose as one
  // block; a competent owner building toward an elite win streams their best.
  streamSelector: 'best',
  foods: 3,               // how many lines to stock
  foodPrice: 3,
  // THE PRICE IS costPerPlay = tokenPrice x playTokens. Measured (n=8, 336d,
  // normal): $1.50 and $1.75 die 0%, $1.25 13%, >= $2.00 dies 100%. $1.50
  // banks the most ($3.4k median).
  tokenPrice: 0.5,
  playTokens: 3,          // $1.50 a play
  cabinets: 2,
  maxEmployees: 2,
  growSetups: true,
  patchEvery: 100,        // days between balance patches, once the Studio is earned
  manager: false,
  ads: ['flyers'],
  cast: 6,
  weekly: 8,
  monthly: 0,
  hireAt: [600, 1400, 2600],
  managerAt: 2200,
  attractions: false,
}

/**
 * What the computer is allowed to do without you. Everything here is either
 * irreversible or the kind of thing you would want to have been asked about.
 * Spectator mode surfaces these as checkboxes; the balance harness leaves them
 * at their defaults, because a headless competent player IS allowed to shrink
 * the floor and that is exactly what P6 measured.
 */
export const DEFAULT_AUTHORITY = {
  eureka: true,       // spend breakthrough points on the cast
  banish: false,      // throw someone out — permanent, and it is your call
  hiatus: false,      // close the setups
  downsize: false,    // lay off staff, sell cabinets
}

const authorityOf = (opts) => ({ ...DEFAULT_AUTHORITY, ...(opts?.authority || {}) })

/**
 * Announcements. Spectator mode passes a sink that turns these into toasts;
 * the harness passes nothing and they evaporate. Kept as a callback rather
 * than pushing toasts directly so the brain has no opinion about the UI, and
 * so a headless run never accumulates a notification queue nobody reads.
 */
const say = (opts, icon, text, see = null) => {
  if (opts?.announce) opts.announce({ icon, text, see })
}

// Attention (metric 6) measures decisions the OWNER made. A decision the
// computer made is not one of those, and counting it would quietly corrupt
// the metric for anyone who ever used spectator mode.
const decided = (save, opts, kind) => {
  if (opts?.countAttention !== false) noteDecision(save, kind)
}

// ---------- running the place ----------

export function autoManage(save, policy = DEFAULT_POLICY, opts = {}) {
  const auth = authorityOf(opts)
  const cash = save.economy.money
  const { employees, managers } = eco.staffCounts(save)
  const clean = save.arcade.cleanliness ?? 80
  const runway = cash / Math.max(1, eco.projectedMonthlyCost(save) / 28)

  // Hire when the room needs it AND there is more than a fortnight of runway.
  const needHands = clean < 62 || save.economy.history.at(-1)?.attendance > 14
  if (employees < policy.maxEmployees && needHands && runway > 14 && cash > 300) {
    if (eco.trySpend(save, eco.HIRE_COST, 'hired an employee')) {
      save.staffing.staff.push(eco.newStaffMember('employee'))
      decided(save, opts, 'hire')
      say(opts, '🧹', `Hired a hand — the floor was getting away from you ($${eco.HIRE_COST}).`,
        { screen: 'manage', params: { tab: 'staff' } })
    }
  }
  // One manager per four employees keeps the floor working (the game says so).
  if (policy.manager && managers < Math.floor(employees / 3) && runway > 20) {
    if (eco.trySpend(save, eco.HIRE_COST, 'hired a manager')) {
      save.staffing.staff.push(eco.newStaffMember('manager'))
      decided(save, opts, 'hire')
      say(opts, '🗂', 'Hired a manager to keep the shifts honest.',
        { screen: 'manage', params: { tab: 'staff' } })
    }
  }
  // Let staff go rather than go under — the last thing before foreclosure.
  if (auth.downsize && runway < 6 && employees > 1) {
    const idx = save.staffing.staff.findIndex((x) => !x.family && x.role === 'employee')
    if (idx >= 0) {
      save.staffing.staff.splice(idx, 1)
      decided(save, opts, 'layoff')
      say(opts, '📉', 'Let someone go. The books were not going to carry the shift.',
        { screen: 'manage', params: { tab: 'staff' } })
    }
  }
  // GROW THE FLOOR. A setup is six matches a day and a token a match, so a
  // room with more people than cabinets is leaving money on the tables.
  const att = save.economy.history.at(-1)?.attendance ?? 0
  if (policy.growSetups && att > save.settings.setups * 6 && runway > 25
      && save.settings.setups < 8 && eco.trySpend(save, eco.SETUP_COST, 'new setup cabinet')) {
    save.settings.setups += 1
    decided(save, opts, 'setup')
    say(opts, '🕹', `Added a setup — that is ${save.settings.setups} cabinets ($${eco.SETUP_COST}). The queue was getting silly.`,
      { screen: 'manage', params: { tab: 'arcade' } })
  }
  // SHRINK IT AGAIN (P6). Measured against a SUSTAINED average, never against
  // today: `history.at(-1).attendance` is null on every tournament day, and
  // selling into a single quiet Tuesday cuts capacity, which cuts revenue,
  // which reads as a worse dip — the first cut of this took median survival
  // from year 13 to year 4.
  const attWindow = save.economy.history.slice(-28).map((h) => h.attendance).filter((a) => a != null)
  const attAvg = attWindow.length >= 14
    ? attWindow.reduce((s2, a) => s2 + a, 0) / attWindow.length
    : null
  if (auth.downsize && policy.growSetups && attAvg != null && save.settings.setups > 2
      && attAvg < (save.settings.setups - 2) * 4 && runway < 30) {
    if (eco.sellSetup(save)) {
      decided(save, opts, 'setup')
      say(opts, '📦', `Sold a cabinet — nobody has sat at it in a month. ${save.settings.setups} left.`,
        { screen: 'manage', params: { tab: 'arcade' } })
    }
  }
  // THE RIG, IF IT COULDN'T BE AFFORDED ON DAY ONE. "Can't afford it at open"
  // used to turn into "never owns a channel for the entire run".
  if (policy.rig && !save.arcade.streamRig && runway > 20
      && eco.trySpend(save, STREAM_RIG_COST, 'streaming setup')) {
    save.arcade.streamRig = true
    decided(save, opts, 'rig')
    say(opts, '📡', `Bought the streaming rig ($${STREAM_RIG_COST}). ${save.arcade.name} has a channel now.`,
      { screen: 'arcade' })
  }
  // Advertising is a weekly bill — only run what the books can carry, and only
  // channels this lineage has EARNED (writing `arcade.ads` directly used to
  // buy achievement-locked channels a real first-run player cannot have).
  const legalAds = policy.ads.filter((k) => {
    const c = AD_CHANNELS.find((x) => x.key === k)
    return c && (!c.unlock || isUnlocked(save, c.unlock))
  })
  const nextAds = runway > 30 ? legalAds : runway > 15 ? legalAds.slice(0, 1) : []
  if (nextAds.join() !== (save.arcade.ads || []).join()) {
    const added = nextAds.filter((k) => !(save.arcade.ads || []).includes(k))
    const dropped = (save.arcade.ads || []).filter((k) => !nextAds.includes(k))
    const label = (k) => AD_CHANNELS.find((x) => x.key === k)?.label || k
    decided(save, opts, 'ads')
    if (added.length) say(opts, '📣', `Started advertising: ${added.map(label).join(', ')}.`, { screen: 'manage', params: { tab: 'arcade' } })
    else if (dropped.length) say(opts, '✂️', `Pulled the ads (${dropped.map(label).join(', ')}) — the books needed the room.`, { screen: 'manage', params: { tab: 'arcade' } })
  }
  save.arcade.ads = nextAds

  // THE ROAD (travel.js): back your people when the books can carry it. A
  // competent owner funds the ask or says no promptly — sitting on one until
  // it lapses is the timid owner's move, and the game reads it as a no.
  for (const ask of pendingAsks(save)) {
    const cashNow = save.economy.money
    const who = save.players[ask.playerId]
    const name = who ? displayName(who, save) : 'somebody'
    if (policy.moneyLever === 'off') {
      denyAsk(save, ask.id)
      decided(save, opts, 'travel')
      say(opts, '🚫', `Turned down ${name}'s trip. Not this one.`, { screen: 'world' })
    } else if (policy.moneyLever === 'max' || (runway > 16 && cashNow > ask.cost * 2)) {
      if (fundAsk(save, ask.id)) {
        decided(save, opts, 'travel')
        say(opts, '✈️', `Funded ${name}'s trip to ${ask.eventName || 'the event'} ($${ask.cost}).`, { screen: 'world' })
      } else if (policy.moneyLever !== 'max') {
        denyAsk(save, ask.id)
        decided(save, opts, 'travel')
        say(opts, '🚫', `Turned down ${name}'s trip — the money wasn't there.`, { screen: 'world' })
      }
    } else if (runway < 10 || cashNow < ask.cost * 1.2) {
      denyAsk(save, ask.id)
      decided(save, opts, 'travel')
      say(opts, '🚫', `Turned down ${name}'s trip — the books said no.`, { screen: 'world' })
    }
  }

  // SUCCESSION (P5, §0 Act 3): keep somebody coming up behind the people who
  // built the place. Only spend a seat on a real ceiling — filling the roster
  // with journeymen is how you arrive at year twelve with eight people who
  // cannot win anything.
  if (policy.succession !== false && canTakeOn(save)) {
    const best = prospectsFor(save)[0]
    if (best && ['talent', 'prospect'].includes(best.player.ceilingTier)) {
      const mentor = mentorsFor(save)[0]
      if (takeUnderWing(save, best.player.id, mentor?.id)) {
        decided(save, opts, 'succession')
        say(opts, '🌱', `Took ${displayName(best.player, save)} under the arcade's wing.`,
          { screen: 'players', params: { playerId: best.player.id } })
      }
    }
  }

  // THE POT: stake past the minimum as the books allow — better fields come to
  // you, and your own stars keep turning up. 'max' stakes the highest
  // SUSTAINABLE tier, not the highest tier; a pot the house can't keep putting
  // up cancels brackets, which buys less adversity than staking nothing.
  for (const e of save.arcade.schedule) {
    if (e.type !== 'singles') continue
    const cashNow = save.economy.money
    const want = policy.moneyLever === 'off' ? 0
      : policy.moneyLever === 'max' ? (cashNow > 900 ? 2 : 1)
      : cashNow > 3000 && runway > 30 ? 2 : cashNow > 1200 && runway > 20 ? 1 : 0
    if ((e.potBoost || 0) !== want) {
      const up = want > (e.potBoost || 0)
      e.potBoost = want
      decided(save, opts, 'pot')
      say(opts, up ? '💰' : '🪙', up
        ? `Raised the pot on ${e.name}. Better fields travel for money.`
        : `Trimmed the pot on ${e.name} — ambition is a standing bill.`,
      { screen: 'manage', params: { tab: 'schedule' } })
    }
  }

  // AN ATTRACTION IS A CROWD YOU DO NOT HAVE YET, or it is furniture
  // (catalog.js). Buy into a pack you have EARNED, one room at a time,
  // preferring an audience the floor doesn't serve — and take the earned free
  // install even when money is tight, because that is what it is for.
  if (policy.attractions) {
    const owned = new Set(save.arcade.otherGames)
    const mix = audienceMix(save)
    const candidates = ATTRACTION_PACKS
      .filter((p) => isUnlocked(save, p.key))
      .map((p) => ({ p, missing: p.items.filter((i) => !owned.has(i)) }))
      .filter((x) => x.missing.length)
      .sort((a, b) => (mix.has(a.p.audience) ? 1 : 0) - (mix.has(b.p.audience) ? 1 : 0))
    const item = candidates[0]?.missing[0]
    if (item) {
      const cost = eco.gameItem(item).price
      const free = hasFreeInstall(save, item)
      const bought = free
        ? claimFreeInstall(save, item)
        : (runway > 30 && cash > cost * 2.5 && eco.trySpend(save, cost, `installed ${item}`))
      if (bought) {
        save.arcade.otherGames.push(item)
        save.arcade.gameTokens[item] ??= 1
        decided(save, opts, 'attraction')
        say(opts, '🎳', free
          ? `Installed ${item} on the house — that one was owed to you.`
          : `Installed ${item} ($${cost}). A crowd the fighting game never reaches.`,
        { screen: 'manage', params: { tab: 'arcade' } })
      }
    }
  }
}

// ---------- the room ----------

/**
 * MINDING THE SCENE. Both of these are OFF by default (see DEFAULT_AUTHORITY)
 * and do nothing until granted, because both are decisions a player who is
 * going to take the wheel back would want to have made themselves.
 *
 * The thresholds are the ones the game's own read uses: gold at 0.18, red at
 * 0.40, and cooling hits zero at 0.455 (social.js spreadFeuds). Acting inside
 * that window is the whole difference between a room that recovers and a room
 * that cannot, so the computer acts EARLY and reopens as soon as it has worked
 * — an owner who leaves the shutters down out of caution loses the arcade to
 * the thing the shutters were supposed to save.
 */
export function autoRoom(save, policy = DEFAULT_POLICY, opts = {}) {
  const auth = authorityOf(opts)
  const tox = save.scene?.toxicity ?? 0

  if (auth.hiatus) {
    if (!hiatusActive(save) && tox >= 0.28) {
      setHiatus(save, true)
      decided(save, opts, 'hiatus')
      say(opts, '🔌', 'Closed the setups. The room needs to cool off more than it needs a Tuesday night.',
        { screen: 'manage', params: { tab: 'schedule' } })
    } else if (hiatusActive(save)) {
      // Reopen when it worked, or when the cure has become the disease. Two
      // weeks dark costs most of the crowd whatever the bad blood is doing.
      const fixed = tox <= 0.08
      const tooLong = hiatusDays(save) >= 21
      if (fixed || tooLong) {
        setHiatus(save, false)
        decided(save, opts, 'hiatus')
        say(opts, '🔛', fixed
          ? 'Setups back on — the room settled down.'
          : 'Setups back on. Three weeks dark was as much as the books could take.',
        { screen: 'arcade' })
      }
    }
  }

  // THE NUCLEAR OPTION, aimed correctly. `feudSource` counts grudges SEEDED,
  // not grudges received — after a faction forms, the person with the most
  // enemies is the target rather than the author, and throwing the target out
  // is both unjust and useless (discipline.js). Held until the room is
  // genuinely poisoned, because it is priced in relevance, in everyone who
  // liked them, and in the chance they come back and beat you.
  if (auth.banish && tox >= 0.42) {
    const src = feudSource(save)
    if (src && src.seeded >= 3) {
      const name = displayName(src.player, save)
      banish(save, src.player, null)
      decided(save, opts, 'banish')
      say(opts, '🚫', `Asked ${name} to leave. It kept coming back to them.`,
        { screen: 'players' })
    }
  }
}

// ---------- the counter ----------

/**
 * Stock and price the concession counter. Lives here rather than in the run
 * setup so spectator mode can restock a run that has been played by hand and
 * left the shelves empty.
 */
export function autoStock(save, policy = DEFAULT_POLICY, opts = {}) {
  const want = Math.max(0, policy.foods | 0)
  save.arcade.foods ??= []
  save.arcade.foodPrices ??= {}
  if (!want || save.arcade.foods.length >= want) return
  const pick = STARTER_FOODS.find((f) => !save.arcade.foods.includes(f))
  if (!pick) return
  const price = policy.foodPrice ?? 3
  save.arcade.foods.push(pick)
  save.arcade.foodPrices[pick] = price
  decided(save, opts, 'stock')
  say(opts, '🌭', `${pick} are on the counter now, $${price}.`,
    { screen: 'manage', params: { tab: 'arcade' } })
}

// ---------- balancing the game ----------

/**
 * Nudge the strongest cast members down and the weakest up. Patching is the
 * only lever against relevance decay, so a policy that never patches measures
 * a player who has decided to lose slowly. This is the ordinary, sensible
 * patch a designer ships — a couple of characters moved a tier, nothing
 * structural.
 */
export function autoPatch(save, policy = DEFAULT_POLICY, opts = {}) {
  if (!policy.patchEvery || !isUnlocked(save, 'studio')) return
  if (save.gameDraft) return
  if (daysSincePatch(save) < policy.patchEvery) return
  const chars = selectableChars(save.game)
  if (chars.length < 4) return
  const draft = structuredClone(save.game)
  const ranked = [...chars].sort((a, b) => charPower(save.game, b.id) - charPower(save.game, a.id))
  const moved = []
  const shift = (charId, dir) => {
    const c = draft.characters.find((x) => x.id === charId)
    if (!c) return
    // Move the biggest-damage move one tier, which is what a real patch note
    // looks like: "Heavy Slash: damage heavy → normal".
    const mv = [...c.moves].sort((a, b) => (b.damage || 0) - (a.damage || 0))[0]
    if (!mv) return
    const i = DAMAGE_TIERS.indexOf(mv.d?.damage ?? 'normal')
    const next = DAMAGE_TIERS[Math.min(DAMAGE_TIERS.length - 1, Math.max(0, i + dir))]
    if (!next || next === mv.d.damage) return
    mv.d = { ...mv.d, damage: next }
    applyMoveDescriptors(mv)
    moved.push(`${c.name} ${dir < 0 ? 'down' : 'up'}`)
  }
  shift(ranked[0].id, -1)
  shift(ranked[1].id, -1)
  shift(ranked[ranked.length - 1].id, +1)
  shift(ranked[ranked.length - 2].id, +1)
  save.gameDraft = draft
  const patch = releasePatch(save)
  decided(save, opts, 'patch')
  if (patch) {
    say(opts, '🛠', `Shipped ${save.game.name} v${patch.version} — ${moved.join(', ')}. The room is calling it ${patch.reception}.`,
      { screen: 'studio' })
  }
}

// ---------- the cast ----------

/**
 * Answer every breakthrough the day armed. The cast waits for the OWNER —
 * a pending eureka is a question with nobody to ask — so leaving them unpicked
 * while the computer runs the place would stall the one system the whole
 * revision is built around.
 *
 * `policy.eurekaPrefer` lets a crisis counterplay name the stats it wants
 * broken through (a burning-out star toward temperance). The glow list still
 * decides what is ON OFFER; this only chooses among what arrived.
 */
export function autoEureka(save, policy = DEFAULT_POLICY, opts = {}) {
  if (!authorityOf(opts).eureka) return
  for (const p of Object.values(save.players)) {
    if (p.npc || p.createdBy !== 'user' || !p.eureka?.pending) continue
    const prefer = policy.eurekaPrefer
    const steered = prefer && p.eureka.pending.candidates.find((c) => prefer.includes(c.stat))?.stat
    const stat = steered || autoPickStat(p, p.eureka.pending.candidates)
    if (!stat) continue
    chooseBreakthrough(save, p, stat)
    decided(save, opts, 'eureka')
    say(opts, '✨', `${displayName(p, save)} has had a breakthrough in ${stat}.`,
      { screen: 'players', params: { playerId: p.id } })
  }
}

// ---------- the camera ----------

/**
 * Put one match a day on the channel. Returns the setup index streamed, or
 * null. Separate from the hour loop so spectator mode can call it after each
 * simulated hour exactly like the manual console does.
 */
export function autoStreamHour(save, policy = DEFAULT_POLICY, opts = {}) {
  if (!policy.stream || !canStream(save)) return null
  const dip = save.dayInProgress
  const hour = dip?.hours?.[dip.hours.length - 1]
  if (!hour || hour.streamedSetup != null) return null
  const idx = policy.streamPick
    ? policy.streamPick(save, hour)
    : pickAutoStreamSetup(save, hour, policy.streamSelector || 'closest')
  if (idx == null) return null
  const ev = hour.events.find((e) => e.type === 'match' && e.setupIndex === idx)
  const a = ev && save.players[ev.aId]
  const b = ev && save.players[ev.bId]
  if (!a || !b || ev.stream) return null
  hour.streamedSetup = idx
  ev.stream = buildStreamForPlayers(save, a, b, ev, 'daily')
  decided(save, opts, 'stream')
  return idx
}

// ---------- what to watch ----------

/**
 * WHICH MATCH IS WORTH WATCHING. Spectator mode shows one thing an hour and
 * there may be eight cabinets running, so something has to have taste.
 *
 * Ranked by what makes a set worth stopping for: bad blood between the two,
 * how close it was, how good they are, whether it upset the odds, whether the
 * camera was on it, and whether these are people you MADE rather than two
 * strangers who happened to be in the room. Deliberately not "highest elo" —
 * a one-sided top-table set is duller than a grudge going the distance.
 */
export function matchInterest(save, ev) {
  if (!ev || ev.type !== 'match') return -Infinity
  const a = save.players[ev.aId]
  const b = save.players[ev.bId]
  if (!a || !b) return -Infinity
  let score = 0
  // Close on paper: 50/50 is the best set in the building.
  score += (1 - Math.abs((ev.probA ?? 0.5) - 0.5) * 2) * 30
  // Close in fact — a full-length set beats a sweep.
  const games = (ev.setWinnerGames ?? 0) + (ev.setLoserGames ?? 0)
  score += Math.min(games, 7) * 3
  // Bad blood. The room stops for these and so does the camera.
  const rel = Math.min(a.relationships?.[b.id] ?? 0, b.relationships?.[a.id] ?? 0)
  if (rel <= -60) score += 26
  else if (rel <= -40) score += 14
  // Standard. Two good players is a better watch than two beginners.
  score += Math.min(40, ((a.elo || 1000) + (b.elo || 1000) - 2000) / 20)
  // It was on the channel, which means the owner (or the camera rule) already
  // judged it the match of the hour.
  if (ev.stream) score += 12
  // YOUR people. A run is about the cast you built; two drifting strangers
  // playing a good set is still two strangers.
  if (!a.npc) score += 10
  if (!b.npc) score += 10
  return score
}

/**
 * The hour's one vignette, chosen. Setups first (that is what the arcade is
 * for), then whatever the room was doing instead.
 *
 * Returns {kind: 'match'|'talk'|'note', ev} or null for a genuinely empty
 * hour — spectator mode skips those rather than staging a shot of nobody.
 */
export function pickVignette(save, hour) {
  if (!hour) return null
  const matches = hour.events.filter((e) => e.type === 'match')
  if (matches.length) {
    const best = matches.reduce((x, y) => (matchInterest(save, y) > matchInterest(save, x) ? y : x))
    return { kind: 'match', ev: best }
  }
  // Conversation: prefer the group with something that actually HAPPENED in it
  // — a friendship forming, a falling out — over three people making small
  // talk, then prefer the bigger group.
  const talks = hour.events.filter((e) => e.type === 'interaction' && (e.beats || []).length)
  if (talks.length) {
    const rank = (e) => (e.outcomes?.length || 0) * 10 + (e.memberIds?.length || 0)
    return { kind: 'talk', ev: talks.reduce((x, y) => (rank(y) > rank(x) ? y : x)) }
  }
  const notes = hour.events.filter((e) => e.text)
  if (notes.length) return { kind: 'note', ev: notes[notes.length - 1] }
  return null
}

// ---------- one automated day ----------

/**
 * The management beat that happens once per day, before the doors open.
 * Spectator mode calls this at the top of each day; the harness calls it from
 * playDay. Kept separate from the hour loop so a spectator can watch the
 * decisions land as toasts before the day starts moving.
 */
export function autoOpen(save, policy = DEFAULT_POLICY, opts = {}) {
  autoManage(save, policy, opts)
  autoRoom(save, policy, opts)
  autoPatch(save, policy, opts)
}

/** The beat that happens once per day after close. */
export function autoClose(save, policy = DEFAULT_POLICY, opts = {}) {
  autoEureka(save, policy, opts)
}

export { HOURS_PER_DAY, clamp }
