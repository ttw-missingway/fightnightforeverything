import { useState } from 'react'
import { Field, NumField, StringListEditor, PillPicker } from './ui.jsx'
import { newCharacter, newMove, newStage, newTournamentEntry } from '../game/model.js'
import {
  generateCharacter, generateGameTitle, generateArcadeName,
  generateStage, generateTournamentName,
  generateChannelName,
} from '../game/generate.js'
import {
  ARCHETYPE_KITS, applyArchetypeKit, generateMoveNameForType, STAGE_VIBES,
  generateMoveData, generateCombo, comboDamage, comboRoute, adjustCharacterPower,
} from '../game/design.js'
import { computeMatchup, matchupExplanation } from '../game/balance.js'
import {
  ARCHETYPES, MOVE_TYPES, DAYS_PER_YEAR, EVO_DAY, formatDay, WEEKDAYS, BRACKET_SIZES,
  DIFFICULTIES, difficultyOf, DEFAULT_FOOD_PRICE, DEFAULT_GAME_TOKENS, AD_CHANNELS,
} from '../game/constants.js'
import { CHARACTER_NAMES, TAG_SUGGESTIONS, PLAYER_TAG_SUGGESTIONS } from '../game/names.js'
import { choice, sample, displayName } from '../game/util.js'
import {
  trySpend, monthlyRent, weeklyUpkeep, projectedMonthlyCost, SETUP_COST,
  startingBudget, arcadeBuildCost, foodPriceOf, gameTokensOf,
  FOOD_CATALOG, GAME_CATALOG, adWeeklyCost, adEffectiveness,
  FAIR_WAGE, HIRE_COST, newStaffMember, staffCounts, managementQuality, isStaffed,
  playerStaffAppeal,
} from '../game/economy.js'
import { SpritePicker, StagePicker } from './SpritePicker.jsx'
import { CHAR_SPRITE_CATALOG, charArtFor, stageArt } from './art.js'

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
        Income: tokens and food the players actually buy, plus stream ad revenue.
      </p>
      <div className="row spread" style={{ borderTop: '1px solid var(--border)', paddingTop: 6, marginBottom: 6 }}>
        <span className="small">📅 Projected running cost</span>
        <span className="small gold">~${projectedMonthlyCost(save)}/month</span>
      </div>
      <p className="dim small" style={{ marginTop: 0 }}>
        Rent ${monthlyRent(save)} on the 1st · restocking &amp; upkeep ${weeklyUpkeep(save)}/wk ·
        payroll ${(staffCounts(save).employees * (save.staffing?.employeeWage || 0) + staffCounts(save).managers * (save.staffing?.managerWage || 0))}/day.
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
        {locked ? (
          <p className="dim small">
            🧑‍🤝‍🧑 Generated players fill the roster automatically over time, up to the 48-player cap —
            more regulars is always a good thing for business, so there's no cap to set.
          </p>
        ) : (
          <>
            <Field label="Allow computer-generated players?">
              <select
                value={save.settings.allowGeneratedPlayers ? 'yes' : 'no'}
                onChange={(e) => update((s) => { s.settings.allowGeneratedPlayers = e.target.value === 'yes' })}>
                <option value="yes">Yes — new faces wander in over time</option>
                <option value="no">No — only my created players</option>
              </select>
            </Field>
            {save.settings.allowGeneratedPlayers && (
              <Field label="Max generated players">
                <input type="number" min={0} max={60} value={save.settings.maxGeneratedPlayers}
                  onChange={(e) => update((s) => { s.settings.maxGeneratedPlayers = Number(e.target.value) })} />
              </Field>
            )}
          </>
        )}
        {save.settings.mode !== 'sandbox' && (
          <Field label="Difficulty (locked at creation)">
            <select disabled value={save.settings.difficulty || 'normal'}>
              {DIFFICULTIES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
          </Field>
        )}
      </div>
    </div>
  )
}

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
        <Field label="Location (aesthetic only)">
          <div className="row">
            <input placeholder="city" value={save.arcade.location?.city || ''}
              onChange={(e) => update((s) => { s.arcade.location.city = e.target.value })} />
            <input placeholder="state / region" value={save.arcade.location?.state || ''}
              onChange={(e) => update((s) => { s.arcade.location.state = e.target.value })} />
            <input placeholder="country" value={save.arcade.location?.country || ''}
              onChange={(e) => update((s) => { s.arcade.location.country = e.target.value })} />
          </div>
        </Field>
        <Field label="Stream channel name">
          <div className="row">
            <input value={save.stream?.channelName || ''} onChange={(e) => update((s) => { s.stream.channelName = e.target.value })} />
            <button className="small" title="random name" onClick={() => update((s) => { s.stream.channelName = generateChannelName() })}>🎲</button>
          </div>
        </Field>
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
        <h3>Commitment</h3>
        <Field label="How locked-in is this world?">
          <select value={save.settings.mode || 'consequential'}
            onChange={(e) => update((s) => { s.settings.mode = e.target.value })}>
            <option value="consequential">Consequential — settings lock, purchases cost, patches have fallout</option>
            <option value="sandbox">Sandbox — adjust everything freely, no consequences</option>
          </select>
        </Field>
        <p className="dim small">
          Consequential: world rules freeze at creation, mid-save additions cost money, the landlord can
          foreclose, and every game patch triggers a community reaction that matters. Sandbox: tune
          anything anytime, for free.
        </p>
        {save.settings.mode !== 'sandbox' && (
          <>
            <Field label="Difficulty">
              <select value={save.settings.difficulty || 'normal'}
                onChange={(e) => update((s) => { s.settings.difficulty = e.target.value })}>
                {DIFFICULTIES.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>
            </Field>
            <p className="dim small" style={{ marginTop: 0 }}>
              {difficultyOf(save).blurb}{' '}
              Starting budget <strong className="green">${difficultyOf(save).startingMoney}</strong> (spent building your
              arcade; the rest is opening cash) · {difficultyOf(save).statPoints} stat points per created
              player (cap {difficultyOf(save).statCap}/stat) · rent ×{difficultyOf(save).rentMult} ·
              popularity gain ×{difficultyOf(save).popularityMult}.
            </p>
          </>
        )}
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
      <div className="grid2">
        <IncomeChart save={save} />
        <FootTraffic save={save} />
      </div>
      <PricesEditor save={save} update={update} />
      <ArcadeEditor save={save} update={update} live={live} />
    </div>
  )
}

