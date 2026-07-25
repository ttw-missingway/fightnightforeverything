// Layer-one dialogue: no AI, no API — every player has a VOICE derived from
// their stats (plus an editable quirk), and each dialogue moment draws from
// template pools filtered through that voice. The same player always sounds
// like themselves; two players never sound quite alike.
//
// Voice dimensions:
//   energy: chill | neutral | fiery       (how loud they run)
//   humor:  dry | earnest | clowning      (what their jokes look like)
//   speech: terse | plain | chatty        (how many words they spend)
//   quirk:  a signature flavor that overrides lines ~half the time

import { choice, chance } from './util.js'

// NOTE ON IMPORTS: this file must not import social.js. model.js imports
// dialogue.js (for deriveVoice) and social.js imports model.js, so reaching
// for getRel here would close the cycle. Relationships are read straight off
// the player instead — it's a one-line lookup either way.

export const VOICE_ENERGIES = ['chill', 'neutral', 'fiery']
export const VOICE_HUMORS = ['dry', 'earnest', 'clowning']
export const VOICE_SPEECHES = ['terse', 'plain', 'chatty']
export const VOICE_QUIRKS = [
  'none', 'third-person', 'anime', 'old-head', 'technical', 'humble', 'menace', 'philosopher', 'hypeman',
]

export const DEFAULT_VOICE = { energy: 'neutral', humor: 'dry', speech: 'plain', quirk: 'none' }

// Voice falls out of who the player already is. Stats first, dice second.
export function deriveVoice(p) {
  const per = p.personal
  const soc = p.social
  const energy = per.dominance + (per.mojo ?? 5) >= 13 ? 'fiery'
    : per.spark + (per.mojo ?? 5) <= 8 ? 'chill' : 'neutral'
  const humor = soc.persona >= 7 && soc.politeness <= 4 ? 'clowning'
    : soc.politeness >= 7 ? 'earnest' : 'dry'
  const speech = soc.charisma >= 7 ? 'chatty' : soc.charisma <= 3 ? 'terse' : 'plain'
  const options = ['none', 'none', 'none']
  if (soc.persona >= 8) options.push('third-person')
  if (per.analysis >= 7) options.push('technical')
  if (soc.politeness >= 7 && soc.sportsmanship >= 7) options.push('humble')
  if (soc.politeness <= 3) options.push('menace')
  if ((per.temperance ?? 5) >= 8) options.push('philosopher')
  if (soc.charisma >= 8) options.push('hypeman')
  options.push(chance(0.5) ? 'anime' : 'old-head')
  return { energy, humor, speech, quirk: choice(options) }
}

