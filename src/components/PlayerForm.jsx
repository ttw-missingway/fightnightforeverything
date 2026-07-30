import { Field, NumField, PillPicker, PointDots, Portrait } from './ui.jsx'
import {
  PERSONAL_STATS, SOCIAL_STATS, GENDERS, difficultyOf,
  TEMPERAMENTS, SOCIAL_TEMPERAMENTS, STAT_UNIT, STAT_MAX_POINTS,
} from '../game/constants.js'
import { clamp } from '../game/util.js'
import { FOODS, OTHER_GAMES } from '../game/names.js'
import { randomIdentity, randomPreferences } from '../game/generate.js'
import { deriveVoice, DEFAULT_VOICE, VOICE_ENERGIES, VOICE_HUMORS, VOICE_SPEECHES, VOICE_QUIRKS } from '../game/dialogue.js'
import { SpritePicker } from './SpritePicker.jsx'
import { playerSpriteCatalog, playerArtFor, FACE_PALETTES } from './art.js'
import { DEFAULT_PALETTE } from '../game/palettes.js'
import { selectableChars } from '../game/forms.js'

const STAT_DESC = Object.fromEntries([...PERSONAL_STATS, ...SOCIAL_STATS])
const uiVal = (v) => Math.round((v || 0) / STAT_UNIT)

// Creation points spent: every point across every stat, minus the free point a
// chosen temperament grants each of its stats (only where a point actually sits).
function pointsSpent(player) {
  let total = 0
  for (const [k] of PERSONAL_STATS) total += uiVal(player.personal[k])
  for (const [k] of SOCIAL_STATS) total += uiVal(player.social[k])
  let free = 0
  const row = TEMPERAMENTS.find((t) => t.key === player.temperament)
  const srow = SOCIAL_TEMPERAMENTS.find((t) => t.key === player.socialTemperament)
  if (row) for (const k of row.stats) free += Math.min(1, uiVal(player.personal[k]))
  if (srow) for (const k of srow.stats) free += Math.min(1, uiVal(player.social[k]))
  return total - free
}

/**
 * Full player editor. `patch(fn)` applies fn to the live player object inside
 * the draft/save; works for both the setup wizard and mid-save editing.
 *
 * Consequential mode is a point-buy: each stat is capped by the difficulty,
 * and the total is bounded by the difficulty's stat points plus any banked
 * prestige from past runs.
 */
