import { useState } from 'react'
import { Field, NumField, StringListEditor, PillPicker } from './ui.jsx'
import { newCharacter, newMove, newStage, newTechnique, newTournamentEntry, getMatchup, setMatchup } from '../game/model.js'
import {
  generateCharacter, generateMoveName, generateGameTitle, generateArcadeName,
  generateStage, generateTechnique, generateTournamentName, randomizeMatchups,
  generateChannelName,
} from '../game/generate.js'
import { ARCHETYPES, MOVE_TYPES, DAYS_PER_YEAR, EVO_DAY, formatDay, WEEKDAYS, BRACKET_SIZES } from '../game/constants.js'
import { FOODS, OTHER_GAMES, CHARACTER_NAMES, TAG_SUGGESTIONS, PLAYER_TAG_SUGGESTIONS } from '../game/names.js'
import { choice, sample } from '../game/util.js'

// Every editor gets (save, update) where update(fn) mutates a draft of the save.

export function BasicsEditor({ save, update }) {
  return (
    <div className="grid2">
      <div className="card">
        <h3>Save & Game</h3>
        <Field label="Save name">
          <input value={save.saveName} onChange={(e) => update((s) => { s.saveName = e.target.value })} />
        </Field>
        <Field label="Fighting game title">
          <div className="row">
            <input value={save.game.name} onChange={(e) => update((s) => { s.game.name = e.target.value })} />
            <button className="small" title="random title" onClick={() => update((s) => { s.game.name = generateGameTitle() })}>🎲</button>
          </div>
        </Field>
        <Field label="Arcade name">
          <div className="row">
            <input value={save.arcade.name} onChange={(e) => update((s) => { s.arcade.name = e.target.value })} />
            <button className="small" title="random name" onClick={() => update((s) => { s.arcade.name = generateArcadeName() })}>🎲</button>
          </div>
        </Field>
        <Field label="Stream channel name">
          <div className="row">
            <input value={save.stream?.channelName || ''} onChange={(e) => update((s) => { s.stream.channelName = e.target.value })} />
            <button className="small" title="random name" onClick={() => update((s) => { s.stream.channelName = generateChannelName() })}>🎲</button>
          </div>
        </Field>
        <NumField label="Number of setups (cabinets for the main game)" value={save.settings.setups} min={1} max={20}
          onChange={(v) => update((s) => { s.settings.setups = v })} />
        <Field label="Refer to players by">
          <select
            value={save.settings.nameDisplay || 'alias'}
            onChange={(e) => update((s) => { s.settings.nameDisplay = e.target.value })}
          >
            <option value="alias">Alias / gamer tag</option>
            <option value="fullname">First + last name</option>
          </select>
        </Field>
      </div>
      <div className="card">
        <h3>Generated Players</h3>
        <Field label="Allow computer-generated players to show up?">
          <select
            value={save.settings.allowGeneratedPlayers ? 'yes' : 'no'}
            onChange={(e) => update((s) => { s.settings.allowGeneratedPlayers = e.target.value === 'yes' })}
          >
            <option value="yes">Yes — new faces wander in over time</option>
            <option value="no">No — only my created players</option>
          </select>
        </Field>
        {save.settings.allowGeneratedPlayers && (
          <NumField label="Max generated players" value={save.settings.maxGeneratedPlayers} min={0} max={60}
            onChange={(v) => update((s) => { s.settings.maxGeneratedPlayers = v })} />
        )}
      </div>
    </div>
  )
}

export function TagsEditor({ save, update }) {
  return (
    <div className="grid2">
      <div className="card">
        <h3>Character Tags</h3>
        <p className="dim small">
          Create any tags you like (e.g. "edgy", "cute", "big damage", "honest"). Assign them to characters,
          then mark players as attracted to or repelled by them — this shapes who mains whom.
        </p>
        <StringListEditor items={save.game.tags} placeholder="new character tag…"
          onChange={(items) => update((s) => { s.game.tags = items })} />
        <button className="small" style={{ marginTop: 6 }} onClick={() => update((s) => {
          const fresh = TAG_SUGGESTIONS.filter((t) => !s.game.tags.includes(t))
          s.game.tags.push(...sample(fresh, Math.min(3, fresh.length)))
        })}>🎲 Add random tags</button>
      </div>
      <div className="card">
        <h3>Player Tags</h3>
        <p className="dim small">
          Vibe tags for people (e.g. "loud", "meme lord", "old head", "tryhard"). Give players their own tags,
          then mark who's drawn to or put off by each vibe — this pulls players together or pushes them apart.
        </p>
        <StringListEditor items={save.game.playerTags || []} placeholder="new player tag…"
          onChange={(items) => update((s) => { s.game.playerTags = items })} />
        <button className="small" style={{ marginTop: 6 }} onClick={() => update((s) => {
          const fresh = PLAYER_TAG_SUGGESTIONS.filter((t) => !(s.game.playerTags || []).includes(t))
          s.game.playerTags.push(...sample(fresh, Math.min(3, fresh.length)))
        })}>🎲 Add random tags</button>
      </div>
    </div>
  )
}