// Placeholders: {t} target/opponent, {m} move, {c} character, {mem} memory,
// {self} the speaker's own name (third-person quirk lives on this).
const LINES = {
  joke: {
    dimension: 'humor',
    pools: {
      clowning: [
        "Yo {t}, your wakeup game is a public service announcement for blocking.",
        "I've seen the level one CPU throw better fireballs than {t}. Level ONE.",
        "{t} plays the character select screen better than the character.",
        "{t}'s gamer tag should legally include a spoiler warning.",
      ],
      dry: [
        "{t}, I counted. Eleven jumps, eleven anti-airs. Just checking you know they're related.",
        "{t} plays defense like a door left open.",
        "Statistically, {t}, one of those gambles had to work. It didn't.",
        "Bold of {t} to keep pressing that button. Braver than me.",
      ],
      earnest: [
        "Okay but {t}'s face when that combo dropped — I can't, I'm sorry.",
        "{t}, I say this with love: what WAS that input.",
        "We've all been {t} today at least once. Be honest, everyone.",
      ],
    },
    tiers: {
      stranger: [
        "Not being funny, {t}, but that last one looked rough.",
        "{t} — that input did not go in. I saw it from here.",
        "Sorry, is that on purpose? The jumping? Genuinely asking.",
      ],
      close: [
        "{t} has been playing this game for years and still blocks like a lawn chair.",
        "I've watched {t} lose that exact way since before either of us had jobs.",
        "{t}, my friend, my brother — that was the worst thing I've ever seen.",
        "Somebody check on {t}. Not because of the loss. Just generally.",
      ],
      hostile: [
        "{t} plays like they've got somewhere better to be. Wish they'd go.",
        "I'd explain {t}'s mistake but I don't think they'd follow.",
        "Nobody's impressed, {t}. Nobody has ever been impressed.",
      ],
    },
  },
  jokeLanded: {
    dimension: null,
    pools: {
      any: [
        "Okay. That one's earned.",
        "I walked into that. Fine. FINE.",
        "Put it on my tombstone, whatever.",
        "Ha! Fair.",
        "I'd be mad if it wasn't true.",
      ],
    },
  },
  jokeBombed: {
    dimension: null,
    pools: {
      any: [
        "...Good one.",
        "Say it again. Slower. I dare you.",
        "Cool. Real cool crowd tonight.",
        "I'm literally standing right here.",
        "Wow. Okay. Noted.",
      ],
    },
  },
  trashTalk: {
    dimension: 'energy',
    pools: {
      fiery: [
        "Run it. Right now. Bring your whole team, {t}.",
        "{t}, I OWN that matchup and you know it.",
        "Say less. Cabinet. Now.",
      ],
      neutral: [
        "I'm just saying, {t} — the bracket doesn't lie.",
        "Careful, {t}. I lab on weekends now.",
      ],
      chill: [
        "No rush, {t}. The runback will be just as embarrassing tomorrow.",
        "It's okay, {t}. Some people peak early.",
      ],
    },
    tiers: {
      stranger: [
        "I'll give you a game if you want one, {t}. No money on it.",
        "Happy to run some sets, {t}. See where we're both at.",
      ],
      close: [
        "{t}. Cabinet. Now. Same as every week and you'll lose the same way.",
        "You're not beating me today, {t}, and we both already know it.",
        "I've had a WEEK, {t}, and I'm taking all of it out on you.",
      ],
      hostile: [
        "Put your money where your mouth is, {t}. If you can find it.",
        "I don't want a friendly. I want the set, and I want people watching.",
      ],
    },
  },
  compliment: {
    dimension: null,
    pools: {
      any: [
        "Your {c} has genuinely leveled up, {t}.",
        "That patience is new, {t}. It's working.",
        "You've stopped panicking on wakeup, {t}. Respect.",
        "Whatever you changed in your practice, {t} — keep it.",
      ],
    },
  },
  winGlow: {
    dimension: 'energy',
    pools: {
      fiery: [
        "Nobody beat me today. NOBODY. I want that in the group chat.",
        "The hands were ON tonight. Somebody check them for batteries.",
      ],
      neutral: [
        "Everything I labbed just... worked today. Best feeling there is.",
        "Good day. The reads were landing before they even moved.",
      ],
      chill: [
        "Quietly? Went undefeated today. But quietly.",
        "Decent day at the office.",
      ],
    },
  },
  saltyLoss: {
    dimension: null,
    pools: {
      any: [
        "I don't want to talk about it.",
        "One pixel. ONE. PIXEL.",
        "The buttons ate my inputs. I swear on everything.",
        "I'm fine. It's fine. The set was rigged but I'm fine.",
        "Don't. Just... don't.",
      ],
    },
  },
  memoryRetell: {
    dimension: null,
    pools: {
      any: [
        "You all remember {mem}? Because I sure do.",
        "This is just like {mem}. I keep telling y'all.",
        "Every time I stand in this spot I think about {mem}.",
        "Anyway — {mem}. I'll never be over it, and neither should you.",
      ],
    },
  },
  watcherHype: {
    dimension: null,
    pools: {
      any: [
        "THE {m}!! Did everybody see the {m}?!",
        "{t} is not human right now.",
        "Clip it. Somebody clip that.",
        "That's the cleanest thing I've seen in this building all week.",
      ],
    },
  },
  watcherWince: {
    dimension: null,
    pools: {
      any: [
        "Oof. {t} is crumbling.",
        "I can't watch this part.",
        "Somebody get {t} some water.",
        "This is hard to look at and I can't look away.",
      ],
    },
  },
  ggWin: {
    dimension: 'energy',
    pools: {
      fiery: [
        "AND THAT'S THE SET. Who's next?!",
        "Too easy. Same time tomorrow, {t}?",
      ],
      neutral: [
        "Good set, {t}. That last game was scary.",
        "GGs. You almost had me in the middle there.",
      ],
      chill: [
        "ggs. run it back whenever.",
        "Good games, {t}. That was fun.",
      ],
    },
    tiers: {
      stranger: [
        "Good games. {t}, was it? Nice sets.",
        "GGs — thanks for the games. You'll get me next time.",
      ],
      close: [
        "GGs. Now go home and think about what you've done.",
        "Same time next week, {t}, and I'll do it again.",
        "That's the one I needed. You've been beating me for a month.",
      ],
      hostile: [
        "GGs. *does not offer the handshake*",
        "That's the set. Nothing else to say.",
      ],
    },
  },
  ggLossGood: {
    dimension: null,
    pools: {
      any: [
        "GGs, {t}. That mid-set adjustment was clean — teach me that.",
        "You got me. Fair and square.",
        "GGs. I'm getting you next week though.",
        "Well played. I felt every one of those reads.",
      ],
    },
  },
  ggLossBad: {
    dimension: null,
    pools: {
      any: [
        "Whatever. Lag.",
        "That character is free. That's all that was.",
        "Don't celebrate too hard, {t}.",
        "*leaves without the handshake*",
      ],
    },
  },
  mmPre: {
    dimension: 'energy',
    pools: {
      fiery: [
        "All the talk ends right here, {t}.",
        "The whole arcade's watching, {t}. Don't blink.",
      ],
      neutral: [
        "After tonight there's nothing left to argue about.",
        "Let's settle it properly, {t}.",
      ],
      chill: [
        "No speeches. Let's just play, {t}.",
        "Hope you warmed up, {t}.",
      ],
    },
  },
  // The first words two people ever exchange. Fires once, on first meeting,
  // and it's the clearest proof the room remembers who knows who.
  intro: {
    dimension: 'energy',
    pools: {
      fiery: [
        "I'm {self}. You play? Because I play.",
        "{self}. Haven't seen you in here — put your name down, let's go.",
        "New face! {self}. Whose cabinet are we taking?",
      ],
      neutral: [
        "Hey — {self}. Don't think we've met.",
        "{self}. You're new, right? Welcome to the best room in town.",
        "I'm {self}. Grab a stick, nobody bites. Mostly.",
      ],
      chill: [
        "...{self}. Hey.",
        "{self}. You're new. It's alright here.",
        "Hey. {self}. Sit wherever.",
      ],
    },
  },
  // Saying hello to somebody you already know — entirely about how well.
  greet: {
    dimension: null,
    pools: { any: ['Hey.', 'Alright?', "You're here."] },
    tiers: {
      acquaintance: [
        "Hey — {t}, right?",
        "Alright {t}. Good to see you again.",
        "{t}. You were here last week too, yeah?",
      ],
      familiar: [
        "{t}! You made it.",
        "There he is. Alright {t}.",
        "{t}, come here, I want to show you something.",
      ],
      close: [
        "Oh thank god, {t}'s here. I was going to have to talk to strangers.",
        "{t}!! Where have you BEEN.",
        "There's my favourite problem. Alright {t}.",
        "{t}. Sit down. I've been thinking about our set all week.",
      ],
      hostile: [
        "{t}.",
        "Oh. You're here.",
        "*sees {t}, picks a different cabinet*",
      ],
    },
  },
  // The shared record, said out loud. What people who've played each other a
  // hundred times actually talk about.
  callback: {
    dimension: null,
    pools: { any: ["We've done this before, {t}."] },
    tiers: {
      familiar: [
        "{n} sets, {t}. I'm {w}–{l} up and I'm not letting you forget it.",
        "That's {n} games between us now. Neither of us has learned anything.",
        "{t} and me are {w}–{l} lifetime. Every single one of them close.",
      ],
      close: [
        "{w}–{l}, {t}. I could play you in my sleep and I'd still lose the ones that matter.",
        "{n} sets deep and you STILL do that on wakeup. Every time.",
        "Me and {t} have played {n} times. I know what they had for breakfast.",
        "{w}–{l}. And every single one of those {l} losses is a personal insult.",
      ],
      hostile: [
        "{w}–{l}. Look it up.",
        "I'm {w}–{l} against {t}. That's the whole conversation.",
        "{n} games. {l} of them I'd like back.",
      ],
    },
  },
  // A conviction, said out loud. {x} is whatever they've got an opinion about
  // — a character, this arcade, another player. The stance decides the pool,
  // because "broken" and "beloved" are not the same sentence.
  takeBroken: {
    dimension: null,
    pools: {
      any: [
        "{x} is broken and I'm tired of pretending otherwise.",
        "Whoever signed off on {x} has never played this game.",
        "I'll say it again: {x} is not balanced. Not close.",
        "Every single time I lose it's to {x}. Every time. Draw your own conclusions.",
        "{x} does not belong in this game and everybody here knows it.",
      ],
    },
  },
  takeWeak: {
    dimension: null,
    pools: {
      any: [
        "Nobody plays {x} because {x} does not work. Simple as that.",
        "{x} needs help. Genuinely, someone give {x} something.",
        "I'd main {x} in a heartbeat if {x} had a single winning matchup.",
      ],
    },
  },
  takeOverrated: {
    dimension: null,
    pools: {
      any: [
        "{x} is not as good as everyone says. It's the players, not the character.",
        "Everybody's scared of {x} and I genuinely don't see it.",
        "{x} is carried by reputation at this point.",
      ],
    },
  },
  takeUnderrated: {
    dimension: null,
    pools: {
      any: [
        "{x} is the most slept-on thing in this game and I hope it stays that way.",
        "One day somebody's going to figure out {x} and it'll be too late for the rest of you.",
        "You all keep ignoring {x}. Keep doing that.",
      ],
    },
  },
  takeBoring: {
    dimension: null,
    pools: {
      any: [
        "{x} is effective and {x} is boring and both things are true.",
        "Watching {x} is like watching someone do their taxes correctly.",
        "No shade, but {x} has never once made me sit forward.",
      ],
    },
  },
  takeBeloved: {
    dimension: null,
    pools: {
      any: [
        "{x} is the reason I still come here. I'll hear nothing against {x}.",
        "Say what you like — {x} is perfect and I love {x}.",
        "I've been on {x} since day one and I'm not moving.",
      ],
    },
  },
  takeArcade: {
    dimension: null,
    pools: {
      any: [
        "This place is home. I don't care what it costs.",
        "Best room in town and it isn't close.",
        "The prices in here are a joke and somebody should say so.",
        "Somebody clean this place. I'm serious. Somebody.",
      ],
    },
  },
  takePlayer: {
    dimension: null,
    pools: {
      any: [
        "{x} is the best player in this building. It's not up for debate.",
        "Everyone rates {x}. I've beaten {x}. Draw your own conclusions.",
        "If {x} enters, {x} wins. That's just the situation.",
      ],
    },
  },
  takeFood: {
    dimension: null,
    pools: {
      any: [
        "The {x} here is the only thing keeping me alive.",
        "I have eaten {x} every single day for a year and I'd do it again.",
      ],
    },
  },
  // Small talk at the counter — the game falls away for a second and people
  // are just people. This is what keeps the cast from reading as stat blocks.
  lifeChat: {
    dimension: 'humor',
    pools: {
      dry: [
        "Slept four hours. Gonna play like it too.",
        "My coworkers think 'labbing' is a personality disorder. They're not wrong.",
        "Rent went up again. Anyway. Who's got next.",
        "I'm told there's a world outside this building. Sounds fake.",
        "Ordered the same thing here for three years. Don't fix what works.",
      ],
      earnest: [
        "Honestly? Best part of my whole week is walking through that door.",
        "My sister asked what I do here. I said 'family.' She hung up.",
        "Got the promotion, by the way. Still can't beat you though, so.",
        "I brought snacks for everybody. No reason. Just felt like it.",
        "Whatever kind of week you're having — glad you're here. I mean it.",
      ],
      clowning: [
        "I told my date I was 'in esports.' She left. Worth it.",
        "New goal: get sponsored so my mom stops asking about a real job.",
        "Dreamt about my blockstrings again. I need help. I need next, actually.",
        "Put me on the arcade lease. I basically live here.",
        "My plant died because I was here. I named it after {t}. RIP.",
      ],
    },
  },
}