export default function PlayerForm({ save, player, patch }) {
  const consequential = save.settings.mode !== 'sandbox'
  const diff = difficultyOf(save)
  // The budget is the difficulty's, full stop. Banked prestige and the
  // champion bonus used to add to it; the revision deprecated the whole
  // prestige-as-power path (docs/DEPRECATED.md) — a returning run must never
  // start stronger, or "my player beat an elite" dies permanently.
  const budget = consequential ? diff.statPoints : null
  const spent = pointsSpent(player)

  return (
    <div>
      <div className="grid2">
        <div className="card sub">
          <div className="row spread">
            <h4>Identity</h4>
            <button className="small" onClick={() => patch((p) => Object.assign(p, randomIdentity(save)))}>
              🎲 Randomize identity
            </button>
          </div>
          <div className="row">
            <Field label="First name">
              <input value={player.firstName} onChange={(e) => patch((p) => { p.firstName = e.target.value })} />
            </Field>
            <Field label="Last name">
              <input value={player.lastName} onChange={(e) => patch((p) => { p.lastName = e.target.value })} />
            </Field>
          </div>
          <div className="row">
            <Field label="Alias / gamer tag">
              <input value={player.alias} onChange={(e) => patch((p) => { p.alias = e.target.value })} />
            </Field>
            <Field label="Gender">
              <select value={player.gender} onChange={(e) => patch((p) => { p.gender = e.target.value })}>
                {GENDERS.map((g) => <option key={g}>{g}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Portrait palette">
            {/* Everyone in the world carries their own palette; this is where
                you choose YOURS. The sprite grid below repaints as you pick. */}
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {FACE_PALETTES.map((pal) => {
                const on = (player.facePalette || DEFAULT_PALETTE) === pal.key
                return (
                  <button key={pal.key} type="button" title={pal.label}
                    className={`sprite-swatch${on ? ' on' : ''}`}
                    onClick={() => patch((p) => { p.facePalette = pal.key })}>
                    <Portrait size={30}
                      url={playerArtFor(player.id, player.gender, player.heritage, pal.key)}
                      alt={pal.label} />
                  </button>
                )
              })}
            </div>
            <div className="dim small" style={{ marginTop: 2 }}>
              {FACE_PALETTES.find((p) => p.key === (player.facePalette || DEFAULT_PALETTE))?.label}
            </div>
          </Field>
          <Field label="Sprite">
            <SpritePicker
              catalog={playerSpriteCatalog(player.facePalette)}
              value={player.spriteKey || null}
              autoUrl={playerArtFor(player.id, player.gender, player.heritage, player.facePalette)}
              onChange={(k) => patch((p) => { p.spriteKey = k })}
            />
          </Field>
          <Field label="Physical description">
            <textarea value={player.description} onChange={(e) => patch((p) => { p.description = e.target.value })} />
          </Field>
          <Field label='Catchphrase (they might say it when they win)'>
            <input value={player.catchphrase || ''} placeholder='"Too easy!"'
              onChange={(e) => patch((p) => { p.catchphrase = e.target.value })} />
          </Field>
          <Field label="Voice — how they talk">
            <div className="row">
              {[
                ['energy', VOICE_ENERGIES],
                ['humor', VOICE_HUMORS],
                ['speech', VOICE_SPEECHES],
                ['quirk', VOICE_QUIRKS],
              ].map(([dim, options]) => (
                <select key={dim} title={dim}
                  value={(player.voice || DEFAULT_VOICE)[dim]}
                  onChange={(e) => patch((p) => {
                    p.voice = { ...(p.voice || DEFAULT_VOICE), [dim]: e.target.value }
                  })}>
                  {options.map((o) => <option key={o} value={o}>{dim === 'quirk' && o !== 'none' ? `quirk: ${o}` : o}</option>)}
                </select>
              ))}
              <button className="small" title="derive voice from their stats"
                onClick={() => patch((p) => { p.voice = deriveVoice(p) })}>🎲 From stats</button>
            </div>
          </Field>
          <Field label="Their vibe (player tags)">
            <PillPicker options={save.game.playerTags || []} selected={player.playerTags || []}
              onToggle={(t) => patch((p) => {
                p.playerTags = (p.playerTags || []).includes(t)
                  ? p.playerTags.filter((x) => x !== t) : [...(p.playerTags || []), t]
              })} />
          </Field>
          <Field label="Drawn to people who are…">
            <PillPicker options={save.game.playerTags || []} selected={player.attractedPlayerTags || []}
              onToggle={(t) => patch((p) => {
                p.attractedPlayerTags = (p.attractedPlayerTags || []).includes(t)
                  ? p.attractedPlayerTags.filter((x) => x !== t) : [...(p.attractedPlayerTags || []), t]
                p.repelledPlayerTags = (p.repelledPlayerTags || []).filter((x) => x !== t)
              })} />
          </Field>
          <Field label="Put off by people who are…">
            <PillPicker options={save.game.playerTags || []} selected={[]} badSelected={player.repelledPlayerTags || []}
              onToggle={(t) => patch((p) => {
                p.repelledPlayerTags = (p.repelledPlayerTags || []).includes(t)
                  ? p.repelledPlayerTags.filter((x) => x !== t) : [...(p.repelledPlayerTags || []), t]
                p.attractedPlayerTags = (p.attractedPlayerTags || []).filter((x) => x !== t)
              })} />
          </Field>
        </div>

        <div className="card sub">
          <div className="row spread">
            <h4>Play Style</h4>
            <button className="small" onClick={() => patch((p) => { Object.assign(p, randomPreferences(save)) })}>
              🎲 Randomize preferences
            </button>
          </div>
          <Field label="Main character">
            <select value={player.mainCharId || ''} onChange={(e) => patch((p) => {
              p.mainCharId = e.target.value || null
              p.settledMain = !!p.mainCharId
              if (p.mainCharId && !(p.exploredChars || []).includes(p.mainCharId)) {
                p.exploredChars = [...(p.exploredChars || []), p.mainCharId]
              }
            })}>
              <option value="">Let them explore and find their own main</option>
              {selectableChars(save.game).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          {player.mainCharId && (
            <Field label="Lock main? (they'll never switch)">
              <input type="checkbox" checked={player.lockedMain}
                onChange={(e) => patch((p) => { p.lockedMain = e.target.checked })} />
            </Field>
          )}
          <NumField label="Default mood (0-10)" value={player.defaultMood} min={0} max={10}
            onChange={(v) => patch((p) => { p.defaultMood = v; p.mood = v })} />
          <Field label="Attracted to tags">
            <PillPicker options={save.game.tags} selected={player.attractedTags}
              onToggle={(t) => patch((p) => {
                p.attractedTags = p.attractedTags.includes(t)
                  ? p.attractedTags.filter((x) => x !== t) : [...p.attractedTags, t]
                p.repelledTags = p.repelledTags.filter((x) => x !== t)
              })} />
          </Field>
          <Field label="Repelled by tags">
            <PillPicker options={save.game.tags} selected={[]} badSelected={player.repelledTags}
              onToggle={(t) => patch((p) => {
                p.repelledTags = p.repelledTags.includes(t)
                  ? p.repelledTags.filter((x) => x !== t) : [...p.repelledTags, t]
                p.attractedTags = p.attractedTags.filter((x) => x !== t)
              })} />
          </Field>
          <div className="row">
            <Field label="Favorite food">
              <select value={(player.foods || [])[0] || ''}
                onChange={(e) => patch((p) => { p.foods = e.target.value ? [e.target.value] : [] })}>
                <option value="">no strong preference</option>
                {FOODS.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </Field>
            <Field label="Favorite side cabinet">
              <select value={(player.otherGames || [])[0] || ''}
                onChange={(e) => patch((p) => { p.otherGames = e.target.value ? [e.target.value] : [] })}>
                <option value="">no strong preference</option>
                {OTHER_GAMES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </Field>
          </div>
          <p className="dim small" style={{ margin: '4px 0' }}>
            Free to pick. Carrying their favorite is a real draw — but favorites are singular, foods
            sell out, and one cabinet only seats so many a night. A room full of people who all want
            the same thing is a room full of people about to be disappointed.
          </p>
        </div>
      </div>

      <div className="card sub">
        {/* Sticks to the top for as long as this section is on screen. The
            build is taller than the viewport, so without this the one number
            that decides whether you can afford the next dot is the one thing
            you have to scroll back up to check. */}
        <div className="row spread stickyhead">
          <h4>
            Temperament & Stats
            {/* This is the pot, so it drains: the dots start filled and go out
                as you place them in the rows below. The white on screen is
                conserved — a point leaves the top and appears on a stat — which
                is what the point-buy actually is, rather than two separate
                meters that happen to add up. */}
            {budget != null && (
              <span style={{ marginLeft: 10 }}>
                <PointDots compact value={Math.max(0, budget - spent)} max={budget} />
                <span className={`small ${spent > budget ? 'red' : 'dim'}`} style={{ marginLeft: 8, fontWeight: 'normal' }}>
                  {spent > budget ? `${spent - budget} over budget` : `${budget - spent} left`}
                </span>
              </span>
            )}
          </h4>
        </div>
        <p className="dim small" style={{ marginTop: 0 }}>
          Every stat starts empty — an unspent stat is a real weakness, not "average". Pick a
          competitive temperament and a social one (a free point in each of that row's stats),
          then spend your points wherever you like.
        </p>
        {budget != null && spent > budget && (
          <p className="red small">Over budget — lower some stats before this player is tournament-legal.</p>
        )}
        <TemperamentPicker
          title="Competitive temperament" list={TEMPERAMENTS} group="personal"
          chosen={player.temperament} field="temperament" patch={patch}
        />
        <PointStats player={player} patch={patch} group="personal" rows={TEMPERAMENTS}
          budget={budget} spent={spent} chosenRow={player.temperament} />
        <TemperamentPicker
          title="Social temperament" list={SOCIAL_TEMPERAMENTS} group="social"
          chosen={player.socialTemperament} field="socialTemperament" patch={patch}
        />
        <PointStats player={player} patch={patch} group="social" rows={SOCIAL_TEMPERAMENTS}
          budget={budget} spent={spent} chosenRow={player.socialTemperament} />
      </div>

      <div className="card sub">
        <h4>Advanced</h4>
        <div className="row">
          <NumField label="Elo" value={player.elo} min={0} max={4000} onChange={(v) => patch((p) => { p.elo = v })} />
          <NumField label="Glory" value={player.glory} min={0} max={9999} onChange={(v) => patch((p) => { p.glory = v })} />
          <NumField label="Respect" value={player.respect} min={0} max={9999} onChange={(v) => patch((p) => { p.respect = v })} />
          <NumField label="Current mood" value={Math.round(player.mood * 10) / 10} min={0} max={10}
            onChange={(v) => patch((p) => { p.mood = v })} />
        </div>
        {selectableChars(save.game).length > 0 && (
          <>
            <h4 className="dim">Character skill (0-100)</h4>
            <div className="grid3">
              {selectableChars(save.game).map((c) => (
                <div className="row" key={c.id}>
                  <span className="small" style={{ minWidth: 110 }}>{c.name}</span>
                  <input type="number" min={0} max={100} value={Math.round(player.charSkill[c.id] || 0)}
                    onChange={(e) => patch((p) => { p.charSkill[c.id] = Number(e.target.value) })} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * The temperament cards. Picking one grants a free point in each of its stats;
 * switching moves the grant (each old row stat drops a point, floored at zero).
 */
function TemperamentPicker({ title, list, group, chosen, field, patch }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <h4 className={group === 'personal' ? 'cyan' : 'pink'} style={{ marginBottom: 6 }}>{title}</h4>
      <div className={group === 'personal' ? 'grid2' : 'grid2'}>
        {list.map((t) => (
          <div key={t.key}
            className="card sub clickable"
            style={{
              cursor: 'pointer', margin: 0,
              borderColor: chosen === t.key ? (t.color || 'var(--pink)') : 'var(--border)',
              opacity: chosen && chosen !== t.key ? 0.75 : 1,
            }}
            onClick={() => patch((p) => {
              if (p[field] === t.key) return
              const bag = group === 'personal' ? p.personal : p.social
              const prev = list.find((x) => x.key === p[field])
              if (prev) for (const k of prev.stats) bag[k] = Math.max(0, (bag[k] || 0) - STAT_UNIT)
              p[field] = t.key
              for (const k of t.stats) bag[k] = Math.min(STAT_MAX_POINTS * STAT_UNIT, (bag[k] || 0) + STAT_UNIT)
            })}>
            <div className="row spread">
              <strong style={t.color ? { color: t.color } : {}}>{t.emoji} {t.label}</strong>
              {chosen === t.key && <span className="small" style={{ color: t.color || 'var(--pink)' }}>✓ chosen</span>}
            </div>
            <p className="dim small" style={{ margin: '4px 0 6px' }}>{t.blurb}</p>
            <div className="small" style={{ color: 'var(--cyan)' }}>{t.stats.join(' · ')}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Point-buy grid, grouped by temperament row so the build reads as a shape.
function PointStats({ player, patch, group, rows, budget, spent, chosenRow }) {
  const chosen = rows.find((t) => t.key === chosenRow)
  const statRow = (key) => {
    const val = uiVal(player[group][key])
    // A temperament isn't a suggestion: its granted point can't be traded away.
    const floor = chosen && chosen.stats.includes(key) ? 1 : 0
    const row = rows.find((t) => t.stats.includes(key))
    return (
      <PointDots key={key} label={key} value={val} max={STAT_MAX_POINTS}
        granted={floor} color={row?.color} title={STAT_DESC[key]}
        onChange={(n) => patch((p) => {
          let next = Math.max(floor, n)
          if (budget != null && next > val) next = Math.min(next, val + Math.max(0, budget - spent))
          p[group][key] = clamp(next, floor, STAT_MAX_POINTS) * STAT_UNIT
        })} />
    )
  }
  return (
    <div className="grid2" style={{ marginBottom: 10 }}>
      {rows.map((t) => (
        <div key={t.key} style={{ opacity: chosenRow && chosenRow !== t.key ? 0.9 : 1 }}>
          <h4 style={{ margin: '4px 0', color: t.color || 'var(--dim)' }}>
            {t.emoji} {t.label}{chosenRow === t.key && <span className="pink small"> · your temperament</span>}
          </h4>
          {t.stats.map(statRow)}
        </div>
      ))}
    </div>
  )
}