export function CharactersEditor({ save, update }) {
  const [selId, setSelId] = useState(null)
  const chars = save.game.characters
  const sel = chars.find((c) => c.id === selId) || null

  const patchChar = (fn) => update((s) => {
    const c = s.game.characters.find((x) => x.id === selId)
    if (c) fn(c)
  })

  return (
    <div className="grid2">
      <div className="card">
        <div className="row spread">
          <h3>Roster ({chars.length})</h3>
          <div className="row">
            <button className="small" onClick={() => update((s) => {
              const c = newCharacter()
              s.game.characters.push(c)
            })}>+ New</button>
            <button className="small" onClick={() => update((s) => {
              const used = new Set(s.game.characters.map((c) => c.name))
              s.game.characters.push(generateCharacter(used))
            })}>🎲 Generate</button>
          </div>
        </div>
        <table>
          <tbody>
            {chars.map((c) => (
              <tr key={c.id} className="clickable" onClick={() => setSelId(c.id)}>
                <td style={selId === c.id ? { color: 'var(--pink)' } : {}}>{c.name}</td>
                <td className="dim">{c.archetype}</td>
                <td className="dim small">diff {c.difficulty} · pop {c.popularity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {chars.length === 0 && <p className="dim">No characters yet — a fighting game needs a cast!</p>}
      </div>

      {sel && (
        <div className="card">
          <div className="row spread">
            <h3>Edit: {sel.name}</h3>
            <button className="small danger" onClick={() => { setSelId(null); update((s) => {
              s.game.characters = s.game.characters.filter((c) => c.id !== sel.id)
            }) }}>Delete</button>
          </div>
          <Field label="Name">
            <div className="row">
              <input value={sel.name} onChange={(e) => patchChar((c) => { c.name = e.target.value })} />
              <button className="small" title="random name" onClick={() => update((s) => {
                const c = s.game.characters.find((x) => x.id === sel.id)
                if (!c) return
                const used = new Set(s.game.characters.map((x) => x.name))
                const free = CHARACTER_NAMES.filter((n) => !used.has(n))
                if (free.length) c.name = choice(free)
              })}>🎲</button>
            </div>
          </Field>
          <Field label="Archetype">
            <select value={sel.archetype} onChange={(e) => patchChar((c) => { c.archetype = e.target.value })}>
              {ARCHETYPES.map((a) => <option key={a}>{a}</option>)}
            </select>
          </Field>
          <div className="row">
            <NumField label="Difficulty (1-10)" value={sel.difficulty} min={1} max={10}
              onChange={(v) => patchChar((c) => { c.difficulty = v })} />
            <NumField label="Popularity (1-10)" value={sel.popularity} min={1} max={10}
              onChange={(v) => patchChar((c) => { c.popularity = v })} />
          </div>
          <Field label="Description">
            <textarea value={sel.description} onChange={(e) => patchChar((c) => { c.description = e.target.value })} />
          </Field>
          <Field label="Tags">
            <PillPicker options={save.game.tags} selected={sel.tags || []}
              onToggle={(t) => patchChar((c) => {
                c.tags = c.tags || []
                c.tags = c.tags.includes(t) ? c.tags.filter((x) => x !== t) : [...c.tags, t]
              })} />
          </Field>
          <h4>Special Moves</h4>
          {sel.moves.map((m) => (
            <div className="row" key={m.id} style={{ marginBottom: 6 }}>
              <input value={m.name} onChange={(e) => patchChar((c) => {
                const mv = c.moves.find((x) => x.id === m.id); if (mv) mv.name = e.target.value
              })} />
              <select value={m.type} onChange={(e) => patchChar((c) => {
                const mv = c.moves.find((x) => x.id === m.id); if (mv) mv.type = e.target.value
              })}>
                {MOVE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <button className="small danger" onClick={() => patchChar((c) => {
                c.moves = c.moves.filter((x) => x.id !== m.id)
              })}>×</button>
            </div>
          ))}
          <div className="row">
            <button className="small" onClick={() => patchChar((c) => { c.moves.push(newMove()) })}>+ Add move</button>
            <button className="small" onClick={() => patchChar((c) => {
              c.moves.push(newMove({ name: generateMoveName(), type: choice(MOVE_TYPES) }))
            })}>🎲 Random move</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function MatchupsEditor({ save, update }) {
  const chars = save.game.characters
  const pairs = []
  for (let i = 0; i < chars.length; i++) {
    for (let j = i + 1; j < chars.length; j++) pairs.push([chars[i], chars[j]])
  }
  return (
    <div className="card">
      <div className="row spread">
        <h3>Matchup Chart</h3>
        {pairs.length > 0 && (
          <button className="small" onClick={() => update((s) => randomizeMatchups(s.game))}>
            🎲 Randomize all
          </button>
        )}
      </div>
      <p className="dim small">
        Win advantage for the left character, out of 100. 50 is an even matchup; 60 means a 60-40 advantage.
        Matchups mostly matter at very high skill levels.
      </p>
      {pairs.length === 0 && <p className="dim">Need at least two characters.</p>}
      <div className="grid3">
        {pairs.map(([a, b]) => (
          <div className="row" key={`${a.id}|${b.id}`}>
            <span style={{ minWidth: 150 }} className="small">{a.name} vs {b.name}</span>
            <input type="number" min={0} max={100}
              value={getMatchup(save.game, a.id, b.id)}
              onChange={(e) => update((s) => setMatchup(s.game, a.id, b.id, Number(e.target.value)))} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function StagesEditor({ save, update }) {
  return (
    <div className="card">
      <div className="row spread">
        <h3>Stages</h3>
        <div className="row">
          <button className="small" onClick={() => update((s) => { s.game.stages.push(newStage()) })}>+ Add stage</button>
          <button className="small" onClick={() => update((s) => {
            s.game.stages.push(generateStage(s.game.stages))
          })}>🎲 Generate</button>
        </div>
      </div>
      <p className="dim small">Flavor only for now — stages don't affect the simulation.</p>
      {save.game.stages.map((st) => (
        <div className="card sub" key={st.id}>
          <div className="row spread">
            <input value={st.name} onChange={(e) => update((s) => {
              const x = s.game.stages.find((y) => y.id === st.id); if (x) x.name = e.target.value
            })} />
            <button className="small danger" onClick={() => update((s) => {
              s.game.stages = s.game.stages.filter((y) => y.id !== st.id)
            })}>×</button>
          </div>
          <textarea placeholder="description…" value={st.description} onChange={(e) => update((s) => {
            const x = s.game.stages.find((y) => y.id === st.id); if (x) x.description = e.target.value
          })} />
        </div>
      ))}
    </div>
  )
}

export function TechniquesEditor({ save, update }) {
  return (
    <div className="card">
      <div className="row spread">
        <h3>Techniques</h3>
        <div className="row">
          <button className="small" onClick={() => update((s) => { s.game.techniques.push(newTechnique()) })}>+ Add technique</button>
          <button className="small" onClick={() => update((s) => {
            s.game.techniques.push(generateTechnique(s))
          })}>🎲 Generate</button>
        </div>
      </div>
      <p className="dim small">
        Skills players can unlock through play. Difficulty controls how hard they are to unlock;
        XP is the skill boost when learned. Character-specific or general.
      </p>
      <table>
        <thead>
          <tr><th>Name</th><th>Scope</th><th>Difficulty</th><th>XP</th><th /></tr>
        </thead>
        <tbody>
          {save.game.techniques.map((t) => (
            <tr key={t.id}>
              <td><input value={t.name} onChange={(e) => update((s) => {
                const x = s.game.techniques.find((y) => y.id === t.id); if (x) x.name = e.target.value
              })} /></td>
              <td>
                <select value={t.charId || ''} onChange={(e) => update((s) => {
                  const x = s.game.techniques.find((y) => y.id === t.id); if (x) x.charId = e.target.value || null
                })}>
                  <option value="">General</option>
                  {save.game.characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </td>
              <td><input type="number" min={1} max={10} value={t.difficulty} onChange={(e) => update((s) => {
                const x = s.game.techniques.find((y) => y.id === t.id); if (x) x.difficulty = Number(e.target.value)
              })} /></td>
              <td><input type="number" min={1} max={30} value={t.xp} onChange={(e) => update((s) => {
                const x = s.game.techniques.find((y) => y.id === t.id); if (x) x.xp = Number(e.target.value)
              })} /></td>
              <td><button className="small danger" onClick={() => update((s) => {
                s.game.techniques = s.game.techniques.filter((y) => y.id !== t.id)
              })}>×</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ArcadeEditor({ save, update }) {
  const quickAdd = (list, key) => (
    <div className="row" style={{ marginTop: 4 }}>
      <span className="dim small">quick add:</span>
      {list.filter((x) => !save.arcade[key].includes(x)).slice(0, 6).map((x) => (
        <span key={x} className="pill clickable" onClick={() => update((s) => { s.arcade[key].push(x) })}>{x}</span>
      ))}
      <button className="small" onClick={() => update((s) => {
        const fresh = list.filter((x) => !s.arcade[key].includes(x))
        s.arcade[key].push(...sample(fresh, Math.min(3, fresh.length)))
      })}>🎲 Add random</button>
    </div>
  )
  return (
    <div className="grid2">
      <div className="card">
        <h3>Concession Stand</h3>
        <p className="dim small">Players who find their favorite snacks show up more often.</p>
        <StringListEditor items={save.arcade.foods} placeholder="add food…"
          onChange={(items) => update((s) => { s.arcade.foods = items })} />
        {quickAdd(FOODS, 'foods')}
      </div>
      <div className="card">
        <h3>Other Games in the Arcade</h3>
        <p className="dim small">Side cabinets where players hang out and socialize between sets.</p>
        <StringListEditor items={save.arcade.otherGames} placeholder="add game…"
          onChange={(items) => update((s) => { s.arcade.otherGames = items })} />
        {quickAdd(OTHER_GAMES, 'otherGames')}
      </div>
    </div>
  )
}

export function ScheduleEditor({ save, update }) {
  const patchEntry = (id, fn) => update((s) => {
    const x = s.arcade.schedule.find((y) => y.id === id)
    if (x) fn(x)
  })
  return (
    <div className="card">
      <div className="row spread">
        <h3>Recurring Tournaments</h3>
        <button className="small" onClick={() => update((s) => {
          s.arcade.schedule.push(newTournamentEntry({ name: generateTournamentName() }))
        })}>+ Schedule tournament</button>
      </div>
      <p className="dim small">
        Brackets are always a power of two — the bracket size you set here is the invite list, filled by
        elo + reputation. If the slots can't be filled, that running of the tournament is cancelled.
        EVO happens automatically on day {EVO_DAY} ({formatDay(EVO_DAY, 1).replace(', Year 1', '')}) every year — your top 8 qualify.
      </p>
      {save.arcade.schedule.map((t) => (
        <div className="card sub" key={t.id}>
          <div className="row">
            <input value={t.name} style={{ minWidth: 180 }}
              onChange={(e) => patchEntry(t.id, (x) => { x.name = e.target.value })} />
            <button className="small" title="random name"
              onClick={() => patchEntry(t.id, (x) => { x.name = generateTournamentName() })}>🎲</button>
            <select value={t.type} onChange={(e) => patchEntry(t.id, (x) => { x.type = e.target.value })}>
              <option value="singles">Singles</option>
              <option value="teams">Team battle</option>
            </select>
            <select value={t.cadence || 'weekly'} onChange={(e) => patchEntry(t.id, (x) => { x.cadence = e.target.value })}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            {(t.cadence || 'weekly') === 'weekly' && (
              <select value={t.weekday || 0} onChange={(e) => patchEntry(t.id, (x) => { x.weekday = Number(e.target.value) })}>
                {WEEKDAYS.map((w, i) => <option key={w} value={i}>every {w}</option>)}
              </select>
            )}
            {t.cadence === 'monthly' && (
              <label className="row small dim">
                day
                <input type="number" min={1} max={28} value={t.dayOfMonth || 1}
                  onChange={(e) => patchEntry(t.id, (x) => { x.dayOfMonth = Number(e.target.value) })} />
                of each month
              </label>
            )}
            {t.cadence === 'yearly' && (
              <label className="row small dim">
                day
                <input type="number" min={1} max={DAYS_PER_YEAR} value={t.dayOfYear}
                  onChange={(e) => patchEntry(t.id, (x) => { x.dayOfYear = Number(e.target.value) })} />
                ({formatDay(t.dayOfYear || 1, 1).replace(', Year 1', '')})
              </label>
            )}
            <label className="row small dim">
              bracket
              <select value={t.size || 8} onChange={(e) => patchEntry(t.id, (x) => { x.size = Number(e.target.value) })}>
                {BRACKET_SIZES.map((n) => <option key={n} value={n}>{n} {t.type === 'teams' ? 'teams' : 'players'}</option>)}
              </select>
            </label>
            <button className="small danger" onClick={() => update((s) => {
              s.arcade.schedule = s.arcade.schedule.filter((y) => y.id !== t.id)
            })}>×</button>
          </div>
        </div>
      ))}
      {save.arcade.schedule.length === 0 && <p className="dim">Nothing scheduled yet.</p>}
    </div>
  )
}