// A quirk hijacks the line about half the time. This is where a voice
// becomes THEIRS.
const QUIRK_LINES = {
  'third-person': {
    trashTalk: ["{self} doesn't lose twice, {t}.", "{self} called it. {self} always calls it."],
    ggWin: ["{self} remains undefeated in matches that matter.", "You witnessed {self}. Tell the others."],
    winGlow: ["{self} was unstoppable today and {self} is being humble about it."],
    mmPre: ["{self} has been waiting for this, {t}."],
  },
  'anime': {
    joke: ["{t}, you're the filler episode of this arcade.", "This isn't even {t}'s final form. Sadly, it's also not a good form."],
    trashTalk: ["You've activated my trap card, {t}.", "This is my training arc, {t}, and you're the first boss."],
    watcherHype: ["IT'S JUST LIKE THE TOURNAMENT ARC!!", "He's powering up. {t} is literally powering up."],
    ggWin: ["It was a good battle, {t}. You may yet unlock your potential."],
  },
  'old-head': {
    joke: ["Kids today mash three buttons and call it pressure. {t} calls it a gameplan.",],
    trashTalk: ["Back in my day we punished that on REACTION, {t}.", "I was doing this before the game told you the frame data, {t}."],
    ggWin: ["Experience, baby. There's no patch for it."],
    watcherHype: ["THAT'S the old-school way. Beautiful."],
    lifeChat: ["Arcades like this used to be on every corner. We're the last of something, you know.", "My back's a tier list of injuries and it's all top tier. Anyway."],
  },
  'technical': {
    joke: ["{t}'s blockstrings have more holes than a training-mode dummy."],
    trashTalk: ["Your gaps are six frames wide, {t}. I measured.", "I know your habits better than you do, {t}. I have notes."],
    watcherHype: ["That was a frame trap. TEXTBOOK frame trap.", "See how they banked the meter there? That's the whole game."],
    ggLossGood: ["GGs. I know exactly which three interactions I lost that in."],
  },
  'humble': {
    ggWin: ["Honestly, {t}, that could've gone either way.", "I got lucky in the last game. Really."],
    winGlow: ["I hit some things today. Felt nice."],
    trashTalk: ["I mean... the set count does kind of speak for itself, {t}. Sorry."],
  },
  'menace': {
    trashTalk: ["I've already beaten you tonight, {t}. In here. *taps temple*"],
    mmPre: ["I'm going to take my time with this one.", "I picked this date for a reason, {t}."],
    ggWin: ["Exactly as I pictured it."],
    joke: ["{t}, I'd explain what you did wrong, but I like watching you do it."],
  },
  'philosopher': {
    saltyLoss: ["Losing is tuition.", "The set was the lesson. The loss was the fee."],
    ggLossGood: ["A worthy defeat. I'll sit with it."],
    winGlow: ["Winning teaches nothing. Fortunately, I learn nothing gladly."],
    watcherWince: ["Every collapse contains its own instruction."],
    lifeChat: ["We come here to lose in a place where losing costs nothing real. Think about that.", "A day outside this room is just a longer wait for the next set."],
  },
  'hypeman': {
    watcherHype: ["YOOOOOO!!", "THE ARCADE IS ON FIRE TONIGHT!!", "I'M TELLING EVERYBODY ABOUT THIS!"],
    ggWin: ["LET'S GOOOOO!", "THAT'S what we practice for!!"],
    jokeLanded: ["AHAHAHA no because it's TRUE—"],
    winGlow: ["Somebody stream ME next, I was COOKING today."],
    lifeChat: ["EVERYBODY good?? Everybody eat?? Good. Let's have the BEST night!", "I love this room. I LOVE this room. Somebody had to say it."],
  },
}

