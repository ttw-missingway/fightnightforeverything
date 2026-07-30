// The journal — REVISION §0.4 and P2. Each user-created player keeps a
// first-person feed. It is both the UI and the story, and it carries ONE HARD
// RULE: the journal is the only place a stat change is announced, and nothing
// is announced anywhere else. No entry means nothing moved. That keeps the
// eureka system auditable, prevents log-file bloat, and makes reading the
// journal the way you play two hands ahead — early warnings arrive as entries
// you could skim past, and by the time something is a toast (notify.js) it is
// nearly too late.
//
// VOICE: two players write the same loss differently. Competitive events are
// voiced by the competitive temperament (a Killer rages, a Scholar takes
// notes, a Natural shrugs, a Stoic states); social events are voiced by the
// social temperament. The prose here is the front of the game now — it is
// what decides whether the eureka system sings or embarrasses.
//
// Filler keeps no journal. Elites keep no journal either — they get FRAGMENTS
// (fragments.js); the asymmetry is the mythology.
//
// (The dialogue corpus in tools/dialogue/out was considered and passed over:
// it is two-party exchange prose, and rewriting it into a single first-person
// voice loses more than it saves. Journals sidestep the coherence problem
// that stalled conversations precisely because nobody answers back.)

import { choice } from './util.js'
import { absDayOf, TEMPERAMENTS, SOCIAL_TEMPERAMENTS } from './constants.js'

const CAP = 350 // ~25/yr × a 12-year career; the oldest fall off the back
const WEEK_BUDGET = 3 // soft cap — a journal is a diary, not a ticker

export const isJournaled = (player) => !player.npc && player.createdBy === 'user'

/**
 * Write one first-person entry. `data` carries the interpolants the kind
 * needs ({opp}, {stat}, {char}, {event}, {place}, …), plus:
 *   deltas  — [{stat, points}] mechanical margin for the one-announcement rule
 *   thread  — a thread id for continuity
 *   always  — bypass the weekly budget (stat changes are NEVER skipped)
 * Returns the entry, or null if unjournaled/budgeted out.
 */
export function writeJournal(save, player, kind, data = {}) {
  if (!isJournaled(player)) return null
  player.journal ??= []
  const today = absDayOf(save.day, save.year)
  if (!data.always) {
    const recent = player.journal.filter((e) => today - e.absDay < 7).length
    if (recent >= WEEK_BUDGET) return null
  }
  const text = composeEntry(player, kind, data)
  if (!text) return null
  const entry = {
    absDay: today,
    day: save.day,
    year: save.year,
    kind,
    text,
    deltas: data.deltas || null,
    thread: data.thread || null,
  }
  player.journal.push(entry)
  player.journalWritten = (player.journalWritten || 0) + 1
  if (player.journal.length > CAP) player.journal.splice(0, player.journal.length - CAP)
  return entry
}

// ---------- Threads (rival, slump, goal, grudge, crisis) ----------
// Continuity: a thread is an open storyline entries can hang off. Opening and
// closing are themselves journal moments; the ids let journal.mjs and the P4+
// systems read arcs instead of isolated lines.

export function threadOf(player, kind, subjectId = null) {
  return (player.threads || []).find((t) => t.kind === kind && t.subjectId === subjectId && !t.closedAbs) || null
}

export function openThread(save, player, kind, subjectId = null) {
  if (!isJournaled(player)) return null
  player.threads ??= []
  const existing = threadOf(player, kind, subjectId)
  if (existing) return existing
  const thread = {
    id: `${kind}_${subjectId || 'self'}_${absDayOf(save.day, save.year)}`,
    kind,
    subjectId,
    openedAbs: absDayOf(save.day, save.year),
    closedAbs: null,
  }
  player.threads.push(thread)
  if (player.threads.length > 40) player.threads.splice(0, player.threads.length - 40)
  return thread
}

export function closeThread(save, player, thread) {
  if (thread) thread.closedAbs = absDayOf(save.day, save.year)
}

// ---------- The voice ----------

const COMP_ROWS = new Set(TEMPERAMENTS.map((t) => t.key))
const SOC_ROWS = new Set(SOCIAL_TEMPERAMENTS.map((t) => t.key))

function fill(template, data) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (data[k] != null ? String(data[k]) : `…`))
}

