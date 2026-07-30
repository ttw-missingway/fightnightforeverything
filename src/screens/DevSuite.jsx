import { useMemo, useState } from 'react'
import { useStore, persistSave } from '../state/store.jsx'
import GrandOpening from './GrandOpening.jsx'
import { ArcadeChampion } from './EvoWeek.jsx'
import { TAB_GATES, tabOpen, tabHint } from '../game/tabs.js'
import { canStream, STREAM_RIG_COST } from '../game/stream.js'
import { rosterOpen } from '../game/model.js'
import { runAge, OPENING_DAYS, formatDay, absDayOf, talentBreadth } from '../game/constants.js'
import { glowingStats, glowRequirement } from '../game/eureka.js'
import { uid, displayName, fullName } from '../game/util.js'
import { playDay, isDead } from '../../tools/balance/policy.mjs'

/**
 * The dev suite. DEV BUILDS ONLY.
 *
 * The guard in App.jsx is `import.meta.env.DEV && …`, which is a COMPILE-TIME
 * constant: in a production build the condition folds to false, the branch is
 * dropped, and this module stops being imported at all — so it cannot ship by
 * accident, and it cannot be reached by guessing a URL on a live build. Verify
 * with `npm run build` and grep the bundle for a string in here.
 *
 * It exists because the interesting states in this game are expensive to reach
 * by playing: a world's first paint happens once, an EVO win takes a year, and
 * every tab gate is a condition somewhere in a save. The revision (§3) added
 * the rest: fast-forward (late-game testing without a week of play), scenario
 * fixtures, the journal viewer, the eureka inspector, and the event timeline.
 *
 * NOTHING HERE WRITES TO A REAL SAVE. Fast-forward and fixtures operate on
 * COPIES — a copy gets a fresh id and lands in the save list as its own
 * world; the save you had open is never touched.
 *
 * Reach it at /#dev.
 */