// ---------- Who are we talking to? ----------
// People don't speak to a stranger the way they speak to someone they've
// played a hundred sets against. Everything downstream — which lines are even
// allowed, how much hedging goes on the front, whether a name gets used —
// hangs off this.

export const FAMILIARITY_TIERS = ['stranger', 'acquaintance', 'familiar', 'close', 'hostile']

/**
 * How well `a` knows `b`, from the record they've already built: games played,
 * how they feel about each other, and how many times they've actually spoken.
 */
export function familiarity(a, b) {
  if (!a || !b || a.id === b.id) return 'familiar'
  const rel = a.relationships?.[b.id] || 0
  const h = a.h2h?.[b.id]
  const games = h ? (h.w || 0) + (h.l || 0) : 0
  const spoken = a.met?.[b.id]?.count || 0
  // Bad blood overrides everything: you can know someone very well and still
  // talk to them like an enemy.
  if (rel <= -45) return 'hostile'
  // Thresholds set from a measured 120-day scene rather than guessed: contact
  // per pair runs min 0 / median 2 / p75 4 / p90 7 / max 20, because
  // matchmaking spreads a roster of thirty people thin. The first pass used
  // 2/8/24 and left 88% of the room stuck on "acquaintance" with nobody ever
  // reaching "close".
  const contact = games + spoken
  if (contact >= 9 || rel >= 45) return 'close'
  if (contact >= 4 || rel >= 20) return 'familiar'
  if (contact >= 1 || rel !== 0) return 'acquaintance'
  return 'stranger'
}