function composeEntry(player, kind, data) {
  const table = LINES[kind]
  if (!table) return data.text || null // a caller may hand finished prose
  const social = !!table.social
  const voice = social ? (player.socialTemperament || 'gracious') : (player.temperament || 'stoic')
  const variants = table[voice] || table.any
  if (!variants) return null
  return fill(choice(variants), data)
}

/**
 * The prose tables. First person, present-or-just-happened tense, no emoji —
 * icons belong to the UI. Interpolants in braces. `social: true` routes the
 * entry through the social temperament instead of the competitive one.
 *
 * Killer runs hot. Scholar takes notes. Natural shrugs. Stoic states facts.
 * Warm reaches out. Gracious keeps its manners. Dramatic feels it at volume.
 * Put-together files it under handled.
 */
const LINES = {
  // -------- the eureka spine (stat changes live HERE and nowhere else) -----
  glow: {
    killer: [
      `Something's coming. Every set lately points the same direction — {stat}. I can feel it wanting to break.`,
      `{stat}. That's the wall. I keep hitting it and one of these days it's coming down.`,
    ],
    scholar: [
      `Pattern in the notes: everything circles {stat} now. Whatever happens next starts there.`,
      `Reviewed the month. The through-line is {stat} — it has begun to matter more than anything else I'm doing.`,
    ],
    natural: [
      `Weird — I keep thinking about {stat} in the shower. Something's brewing there.`,
      `Can't explain it, but {stat} feels close. Like a word on the tip of my tongue.`,
    ],
    stoic: [
      `{stat} keeps coming up. Noted.`,
      `The pressure has a name now: {stat}.`,
    ],
  },
  breakthroughWound: {
    killer: [
      `It clicked. All those losses — {why} — and today {stat} just CLICKED. Nobody beats me that way again.`,
      `Fixed it. The thing that kept costing me — {stat} — it's mine now. Run it back, all of you.`,
    ],
    scholar: [
      `Breakthrough. The flaw was {stat}; the evidence was months of it — {why}. Closed the gap today. Log updated.`,
      `Finally solved my own worst matchup: me. {stat} clicked, and every loss on that page suddenly reads like homework.`,
    ],
    natural: [
      `Oh. OH. So THAT's what everyone meant about {stat}. It just clicked mid-set. I laughed out loud.`,
      `Something snapped into place today — {stat}. All the pain suddenly feels like it was on purpose.`,
    ],
    stoic: [
      `{stat} clicked today. The losses paid for it. Fair trade.`,
      `Breakthrough on {stat}. It took what it took.`,
    ],
  },
  breakthroughEdge: {
    killer: [
      `Sharper. {stat} was already my blade and today it went to a new level. They should worry.`,
      `Why fix what's broken when you can perfect what isn't? {stat}. Sharper than ever.`,
    ],
    scholar: [
      `Doubled down on {stat} — {why}. The strength compounds; the plan is the plan.`,
      `A breakthrough on {stat}, of all things. Strengths reward study too.`,
    ],
    natural: [
      `Leaned into the fun part — {stat} — and it leveled up. Play to your outs, baby.`,
      `The thing I was already good at got better today. {stat}. No notes.`,
    ],
    stoic: [
      `{stat} improved again. Build on rock, not sand.`,
      `The edge got sharper. {stat}. Keep going.`,
    ],
  },
  breakthroughInfluence: {
    killer: [
      `Watching {opp} finally rubbed off — {stat} clicked. I hate owing anyone anything. I'll pay it back in sets.`,
      `{stat} clicked, and if I'm honest it's {opp}'s fault. Fine. FINE. Thanks.`,
    ],
    scholar: [
      `{stat} clicked today, and the source is obvious: {opp}. Proximity to better is a curriculum.`,
      `You become who you study with. {stat}, courtesy of watching {opp} do it right for months.`,
    ],
    natural: [
      `Turns out hanging around {opp} teaches you things. {stat} just showed up in my hands today.`,
      `Caught myself doing the {opp} thing — {stat} — like it was mine. I guess it is now.`,
    ],
    stoic: [
      `{stat} clicked. Learned from {opp}, whether either of us meant it.`,
      `The company you keep gets into your game. {stat}. Good company.`,
    ],
  },
  breakthroughDemand: {
    killer: [
      `{char} kept demanding {stat} and tonight I finally answered. The character shapes the player. Fine — shape me into a weapon.`,
    ],
    scholar: [
      `{stat} clicked. The teacher was the character itself — {char} has been assigning this homework since the day I picked them.`,
    ],
    natural: [
      `Turns out maining {char} was secretly {stat} lessons this whole time. Today the tuition paid out.`,
    ],
    stoic: [
      `{stat} clicked. {char} demanded it long enough. The character wins arguments by patience. So do I.`,
    ],
  },
  forced: {
    killer: [
      `Everyone saw it coming except me, apparently. {stat} broke — I broke — and something else went with it. Don't ask.`,
      `Dealt with the {stat} thing. Badly. There's a mess I'm not writing down.`,
    ],
    scholar: [
      `I ignored the {stat} problem until it resolved itself. The data was all there. I just didn't want to read it.`,
      `Forced correction on {stat}. Cost exceeded what choosing early would have paid. Lesson filed, expensively.`,
    ],
    natural: [
      `So the {stat} thing finally blew up. It fixed itself, kind of, the way a bone sets crooked.`,
      `Should've dealt with {stat} months ago. It dealt with me instead.`,
    ],
    stoic: [
      `{stat} resolved itself. The hard way. My fault for waiting.`,
      `Waited too long on {stat}. Paid the difference.`,
    ],
  },
  wall: {
    killer: [
      `I don't think I'm getting any better at this. Writing that down felt like losing a set to somebody I've never beaten.`,
      `The climb stopped. Not paused — stopped. I've never hated a sentence more.`,
    ],
    scholar: [
      `Conclusion, months of data: I don't think I'm getting any better at this. The curve has an asymptote and I am on it.`,
      `I have studied everything there is to study and the number no longer moves. So the question changes: what else am I for?`,
    ],
    natural: [
      `Huh. I don't think I'm getting any better at this. Weirdly calm about it? There's other stuff I'm good at.`,
      `The magic hands have a ceiling after all. Okay. What's next, then.`,
    ],
    stoic: [
      `I don't think I'm getting any better at this. Most people never find their wall. I found mine. Now I decide what to build against it.`,
      `The ceiling is real. I touched it. No complaints — just a new map.`,
    ],
  },
  shift: {
    killer: [
      `People keep saying I've changed. They're right. {row} — that's what they'd call me now. The old me would have hated it. The old me lost a lot.`,
    ],
    scholar: [
      `Enough changes compound into a different person. The evidence says I'm {row} now. Peer review accepted.`,
    ],
    natural: [
      `Caught my reflection in the cab glass and thought: when did I become {row}? No idea. Suits me though.`,
    ],
    stoic: [
      `I'm not who I was. {row} now, apparently. People change slower than anyone admits, and then all at once.`,
    ],
  },

  // -------- results --------
  title: {
    killer: [
      `Won {event}. Felt correct. Next.`,
      `{event} is mine. The final wasn't close because I didn't let it be.`,
    ],
    scholar: [
      `Took {event}. The bracket played out almost exactly as mapped — almost. The 'almost' goes in the notes.`,
      `Won {event}. Preparation is a weapon nobody can nerf.`,
    ],
    natural: [
      `Won {event}?? Still grinning. Somebody buy the room a round of tokens.`,
      `{event}, champion, me. Says so on the bracket and everything.`,
    ],
    stoic: [
      `Won {event}. The work works.`,
      `{event}. First place. Moving on.`,
    ],
  },
  elimination: {
    killer: [
      `Out of {event}. I believed it this time — that's what makes it unbearable. Somebody's going to pay for this bracket.`,
      `{event} put me down and I heard the room go quiet. Remember the sound. Use it.`,
    ],
    scholar: [
      `Eliminated from {event}. Belief was justified; execution wasn't. The gap between those two is my whole off-season.`,
      `Out of {event}. I know exactly which game it slipped — I'll be replaying it for a month.`,
    ],
    natural: [
      `Went out of {event}. It stings more when you let yourself want it. I let myself want it.`,
      `{event}: out. Rode home in the quiet. Some nights the game doesn't love you back.`,
    ],
    stoic: [
      `Out of {event}. Believed, lost anyway. Both things can be true.`,
      `{event} ended early for me. The tape will say why.`,
    ],
  },
  evoWatch: {
    killer: [
      `Watched EVO tonight. {champ} lifted it. One day that stage hears MY name and the rest of this is just the road there.`,
    ],
    scholar: [
      `EVO finals: {champ}. Studied every round like scripture. The distance between here and that stage is measurable, and I intend to measure it.`,
    ],
    natural: [
      `EVO night at the arcade. {champ} won and the whole room screamed. Someday somebody screams like that for one of us.`,
    ],
    stoic: [
      `EVO happened. {champ} won it. The summit exists. Good to know what it looks like.`,
    ],
  },
  evoRun: {
    killer: [
      `EVO. Placed {place}. Every name that finished above mine is now a list, and I keep lists.`,
    ],
    scholar: [
      `EVO: {place}. The gap to the top eight has a shape now — I've seen it up close. It can be closed. That's the finding.`,
    ],
    natural: [
      `I played EVO. Actual EVO. Placed {place} and honestly walked off the stage shaking.`,
    ],
    stoic: [
      `EVO, {place}. The stage is just a stage. The players are not just players. Noted for next year.`,
    ],
  },
  eliteWin: {
    killer: [
      `I beat {opp}. WORLD-RANKED {opp}. Read it back. Read it again. Everything before tonight was practice.`,
    ],
    scholar: [
      `Defeated {opp} — a name off the world list. The gap is not a wall; it is a distance. Distances close.`,
    ],
    natural: [
      `I just beat {opp}. THE {opp}. My hands did that. I might frame this page.`,
    ],
    stoic: [
      `Beat {opp} tonight. World top sixty-four. It can be done. It was done. By me.`,
    ],
  },
  moneyWin: {
    any: [
      `Took the money match against {opp}. The bills matter less than the look on their face.`,
      `Money match, {opp}, settled. My pocket and my point both heavier.`,
    ],
  },
  moneyLoss: {
    any: [
      `Lost the money match to {opp}. Paying up in front of everyone is a specific kind of education.`,
      `{opp} took my money and my evening. One of those comes back.`,
    ],
  },

  // -------- career weather (the early warnings) --------
  slumpOpen: {
    killer: [
      `Five straight. FIVE. The room's starting to look at me differently and I don't blame them.`,
    ],
    scholar: [
      `Losing streak, statistically undeniable now. Cataloguing everything — food, sleep, warmups. Something changed and I will find it.`,
    ],
    natural: [
      `Can't buy a win lately. The game feels heavier than it used to. Weird how fast that happens.`,
    ],
    stoic: [
      `The slump is real. Naming it so it doesn't get to name me.`,
    ],
  },
  slumpClose: {
    killer: [
      `Slump's dead. Killed it myself. Whoever queues up next gets the version of me that remembers all of it.`,
    ],
    scholar: [
      `Streak broken; hypothesis confirmed — it was never the hands, it was the head. Documenting the fix for next time. There's always a next time.`,
    ],
    natural: [
      `Won again, then again. The game feels light. Whatever that was, it's over, and I'm not going to poke it.`,
    ],
    stoic: [
      `The slump ended the way it started: one day at a time.`,
    ],
  },
  passionLow: {
    killer: [
      `Caught myself not caring whether I won last night. That has never once been true in my life. It scared me more than any bracket.`,
    ],
    scholar: [
      `Observation, reluctantly logged: the game has started to feel like work. That variable predicts things I don't want predicted.`,
    ],
    natural: [
      `Skipped the arcade twice this week and didn't miss it. Writing that down because it doesn't sound like me at all.`,
    ],
    stoic: [
      `The fire is lower. I can feel the difference in my hands. Watching it honestly.`,
    ],
  },
  passionOut: {
    killer: [
      `Ran the numbers I never run: how many nights left in me. Fewer than I thought. If something doesn't change I'm done, and everyone will pretend they saw it coming.`,
    ],
    scholar: [
      `Near-terminal, if I'm honest with the data. The love is almost spent. Documenting it feels like writing my own obituary in advance.`,
    ],
    natural: [
      `I think I'm burning out for real. The tokens sit in my pocket all night. Somebody notice, please.`,
    ],
    stoic: [
      `Close to empty. If the game wants to keep me, it has about one good reason left to show me.`,
    ],
  },
  retire: {
    killer: [
      `Last entry. I never learned to lose and I'm not starting now — so I'm leaving before the game beats it into me. {days} nights. Every one of them a war. Worth it.`,
    ],
    scholar: [
      `Final entry, for completeness. {days} nights, {wins} wins, a body of work. The notebook closes but the notes were never really about the game.`,
    ],
    natural: [
      `Okay. Last one. {days} nights and I loved almost all of them, even the bad ones. Especially the bad ones, weirdly. Bye, room. Thanks for everything.`,
    ],
    stoic: [
      `Done. {days} nights. I gave what I had and kept nothing back. That's the whole entry. That's the whole career.`,
    ],
  },

  // -------- the road (REVISION §0 — money's new job) --------
  travelAsk: {
    killer: [
      `There's {event} coming up. I told the front counter I want in. If the answer's no, I want to hear somebody say it to my face.`,
    ],
    scholar: [
      `{event} is in reach. I put the request in with the cost worked out to the dollar. The math says send me.`,
    ],
    natural: [
      `Asked about getting sent to {event} today. Felt weird saying it out loud — like admitting I think I'm good.`,
    ],
    stoic: [
      `Asked to be sent to {event}. The asking is its own kind of match.`,
    ],
  },
  travelFunded: {
    killer: [
      `They're sending me to {event}. Somebody put real money on me. I intend to make that look like the easiest call they ever made.`,
    ],
    scholar: [
      `Funded: {event}. The arcade just made an investment with a name on it — mine. Time to study the field.`,
    ],
    natural: [
      `I'M GOING. {event}! Packed three days early like a kid before a school trip. No regrets.`,
    ],
    stoic: [
      `The trip to {event} is paid. Someone believes the work is real. Now it has to be.`,
    ],
  },
  travelDenied: {
    killer: [
      `No {event} for me. Money's tight — I've seen the register. Doesn't make the lock on that door feel any better.`,
    ],
    scholar: [
      `Request declined: {event}. The books are thin right now; the decision is defensible. The disappointment is data anyway.`,
    ],
    natural: [
      `Not going to {event}. The place can't swing it right now — I get it. Still went home early tonight.`,
    ],
    stoic: [
      `Not this time. The arcade can't carry the fare. Understood. Filed. Not forgotten.`,
    ],
  },
  travelDeniedFlush: {
    killer: [
      `They wouldn't send me to {place}. I've SEEN the register — the money's there. It just isn't for me. Fine. I'll remember exactly how this feels.`,
    ],
    scholar: [
      `Declined for {event}. Note: current cash on hand comfortably covers the cost — this was a choice, not a constraint. Updating some assumptions about my standing here.`,
    ],
    natural: [
      `The arcade's doing fine and I'm still not going to {place}. That one got under my skin and I can't laugh it off yet.`,
    ],
    stoic: [
      `The money was there. The answer was still no. I heard what was actually said.`,
    ],
  },
  awayPlaced: {
    killer: [
      `{event}: {place}. Walked into somebody else's room and took what I came for. Tell everyone.`,
    ],
    scholar: [
      `{event}: {place}. The field was better than home and the result held anyway — which answers the question I actually travelled to ask.`,
    ],
    natural: [
      `Went to {event} and {place}!! Slept the whole ride home with the bracket printout in my jacket.`,
    ],
    stoic: [
      `{event}. {place}. The road agrees with the work.`,
    ],
  },
  awayOut: {
    killer: [
      `{event}: {place}. The arcade paid for that. I flew all that way to find out what I'm not yet. I'll pay it back with interest.`,
    ],
    scholar: [
      `{event}: {place}. Expensive data — the gap between home form and road form is now measured, and it's mine to close.`,
    ],
    natural: [
      `So {event} happened. {place}. The ride home was very quiet and very long.`,
    ],
    stoic: [
      `{event}. {place}. The money is spent either way; the lesson only pays if I collect it.`,
    ],
  },

  // -------- the world --------
  patchNerf: {
    killer: [
      `They gutted {char}. MY {char}. Fine — I'll win with the corpse, and it'll be worse for everyone.`,
    ],
    scholar: [
      `Patch notes: {char} nerfed. Rebuilding the gameplan from first principles. There is always a line; my job is to find it first.`,
    ],
    natural: [
      `{char} caught a nerf. Poured one out at the counter. We ride at dawn anyway.`,
    ],
    stoic: [
      `{char} got worse on paper. Paper has been wrong about us before.`,
    ],
  },
  patchBuff: {
    killer: [
      `They buffed {char}. Whoever was ducking me before should think very carefully about their schedule now.`,
    ],
    scholar: [
      `{char} buffed — the notes read like a gift. Two weeks in the lab before anyone else understands what this actually enables.`,
    ],
    natural: [
      `{char} got BUFFED. Ran to the cab the second I read the notes. It's Christmas.`,
    ],
    stoic: [
      `{char} improved. The work stays the same.`,
    ],
  },
  innovation: {
    killer: [
      `Found something on {char} nobody's seen. It has a name now — "{tech}" — and everyone's going to learn it the hard way.`,
      `"{tech}". Mine. Discovered it, named it, and I'm keeping the best version for bracket.`,
    ],
    scholar: [
      `Discovery: "{tech}". Hours in the lab crystallised into four seconds of something new. This is the whole reason I play.`,
      `Logged a new technique tonight — "{tech}". The game is deeper than anyone playing it, which is the most reassuring thought I know.`,
    ],
    natural: [
      `Messing around after close and — wait. WAIT. That's not supposed to work. It works. Calling it "{tech}".`,
      `Found "{tech}" completely by accident. The good stuff always shows up when you stop looking for it.`,
    ],
    stoic: [
      `Found "{tech}" tonight. New things still exist. Good.`,
      `"{tech}". Discovered between closing time and common sense. Worth it.`,
    ],
  },
  teamLeft: {
    social: true,
    warm: [
      `Left {team}. Or it left me — hard to tell from inside a falling out. Either way there's an empty chair where my people used to be.`,
    ],
    gracious: [
      `Walked away from {team} today. I said my thank-yous and meant most of them. Some rooms you outgrow; some grow away from you.`,
    ],
    dramatic: [
      `DONE with {team}. Everyone will have a version of what happened. Only mine is true, and it's not for this page.`,
    ],
    puttogether: [
      `Resigned from {team}. Cleanly, on the record, effective immediately. The spreadsheet of my life just lost a tab.`,
    ],
  },
  belief: {
    killer: [
      `Something's different under the lights lately. The noise used to be pressure. Now it's fuel.`,
    ],
    scholar: [
      `Measurable change: the stage no longer costs me frames. Composure was theory; now it's muscle.`,
    ],
    natural: [
      `Realised mid-set I wasn't nervous. Cameras, crowd, everything — and my hands just played. When did that happen?`,
    ],
    stoic: [
      `The stage stopped being loud. Or I stopped hearing it. Either way: ready for bigger rooms.`,
    ],
  },

  // -------- social (voiced by the SOCIAL temperament) --------
  ruptureCaused: {
    social: true,
    warm: [
      `{opp} isn't speaking to me and it's my fault. I said the thing you can't unsay. I fix rooms — how did I break this one?`,
    ],
    gracious: [
      `I was rude to {opp}, properly rude, and no apology has covered it yet. Keeping this entry as the receipt.`,
    ],
    dramatic: [
      `Burned it down with {opp} tonight. Everyone watched. I'd take it back and I'd also say it again louder — both, somehow.`,
    ],
    puttogether: [
      `The {opp} situation is my doing. Filed under: handled badly. Remediation unclear.`,
    ],
  },
  ruptureAbsorbed: {
    social: true,
    warm: [
      `What {opp} said really got in. I keep replaying it at the counter. I know better than to water a thing like that, and I'm watering it anyway.`,
    ],
    gracious: [
      `Falling out with {opp}. I kept my manners; it didn't help. Some fights don't want de-escalating.`,
    ],
    dramatic: [
      `{opp} went for the throat and everyone heard it. Fine. FINE. The room will pick a side and I know which one picks me.`,
    ],
    puttogether: [
      `{opp} and I are done, apparently. Not my ledger, not my debt — but it sits with me anyway.`,
    ],
  },
  friend: {
    social: true,
    warm: [
      `{opp} and I closed the arcade down talking. Some people just fit. The scene got smaller and warmer tonight.`,
    ],
    gracious: [
      `Good sets, better company: {opp}. Ran it back all night and shook hands like it meant something. It did.`,
    ],
    dramatic: [
      `{opp} GETS it. Finally somebody at this arcade who understands what all of this is actually about.`,
    ],
    puttogether: [
      `{opp}: reliable, punctual, dangerous on the sticks. My favourite kind of person. Adding them to the roster of people I actually text back.`,
    ],
  },
  team: {
    social: true,
    warm: [
      `{team} is real now, and I'm in it. A name over our heads and everything. Teams are just friendship with stakes.`,
      `Wearing {team}'s tag tonight for the first time. It's three letters and it changes how the whole room says my name.`,
    ],
    gracious: [
      `Joined {team}. Someone believed my name belonged next to theirs. I intend to be worth the invitation.`,
      `{team} asked and I said yes before they finished the sentence. Manners later; this mattered.`,
    ],
    dramatic: [
      `{team}. Us against literally everyone. This is the beginning of something people will talk about.`,
      `I have COLOURS now. {team}'s. The story just got a faction.`,
    ],
    puttogether: [
      `Signed with {team}. Structure, schedule, standards. About time this scene got organised around me.`,
      `{team}: joined. Practice nights in the calendar, tag in the name field. Commitments suit me.`,
    ],
  },
  mentor: {
    social: true,
    warm: [
      `Started working with {opp}. Watching someone light up when a concept lands — that might be better than winning.`,
    ],
    gracious: [
      `Passing on what I know to {opp}. Somebody did this for me once and never asked for anything. Now I get it.`,
    ],
    dramatic: [
      `{opp} is MY student now. When they're famous, remember whose hands built the foundation.`,
    ],
    puttogether: [
      `Taking {opp} on. A curriculum, a schedule, expectations. They'll thank me by winning.`,
    ],
  },
  friendBanished: {
    social: true,
    warm: [
      `{opp} got banned today. My friend. I keep looking at the door like they might still walk through it. The room feels smaller and I feel complicit.`,
    ],
    gracious: [
      `{opp} was asked to leave for good. Maybe it was deserved. I shook their hand on the way out anyway — somebody had to.`,
    ],
    dramatic: [
      `They BANNED {opp}. Just like that — years of sets, gone with a word. Everyone's pretending it's fine. It is not fine.`,
    ],
    puttogether: [
      `{opp}: banned, effective today. Noted without comment. The comment would be unprofessional.`,
    ],
  },
  grudgeOpen: {
    social: true,
    warm: [
      `I don't hate people. I don't. But {opp} is testing the policy.`,
    ],
    gracious: [
      `{opp} and I have a real problem now. I'll keep it civil in the room. The bracket is another matter.`,
    ],
    dramatic: [
      `{opp}. Underline it, circle it, star it. This is a GRUDGE now, and I take grudges seriously.`,
    ],
    puttogether: [
      `Opening a file on {opp}. Every slight goes in it. The file gets closed one way: across the sticks.`,
    ],
  },
  rivalOpen: {
    killer: [
      `{opp} again. Every bracket, every time, closer than I'll say out loud. Fine. If the game insists on giving me a rival, I'll make it a famous one.`,
      `New name at the top of the list: {opp}. They think this is a rivalry. It's a countdown.`,
      `The room's already calling me-and-{opp} a thing. Good. I play better with someone to beat.`,
    ],
    scholar: [
      `The {opp} series has become its own subject. I keep a page just for them now. Iron sharpens iron — and I brought a whetstone.`,
      `{opp}'s habits are a curriculum and I have enrolled. The series will show who studies harder.`,
      `A rivalry, properly speaking: {opp}. Close elo, close sets, opposite conclusions from the same data.`,
    ],
    natural: [
      `Me and {opp} keep colliding like the bracket does it on purpose. Honestly? Best sets of my life. Don't tell them.`,
      `So {opp} is my rival now, per the entire arcade. Fine by me — I play up when somebody's watching me specifically.`,
      `There's a {opp}-shaped problem in my week now. Kind of love it.`,
    ],
    stoic: [
      `{opp} keeps showing up across from me. Good. A wall you can measure against is worth more than ten easy nights.`,
      `New rival: {opp}. I don't do drama. I do sets. We'll see whose holds.`,
      `{opp} and I are going to define each other for a while. Acceptable terms.`,
    ],
  },
}

// Exposed for the dev suite and journal.mjs: which kinds exist and how a
// player's voices resolve. Content tools read this so gaps are visible.
export const JOURNAL_KINDS = Object.keys(LINES)
export const journalVoiceOf = (player, kind) =>
  LINES[kind]?.social ? (player.socialTemperament || 'gracious') : (player.temperament || 'stoic')
export const COMP_VOICE_ROWS = COMP_ROWS
export const SOC_VOICE_ROWS = SOC_ROWS
