# `src/content` — every word the player reads

This directory holds the game's prose. The rule that keeps it useful:

> **`src/game/*.js` decides WHEN something is said and to whom.
> `src/content/*.json` decides what the words are.**

Any file in here can be rewritten start to finish without touching a line of
logic, and nothing in here can break the simulation. The worst a bad edit does
is print oddly — a missing `{placeholder}` renders as `…`, and an unknown
chronicle key prints `[missing line: the.key]` on screen rather than throwing.

Two things are *not* in here, on purpose:

- **`src/game/data/scenes.js`** — the conversation corpus, ~10,000 lines of
  two-party exchange prose. It is generated (see `tools/dialogue/`), and its
  editable source is the per-situation files under `tools/dialogue/out/corpus/`.
  Edit those, then re-run `tools/dialogue/gen-corpus.mjs`.
- **UI copy** — screen headers, tooltips, button labels. Those are interleaved
  with the layout that gives them meaning and are better read in place.

---

## The files

### `journal.json` — the first-person feed (the biggest one)

Every entry a player writes in their own diary. This is the front of the game:
the one-announcement rule (REVISION §0.4) means a stat change speaks HERE and
nowhere else, so these lines carry the whole eureka system.

```jsonc
{
  "breakthroughWound": {          // the kind of moment
    "killer":  [ "…", "…" ],      // voiced by competitive temperament
    "scholar": [ "…" ],
    "natural": [ "…" ],
    "stoic":   [ "…" ]
  },
  "friend": {
    "social": true,               // route through the SOCIAL temperament instead
    "warm": [ "…" ], "gracious": [ "…" ], "dramatic": [ "…" ], "together": [ "…" ]
  }
}
```

Voices: **killer** runs hot · **scholar** takes notes · **natural** shrugs ·
**stoic** states facts. Socially: **warm** reaches out · **gracious** keeps its
manners · **dramatic** feels it at volume · **together** files it under handled.
An `"any"` key covers all voices.

Placeholders: `{stat}` `{opp}` `{char}` `{event}` `{place}` `{why}` `{row}`.

House style: first person, present or just-happened tense, **no emoji** (icons
belong to the UI), and no numbers — "it clicked", never "+1 composure".

### `dialogue.json` / `dialogue-quirks.json` — what people say out loud

Arcade banter, filtered through a voice derived from stats.

```jsonc
{
  "joke": {
    "dimension": "humor",              // which voice axis picks the pool
    "pools": { "clowning": [...], "dry": [...], "earnest": [...] },
    "tiers": { "stranger": [...], "close": [...], "hostile": [...] }
  }
}
```

`pools` is chosen by the speaker's voice; `tiers` overrides it based on how well
the two people know each other. Placeholders: `{t}` the target, `{m}` a move,
`{c}` a character, `{mem}` a shared memory, `{self}` the speaker's own name.

`dialogue-quirks.json` is the signature-flavour override — third-person,
technical, humble, menace, philosopher, hypeman, anime, old-head.

### `chronicle.json` — the room's collective memory

Flat `key → sentence`. The engine calls `line('key', { data })` and never
contains the sentence itself.

Keep these **numberless and occasional**. The chronicle is for things that
happened to everybody; anything about one person's stats belongs in
`journal.json` instead.

### `socialmedia.json` — Chirper posts and board handles

`WORLD_TAKES` (the world talking about itself), `WORLD_ABOUT_YOU` (the world
noticing your player), `EVO_COUNTDOWN` / `EVO_BUILDUP` / `EVO_AFTERMATH`,
`WORLD_UPSET_TAKES`. Lowercase, unpunctuated, posted-from-a-phone voice.

### `worldtalk.json` — two regulars at the counter

Each beat is an `open` and a set of `replies`; the second speaker picks one.

### `fragments.json` — how the world's best sound

Elites keep no journal — the asymmetry is the mythology. They get interview
quotes, tweets and lines of commentary instead, voiced by persona (loyalist,
meta-chaser, lab-monster, showman, veteran). Format is `"kind|text"` where kind
is `interview` / `tweet` / `vod` / `guide`.

### `guides.json` — character guides your scene writes

Section by section. Which variant a guide gets is chosen by the AUTHOR's real
numbers — `authority` at skill 45+, `journeyman` at 25+, `hopeful` below — so a
guide by a mediocre player should *read* like one. Don't make the `hopeful`
lines sound confident; that band is doing real work.

---

## Editing notes

- **Placeholders are `{braces}`.** A key with no matching data renders `…`.
- **Keys are load-bearing.** Renaming one silently disables a line. Rewriting
  the *text* under a key is always safe.
- **Variants are arrays.** Add or remove freely — one is fine, twelve is fine.
- **Escape** `"` as `\"` inside JSON strings. Apostrophes need no escaping.
- After editing, `npm run build` will fail loudly on malformed JSON.