/** Record that these two actually spoke. Cheap, and it feeds familiarity. */
export function noteMeeting(a, b, absDay = 0) {
  if (!a || !b || a.id === b.id) return
  if (!a.met) a.met = {}
  const prior = a.met[b.id]
  if (prior) prior.count++
  else a.met[b.id] = { firstDay: absDay, count: 1 }
}

/** True the first time these two have ever exchanged a word. */
export function isFirstMeeting(a, b) {
  if (!a || !b || a.id === b.id) return false
  if (a.met?.[b.id]) return false
  const h = a.h2h?.[b.id]
  return !((h ? (h.w || 0) + (h.l || 0) : 0) > 0)
}

// ---------- Not saying the same thing twice ----------
// Templates are identified by hashing them BEFORE substitution, so the same
// sentence about two different opponents still counts as a repeat. No content
// refactor needed — the pools stay plain strings.

const SAID_RING = 14 // per person
const ROOM_RING = 26 // and the room as a whole

function lineId(template) {
  let h = 5381
  for (let i = 0; i < template.length; i++) h = ((h * 33) ^ template.charCodeAt(i)) >>> 0
  return h.toString(36)
}

// The arcade's short-term memory. Not persisted: it only has to stop everyone
// saying the same thing within one stretch of simulation.
const roomRecent = []

