// The authoring spec for generated dialogue.
//
// This file is the SOURCE OF TRUTH for the corpus. `generate.mjs` reads it,
// asks Claude for lines per bucket, validates them, and writes JSON that
// dialogue.js loads. Nothing here ships to the browser.
//
// A bucket is one (kind × pool) pair — e.g. trashTalk/fiery, trashTalk/close.
// Every bucket is generated independently, so a kind that reads badly can be
// regenerated alone for a few cents rather than redoing the whole corpus.

// ---------- Shared context: what the model needs to know every time ----------
// This block is identical across every request, which is the point — it sits
// at the front of the prompt and is cached, so only the per-bucket tail is
// billed at full rate after the first call.

export const GAME_CONTEXT = `
You are writing dialogue for FIGHT NIGHT, a simulation game about running a
fighting-game arcade. The player designs a fighting game and an arcade; the
game then simulates a community of regulars who show up, play sets, form
rivalries and friendships, argue about balance, burn out, and retire.

The dialogue you write is what those regulars SAY to each other on the floor.
It appears in the game as a single quoted line attributed to one person:

    💬 LabMonster: "Rent went up again. Anyway. Who's got next."

These are not professional esports players. They are adults with jobs who are
serious about a video game in a small room with sticky floors. The register is
specific: dry, lived-in, unglamorous, funny in a way that comes from familiarity
rather than from telling jokes. Nobody is performing for an audience.
`.trim()

// Each player has a VOICE derived from their stats. These definitions are what
// make two characters sound different, so they have to be concrete rather than
// adjectives — "fiery" as a mood produces the same line as "neutral" with an
// exclamation mark, which is not a different voice.
export const VOICE_DIMENSIONS = {
  energy: {
    fiery: 'Runs hot. Direct, propulsive, wants it NOW. Short imperatives. Will escalate. Not cruel, just loud and immediate.',
    neutral: 'Even-keeled. Says the thing without heat or hedging. The most conversational register — most people are here.',
    chill: 'Low-amplitude. Understated, unbothered, often funnier for being quiet. Trails off. Uses fewer words than the moment calls for.',
  },
  humor: {
    dry: 'Deadpan. Understatement, flat delivery, the joke is that it is not delivered as a joke. Never signposts the punchline.',
    earnest: 'Sincere without irony. Warm, means what it says, occasionally sentimental about the room and the people in it. Not saccharine.',
    clowning: 'Openly going for the bit. Self-deprecating as often as not. Commits hard to a stupid premise.',
  },
}

// How well the speaker knows the person they are talking to. Where a kind has
// tier pools, they OUTRANK the voice pools most of the time — the difference
// between a stranger and someone you have played two hundred sets with is the
// single biggest thing shaping what you would actually say.
export const TIERS = {
  stranger: "They have barely spoken. Polite, a little careful, no shared history to draw on. Nobody is rude to a stranger here.",
  acquaintance: 'They know each other by name and have played a bit. Friendly but not familiar. Small talk range.',
  familiar: 'Regulars around each other. Comfortable, casual, some shared references.',
  close: 'Genuinely close — years of sets, inside jokes, they would notice if the other stopped showing up. Can be brutal precisely because the affection is not in question.',
  hostile: 'Real bad blood. Cold rather than loud. Avoids, dismisses, withholds. Never cartoonishly villainous.',
}

// The placeholder vocabulary. A line may ONLY use placeholders listed for its
// kind — the validator rejects anything else, because an undefined placeholder
// renders as "that" and reads like a bug.
export const PLACEHOLDERS = {
  t: "the person being spoken to (a player's name or gamer tag)",
  self: "the speaker's own name",
  x: 'a subject under discussion — a character name, a food, a player',
  m: 'a move name',
  c: 'a fighting-game character name',
  n: 'a number supplied by the situation',
  w: 'a win count',
  l: 'a loss count',
  mem: 'a remembered past event',
}

// What NOT to do. Every item here is a failure mode observed in generated
// dialogue, and each one is the difference between a line that sounds like a
// person and a line that sounds like a language model doing an impression.
export const ANTI_PATTERNS = `
- Do NOT start lines with "Look,", "Listen,", "Honestly,", "I'm not gonna lie",
  or any other throat-clearing opener. Start on the actual content.
- Do NOT explain or land on the joke. If a line is funny it should be funny in
  passing, on the way to something else.
- Do NOT make every line the same length or shape. Real speech is lumpy: some
  lines are two words, some run a full sentence and a half. Vary it hard.
- Do NOT begin most lines with {t}. Vary where the name falls, and leave it out
  entirely wherever the line still reads.
- Do NOT use em dashes more than very occasionally. They are a tell.
- Do NOT reference the speaker's or listener's gender, or use he/she for {t}.
  {t} is any player of any gender. Use their name or "they".
- Do NOT write influencer/streamer voice ("lowkey", "no cap", "it's giving") or
  corporate-cheerful voice. These are people in a room, not content.
- Do NOT use stage directions (*asterisk actions*). One or two exist in the
  hand-written corpus; that is the whole budget.
- Do NOT repeat a joke shape within a bucket. If one line is "X is a public
  service announcement for Y", no other line uses that construction.
- Do NOT write anything that assumes a specific fighting game, real-world title,
  character, or esports personality. The game is one the player invented.
`.trim()

// ---------- The kinds ----------
// `seed` lines are the hand-written originals. They are the quality bar, they
// are shown to the model as the target register, and they STAY in the shipped
// corpus — they are the best lines in the game.

export const KINDS = [
  {
    kind: 'trashTalk',
    when: 'Challenging someone to a set, or needling them about one. Competitive but fundamentally social — this is how people here express that they like playing against each other.',
    dimension: 'energy',
    placeholders: ['t', 'self'],
    count: 10,
    pools: {
      fiery: [
        'Run it. Right now. Bring your whole team, {t}.',
        '{t}, I OWN that matchup and you know it.',
        'Say less. Cabinet. Now.',
      ],
      neutral: [
        "I'm just saying, {t} — the bracket doesn't lie.",
        '{t}. Careful. I lab on weekends now.',
      ],
      chill: [
        'No rush, {t}. The runback will be just as embarrassing tomorrow.',
        "It's okay, {t}. Some people peak early.",
      ],
    },
    tiers: {
      stranger: [
        "I'll give you a game if you want one, {t}. No money on it.",
        'Happy to run some sets, {t}. See where we\'re both at.',
      ],
      close: [
        '{t}. Cabinet. Now. Same as every week and you\'ll lose the same way.',
        "You're not beating me today, {t}, and we both already know it.",
        "I've had a WEEK, {t}, and I'm taking all of it out on you.",
      ],
      hostile: [
        'Put your money where your mouth is, {t}. If you can find it.',
        "I don't want a friendly. I want the set, and I want people watching.",
      ],
    },
  },
  {
    kind: 'saltyLoss',
    when: 'They just lost a set and are not handling it well. Said to nobody in particular, or half to the room. The comedy is in the transparency of the cope — everyone present knows exactly what is happening, including the speaker.',
    dimension: null,
    placeholders: [],
    count: 14,
    pools: {
      any: [
        "I don't want to talk about it.",
        'One pixel. ONE. PIXEL.',
        'The buttons ate my inputs. I swear on everything.',
        "I'm fine. It's fine. The set was rigged but I'm fine.",
        'Don\'t. Just... don\'t.',
      ],
    },
  },
]
