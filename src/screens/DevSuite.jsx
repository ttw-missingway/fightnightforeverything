import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import GrandOpening from './GrandOpening.jsx'
import { ArcadeChampion } from './EvoWeek.jsx'
import { TAB_GATES, tabOpen, tabHint } from '../game/tabs.js'
import { canStream, STREAM_RIG_COST } from '../game/stream.js'
import { canStageExhibition, EXHIBITION_MIN_FOLLOWERS } from '../game/tournament.js'
import { rosterOpen } from '../game/model.js'
import { runAge, OPENING_DAYS } from '../game/constants.js'

/**
 * The dev suite. DEV BUILDS ONLY.
 *
 * The guard in App.jsx is `import.meta.env.DEV && …`, which is a COMPILE-TIME
 * constant: in a production build the condition folds to false, the branch is
 * dropped, and this module stops being imported at all — so it cannot ship by
 * accident, and it cannot be reached by guessing a URL on a live build. Verify
 * with `npm run build` and grep the bundle for a string in here; there is a
 * check for exactly that in the notes below.
 *
 * It exists because the interesting states in this game are expensive to reach
 * by playing: a world's first paint happens once, an EVO win takes a year, and
 * every tab gate is a condition somewhere in a save. The alternative was
 * hand-editing `lastTournament` in localStorage to look at an animation, which
 * risks destroying a real tournament record for a cosmetic check.
 *
 * NOTHING HERE WRITES TO A SAVE. Cinematics render standalone with props, and
 * the inspector is read-only — a dev tool that mutates state is a dev tool
 * that eventually corrupts the save you were debugging.
 *
 * Reach it at /#dev.
 */
export default function DevSuite() {
  const [tab, setTab] = useState('cinema')
  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: 16 }}>
      <div className="row spread" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>🧪 Dev suite</h2>
        <span className="dim small">dev builds only · stripped from production · read-only</span>
      </div>
      <div className="tabs" style={{ marginTop: 0 }}>
        <button className={`small ${tab === 'cinema' ? 'active' : ''}`} onClick={() => setTab('cinema')}>🎬 Cinematics</button>
        <button className={`small ${tab === 'gates' ? 'active' : ''}`} onClick={() => setTab('gates')}>🔓 Gates</button>
        <button className={`small ${tab === 'state' ? 'active' : ''}`} onClick={() => setTab('state')}>🔎 Save state</button>
      </div>
      {tab === 'cinema' && <Cinematics />}
      {tab === 'gates' && <Gates />}
      {tab === 'state' && <SaveState />}
    </div>
  )
}

// ---------- Cinematics ----------

/**
 * Both one-shot cinematics, on demand. Replay remounts via `key`: a CSS
 * entrance animation only plays on mount, and "watch it again" is the job.
 */
function Cinematics() {
  const [which, setWhich] = useState('opening')
  const [name, setName] = useState('BracketDemon')
  const [run, setRun] = useState(0)
  const replay = () => setRun((n) => n + 1)
  const pick = (w) => { setWhich(w); replay() }
  return (
    <div>
      <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
        <button className={which === 'opening' ? 'primary' : ''} onClick={() => pick('opening')}>Grand opening</button>
        <button className={which === 'champion' ? 'primary' : ''} onClick={() => pick('champion')}>EVO champion</button>
        {which === 'champion' && (
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: 220 }} aria-label="champion name" />
        )}
        <button onClick={replay}>↻ Replay</button>
      </div>
      <p className="dim small">
        {which === 'opening'
          ? 'Plays once per world, and again on a run-back. Uses the loaded save’s arcade name and location when there is one.'
          : `Plays only in a year one of YOUR players takes the title (arcadeResults place 1). Clicking through advances to "That's EVO".`}
      </p>
      {which === 'opening'
        ? <GrandOpening key={run} onDone={replay} />
        : <ArcadeChampion key={run} name={name} onDone={replay} />}
    </div>
  )
}

// ---------- Gates ----------

/**
 * Every lock in the game and whether THIS save has opened it, with the state
 * the answer was read from. The point is the third column: a gate that reads
 * shut is only a bug if the thing it measures actually happened.
 */
