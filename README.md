# Fight Night — Arcade Community Simulator

A browser-based, text-only fighting game community sim built with React + Vite.
You run an arcade centered on one fighting game; players show up, pick mains,
grind skill, form friendships, rivalries, mentorships and teams, invent new
tech, enter your tournaments, and once a year the best of them take on the
world at EVO. Everything is saved to `localStorage`.

## Run it

```sh
npm install
npm run dev
```

Then open http://localhost:5173.

## How a save works

**Setup wizard** (New Save): name your game and arcade, then optionally define —

- **Tags** — freeform character tags (e.g. "edgy", "honest"); players can be attracted to or repelled by them, which shapes who mains whom.
- **Characters** — name, archetype, difficulty, popularity, tags, and special moves (name + type). Moves feed the match narration.
- **Matchups** — per-pair win advantage (60 = a 60-40 matchup).
- **Stages** — flavor descriptions only (no sim impact yet).
- **Techniques** — general or character-specific unlockables with difficulty and XP.
- **Arcade** — concession stand foods, side games (both affect attendance/enjoyment), number of setups.
- **Schedule** — singles tournaments and team battles on any day of the 336-day year. EVO fires automatically on day 322.
- **Players** — create as many as you like (identity, stats, main character, likes), and/or allow generated players with a cap. Stats can be edited directly or rolled D&D-style and allocated to slots.

**Daily sim**: hit *Simulate Day*. Attendance is driven by spark, mood and how
much the arcade caters to each player. Players pair off on setups (match
results driven by skill, elo, mood/mojo, x-factor, matchups, and known tech),
watch sets (learning via analysis), or hang out at the concession stand and
side cabinets (relationships, mood, mentorships, team formation, tech
spreading). Click any match for narration, any interaction for who's feeling
what.

**Progression**: aptitude lowers a character's difficulty floor, mastery lowers
its ceiling; skill 100 requires knowing every character-specific innovation.
Innovations are invented by high-innovation players and spread through the
community via the learning stat.

**Tournaments** run on their own screen with a full bracket and longer-form
narration; team battles are 4v4 crew battles seeded from team elo. All results
land in the **Hall of Fame**. **EVO** pits your top 8 (by elo) against a
persistent roster of elite world players who drift slightly year to year — the
broadcast cuts out once the last arcade player is eliminated.

**Streaming**: the arcade runs a stream channel (name it what you like). Once
per hour you can put one setup's match on stream — curate close, high-level
games between popular personalities to grow hype and followers. Every
tournament match is auto-streamed, EVO is always packed, and live chat
(random accounts, not your players) reacts line by line as matches play out.
A brand-new channel streams into the void: zero viewers until you build hype.

**Manage** lets you edit the game, arcade, schedule and roster mid-save.

## Code layout

- `src/game/` — pure simulation engine (no React): models, generators, match/elo/narration, daily sim, social systems, tournaments/EVO.
- `src/state/store.jsx` — React context + localStorage persistence (multiple save slots).
- `src/screens/` — main menu, setup wizard, arcade day view, players, teams, tournament, hall of fame, manage.
- `src/components/` — shared editors and the player form.
