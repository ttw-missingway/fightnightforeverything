import { useState } from 'react'
import { Field, NumField, StringListEditor, PillPicker } from './ui.jsx'
import { newCharacter, newMove, newStage, newTechnique, newTournamentEntry } from '../game/model.js'
import {
  generateCharacter, generateGameTitle, generateArcadeName,
  generateStage, generateTechnique, generateTournamentName,
  generateChannelName,
} from '../game/generate.js'
import {
  ARCHETYPE_KITS, applyArchetypeKit, generateMoveNameForType, STAGE_VIBES,
  generateMoveData, generateCombo, comboDamage, comboRoute,
} from '../game/design.js'
import { computeMatchup, matchupExplanation } from '../game/balance.js'
import { ARCHETYPES, MOVE_TYPES, DAYS_PER_YEAR, EVO_DAY, formatDay, WEEKDAYS, BRACKET_SIZES } from '../game/constants.js'
import { FOODS, OTHER_GAMES, CHARACTER_NAMES, TAG_SUGGESTIONS, PLAYER_TAG_SUGGESTIONS } from '../game/names.js'
import { choice, sample } from '../game/util.js'
import { trySpend, weeklyRent, PRICES } from '../game/economy.js'

// Every editor gets (save, update) where update(fn) mutates a draft of the save.

// The arcade's books, shown wherever money matters.
export function EconomyCard({ save }) {
  if (!save.economy) return null
  return (
    <div className="card">
      <div className="row spread">
        <h3>💰 The Books</h3>
        <span className={save.economy.money < 0 ? 'red' : 'green'} style={{ fontSize: 18, fontWeight: 700 }}>
          ${Math.round(save.economy.money)}
        </span>
      </div>
      <p className="dim small">
        Income: door quarters, concession sales, stream ad revenue. Weekly rent: ${weeklyRent(save)}
        {' '}(scales with setups and side cabinets). Additions cost money — the arcade you
        opened with was free.
      </p>
      {save.economy.log.slice(0, 12).map((e, i) => (
        <div className="row spread" key={i} style={{ borderBottom: '1px solid var(--border)', padding: '2px 0' }}>
          <span className="small">{e.label}</span>
          <span className={`small ${e.amount >= 0 ? 'green' : 'red'}`}>
            {e.amount >= 0 ? '+' : '−'}${Math.abs(e.amount).toFixed(0)}
            <span className="dim"> · {formatDay(e.day, e.year)}</span>
          </span>
        </div>
      ))}
      {save.economy.log.length === 0 && <p className="dim small">No transactions yet.</p>}
    </div>
  )
}

// Mid-save settings that DON'T touch the economy or the game itself.
// Consequential mode locks the world-defining ones.
export function SettingsEditor({ save, update }) {
  const locked = save.settings.mode !== 'sandbox'
  return (
    <div className="grid2">
      <div className="card">
        <h3>Settings</h3>
        <Field label="Save name">
          <input value={save.saveName} onChange={(e) => update((s) => { s.saveName = e.target.value })} />
        </Field>
        <Field label="Refer to players by">
          <select value={save.settings.nameDisplay || 'alias'}
            onChange={(e) => update((s) => { s.settings.nameDisplay = e.target.value })}>
            <option value="alias">Alias / gamer tag</option>
            <option value="fullname">First + last name</option>
          </select>
        </Field>
        <Field label="Stream channel name">
          <div className="row">
            <input value={save.stream?.channelName || ''} onChange={(e) => update((s) => { s.stream.channelName = e.target.value })} />
            <button className="small" title="random name" onClick={() => update((s) => { s.stream.channelName = generateChannelName() })}>🎲</button>
          </div>
        </Field>
      </div>
      <div className="card">
        <h3>World Rules {locked && <span className="pill" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>🔒 consequential</span>}</h3>
        {locked && (
          <p className="dim small">
            You chose a consequential arcade — the world's rules were locked at creation.
            (New saves can pick sandbox mode instead.)
          </p>
        )}
        <Field label="Allow computer-generated players?">
          <select disabled={locked}
            value={save.settings.allowGeneratedPlayers ? 'yes' : 'no'}
            onChange={(e) => update((s) => { s.settings.allowGeneratedPlayers = e.target.value === 'yes' })}>
            <option value="yes">Yes — new faces wander in over time</option>
            <option value="no">No — only my created players</option>
          </select>
        </Field>
        <Field label="Max generated players">
          <input type="number" disabled={locked} min={0} max={60} value={save.settings.maxGeneratedPlayers}
            onChange={(e) => update((s) => { s.settings.maxGeneratedPlayers = Number(e.target.value) })} />
        </Field>
      </div>
    </div>
  )
}

