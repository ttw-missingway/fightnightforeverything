import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { ordinal } from './Tournament.jsx'
import { displayName } from '../game/util.js'
import { formatDay } from '../game/constants.js'
import { ACHIEVEMENTS, groupedAchievements } from '../game/achievements.js'

export default function HallOfFame() {
  const { save, nav } = useStore()
  const [tab, setTab] = useState('records')
  const records = [...save.hallOfFame].reverse()
  const players = Object.values(save.players).filter((p) => !p.npc)
  const mostGlorious = [...players].sort((a, b) => b.glory - a.glory).slice(0, 5).filter((p) => p.glory > 0)
  const evoLegends = [...save.evoRoster].sort((a, b) => (b.titles || 0) - (a.titles || 0)).filter((e) => e.titles > 0)
  const archives = save.archives || []
  const earnedCount = ACHIEVEMENTS.filter((a) => save.prestige?.achievements?.[a.key]).length

  if (tab === 'legacy') {
    return (
      <div>
        <HofTabs tab={tab} setTab={setTab} count={(save.chronicle || []).length} archives={archives.length} earned={earnedCount} />
        <LegacyLadder save={save} earned={earnedCount} />
      </div>
    )
  }

  if (tab === 'chronicle') {
    return (
      <div>
        <HofTabs tab={tab} setTab={setTab} count={(save.chronicle || []).length} archives={archives.length} earned={earnedCount} />
        <h1 style={{ fontSize: 30 }}>📜 The Arcade Chronicle</h1>
        <p className="dim">The moments everyone remembers — told and retold until they're legend.</p>
        {(save.chronicle || []).length === 0 && (
          <div className="card"><p className="dim">Nothing legendary has happened yet. Give it time — or force the issue.</p></div>
        )}
        <div className="card">
          {(save.chronicle || []).map((c, i) => (
            <div className="row spread" key={i} style={{ borderBottom: '1px solid var(--border)', padding: '6px 0' }}>
              <span>{c.icon} {c.text}</span>
              <span className="dim small" style={{ whiteSpace: 'nowrap' }}>{formatDay(c.day, c.year)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (tab === 'archive') {
    return (
      <div>
        <HofTabs tab={tab} setTab={setTab} count={(save.chronicle || []).length} archives={archives.length} earned={earnedCount} />
        <h1 style={{ fontSize: 30 }}>🗄 The Archives</h1>
        <p className="dim">Past runs of this world — everything that happened before the reset(s).</p>
        {[...archives].reverse().map((a) => (
          <div className="card" key={a.run}>
            <h3 style={{ marginTop: 0 }}>Run {a.run} <span className="dim small">— ended {a.endedDateLabel}</span></h3>
            {(a.hallOfFame || []).length > 0 && (
              <>
                <h4 className="gold">Tournament results</h4>
                {[...a.hallOfFame].reverse().map((r) => (
                  <div className="row spread" key={r.id} style={{ padding: '2px 0' }}>
                    <span className="small">
                      {r.type === 'evo' ? '🌏' : r.type === 'circuit' ? '🌐' : r.type === 'teams' ? '🛡' : '🏆'} {r.name}
                    </span>
                    <span className="small gold">{r.champion}</span>
                  </div>
                ))}
              </>
            )}
            {(a.chronicle || []).length > 0 && (
              <>
                <h4 className="cyan">Chronicle</h4>
                {a.chronicle.map((c, i) => (
                  <div className="row spread" key={i} style={{ borderBottom: '1px solid var(--border)', padding: '3px 0' }}>
                    <span className="small">{c.icon} {c.text}</span>
                    <span className="dim small" style={{ whiteSpace: 'nowrap' }}>{formatDay(c.day, c.year)}</span>
                  </div>
                ))}
              </>
            )}
            {(a.hallOfFame || []).length === 0 && (a.chronicle || []).length === 0 && (
              <p className="dim small">A quiet run — nothing made the record books.</p>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <HofTabs tab={tab} setTab={setTab} count={(save.chronicle || []).length} archives={archives.length} earned={earnedCount} />
      <h1 style={{ fontSize: 30 }}>🏛 Hall of Fame</h1>

      <div className="grid2">
        <div className="card">
          <h3 className="gold">Most Glorious</h3>
          {mostGlorious.length === 0 && <p className="dim">Nobody has earned glory yet. Win tournaments. Go to EVO.</p>}
          {mostGlorious.map((p, i) => (
            <div className="row spread" key={p.id} style={{ padding: '3px 0' }}>
              <span className="clickable" style={{ cursor: 'pointer' }} onClick={() => nav('players', { playerId: p.id })}>
                {['🥇', '🥈', '🥉', '', ''][i]} {displayName(p, save)}
              </span>
              <span className="gold">{Math.round(p.glory)} glory</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h3 className="cyan">World Champions (EVO legends)</h3>
          {evoLegends.length === 0 && <p className="dim">No EVO has been decided yet.</p>}
          {evoLegends.map((e) => (
            <div className="row spread" key={e.id} style={{ padding: '3px 0' }}>
              <span>{e.alias} <span className="dim small">[{e.region}]</span></span>
              <span className="gold">{'🏆'.repeat(Math.min(e.titles, 8))}</span>
            </div>
          ))}
        </div>
      </div>

      <h2>Tournament Results</h2>
      {records.length === 0 && <div className="card"><p className="dim">No tournaments have been held yet.</p></div>}
      {records.map((r) => (
        <div className="card" key={r.id} style={r.type === 'evo' ? { borderColor: 'var(--gold)' } : {}}>
          <div className="row spread">
            <h3 style={{ margin: 0 }}>
              {r.type === 'evo' ? '🌏' : r.type === 'circuit' ? '🌐' : r.type === 'teams' ? '🛡' : '🏆'} {r.name}
            </h3>
            <span className="dim small">{r.dateLabel} · {r.entrantCount} entrants</span>
          </div>
          <p className="gold" style={{ margin: '6px 0' }}>Champion: {r.champion}</p>
          <div className="row">
            {(r.placements || []).slice(0, 8).map((pl, i) => (
              <span key={i} className={`pill ${pl.arcade ? 'on' : ''}`}>
                {ordinal(pl.place)} — {pl.name}
              </span>
            ))}
          </div>
          {r.arcadeResults && r.arcadeResults.length > 0 && (
            <p className="small cyan" style={{ marginBottom: 0 }}>
              Arcade crew: {r.arcadeResults.map((a) => `${a.name} (${ordinal(a.place)})`).join(' · ')}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * The one page that isn't about this run.
 *
 * Everything else in the Hall of Fame is a record of what happened; this is a
 * record of what you can now do — and it stays true through every foreclosure,
 * because a lineage is the thing that accumulates when the runs don't.
 */
function LegacyLadder({ save, earned }) {
  const record = save.prestige?.achievements || {}
  const points = save.prestige?.points || 0
  const runs = save.prestige?.runs || 0

  return (
    <div>
      <h1 style={{ fontSize: 30 }}>🎖 Legacy</h1>
      <p className="dim">
        What survives a reset. None of it is for sale — every tool here is earned by proving you
        can run the place without it, and nothing you earn is ever taken away again.
      </p>
      <div className="card">
        <div className="row spread">
          <span><span className="gold" style={{ fontSize: 22, fontWeight: 700 }}>{points}</span> <span className="dim">prestige banked — spent on unlockables, never on power</span></span>
          <span className="dim small">{earned} of {ACHIEVEMENTS.length} earned · {runs === 0 ? 'first run' : `${runs} run${runs === 1 ? '' : 's'} behind you`}</span>
        </div>
      </div>

      {groupedAchievements().map((group) => {
        const done = group.items.filter((a) => record[a.key]).length
        return (
          <div className="card" key={group.key}>
            <div className="row spread">
              <h3 style={{ margin: 0 }}>{group.label}</h3>
              <span className={done === group.items.length ? 'gold small' : 'dim small'}>
                {done}/{group.items.length}
              </span>
            </div>
            <p className="dim small" style={{ margin: '2px 0 8px' }}>{group.blurb}</p>
            {group.items.map((a) => {
              const at = record[a.key]
              return (
                <div key={a.key} style={{
                  borderTop: '1px solid var(--border)', padding: '6px 0',
                  opacity: at ? 1 : 0.75,
                }}>
                  <div className="row spread">
                    <span style={{ color: at ? 'var(--gold)' : 'var(--dim)' }}>
                      {at ? a.icon : '🔒'} <strong>{a.unlockLabel}</strong>
                    </span>
                    <span className="dim small" style={{ whiteSpace: 'nowrap' }}>
                      {a.points > 0 && <span className="gold">+{a.points} pt{a.points === 1 ? '' : 's'} </span>}
                      {at?.day ? `${formatDay(at.day, at.year)}${at.run ? ` · run ${at.run}` : ''}` : ''}
                    </span>
                  </div>
                  <p className="small" style={{ margin: '2px 0 0', color: at ? 'var(--dim)' : 'inherit' }}>
                    {at ? <>✅ earned — {a.how.toLowerCase()}</> : a.how}
                  </p>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function HofTabs({ tab, setTab, count, archives = 0, earned = 0 }) {
  return (
    <div className="tabs">
      <button className={tab === 'records' ? 'active' : ''} onClick={() => setTab('records')}>🏛 Hall of Fame</button>
      <button className={tab === 'chronicle' ? 'active' : ''} onClick={() => setTab('chronicle')}>
        📜 Arcade Chronicle ({count})
      </button>
      <button className={tab === 'legacy' ? 'active' : ''} onClick={() => setTab('legacy')}>
        🎖 Legacy ({earned}/{ACHIEVEMENTS.length})
      </button>
      {archives > 0 && (
        <button className={tab === 'archive' ? 'active' : ''} onClick={() => setTab('archive')}>
          🗄 Archives ({archives})
        </button>
      )}
    </div>
  )
}