function rememberLine(player, id) {
  if (!player.said) player.said = []
  player.said.push(id)
  while (player.said.length > SAID_RING) player.said.shift()
  roomRecent.push(id)
  while (roomRecent.length > ROOM_RING) roomRecent.shift()
}

// ---------- The render pipeline ----------
// This is the variety multiplier. One template becomes many different voices
// without writing a single new line: a tic on the front, a casing habit, a
// hedge for someone you've just met, a nickname for someone you haven't.

const TICS = {
  fiery: ['Yo—', 'Nah,', 'Listen—', 'Bro,'],
  neutral: ['Look,', 'Okay so,', 'I mean,'],
  chill: ['I mean,', 'Honestly,', 'Eh—'],
}

// What you say to somebody you barely know before you say the actual thing.
const HEDGES = [
  'No offence,', 'Sorry—', "Don't take this the wrong way, but", 'Genuinely,',
]

// ...and the tag you put on the end for someone you know far too well.
const CLOSE_TAGS = [', man.', ', dude.', ' lol.', ", I'm serious."]
const HOSTILE_TAGS = [' Whatever.', ' Yeah.', ' Sure.']

/**
 * Lowercase the opening letter — but never when the sentence starts with
 * somebody's name or "I". Blindly decapitalising turned "P91 plays defense"
 * into "p91 plays defense", which reads like a typo rather than a voice.
 */
