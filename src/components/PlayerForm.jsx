import { useState } from 'react'
import { Field, NumField, PillPicker } from './ui.jsx'
import { PERSONAL_STATS, SOCIAL_STATS, GENDERS } from '../game/constants.js'
import { rollStat } from '../game/util.js'
import { randomIdentity, randomPreferences } from '../game/generate.js'

/**
 * Full player editor. `patch(fn)` applies fn to the live player object inside
 * the draft/save; works for both the setup wizard and mid-save editing.
 */
export default function PlayerForm({ save, player, patch }) {
  const [statMode, setStatMode] = useState('direct') // 'direct' | 'roll'

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
          <Field label="Physical description">
            <textarea value={player.description} onChange={(e) => patch((p) => { p.description = e.target.value })} />
          </Field>
          <Field label='Catchphrase (they might say it when they win)'>
            <input value={player.catchphrase || ''} placeholder='"Too easy!"'
              onChange={(e) => patch((p) => { p.catchphrase = e.target.value })} />
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
            <button className="small" onClick={() => patch((p) => Object.assign(p, randomPreferences(save)))}>
              🎲 Randomize preferences
            </button>
          </div>
          <Field label="Main character">
            <select value={player.mainCharId || ''} onChange={(e) => patch((p) => { p.mainCharId = e.target.value || null })}>
              <option value="">Let them find their own main</option>
              {save.game.characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
          <Field label="Other games they like">
            <PillPicker options={save.arcade.otherGames} selected={player.otherGames}
              onToggle={(g) => patch((p) => {
                p.otherGames = p.otherGames.includes(g) ? p.otherGames.filter((x) => x !== g) : [...p.otherGames, g]
              })} />
          </Field>
          <Field label="Foods they like">
            <PillPicker options={save.arcade.foods} selected={player.foods}
              onToggle={(f) => patch((p) => {
                p.foods = p.foods.includes(f) ? p.foods.filter((x) => x !== f) : [...p.foods, f]
              })} />
          </Field>
        </div>
      </div>

      <div className="card sub">
        <div className="row spread">
          <h4>Stats</h4>
          <div className="tabs" style={{ margin: 0 }}>
            <button className={`small ${statMode === 'direct' ? 'active' : ''}`} onClick={() => setStatMode('direct')}>Edit directly</button>
            <button className={`small ${statMode === 'roll' ? 'active' : ''}`} onClick={() => setStatMode('roll')}>🎲 Roll & allocate</button>
          </div>
        </div>
        {statMode === 'direct' ? <DirectStats player={player} patch={patch} /> : <RollAllocate player={player} patch={patch} />}
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
        {save.game.characters.length > 0 && (
          <>
            <h4 className="dim">Character skill (0-100)</h4>
            <div className="grid3">
              {save.game.characters.map((c) => (
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

function DirectStats({ player, patch }) {
  const statRow = (group, [key, desc]) => (
    <div className="row" key={key} title={desc} style={{ marginBottom: 4 }}>
      <span className="small" style={{ width: 120, color: 'var(--dim)' }}>{key}</span>
      <input type="range" min={1} max={10} value={player[group][key]} style={{ flex: 1 }}
        onChange={(e) => patch((p) => { p[group][key] = Number(e.target.value) })} />
      <span style={{ width: 22, textAlign: 'right' }}>{player[group][key]}</span>
    </div>
  )
  return (
    <div className="grid2">
      <div>
        <h4 className="cyan">Personal</h4>
        {PERSONAL_STATS.map((s) => statRow('personal', s))}
      </div>
      <div>
        <h4 className="pink">Social</h4>
        {SOCIAL_STATS.map((s) => statRow('social', s))}
      </div>
    </div>
  )
}

/**
 * D&D-style stat allocation: roll a pool of numbers, every rolled value is
 * auto-assigned to a slot, and picking a value already used by another stat
 * swaps the two. Apply is always one click away.
 */
function RollAllocate({ patch }) {
  const [pools, setPools] = useState(null) // {personal: [...12], social: [...6]}
  const [assign, setAssign] = useState(null) // {personal: {statKey: poolIdx}, social: {...}}
  const [applied, setApplied] = useState(false)

  const roll = () => {
    setPools({
      personal: Array.from({ length: PERSONAL_STATS.length }, rollStat),
      social: Array.from({ length: SOCIAL_STATS.length }, rollStat),
    })
    // Start fully assigned (stat i gets rolled value i); the user swaps from there.
    setAssign({
      personal: Object.fromEntries(PERSONAL_STATS.map(([k], i) => [k, i])),
      social: Object.fromEntries(SOCIAL_STATS.map(([k], i) => [k, i])),
    })
    setApplied(false)
  }

  // Assign poolIdx to key; whoever held poolIdx gets key's old value (a swap).
  const setStat = (group, key, poolIdx) => {
    setAssign((a) => {
      const g = { ...a[group] }
      const prevIdx = g[key]
      const holder = Object.keys(g).find((k) => g[k] === poolIdx)
      g[key] = poolIdx
      if (holder && holder !== key) g[holder] = prevIdx
      return { ...a, [group]: g }
    })
    setApplied(false)
  }

  const apply = () => {
    patch((p) => {
      for (const [k] of PERSONAL_STATS) p.personal[k] = pools.personal[assign.personal[k]]
      for (const [k] of SOCIAL_STATS) p.social[k] = pools.social[assign.social[k]]
    })
    setApplied(true)
  }

  const groupUI = (group, stats) => (
    <div>
      <h4 className={group === 'personal' ? 'cyan' : 'pink'}>{group}</h4>
      <div style={{ marginBottom: 6 }}>
        {pools[group].map((v, i) => <span key={i} className="rollchip">{v}</span>)}
      </div>
      {stats.map(([key, desc]) => (
        <div className="row" key={key} title={desc} style={{ marginBottom: 4 }}>
          <span className="small" style={{ width: 120, color: 'var(--dim)' }}>{key}</span>
          <select
            value={assign[group][key]}
            onChange={(e) => setStat(group, key, Number(e.target.value))}
          >
            {pools[group].map((v, i) => <option key={i} value={i}>{v}</option>)}
          </select>
        </div>
      ))}
    </div>
  )

  return (
    <div>
      <div className="row">
        <button onClick={roll}>🎲 {pools ? 'Re-roll' : 'Roll stats'}</button>
        {pools && <button className="primary" onClick={apply}>Apply allocation</button>}
        {pools && !applied && <span className="dim small">picking a number another stat holds swaps them</span>}
        {applied && <span className="green small">✓ applied — check "Edit directly" to confirm</span>}
      </div>
      {pools && (
        <div className="grid2" style={{ marginTop: 10 }}>
          {groupUI('personal', PERSONAL_STATS)}
          {groupUI('social', SOCIAL_STATS)}
        </div>
      )}
    </div>
  )
}
