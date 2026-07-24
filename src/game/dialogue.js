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

/**
 * The single entry point: a player says something appropriate to the moment,
 * in their own voice. Returns null when no line fits.
 * ctx: {t: other name, m: move, c: character, mem: memory text, self: own name}
 */
export function speak(player, kind, ctx = {}) {
  const v = player.voice || DEFAULT_VOICE
  const spec = LINES[kind]
  if (!spec) return null
  const dimVal = spec.dimension ? v[spec.dimension] : 'any'
  let candidates = [...(spec.pools[dimVal] || []), ...(spec.pools.any || [])]
  const quirkPool = QUIRK_LINES[v.quirk]?.[kind]
  if (quirkPool && chance(0.5)) candidates = quirkPool
  if (!candidates.length) return null
  // Speech length: terse players find the short version, chatty ones commit.
  const picks = [choice(candidates), choice(candidates), choice(candidates)]
  let line = v.speech === 'terse' ? picks.reduce((a, b) => (a.length <= b.length ? a : b))
    : v.speech === 'chatty' ? picks.reduce((a, b) => (a.length >= b.length ? a : b))
    : picks[0]
  return line
    .replaceAll('{t}', ctx.t ?? 'you')
    .replaceAll('{m}', ctx.m ?? 'that')
    .replaceAll('{c}', ctx.c ?? 'your character')
    .replaceAll('{mem}', ctx.mem ?? 'that one time')
    .replaceAll('{self}', ctx.self ?? 'they')
}

export function voiceSummary(voice) {
  if (!voice) return 'plain'
  const bits = [voice.energy, voice.humor, voice.speech]
  if (voice.quirk && voice.quirk !== 'none') bits.push(`quirk: ${voice.quirk}`)
  return bits.join(' · ')
}