// Trailing slice of the daily economy history (newest last), only rows with
// the field we're charting present.
function recentHistory(save, n, field) {
  const h = save.economy?.history || []
  return h.filter((d) => d[field] != null).slice(-n)
}

// Daily net income as up/down bars over the last few weeks. Green above the
// zero line, red below it — a quick read on whether the arcade is bleeding.
export function IncomeChart({ save }) {
  const data = recentHistory(save, 30, 'net')
  const W = 320
  const H = 96
  if (data.length < 2) {
    return (
      <div className="card">
        <h3>📈 Daily income</h3>
        <p className="dim small">Not enough days yet — play a few and the trend shows up here.</p>
      </div>
    )
  }
  const nets = data.map((d) => d.net)
  const peak = Math.max(1, ...nets.map((v) => Math.abs(v)))
  const mid = H / 2
  const bw = W / data.length
  const total = nets.reduce((s, v) => s + v, 0)
  const avg = total / nets.length
  const best = Math.max(...nets)
  const worst = Math.min(...nets)
  return (
    <div className="card">
      <div className="row spread">
        <h3 style={{ margin: 0 }}>📈 Daily income</h3>
        <span className={`small ${avg >= 0 ? 'green' : 'red'}`}>
          avg {avg >= 0 ? '+' : '−'}${Math.abs(avg).toFixed(0)}/day
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ marginTop: 6, display: 'block' }}>
        <line x1="0" y1={mid} x2={W} y2={mid} stroke="var(--border)" strokeWidth="1" />
        {data.map((d, i) => {
          const h = (Math.abs(d.net) / peak) * (mid - 3)
          const up = d.net >= 0
          return (
            <rect key={i} x={i * bw + 1} y={up ? mid - h : mid} width={Math.max(1, bw - 2)} height={Math.max(0.5, h)}
              fill={up ? 'var(--green)' : 'var(--red)'} opacity={i === data.length - 1 ? 1 : 0.72}>
              <title>{`Day ${d.absDay}: ${up ? '+' : '−'}$${Math.abs(d.net).toFixed(0)}`}</title>
            </rect>
          )
        })}
      </svg>
      <div className="row spread" style={{ marginTop: 4 }}>
        <span className="small green">best +${best.toFixed(0)}</span>
        <span className="dim small">last {data.length} days</span>
        <span className="small red">worst {worst < 0 ? '−' : '+'}${Math.abs(worst).toFixed(0)}</span>
      </div>
    </div>
  )
}