function Gates() {
  const { save } = useStore()
  if (!save) return <p className="dim" style={{ marginTop: 12 }}>No save loaded — open one to inspect its gates.</p>
  const evoCount = (save.hallOfFame || []).filter((r) => r.type === 'evo').length
  const localCount = (save.hallOfFame || []).filter((r) => r.type !== 'evo').length
  const followers = save.stream?.followers || 0
  const exhibition = canStageExhibition(save)

  const rows = [
    ...Object.keys(TAB_GATES).map((k) => ({
      name: `Tab: ${k}`,
      open: tabOpen(save, k),
      how: tabHint(k),
      evidence: k === 'world' || k === 'halloffame' ? `${evoCount} EVO record(s)`
        : k === 'vods' ? `${(save.vods || []).length} VOD(s) · ${localCount} local tournament(s)`
        : k === 'teams' ? `${Object.keys(save.teams || {}).length} team(s)`
        : `${(save.innovations || []).length} technique(s) · ${(save.guides || []).length} guide(s)`,
    })),
    {
      name: 'Codex → Tier Lists',
      open: (save.tierLists || []).length > 0,
      how: 'the community publishing a tier list',
      evidence: `${(save.tierLists || []).length} list(s)`,
    },
    {
      name: 'Streaming (rig bought)',
      open: canStream(save),
      how: `buying the rig ($${STREAM_RIG_COST})`,
      evidence: `$${Math.round(save.economy?.money ?? 0)} on hand`,
    },
    {
      name: 'Exhibition night',
      open: exhibition.ok,
      how: `${EXHIBITION_MIN_FOLLOWERS} followers, cash, cooldown, 4 regulars`,
      evidence: exhibition.ok ? `${followers} followers` : exhibition.reason,
    },
    {
      name: 'Opening-weeks dialogue',
      open: runAge(save) <= OPENING_DAYS,
      how: `the first ${OPENING_DAYS} days of the run`,
      evidence: `run day ${runAge(save)}`,
    },
    {
      name: 'Roster window (spend legacy points)',
      open: rosterOpen(save),
      how: 'no day banked yet this run',
      evidence: `${save.prestige?.points || 0} point(s) · ${(save.economy?.history || []).length} day(s) traded`,
    },
  ]

  return (
    <div className="table-scroll" style={{ marginTop: 12 }}><table>
      <thead><tr><th>Gate</th><th>State</th><th>Opens on</th><th>Read from</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name}>
            <td><strong>{r.name}</strong></td>
            <td className={r.open ? 'green' : 'dim'}>{r.open ? '✓ open' : '🔒 shut'}</td>
            <td className="small">{r.how}</td>
            <td className="small dim">{r.evidence}</td>
          </tr>
        ))}
      </tbody>
    </table></div>
  )
}

// ---------- Save state ----------

/** The handful of counters worth seeing at a glance while debugging. */
function SaveState() {
  const { save } = useStore()
  if (!save) return <p className="dim" style={{ marginTop: 12 }}>No save loaded.</p>
  const players = Object.values(save.players || {})
  const rows = [
    ['run day', runAge(save)],
    ['calendar', `${save.dateLabel || `day ${save.day}`}, year ${save.year}`],
    ['grandOpening pending', String(!!save.grandOpening)],
    ['mode / difficulty', `${save.settings?.mode} / ${save.settings?.difficulty}`],
    ['cash', `$${Math.round(save.economy?.money ?? 0)}`],
    ['relevance', Math.round(save.relevance ?? 0)],
    ['stream', canStream(save) ? `${save.stream?.followers || 0} followers · hype ${Math.round(save.stream?.hype || 0)}` : 'no rig'],
    ['players (active / total)', `${players.filter((p) => !p.retired && !p.banished).length} / ${players.length}`],
    ['teams', Object.keys(save.teams || {}).length],
    ['hall of fame', `${(save.hallOfFame || []).length} (${(save.hallOfFame || []).filter((r) => r.type === 'evo').length} EVO)`],
    ['VODs / tier lists', `${(save.vods || []).length} / ${(save.tierLists || []).length}`],
    ['techniques / guides', `${(save.innovations || []).length} / ${(save.guides || []).length}`],
    ['prestige points / runs', `${save.prestige?.points || 0} / ${save.prestige?.runs || 0}`],
    ['evoWeek step', save.evoWeek?.step || '—'],
  ]
  return (
    <div className="table-scroll" style={{ marginTop: 12 }}><table>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}><td className="dim">{k}</td><td><strong>{String(v)}</strong></td></tr>
        ))}
      </tbody>
    </table></div>
  )
}