export function BasicsEditor({ save, update, live = false }) {
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
        <NumField label={`Number of setups (cabinets for the main game)${live ? ` — $${PRICES.setup} each to add` : ''}`}
          value={save.settings.setups} min={1} max={20}
          onChange={(v) => update((s) => {
            const cur = s.settings.setups
            if (live && v > cur) {
              let n = cur
              while (n < v && trySpend(s, PRICES.setup, 'new setup cabinet')) n++
              s.settings.setups = n
            } else {
              s.settings.setups = v
            }
          })} />
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
        <h3>Commitment</h3>
        <Field label="How locked-in is this world?">
          <select value={save.settings.mode || 'consequential'}
            onChange={(e) => update((s) => { s.settings.mode = e.target.value })}>
            <option value="consequential">Consequential — settings lock, purchases cost, patches have fallout</option>
            <option value="sandbox">Sandbox — adjust everything freely, no consequences</option>
          </select>
        </Field>
        <p className="dim small">
          Consequential: world rules freeze at creation, mid-save additions cost money, and every game
          patch triggers a community reaction that matters. Sandbox: tune anything anytime, for free.
        </p>
      </div>
    </div>
  )
}

// The Manage screen's arcade-management tab: everything with a price tag.
export function ArcadeManagement({ save, update }) {
  const live = save.settings.mode !== 'sandbox'
  return (
    <div>
      <EconomyCard save={save} />
      <div className="card">
        <NumField label={`Setups (cabinets for the main game)${live ? ` — $${PRICES.setup} each to add` : ''}`}
          value={save.settings.setups} min={1} max={20}
          onChange={(v) => update((s) => {
            const cur = s.settings.setups
            if (live && v > cur) {
              let n = cur
              while (n < v && trySpend(s, PRICES.setup, 'new setup cabinet')) n++
              s.settings.setups = n
            } else {
              s.settings.setups = v
            }
          })} />
      </div>
      <ArcadeEditor save={save} update={update} live={live} />
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
        <div className="table-scroll"><table>
          <tbody>
            {chars.map((c) => (
              <tr key={c.id} className="clickable" onClick={() => setSelId(c.id)}>
                <td style={selId === c.id ? { color: 'var(--pink)' } : {}}>{c.name}</td>
                <td className="dim">{c.archetype}</td>
                <td className="dim small">diff {c.difficulty} · pop {c.popularity}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
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
            <div className="row">
              <select value={sel.archetype} onChange={(e) => patchChar((c) => { c.archetype = e.target.value })}>
                {ARCHETYPES.map((a) => <option key={a}>{a}</option>)}
              </select>
              <button className="small" title="fill stats, moves and tags from the archetype template"
                onClick={() => update((s) => {
                  const c = s.game.characters.find((x) => x.id === sel.id)
                  if (c) applyArchetypeKit(c, c.archetype, s.game.tags)
                })}>
                📦 Apply {sel.archetype} kit
              </button>
            </div>
            {ARCHETYPE_KITS[sel.archetype] && (
              <p className="dim small" style={{ margin: '4px 0 0' }}>{ARCHETYPE_KITS[sel.archetype].blurb}</p>
            )}
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
          <MovelistEditor char={sel} patchChar={patchChar} />
          <CombosEditor char={sel} patchChar={patchChar} />
        </div>
      )}
    </div>
  )
}

// The chart is COMPUTED from the movesets now — the game tells you what
// you built. In the wizard it's pure design theory; in a live save it's
// OBSERVED data that starts blurry after each patch and sharpens as sets
// get played (pass `observe`, `confidence`, `games`).
export function MatchupReport({ save, observe = null, confidence = 1, games = 0 }) {
  const chars = save.game.characters
  const pairs = []
  for (let i = 0; i < chars.length; i++) {
    for (let j = i + 1; j < chars.length; j++) pairs.push([chars[i], chars[j]])
  }
  const pct = Math.round(confidence * 100)
  return (
    <div className="card">
      <h3>Matchup Report <span className="dim small">{observe ? '(observed from play)' : '(projected from your designs)'}</span></h3>
      {observe && (
        <div className="card sub" style={{ marginBottom: 8 }}>
          <span className="small">
            📈 Data confidence: <strong className={pct >= 70 ? 'green' : pct >= 35 ? 'gold' : 'red'}>{pct}%</strong>
            <span className="dim"> · {games} sets on this build</span>
          </span>
          {pct < 70 && (
            <p className="dim small" style={{ margin: '4px 0 0' }}>
              Early numbers lie. Patch off thin data and you may nerf a phantom — or miss the real problem.
            </p>
          )}
        </div>
      )}
      <p className="dim small">
        The game reads every character's frame data, damage, meter and setups and derives the chart —
        zoning smothers slow approaches, pressure beats thin defense, damage decides trades.
        Matchups mostly matter at very high skill levels.
      </p>
      {pairs.length === 0 && <p className="dim">Need at least two characters.</p>}
      {pairs.map(([a, b]) => {
        const mu = observe ? observe(save.game, a, b) : computeMatchup(a, b)
        return (
          <div key={`${a.id}|${b.id}`} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="row spread">
              <span className="small"><strong>{a.name}</strong> vs <strong>{b.name}</strong></span>
              <span className={`small ${Math.abs(mu - 50) >= 8 ? 'red' : Math.abs(mu - 50) >= 4 ? 'gold' : 'green'}`}>
                {mu}–{100 - mu}{observe && confidence < 1 && <span className="dim"> ±{Math.round((1 - confidence) * 4.5)}</span>}
              </span>
            </div>
            <div className="track" style={{ height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${mu}%`, height: '100%', background: 'linear-gradient(90deg, var(--cyan), var(--pink))' }} />
            </div>
            <span className="dim small">
              {observe && confidence < 0.25 ? 'too early to say why — the data is still arguing with itself' : matchupExplanation(a, b)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

const FD_FIELDS = [
  ['startup', 'Start'], ['active', 'Active'], ['recovery', 'Rec'], ['onBlock', 'OnBlk'],
  ['damage', 'Dmg'], ['chip', 'Chip'], ['meterCost', 'Meter'], ['duration', 'Dur(s)'],
]

// The frame-data sheet: normals, specials, supers — every number editable.
function MovelistEditor({ char, patchChar }) {
  const patchMove = (id, fn) => patchChar((c) => {
    const m = c.moves.find((x) => x.id === id)
    if (m) fn(m)
  })
  const [addType, setAddType] = useState('projectile')
  const groups = [
    ['normal', 'Normals'],
    ['special', 'Specials'],
    ['super', 'Supers'],
  ]
  return (
    <div>
      <h4>Movelist</h4>
      {groups.map(([slot, label]) => {
        const moves = char.moves.filter((m) => (m.slot || 'special') === slot)
        if (!moves.length) return null
        return (
          <div key={slot}>
            <p className="dim small" style={{ margin: '8px 0 2px', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</p>
            <div className="table-scroll"><table>
              <thead>
                <tr>
                  <th>Move</th><th>Type</th>
                  {FD_FIELDS.map(([k, l]) => <th key={k} title={k}>{l}</th>)}
                  <th />
                </tr>
              </thead>
              <tbody>
                {moves.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
                        <input value={m.name} style={{ minWidth: 110 }}
                          onChange={(e) => patchMove(m.id, (x) => { x.name = e.target.value })} />
                        <button className="small" title="random name for this type"
                          onClick={() => patchMove(m.id, (x) => { x.name = generateMoveNameForType(x.type) })}>🎲</button>
                      </div>
                    </td>
                    <td>
                      <select value={m.type} onChange={(e) => patchMove(m.id, (x) => {
                        x.type = e.target.value
                        Object.assign(x, generateMoveData(x.type)) // fresh realistic data for the new type
                      })}>
                        {MOVE_TYPES.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </td>
                    {FD_FIELDS.map(([k]) => (
                      <td key={k}>
                        <input type="number" className="fd" value={m[k] ?? 0}
                          onChange={(e) => patchMove(m.id, (x) => { x[k] = Number(e.target.value) })} />
                      </td>
                    ))}
                    <td><button className="small danger" onClick={() => patchChar((c) => {
                      c.moves = c.moves.filter((x) => x.id !== m.id)
                    })}>×</button></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )
      })}
      <div className="row" style={{ marginTop: 8 }}>
        <select value={addType} onChange={(e) => setAddType(e.target.value)}>
          {MOVE_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
        <button className="small" onClick={() => patchChar((c) => {
          c.moves.push(newMove({ name: generateMoveNameForType(addType), type: addType }))
        })}>+ Add {addType}</button>
        <span className="dim small">frame data is generated realistic-by-type; tune every number</span>
      </div>
    </div>
  )
}

// Named routes: pick real moves, get real (scaled) damage numbers.
function CombosEditor({ char, patchChar }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row spread">
        <h4 style={{ margin: 0 }}>Combos</h4>
        <button className="small" onClick={() => patchChar((c) => {
          const combo = generateCombo(c, (c.combos || []).map((x) => x.name))
          if (combo) { c.combos = c.combos || []; c.combos.push(combo) }
        })}>🎲 New combo</button>
      </div>
      <p className="dim small">Named routes built from the movelist. Damage scales per hit, like a real fighter. These show up in match commentary.</p>
      {(char.combos || []).map((combo) => (
        <div className="card sub" key={combo.id}>
          <div className="row spread">
            <div className="row">
              <input value={combo.name} style={{ minWidth: 150 }}
                onChange={(e) => patchChar((c) => {
                  const x = (c.combos || []).find((y) => y.id === combo.id); if (x) x.name = e.target.value
                })} />
              <span className="gold small">{comboDamage(char, combo)} dmg</span>
            </div>
            <div className="row">
              <button className="small" title="reroll the route" onClick={() => patchChar((c) => {
                const x = (c.combos || []).find((y) => y.id === combo.id)
                const fresh = generateCombo(c, [])
                if (x && fresh) x.moveIds = fresh.moveIds
              })}>🎲</button>
              <button className="small danger" onClick={() => patchChar((c) => {
                c.combos = (c.combos || []).filter((y) => y.id !== combo.id)
              })}>×</button>
            </div>
          </div>
          <p className="small dim" style={{ margin: '4px 0 0' }}>{comboRoute(char, combo) || 'route uses deleted moves'}</p>
        </div>
      ))}
      {!(char.combos || []).length && <p className="dim small">No combos named yet.</p>}
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
            <div className="row">
              <input value={st.name} onChange={(e) => update((s) => {
                const x = s.game.stages.find((y) => y.id === st.id); if (x) x.name = e.target.value
              })} />
              <select value={st.vibe || 'hype'} title="stage vibe" onChange={(e) => update((s) => {
                const x = s.game.stages.find((y) => y.id === st.id); if (x) x.vibe = e.target.value
              })}>
                {STAGE_VIBES.map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
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
  // One page per character, plus a General page. 'general' = charId null.
  const [page, setPage] = useState('general')
  const pageCharId = page === 'general' ? null : page
  const pageChar = pageCharId ? save.game.characters.find((c) => c.id === pageCharId) : null
  // Selected character got deleted (or page is stale) — fall back to General.
  if (pageCharId && !pageChar) setPage('general')

  const patchTech = (id, fn) => update((s) => {
    const x = s.game.techniques.find((y) => y.id === id)
    if (x) fn(x)
  })
  const countFor = (charId) => save.game.techniques.filter((t) => t.charId === charId).length
  const pageTechs = save.game.techniques.filter((t) => t.charId === pageCharId)

  return (
    <div className="card">
      <h3>Techniques</h3>
      <p className="dim small">
        Skills players can unlock through play. Difficulty controls how hard they are to unlock;
        XP is the skill boost when learned. General techniques work on every character.
      </p>
      <div className="tabs">
        <button className={`small ${page === 'general' ? 'active' : ''}`} onClick={() => setPage('general')}>
          🌐 General ({countFor(null)})
        </button>
        {save.game.characters.map((c) => (
          <button key={c.id} className={`small ${page === c.id ? 'active' : ''}`} onClick={() => setPage(c.id)}>
            {c.name} ({countFor(c.id)})
          </button>
        ))}
      </div>

      <div className="row" style={{ marginBottom: 10 }}>
        <button className="small" onClick={() => update((s) => {
          s.game.techniques.push(newTechnique({ charId: pageCharId }))
        })}>+ Add {pageChar ? `${pageChar.name} technique` : 'general technique'}</button>
        <button className="small" onClick={() => update((s) => {
          s.game.techniques.push(generateTechnique(s, pageCharId))
        })}>🎲 Generate</button>
      </div>

      {pageTechs.length === 0 && (
        <p className="dim">
          {pageChar ? `${pageChar.name} has no signature techniques yet.` : 'No general techniques yet.'}
        </p>
      )}
      {pageTechs.map((t) => (
        <div className="card sub" key={t.id}>
          <div className="row spread">
            <div className="row">
              <input value={t.name} style={{ minWidth: 200 }}
                onChange={(e) => patchTech(t.id, (x) => { x.name = e.target.value })} />
              <label className="row small dim">
                difficulty
                <input type="number" min={1} max={10} value={t.difficulty}
                  onChange={(e) => patchTech(t.id, (x) => { x.difficulty = Number(e.target.value) })} />
              </label>
              <label className="row small dim">
                xp
                <input type="number" min={1} max={30} value={t.xp}
                  onChange={(e) => patchTech(t.id, (x) => { x.xp = Number(e.target.value) })} />
              </label>
            </div>
            <button className="small danger" onClick={() => update((s) => {
              s.game.techniques = s.game.techniques.filter((y) => y.id !== t.id)
            })}>×</button>
          </div>
          <textarea placeholder="what this tech actually does…" value={t.description || ''}
            style={{ marginTop: 6, minHeight: 40 }}
            onChange={(e) => patchTech(t.id, (x) => { x.description = e.target.value })} />
        </div>
      ))}
    </div>
  )
}

export function ArcadeEditor({ save, update, live = false }) {
  const price = (key) => (key === 'foods' ? PRICES.food : PRICES.sideGame)
  const label = (key, item) => key === 'foods' ? `stocked ${item}` : `bought ${item} cabinet`

  // Mid-save, additions cost money; the setup wizard configures for free.
  const addItems = (key, items) => update((s) => {
    for (const item of items) {
      if (s.arcade[key].includes(item)) continue
      if (live && !trySpend(s, price(key), label(key, item))) break
      s.arcade[key].push(item)
    }
  })

  const quickAdd = (list, key) => (
    <div className="row" style={{ marginTop: 4 }}>
      <span className="dim small">quick add:</span>
      {list.filter((x) => !save.arcade[key].includes(x)).slice(0, 6).map((x) => (
        <span key={x} className="pill clickable" onClick={() => addItems(key, [x])}>{x}</span>
      ))}
      <button className="small" onClick={() => {
        const fresh = list.filter((x) => !save.arcade[key].includes(x))
        addItems(key, sample(fresh, Math.min(3, fresh.length)))
      }}>🎲 Add random</button>
    </div>
  )
  return (
    <div className="grid2">
      <div className="card">
        <h3>Concession Stand {live && <span className="dim small">(${PRICES.food} per item)</span>}</h3>
        <p className="dim small">Players who find their favorite snacks show up more often — and buy them.</p>
        <StringListEditor items={save.arcade.foods} placeholder="add food…"
          onChange={(items) => {
            if (items.length > save.arcade.foods.length) addItems('foods', items.filter((x) => !save.arcade.foods.includes(x)))
            else update((s) => { s.arcade.foods = items })
          }} />
        {quickAdd(FOODS, 'foods')}
      </div>
      <div className="card">
        <h3>Other Games in the Arcade {live && <span className="dim small">(${PRICES.sideGame} per cabinet)</span>}</h3>
        <p className="dim small">Side cabinets where players hang out and socialize between sets. Rent scales with floor space.</p>
        <StringListEditor items={save.arcade.otherGames} placeholder="add game…"
          onChange={(items) => {
            if (items.length > save.arcade.otherGames.length) addItems('otherGames', items.filter((x) => !save.arcade.otherGames.includes(x)))
            else update((s) => { s.arcade.otherGames = items })
          }} />
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