// Foot traffic: how many people came through the door today, with a sparkline
// of the last few weeks and the running average.
export function FootTraffic({ save }) {
  const data = recentHistory(save, 30, 'attendance')
  const latest = data.length ? data[data.length - 1].attendance : null
  const W = 320
  const H = 56
  if (data.length < 2) {
    return (
      <div className="card">
        <h3>🚶 Foot traffic</h3>
        <div style={{ fontSize: 30, fontWeight: 700 }} className="cyan">{latest ?? '—'}</div>
        <p className="dim small">through the door today</p>
      </div>
    )
  }
  const counts = data.map((d) => d.attendance)
  const peak = Math.max(1, ...counts)
  const avg = counts.reduce((s, v) => s + v, 0) / counts.length
  const stepX = W / (counts.length - 1)
  const pts = counts.map((v, i) => `${(i * stepX).toFixed(1)},${(H - 3 - (v / peak) * (H - 6)).toFixed(1)}`).join(' ')
  return (
    <div className="card">
      <div className="row spread">
        <h3 style={{ margin: 0 }}>🚶 Foot traffic</h3>
        <span className="small dim">avg {avg.toFixed(1)}/day</span>
      </div>
      <div className="row" style={{ alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 30, fontWeight: 700 }} className="cyan">{latest ?? '—'}</span>
        <span className="dim small">through the door today · peak {peak}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ marginTop: 4, display: 'block' }}>
        <polyline points={pts} fill="none" stroke="var(--cyan)" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />
        {counts.map((v, i) => (
          <circle key={i} cx={i * stepX} cy={H - 3 - (v / peak) * (H - 6)} r={i === counts.length - 1 ? 3 : 1.5}
            fill="var(--cyan)">
            <title>{`Day ${data[i].absDay}: ${v}`}</title>
          </circle>
        ))}
      </svg>
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
          <Field label="Sprite">
            <SpritePicker
              catalog={CHAR_SPRITE_CATALOG}
              value={sel.spriteKey || null}
              autoUrl={charArtFor(sel.id, sel.archetype)}
              onChange={(k) => patchChar((c) => { c.spriteKey = k })}
            />
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
          <Field label="Quick balance">
            <div className="row">
              <button className="small" title="scale the whole kit up a little"
                onClick={() => patchChar((c) => adjustCharacterPower(c, 'buff', 'light'))}>▲ Light buff</button>
              <button className="small" title="scale the whole kit down a little"
                onClick={() => patchChar((c) => adjustCharacterPower(c, 'nerf', 'light'))}>▼ Light nerf</button>
              <button className="small" title="scale the whole kit up hard"
                onClick={() => patchChar((c) => adjustCharacterPower(c, 'buff', 'heavy'))}>⏫ Heavy buff</button>
              <button className="small" title="scale the whole kit down hard"
                onClick={() => patchChar((c) => adjustCharacterPower(c, 'nerf', 'heavy'))}>⏬ Heavy nerf</button>
            </div>
            <p className="dim small" style={{ margin: '4px 0 0' }}>
              A one-click shortcut for when you don't want to hand-tune frame data: shoves every move's
              damage, startup/recovery, block advantage and meter cost together so the character actually
              moves on the chart. Blunt by design — stack them for bigger swings. All changes land in the
              patch notes.
            </p>
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
export function MatchupReport({ save, observe = null, confidence = 1, games = 0, changedIds = new Set() }) {
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
        const draftPair = changedIds.has(a.id) || changedIds.has(b.id)
        const margin = draftPair ? 9 : Math.round((1 - confidence) * 4.5)
        return (
          <div key={`${a.id}|${b.id}`} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="row spread">
              <span className="small">
                <strong>{a.name}</strong> vs <strong>{b.name}</strong>
                {draftPair && <span className="red small"> ✏ unreleased changes — projection</span>}
              </span>
              <span className={`small ${Math.abs(mu - 50) >= 8 ? 'red' : Math.abs(mu - 50) >= 4 ? 'gold' : 'green'}`}>
                {mu}–{100 - mu}{observe && margin > 0 && <span className="dim"> ±{margin}</span>}
              </span>
            </div>
            <div className="track" style={{ height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${mu}%`, height: '100%', background: 'linear-gradient(90deg, var(--cyan), var(--pink))' }} />
            </div>
            <span className="dim small">
              {draftPair
                ? 'design spreadsheet math — nobody has played a single set on these numbers'
                : observe && confidence < 0.25 ? 'too early to say why — the data is still arguing with itself' : matchupExplanation(a, b)}
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
      <p className="dim small">Stages set the backdrop matches are fought on — pick each one's art below.</p>
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
          <div style={{ margin: '6px 0' }}>
            <StagePicker
              value={st.bgKey || null}
              autoStage={stageArt({ ...st, bgKey: null })}
              onChange={(k) => update((s) => {
                const x = s.game.stages.find((y) => y.id === st.id); if (x) x.bgKey = k
              })}
            />
          </div>
          <textarea placeholder="description…" value={st.description} onChange={(e) => update((s) => {
            const x = s.game.stages.find((y) => y.id === st.id); if (x) x.description = e.target.value
          })} />
        </div>
      ))}
    </div>
  )
}

/**
 * The concession stand and the side-cabinet floor, from FIXED catalogs —
 * no more inventing menu items. Every item has a real price tag: an install
 * cost up front and a weekly upkeep/restock. Prices are always shown.
 *
 * `live` (mid-save) spends destructively from the account. `budget`
 * (creation) shows costs and a budget bar but doesn't touch the account — the
 * leftover becomes opening cash at start. Sandbox: everything is free.
 */
export function ArcadeEditor({ save, update, live = false, budget = false }) {
  const priced = live || budget
  const toggle = (key, name, initialCost, costLabel) => update((s) => {
    const owned = s.arcade[key].includes(name)
    if (owned) {
      s.arcade[key] = s.arcade[key].filter((x) => x !== name)
    } else {
      if (live && !trySpend(s, initialCost, costLabel)) return
      s.arcade[key].push(name)
      // Seed a default price so it's sellable from day one (editable in Prices).
      if (key === 'foods') { s.arcade.foodPrices = { ...(s.arcade.foodPrices || {}) }; s.arcade.foodPrices[name] ??= DEFAULT_FOOD_PRICE }
      if (key === 'otherGames') { s.arcade.gameTokens = { ...(s.arcade.gameTokens || {}) }; s.arcade.gameTokens[name] ??= DEFAULT_GAME_TOKENS }
    }
  })

  const setSetups = (v) => update((s) => {
    const cur = s.settings.setups
    if (live && v > cur) {
      let n = cur
      while (n < v && trySpend(s, SETUP_COST, 'new setup cabinet')) n++
      s.settings.setups = n
    } else {
      s.settings.setups = Math.max(1, v)
    }
  })

  const catalogCard = (title, blurb, key, catalog, describe, costOf, labelOf) => (
    <div className="card">
      <h3>{title}</h3>
      <p className="dim small">{blurb}</p>
      {catalog.map((item) => {
        const owned = save.arcade[key].includes(item.name)
        return (
          <div className="row spread" key={item.name} style={{ borderBottom: '1px solid var(--border)', padding: '3px 0' }}>
            <span className={`pill clickable ${owned ? 'on' : ''}`}
              onClick={() => toggle(key, item.name, costOf(item), labelOf(item))}>
              {owned ? '✓ ' : '+ '}{item.name}
            </span>
            <span className="dim small">{describe(item)}</span>
          </div>
        )
      })}
      {/* Legacy custom items from before the fixed catalogs still work — they just can't be re-added. */}
      {save.arcade[key].filter((n) => !catalog.some((c) => c.name === n)).map((n) => (
        <div className="row spread" key={n} style={{ padding: '3px 0' }}>
          <span className="pill on clickable" onClick={() => toggle(key, n, 0, '')}>✓ {n}</span>
          <span className="dim small">custom (legacy)</span>
        </div>
      ))}
    </div>
  )

  return (
    <div>
      {budget && <BudgetBar save={save} />}
      <div className="card">
        <h3>🕹 Setups <span className="dim small">— cabinets running {save.game.name || 'the main game'}</span></h3>
        <p className="dim small">
          More setups mean more matches an hour (and more token income), but each cabinet
          {priced ? <> costs <strong className="gold">${SETUP_COST}</strong> to install and</> : ''} adds to the rent and upkeep.
        </p>
        <NumField label="Number of setups" value={save.settings.setups} min={1} max={20} onChange={setSetups} />
      </div>
      <div className="grid2">
        {catalogCard(
          'Concession Stand',
          'Players who find their favorite snacks show up more often — and buy them at the price you set. Stocking costs up front; restocking hits the books weekly.',
          'foods', FOOD_CATALOG,
          (f) => `${priced ? `$${f.stockCost} to stock · ` : ''}$${f.restock}/wk restock`,
          (f) => f.stockCost, (f) => `stocked ${f.name}`,
        )}
        {catalogCard(
          'Other Games in the Arcade',
          'Side cabinets where players hang out between sets. Each has an up-front installation fee, needs weekly maintenance, and adds to the rent.',
          'otherGames', GAME_CATALOG,
          (g) => `${priced ? `$${g.price} to install · ` : ''}$${g.upkeep}/wk upkeep`,
          (g) => g.price, (g) => `installed ${g.name} cabinet`,
        )}
      </div>
      <AdvertisingEditor save={save} update={update} />
    </div>
  )
}

// Advertising: how you get people through the door, especially early. Each
// channel is a recurring weekly upkeep cost. Some reach further while you're
// unknown; others hold momentum or steer public opinion once you're rolling.
export function AdvertisingEditor({ save, update }) {
  const active = save.arcade.ads || []
  const toggle = (key) => update((s) => {
    const cur = s.arcade.ads || []
    s.arcade.ads = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]
  })
  const phaseHint = (c) => {
    if (c.phase === 'opinion') return { text: '📣 steers opinion', color: 'var(--cyan)' }
    if (c.phase === 'steady') return { text: '🔁 steady momentum', color: 'var(--cyan)' }
    if (c.phase === 'late') return { text: '💪 late-game reach', color: 'var(--gold)' }
    // early: effectiveness fades as you become known
    const eff = adEffectiveness(save, c)
    if (eff >= 0.7) return { text: '🔥 great right now', color: 'var(--green)' }
    if (eff >= 0.35) return { text: '📉 fading — you\'re getting known', color: 'var(--gold)' }
    return { text: '🥱 barely worth it now', color: 'var(--red)' }
  }
  return (
    <div className="card">
      <div className="row spread">
        <h3>📣 Advertising</h3>
        <span className="small gold">+${adWeeklyCost(save)}/wk to upkeep</span>
      </div>
      <p className="dim small">
        Run as many channels as you like — each adds its weekly cost to your upkeep bill. This is the
        main way to get people through the door before there's a scene to speak of.
      </p>
      {AD_CHANNELS.map((c) => {
        const on = active.includes(c.key)
        const hint = phaseHint(c)
        return (
          <div key={c.key} className="row spread" style={{ borderBottom: '1px solid var(--border)', padding: '5px 0', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <span className={`pill clickable ${on ? 'on' : ''}`} onClick={() => toggle(c.key)}>
                {on ? '✓ ' : '+ '}{c.label}
              </span>
              <span className="small" style={{ color: hint.color, marginLeft: 6 }}>{hint.text}</span>
              <p className="dim small" style={{ margin: '3px 0 0' }}>{c.blurb}</p>
            </div>
            <span className="small gold" style={{ whiteSpace: 'nowrap', marginLeft: 8 }}>${c.cost}/wk</span>
          </div>
        )
      })}
    </div>
  )
}

// The creation budget: your difficulty's starting funds, spent building the
// arcade. Shown while setting up so you can see what's left before you open.
export function BudgetBar({ save }) {
  if (save.settings.mode === 'sandbox') return null
  const budget = startingBudget(save)
  const spent = arcadeBuildCost(save)
  const left = budget - spent
  const pct = Math.max(0, Math.min(100, Math.round((spent / budget) * 100)))
  return (
    <div className="card sub" style={{ marginBottom: 10, ...(left < 0 ? { borderColor: 'var(--red)' } : {}) }}>
      <div className="row spread">
        <span className="small">💰 Build budget</span>
        <span className={`small ${left < 0 ? 'red' : 'green'}`}>
          ${spent} spent · <strong>${left}</strong> {left < 0 ? 'over budget' : 'left to open with'}
        </span>
      </div>
      <div className="track" style={{ height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden', marginTop: 4 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: left < 0 ? 'var(--red)' : left < budget * 0.15 ? 'var(--gold)' : 'linear-gradient(90deg, var(--cyan), var(--green))' }} />
      </div>
      <div className="row spread" style={{ marginTop: 6 }}>
        <span className="dim small">of ${budget} starting budget</span>
        <span className="dim small">then ~${projectedMonthlyCost(save)}/month to run</span>
      </div>
    </div>
  )
}

// The owner sets the prices; the players vote with their wallets. One global
// token price (what a token costs), a per-cabinet token cost to play each
// side game, and a per-item dollar price for every food.
export function PricesEditor({ save, update }) {
  const token = save.arcade.prices?.token ?? 1
  return (
    <div className="card">
      <h3>💲 Prices</h3>
      <p className="dim small">
        A token costs the price below; the main game is a token a match. Each side cabinet costs a
        set number of tokens to play, and each food has its own dollar price. Price anything too high
        and players play less, snack less, and grumble on the way out — high-income players barely notice.
      </p>
      <div style={{ maxWidth: 260 }}>
        <NumField label="Token price ($ per token)" value={token} min={0.25} max={10} step={0.25}
          onChange={(v) => update((s) => { s.arcade.prices = { ...(s.arcade.prices || {}), token: v } })} />
      </div>

      <div className="grid2" style={{ marginTop: 8 }}>
        <div>
          <h4 style={{ margin: '4px 0' }}>Side cabinets <span className="dim small">(tokens to play)</span></h4>
          {save.arcade.otherGames.length === 0 && <p className="dim small">No side cabinets installed.</p>}
          {save.arcade.otherGames.map((g) => (
            <div className="row spread" key={g} style={{ padding: '2px 0' }}>
              <span className="small">{g}</span>
              <span className="row" style={{ gap: 4 }}>
                <input type="number" className="fd" min={1} max={12} value={gameTokensOf(save, g)}
                  onChange={(e) => update((s) => {
                    s.arcade.gameTokens = { ...(s.arcade.gameTokens || {}), [g]: Math.max(1, Number(e.target.value)) }
                  })} />
                <span className="dim small">tokens</span>
              </span>
            </div>
          ))}
        </div>
        <div>
          <h4 style={{ margin: '4px 0' }}>Concessions <span className="dim small">($ per item)</span></h4>
          {save.arcade.foods.length === 0 && <p className="dim small">No food stocked.</p>}
          {save.arcade.foods.map((f) => (
            <div className="row spread" key={f} style={{ padding: '2px 0' }}>
              <span className="small">{f}</span>
              <span className="row" style={{ gap: 4 }}>
                <span className="dim small">$</span>
                <input type="number" className="fd" min={1} max={30} step={0.5} value={foodPriceOf(save, f)}
                  onChange={(e) => update((s) => {
                    s.arcade.foodPrices = { ...(s.arcade.foodPrices || {}), [f]: Math.max(0.5, Number(e.target.value)) }
                  })} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Payroll and the people on it. Wages are the levers: underpay and staff
 * quit and stop caring (dirty floor, broken machines, unhappy players);
 * managers keep the floor effective — in the right ratio. Players can be
 * hired too, but nobody works the counter and plays at the same time.
 */
export function StaffManagement({ save, update }) {
  const st = save.staffing
  const live = save.settings.mode !== 'sandbox'
  const { employees, managers } = staffCounts(save)
  const mgmt = managementQuality(save)
  const clean = Math.round(save.arcade.cleanliness ?? 80)
  const hirable = Object.values(save.players).filter((p) => p.isRegular && !p.retired && !isStaffed(save, p.id))
  const [hirePlayerId, setHirePlayerId] = useState('')
  const draw = playerStaffAppeal(save)
  // Per-player pull if put behind the counter — mirrors playerStaffAppeal's
  // single-member contribution, so the dropdown can flag who's actually a draw.
  const appealOf = (p) => {
    const fame = Math.max(0, Math.min(1, (p.respect + p.glory * 1.2) / 100))
    const warmth = (((p.social?.community ?? 5) + (p.social?.charisma ?? 5)) / 20)
    return fame * 0.75 + warmth * 0.35
  }

  const hire = (role, playerId = null) => update((s) => {
    if (live && !trySpend(s, HIRE_COST, `hired a ${role}`)) return
    const player = playerId ? s.players[playerId] : null
    const member = newStaffMember(role, playerId, player ? `${player.firstName} ${player.lastName}` : null)
    s.staffing.staff.push(member)
  })

  const meter = (label, value, goodAt) => (
    <div style={{ flex: 1, minWidth: 180 }}>
      <div className="row spread">
        <span className="small">{label}</span>
        <span className={`small ${value >= goodAt ? 'green' : value >= goodAt * 0.6 ? 'gold' : 'red'}`}>{value}</span>
      </div>
      <div className="track" style={{ height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: value >= goodAt ? 'var(--green)' : value >= goodAt * 0.6 ? 'var(--gold)' : 'var(--red)' }} />
      </div>
    </div>
  )

  return (
    <div>
      <div className="card">
        <h3>🧹 Staff</h3>
        <div className="row" style={{ gap: 16 }}>
          {meter('Staff morale', Math.round(st.morale), 60)}
          {meter('Cleanliness', clean, 55)}
          {meter('Management', Math.round(mgmt * 100), 60)}
          {draw > 0.05 && meter('Counter draw', Math.min(100, Math.round(draw * 55)), 40)}
        </div>
        <p className="dim small">
          Employees clean and keep customers happy. Managers keep employees effective (about one per
          four employees, fairly paid) — too few and the floor slips and machines break; too many and
          people quit. Cleanliness below 30 invites the health inspector, and a failed inspection means
          a temporary shutdown.
        </p>
      </div>

      <div className="grid2">
        <div className="card">
          <h4 style={{ marginTop: 0 }}>Wages <span className="dim small">(per person, per day — market rate: ${FAIR_WAGE.employee} / ${FAIR_WAGE.manager})</span></h4>
          <div className="row">
            <NumField label="Employee wage ($/day)" value={st.employeeWage} min={1} max={40}
              onChange={(v) => update((s) => { s.staffing.employeeWage = v })} />
            <NumField label="Manager wage ($/day)" value={st.managerWage} min={1} max={60}
              onChange={(v) => update((s) => { s.staffing.managerWage = v })} />
          </div>
          <p className="dim small">
            Daily payroll: ${employees * st.employeeWage + managers * st.managerWage}
            {' '}({employees} employee{employees === 1 ? '' : 's'}, {managers} manager{managers === 1 ? '' : 's'}).
            Underpaying drives turnover and tanks morale.
          </p>
          <div className="row">
            <button className="small" onClick={() => hire('employee')}>+ Hire employee{live ? ` ($${HIRE_COST})` : ''}</button>
            <button className="small" onClick={() => hire('manager')}>+ Hire manager{live ? ` ($${HIRE_COST})` : ''}</button>
          </div>
          {hirable.length > 0 && (
            <div className="row" style={{ marginTop: 6 }}>
              <select value={hirePlayerId} onChange={(e) => setHirePlayerId(e.target.value)}>
                <option value="">Hire a player…</option>
                {[...hirable].sort((a, b) => appealOf(b) - appealOf(a)).map((p) => (
                  <option key={p.id} value={p.id}>
                    {appealOf(p) >= 0.6 ? '⭐ ' : ''}{displayName(p, save)} — draw {appealOf(p).toFixed(1)}
                  </option>
                ))}
              </select>
              <button className="small" disabled={!hirePlayerId}
                title="a familiar face draws regulars in and lifts staff morale — but they can't compete while working"
                onClick={() => { hire('employee', hirePlayerId); setHirePlayerId('') }}>
                Put them on the counter
              </button>
            </div>
          )}
          <p className="dim small">
            <b>Outside hire:</b> pure labor — cheap, and you don't lose a competitor.{' '}
            <b>Put a player on the counter:</b> a familiar (or famous) face is a draw — regulars
            turn up to hang out where their friend works, and a community-minded player lifts staff
            morale. The cost: they can't compete or train while on shift, and their passion slowly
            cools. Staff who watch enough sets sometimes quit to become players.
          </p>
        </div>

        <div className="card">
          <h4 style={{ marginTop: 0 }}>On the payroll ({st.staff.length})</h4>
          {st.staff.length === 0 && <p className="dim">Nobody. You're mopping this floor yourself.</p>}
          {st.staff.map((s) => (
            <div className="row spread" key={s.id} style={{ borderBottom: '1px solid var(--border)', padding: '3px 0' }}>
              <span className="small">
                {s.role === 'manager' ? '📋' : '🧹'} {s.name}
                <span className="dim"> — {s.role}</span>
                {s.playerId && <span className="cyan small"> (player)</span>}
              </span>
              <button className="small danger" onClick={() => update((x) => {
                x.staffing.staff = x.staffing.staff.filter((y) => y.id !== s.id)
              })}>let go</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ScheduleEditor({ save, update }) {
  const consequential = save.settings.mode !== 'sandbox'
  // Consequential worlds hold real tournaments to a floor: no sub-8-player
  // singles brackets and no sub-4-team crew battles. Sandbox allows anything.
  const minBracket = (type) => (consequential ? (type === 'teams' ? 4 : 8) : 2)

  const patchEntry = (id, fn) => update((s) => {
    const x = s.arcade.schedule.find((y) => y.id === id)
    if (x) fn(x)
  })
  return (
    <div className="card">
      <div className="row spread">
        <h3>Recurring Tournaments</h3>
        <button className="small" onClick={() => update((s) => {
          s.arcade.schedule.push(newTournamentEntry({ name: generateTournamentName(), size: minBracket('singles') }))
        })}>+ Schedule tournament</button>
      </div>
      <p className="dim small">
        Brackets are always a power of two — the bracket size you set here is the invite list, filled by
        elo + reputation. If the slots can't be filled, that running of the tournament is cancelled.
        {consequential && ' Consequential worlds require at least 8 players (singles) or 4 teams (crew battles).'}
        {' '}EVO happens automatically on day {EVO_DAY} ({formatDay(EVO_DAY, 1).replace(', Year 1', '')}) every year — your top 8 qualify.
      </p>
      {save.arcade.schedule.map((t) => (
        <div className="card sub" key={t.id}>
          <div className="row">
            <input value={t.name} style={{ minWidth: 180 }}
              onChange={(e) => patchEntry(t.id, (x) => { x.name = e.target.value })} />
            <button className="small" title="random name"
              onClick={() => patchEntry(t.id, (x) => { x.name = generateTournamentName() })}>🎲</button>
            <select value={t.type} onChange={(e) => patchEntry(t.id, (x) => {
              x.type = e.target.value
              // Switching type may make the size illegal (e.g. a 4-team bracket
              // becoming a singles bracket) — bump it up to the new floor.
              const min = minBracket(x.type)
              if ((x.size || 8) < min) x.size = min
            })}>
              <option value="singles">Singles</option>
              <option value="teams">Team battle</option>
            </select>
            {t.type === 'singles' && (
              <select value={t.format || 'single'} title="bracket format"
                onChange={(e) => patchEntry(t.id, (x) => { x.format = e.target.value })}>
                <option value="single">Single elim</option>
                <option value="doubleelim">Double elim</option>
                <option value="roundrobin">Round robin</option>
              </select>
            )}
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
              <select value={Math.max(t.size || 8, minBracket(t.type))}
                onChange={(e) => patchEntry(t.id, (x) => { x.size = Number(e.target.value) })}>
                {BRACKET_SIZES.filter((n) => n >= minBracket(t.type)).map((n) => (
                  <option key={n} value={n}>{n} {t.type === 'teams' ? 'teams' : 'players'}</option>
                ))}
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