function decap(line, names) {
  const first = line.split(/[\s,.!?]/)[0]
  // "I", and every contraction of it — the apostrophe isn't a split point, so
  // a bare `first === 'I'` check let "I'm" through and produced "i'm".
  if (/^I(['\u2019]|$)/.test(first)) return line
  if (names.some((n) => n && first === n.split(/\s/)[0])) return line
  if (/^[A-Z][a-z]*[A-Z]/.test(first)) return line // CamelCase gamertags
  return line.charAt(0).toLowerCase() + line.slice(1)
}

function applyVoice(line, v, tier, names = []) {
  let out = line

  // A signature filler. Same person, same tic — that's what makes it theirs.
  if (chance(0.18)) {
    const pool = TICS[v.energy] || TICS.neutral
    out = `${choice(pool)} ${decap(out, names)}`
  }

  // Talking to someone you've just met takes the edge off.
  if (tier === 'stranger' && chance(0.35)) {
    out = `${choice(HEDGES)} ${decap(out, names)}`
  } else if (tier === 'close' && chance(0.25) && /[.!?]$/.test(out)) {
    out = out.replace(/[.!?]$/, choice(CLOSE_TAGS))
  } else if (tier === 'hostile' && chance(0.25)) {
    out += choice(HOSTILE_TAGS)
  }

  // Casing habits. Loud people get loud; quiet people don't bother with caps.
  if (v.energy === 'fiery' && out.length < 46 && chance(0.14)) out = out.toUpperCase()
  else if (v.energy === 'chill' && chance(0.14)) out = decap(out, names)

  // Politeness reads as not contracting. Used sparingly — it's stiff on purpose.
  if (v.humor === 'earnest' && tier === 'stranger' && chance(0.3)) {
    out = out.replace(/\bdon't\b/g, 'do not').replace(/\bcan't\b/g, 'cannot')
      .replace(/\bI'm\b/g, 'I am').replace(/\bit's\b/g, 'it is')
  }
  return out
}

// A joke that crosses the line needs a licence: either you know them well
// enough to get away with it, or you're the sort who doesn't care.
//
// Deliberately a PROBABILITY, not a ban. Refusing outright meant a dry-voiced
// regular never once joked with someone new, which didn't soften the
// interaction — it deleted it, and the whole beat went silent.
function allowedByTier(kind, tier, v) {
  if (kind !== 'joke' && kind !== 'trashTalk') return true
  if (tier === 'close' || tier === 'hostile') return true
  if (v.quirk === 'menace' || v.humor === 'clowning') return true
  if (tier === 'stranger') return chance(kind === 'trashTalk' ? 0.3 : 0.55)
  if (tier === 'acquaintance') return chance(kind === 'trashTalk' ? 0.7 : 0.9)
  return true
}

/**
 * The single entry point: a player says something appropriate to the moment,
 * in their own voice, to whoever is listening. Returns null when no line fits.
 *
 * ctx: {
 *   t: other's display name, to: the other PLAYER (unlocks familiarity),
 *   m: move, c: character, mem: memory text, self: own name, absDay
 * }
 */
export function speak(player, kind, ctx = {}) {
  const v = player.voice || DEFAULT_VOICE
  const spec = LINES[kind]
  if (!spec) return null
  const listener = ctx.to || null
  const tier = listener ? familiarity(player, listener) : 'familiar'
  if (!allowedByTier(kind, tier, v)) return null

  // Talking to someone new, a joke reaches for the gentlest register the
  // pools have rather than whatever this voice would normally pick.
  const softening = tier === 'stranger' && kind === 'joke' && spec.pools.earnest && chance(0.6)
  const dimVal = softening ? 'earnest' : (spec.dimension ? v[spec.dimension] : 'any')
  let candidates = [...(spec.pools[dimVal] || []), ...(spec.pools.any || [])]

  // A pool written FOR this relationship outranks the voice's usual register
  // most of the time — this is where the difference between a stranger and
  // somebody you've played two hundred sets with actually lives. Not always,
  // so the voice still colours who they are.
  const tierPool = spec.tiers?.[tier]
  if (tierPool?.length && chance(0.62)) candidates = tierPool

  const quirkPool = QUIRK_LINES[v.quirk]?.[kind]
  if (quirkPool && chance(0.5)) candidates = quirkPool
  if (!candidates.length) return null

  // Drop anything this person (or the room) has said lately. If that empties
  // the pool, fall back rather than going silent.
  const stale = new Set([...(player.said || []), ...roomRecent])
  const fresh = candidates.filter((c) => !stale.has(lineId(c)))
  const pool = fresh.length ? fresh : candidates

  // Speech length: terse players find the short version, chatty ones commit.
  const picks = [choice(pool), choice(pool), choice(pool)]
  const template = v.speech === 'terse' ? picks.reduce((a, b) => (a.length <= b.length ? a : b))
    : v.speech === 'chatty' ? picks.reduce((a, b) => (a.length >= b.length ? a : b))
    : picks[0]

  rememberLine(player, lineId(template))
  if (listener) noteMeeting(player, listener, ctx.absDay ?? 0)

  const filled = template
    .replaceAll('{t}', ctx.t ?? 'you')
    .replaceAll('{m}', ctx.m ?? 'that')
    .replaceAll('{c}', ctx.c ?? 'your character')
    .replaceAll('{mem}', ctx.mem ?? 'that one time')
    .replaceAll('{self}', ctx.self ?? 'they')
    .replaceAll('{w}', ctx.w ?? '0')
    .replaceAll('{l}', ctx.l ?? '0')
    .replaceAll('{n}', ctx.n ?? '0')
    .replaceAll('{x}', ctx.x ?? 'that')
  return applyVoice(filled, v, tier, [ctx.t, ctx.self])
}

export function voiceSummary(voice) {
  if (!voice) return 'plain'
  const bits = [voice.energy, voice.humor, voice.speech]
  if (voice.quirk && voice.quirk !== 'none') bits.push(`quirk: ${voice.quirk}`)
  return bits.join(' · ')
}