export default function DevSuite() {
  const [tab, setTab] = useState('cinema')
  const TABS = [
    ['cinema', '🎬 Cinematics'], ['gates', '🔓 Gates'], ['state', '🔎 Save state'],
    ['ff', '⏩ Fast-forward'], ['fixtures', '🗂 Fixtures'], ['journal', '📔 Journal'],
    ['eureka', '✨ Eureka'], ['timeline', '📜 Timeline'],
  ]
  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: 16 }}>
      <div className="row spread" style={{ marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>🧪 Dev suite</h2>
        <span className="dim small">dev builds only · stripped from production · never writes to a real save</span>
      </div>
      <div className="tabs" style={{ marginTop: 0 }}>
        {TABS.map(([k, label]) => (
          <button key={k} className={`small ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {tab === 'cinema' && <Cinematics />}
      {tab === 'gates' && <Gates />}
      {tab === 'state' && <SaveState />}
      {tab === 'ff' && <FastForward />}
      {tab === 'fixtures' && <Fixtures />}
      {tab === 'journal' && <JournalViewer />}
      {tab === 'eureka' && <EurekaInspector />}
      {tab === 'timeline' && <Timeline />}
    </div>
  )
}

// Install a world COPY as its own save: fresh id, marked name, main-menu row.
// This is the one write the dev suite performs, and it is always to a new id.
function installCopy(world, nameSuffix) {
  const copy = structuredClone(world)
  copy.id = uid('save')
  copy.saveName = `${copy.saveName}${nameSuffix ? ` ${nameSuffix}` : ''}`.slice(0, 60)
  if (copy.idle) { copy.idle.running = false; copy.idle.lastTickAt = null; copy.idle.awayReport = null }
  persistSave(copy)
  return copy
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
      name: 'Opening-weeks dialogue',
      open: runAge(save) <= OPENING_DAYS,
      how: `the first ${OPENING_DAYS} days of the run`,
      evidence: `run day ${runAge(save)}`,
    },
    {
      name: 'Roster window',
      open: rosterOpen(save),
      how: 'no day banked yet this run',
      evidence: `${(save.economy?.history || []).length} day(s) traded`,
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
    ['calendar', `${formatDay(save.day, save.year)}`],
    ['schema / rng state', `v${save.schemaVersion} / ${save.rng?.state ?? '—'}`],
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
    ['prestige (cosmetic) / runs', `${save.prestige?.points || 0} / ${save.prestige?.runs || 0}`],
    ['attention (total / steady)', `${save.attention?.total ?? 0} / ${save.attention?.steady ?? 0}`],
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

// ---------- Fast-forward ----------

/**
 * Sim the loaded save forward N days with the competent player from
 * tools/balance/policy.mjs — the feature that stops late-game testing from
 * costing a week of play. Operates on a COPY; the result installs as a new
 * save you open from the main menu.
 */
function FastForward() {
  const { save } = useStore()
  const [days, setDays] = useState(336)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  if (!save) return <p className="dim" style={{ marginTop: 12 }}>No save loaded — open one to fast-forward a copy of it.</p>

  const run = () => {
    setBusy(true)
    setResult(null)
    // Yield one frame so the button can render its busy state; the sim itself
    // is synchronous and a year takes a couple of seconds.
    setTimeout(() => {
      const copy = structuredClone(save)
      const before = { day: copy.day, year: copy.year, money: copy.economy?.money ?? 0 }
      let played = 0
      const n = Math.min(Math.max(1, days | 0), 3360)
      for (let d = 0; d < n; d++) {
        playDay(copy)
        played += 1
        if (isDead(copy)) break
      }
      setResult({ world: copy, before, played, dead: isDead(copy) })
      setBusy(false)
    }, 30)
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <label className="small dim">days</label>
        <input type="number" value={days} min={1} max={3360}
          onChange={(e) => setDays(Number(e.target.value))} style={{ width: 90 }} />
        {[28, 112, 336, 672].map((n) => (
          <button key={n} className="small" onClick={() => setDays(n)}>{n}</button>
        ))}
        <button className="primary" disabled={busy} onClick={run}>{busy ? 'Simming…' : '⏩ Fast-forward a copy'}</button>
      </div>
      <p className="dim small">Plays the competent policy (streams daily, hires, prices sanely, patches once the Studio opens). Your open save is untouched.</p>
      {result && (
        <div className="card" style={{ marginTop: 8 }}>
          <p style={{ marginTop: 0 }}>
            {result.played} day{result.played === 1 ? '' : 's'} played: {formatDay(result.before.day, result.before.year)} → {formatDay(result.world.day, result.world.year)}.
            {' '}${Math.round(result.before.money)} → ${Math.round(result.world.economy?.money ?? 0)}.
            {result.dead && <span className="red"> The run DIED en route ({result.world.gameOver?.funnel || 'economy'} funnel).</span>}
          </p>
          <button onClick={() => {
            const installed = installCopy(result.world, `+${result.played}d`)
            setResult(null)
            alert(`Installed "${installed.saveName}" — open it from the main menu.`)
          }}>💾 Install result as a new save</button>
        </div>
      )}
    </div>
  )
}

// ---------- Fixtures ----------

// Committed scenario saves, baked by `node tools/balance/fixtures.mjs` and
// regenerated whenever the save schema moves. Lazy glob: a fixture's JSON is
// only fetched when clicked.
const FIXTURE_LOADERS = import.meta.glob('../../tools/balance/fixtures/*.json')

function Fixtures() {
  const [notice, setNotice] = useState(null)
  const entries = Object.entries(FIXTURE_LOADERS)
    .map(([path, load]) => ({ path, load, name: path.split('/').pop().replace('.json', '') }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const install = async (entry) => {
    const mod = await entry.load()
    const payload = mod.default || mod
    if (!payload?.save) { setNotice(`✗ ${entry.name}: not a fixture file`); return }
    const installed = installCopy(payload.save, '')
    setNotice(`✓ ${payload.name}: ${payload.blurb} — installed as "${installed.saveName}". Open it from the main menu.`)
  }

  return (
    <div style={{ marginTop: 12 }}>
      <p className="dim small" style={{ marginTop: 0 }}>
        One click installs a COPY of a baked scenario as its own save. Regenerate the set with
        <code> node tools/balance/fixtures.mjs</code> whenever the save schema moves.
      </p>
      {entries.length === 0 && <p className="dim">No fixtures baked yet — run <code>node tools/balance/fixtures.mjs</code>.</p>}
      <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
        {entries.map((e) => (
          <button key={e.path} onClick={() => install(e)}>🗂 {e.name}</button>
        ))}
      </div>
      {notice && <p className="small" style={{ marginTop: 10 }}>{notice}</p>}
    </div>
  )
}

// ---------- Journal viewer ----------

/**
 * Any player's full journal, entry quality judged in bulk, with the
 * mechanical deltas in a margin — the one-announcement rule made visible:
 * every stat move should have a line here, and every line with a delta IS a
 * stat move. Threads shown so continuity reads at a glance.
 */
function JournalViewer() {
  const { save } = useStore()
  const [pid, setPid] = useState('')
  if (!save) return <p className="dim" style={{ marginTop: 12 }}>No save loaded.</p>
  const people = Object.values(save.players || {})
    .filter((p) => !p.npc)
    .sort((a, b) => (b.journalWritten || 0) - (a.journalWritten || 0))
  const p = save.players[pid] || people[0]
  if (!p) return <p className="dim" style={{ marginTop: 12 }}>Nobody in this save yet.</p>
  const feed = p.journal || []
  const threads = p.threads || []
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={p.id} onChange={(e) => setPid(e.target.value)}>
          {people.map((x) => (
            <option key={x.id} value={x.id}>{displayName(x, save)} · {x.journalWritten || 0} entries</option>
          ))}
        </select>
        <span className="dim small">{fullName(p)} · {p.temperament}/{p.socialTemperament}
          {' '}· threads: {threads.filter((t) => !t.closedAbs).map((t) => t.kind).join(', ') || 'none open'}</span>
      </div>
      <div className="card" style={{ marginTop: 8 }}>
        {feed.length === 0 && <p className="dim">Blank pages — nothing has happened to this person yet.</p>}
        {feed.map((e, i) => (
          <div key={i} className="row" style={{ gap: 10, borderBottom: '1px solid var(--border)', padding: '4px 0', alignItems: 'baseline' }}>
            <span className="dim small" style={{ minWidth: 148 }}>{formatDay(e.day, e.year)}</span>
            <span className="small gold" style={{ minWidth: 130 }}>
              [{e.kind}]{e.thread ? ' 🧵' : ''}
              {e.deltas?.map((d, j) => <span key={j} className="cyan"> {d.stat}{d.points > 0 ? `+${d.points}` : ''}</span>)}
            </span>
            <span className="small" style={{ flex: 1 }}>{e.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------- Eureka inspector ----------

/**
 * The debugger for the most opaque system in the game (REVISION §3). Shows
 * everything the fiction hides: the meter against its threshold, every
 * pressured stat with WHAT fed it and when, glow state, the spirit rolls the
 * player will never see, and the breakthrough log. If a stat is glowing, this
 * panel can say exactly why — that property is the point of per-stat
 * pressure.
 */
function EurekaInspector() {
  const { save } = useStore()
  const [pid, setPid] = useState('')
  if (!save) return <p className="dim" style={{ marginTop: 12 }}>No save loaded.</p>
  const people = Object.values(save.players || {}).filter((p) => !p.npc)
  const p = save.players[pid] || people[0]
  const e = p?.eureka
  if (!e) return <p className="dim" style={{ marginTop: 12 }}>Nobody with an eureka bag in this save.</p>
  const meter = Object.values(e.pressure || {}).reduce((s, v) => s + v, 0)
  const glowing = new Set(glowingStats(p).map((g) => g.stat))
  const rows = Object.entries(e.pressure || {})
    .filter(([, v]) => v > 0.05)
    .sort((a, b) => b[1] - a[1])
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={p.id} onChange={(ev) => setPid(ev.target.value)}>
          {people.map((x) => <option key={x.id} value={x.id}>{displayName(x, save)} · {x.eureka?.count || 0} bt</option>)}
        </select>
        <span className="small">meter <strong>{meter.toFixed(1)}</strong> / threshold <strong>{e.threshold}</strong></span>
        <span className="small dim">breadth K={talentBreadth(p)} · spirit {p.spirit} rolls {JSON.stringify(p.spiritRolls)} · ceil {JSON.stringify(p.spiritCeil)}</span>
        {e.pending && <span className="small gold">✨ CHOICE PENDING since abs {e.pending.sinceAbs}</span>}
      </div>
      <div className="card" style={{ marginTop: 8 }}>
        {rows.length === 0 && <p className="dim">No pressure anywhere — nothing has happened to this person yet.</p>}
        {rows.map(([stat, v]) => (
          <div key={stat} style={{ borderBottom: '1px solid var(--border)', padding: '4px 0' }}>
            <div className="row spread">
              <strong>{glowing.has(stat) ? '✨ ' : ''}{stat}</strong>
              <span className="small">{v.toFixed(1)} / needs {glowRequirement(p, stat).toFixed(1)}
                <span className="dim"> · broken through ×{e.perStat?.[stat] || 0}</span></span>
            </div>
            {(e.sources?.[stat] || []).slice(-4).map((s, i) => (
              <p key={i} className="small dim" style={{ margin: '1px 0 1px 12px' }}>
                [{s.kind}] +{s.amt} — {s.why} <span style={{ opacity: 0.6 }}>(abs {s.absDay})</span>
              </p>
            ))}
          </div>
        ))}
      </div>
      {(e.log || []).length > 0 && (
        <div className="card" style={{ marginTop: 8 }}>
          <h4 style={{ marginTop: 0 }}>Breakthrough log · burnout ledger {Math.round(e.burnout)} of {Math.round(e.adversity)} adversity</h4>
          {e.log.map((l, i) => (
            <p key={i} className="small" style={{ margin: '2px 0' }}>
              abs {l.absDay} — <strong>{l.stat}</strong> [{l.kind}]{l.cross ? ' · cross-row' : ''}{l.forced ? ' · FORCED' : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------- Timeline ----------

/** A whole run's event log, scrubbed — a year should read in thirty seconds. */
function Timeline() {
  const { save } = useStore()
  const [fromYear, setFromYear] = useState(1)
  const events = useMemo(() => {
    if (!save) return []
    const out = []
    for (const c of save.chronicle || []) {
      out.push({ abs: absDayOf(c.day, c.year), icon: c.icon, text: c.text, day: c.day, year: c.year })
    }
    for (const r of save.hallOfFame || []) {
      if (r.day == null) continue
      out.push({ abs: absDayOf(r.day, r.year), icon: r.type === 'evo' ? '🏆' : '🥇', text: `${r.name || r.type}: ${r.champion || '—'}`, day: r.day, year: r.year })
    }
    for (const patch of save.patches || []) {
      out.push({ abs: absDayOf(patch.day, patch.year), icon: '🛠', text: `Patch v${patch.version}`, day: patch.day, year: patch.year })
    }
    return out.sort((a, b) => a.abs - b.abs)
  }, [save])
  if (!save) return <p className="dim" style={{ marginTop: 12 }}>No save loaded.</p>
  const shown = events.filter((e) => e.year >= fromYear)
  return (
    <div style={{ marginTop: 12 }}>
      <div className="row" style={{ gap: 8, alignItems: 'center' }}>
        <label className="small dim">from year</label>
        <input type="range" min={1} max={Math.max(1, save.year)} value={fromYear}
          onChange={(e) => setFromYear(Number(e.target.value))} />
        <span className="small">{fromYear}</span>
        <span className="dim small">{shown.length} events (chronicle caps at 250 — early years fade first)</span>
      </div>
      <div className="card" style={{ marginTop: 8, maxHeight: 520, overflowY: 'auto' }}>
        {shown.map((e, i) => (
          <div key={i} className="row" style={{ gap: 10, borderBottom: '1px solid var(--border)', padding: '3px 0', alignItems: 'baseline' }}>
            <span className="dim small" style={{ minWidth: 150 }}>{formatDay(e.day, e.year)}</span>
            <span style={{ minWidth: 24 }}>{e.icon}</span>
            <span className="small">{e.text}</span>
          </div>
        ))}
        {shown.length === 0 && <p className="dim">Nothing yet.</p>}
      </div>
    </div>
  )
}
