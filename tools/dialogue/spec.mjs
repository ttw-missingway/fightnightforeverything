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

// The physical room, from Dylan. Canon — scenes may reference anything here and
// must not contradict it. This exists because the model invents arcade detail
// unprompted (it produced a sticky bench, a signup sheet, and a permanently
// abandoned coin), and across thousands of scenes those inventions start
// contradicting each other. Better to hand it the real place.
export const THE_ROOM = `
You come in through double glass doors into a large lobby. A circular desk sits
in the middle of it. The front side, facing the doors, is registers and
attendants, with whiteboards behind them for events, deals, announcements. Go
round the other side and it is glass cases of prizes and a ticket exchange
counter, with the big-ticket stuff stacked behind the attendants — oversized
stuffed animals, scooters, inflatables.

Past the desk are tables bolted to the floor: long ones with bench seating for
big parties, and higher circular ones with barstools. White, patterned in
purple and teal. Behind those is the concession counter — staff, a menu board
hung behind them, a register, and off to one side the condiments, paper towels
and plastic silverware.

Right of concession are the bathrooms, with a photo booth wedged between the
men's and the women's. Right of the bathrooms is the general arcade floor:
skee-ball, the classic cabinets, DDR, Wave Racer — everything that is not THE
fighting game. Left of concession, an open area with pinball machines lining
the walls.

Keep going right, along the wall that runs back toward the entrance, and you
reach two velvet curtains. Through them is a dim room. This is where the
fighting-game setups are. Folding chairs in rows, a projector throwing the
stream onto a screen, a popcorn machine, a couple of vending machines.

That dim curtained room is where nearly all of this dialogue happens. It is
adjacent to a loud, bright, family arcade full of skee-ball and prize counters,
and the contrast is part of what the place is: a serious little room behind a
curtain, inside somewhere that sells inflatable hammers to nine-year-olds.
`.trim()

// Fighting-game vocabulary. Dylan's audience IS fighting-game players, and
// using these terms as flavour rather than correctly is worse than not using
// them — one generated scene said a player "couldn't punish" someone's reads
// going bad, which is not what punishing is and reads as a tourist writing.
export const FG_GLOSSARY = `
- PUNISH: hitting a move that left the opponent vulnerable — one that was minus
  on block, or whiffed. You punish A MOVE. You cannot punish a read, a habit, a
  decision, or a bad day. "Whiff punish" is the same thing against a move that
  hit nothing.
- NEUTRAL: the phase where neither player has the advantage and both are looking
  for a way in.
- FOOTSIES / SPACING: fighting for ground in neutral with long pokes.
- OKI: the pressure applied to an opponent getting up off a knockdown.
- MIX-UP: forcing a guess, usually high vs low, or strike vs throw.
- PLUS / MINUS ON BLOCK: whether you recover before or after they do when they
  block your move. "Minus" is what makes something punishable.
- CONFIRM: seeing a hit land and converting it into a full combo. A "drop" is
  failing that conversion.
- READ: correctly predicting what they will do. You "get a read", you don't
  punish one.
- LAB / LABBING: practising something alone in training mode.
- TECH: (1) escaping a throw, (2) newly discovered technology. Both are used.
- METER: the resource supers and other cash-ins are spent from.
- THROW: a grab. You "throw someone", "go for a throw", or "get thrown". You
  NEVER "throw at" someone — that reads as throwing an object and is wrong.
  Escaping one is a "tech".
- DASH / METER / KNOCKDOWN and every other mechanic are SEPARATE systems. Do not
  invent causal links between them. "Dashes forward whenever their meter fills"
  is nonsense — meter is a resource, dashing is movement, and one does not cause
  the other. If a scene describes somebody's habit, keep it to ONE mechanic.
- Sets are first-to-2 or first-to-3, so a set is at most five games and usually
  fewer. Do not reference a specific game number ("game four") — say "that last
  one" or "the one where you switched" instead.

Use these only where a real player would, and only correctly. A scene with no
jargon at all is always better than a scene with jargon used loosely.
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
- Do NOT end on a wry observational flourish. This is THE tell, and it is what
  got two scenes rejected outright as "very AI-ish": setup, beat, then a knowing
  little button like "I asked about it once and got three different answers,
  none of them confident" or "say that one more time but louder and toward the
  door". People do not talk in closing lines. End flat, or on a non-answer, or
  mid-thought.
- Do NOT require more than ONE inference from the reader. Implication is good;
  an exchange where you must reconstruct who is leaving, what was unsaid, AND
  what the joke refers to just reads as confusing.
- Do NOT write pure logistics. If nothing in the exchange does anything except
  arrange two people in space, it is boring and will be cut.
- Do NOT assume elapsed time the sim has not accrued ("I've been coming here a
  long time", "we've been doing this for years"). If a scene needs that, it
  must declare "arcade:established" in its cast requirements.
- Do NOT use the ironic "the thing" construction. "Just do the thing", "I can't
  believe you did the thing", "make me stop doing the thing" — this is the
  single most disliked pattern in the whole corpus. It is internet-register
  irony and it is cringe. Name what you mean or cut the line.
- Do NOT write like Twitter or Reddit. No ironic distancing, no self-aware
  narration of one's own behaviour, no phrasing that exists to be quotable.
  Some real players talk this way; a whole cast talking this way is unbearable.
  These are adults in a room, not posters.
- Do NOT reach for oddly precise quantities as a joke ("spent about four seconds
  building it"). The false precision is a tell.
- EVERY pronoun and every "that" / "it" / "one" must have a clear antecedent
  INSIDE the exchange. A scene plays with no surrounding context, so a referent
  that points at something the reader cannot see is not subtle, it is broken.
  This is the most common failure after the closing-flourish problem: lines that
  would be clear if you had watched the set, and are meaningless if you did not.
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
