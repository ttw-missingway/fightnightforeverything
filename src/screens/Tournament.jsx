import { useState } from 'react'
import { useStore } from '../state/store.jsx'

export default function Tournament() {
  const { save, nav } = useStore()
  const t = save.lastTournament

  if (!t) {
    return (
      <div className="card">
        <h2>Tournament Hall</h2>
        <p className="dim">No tournament has been run yet. Schedule one from the Manage screen, then simulate to that day.</p>
        <button onClick={() => nav('arcade')}>Back to the arcade</button>
      </div>
    )
  }

  return (
    <div>
      <div className="row spread">
        <div>
          <h1 style={{ fontSize: 30, margin: '4px 0' }}>
            {t.type === 'evo' ? '🌏 ' : '🏆 '}{t.name}
          </h1>
          <span className="dim">{t.dateLabel} · {t.entrantCount} entrants · {
            t.type === 'evo' ? 'the biggest stage in the world' : t.type === 'teams' ? 'crew battle format' : 'single elimination'
          }</span>
        </div>
        <div className="row">
          <button onClick={() => nav('halloffame')}>Hall of Fame</button>
          <button onClick={() => nav('arcade')}>Back to arcade →</button>
        </div>
      </div>

      <div className="card" style={{ borderColor: 'var(--gold)' }}>
        <h3 className="gold" style={{ margin: '2px 0' }}>Champion: {t.champion}</h3>
        {t.type === 'evo' && t.abrupt && (
          <p className="dim small">
            The arcade crew's run ended before the finish — results past their elimination trickled in online.
          </p>
        )}
        {t.arcadeResults && (
          <p className="small">
            Arcade results: {t.arcadeResults.map((r) => `${r.name} — ${ordinal(r.place)}`).join(' · ')}
          </p>
        )}
      </div>

      <h2>Bracket</h2>
      <div className="bracket">
        {t.rounds.map((round, ri) => (
          <div className="round" key={ri}>
            <h4 className={round.offScreen ? 'dim' : 'cyan'} style={{ textAlign: 'center' }}>
              {round.title}{round.offScreen ? ' (off-screen)' : ''}
            </h4>
            {round.matches.map((m) => <BracketMatch key={m.id} m={m} offScreen={round.offScreen} />)}
          </div>
        ))}
      </div>
    </div>
  )
}

function BracketMatch({ m, offScreen }) {
  const [open, setOpen] = useState(false)
  if (m.bye) {
    return (
      <div className={`bmatch ${offScreen ? 'offscreen' : ''}`} style={{ cursor: 'default' }}>
        <span className="winner">{m.winnerName}</span> <span className="dim small">— bye</span>
      </div>
    )
  }
  const aWon = m.winnerName === m.aName
  return (
    <div className={`bmatch ${offScreen ? 'offscreen' : ''}`} onClick={() => setOpen(!open)}>
      <div className={aWon ? 'winner' : 'loser'}>{m.aName} {m.aChar && <span className="small">({m.aChar})</span>}</div>
      <div className={!aWon ? 'winner' : 'loser'}>{m.bName} {m.bChar && <span className="small">({m.bChar})</span>}</div>
      {m.score && <div className="gold small">{m.score}</div>}
      {open && (
        <div className="narration" onClick={(e) => e.stopPropagation()}>
          {(m.narration || []).map((l, i) => <p key={i}>{l}</p>)}
          {m.duels && m.duels.map((d, i) => (
            <p key={i} className="small" style={{ fontStyle: 'normal' }}>
              {d.tiebreaker ? '⚔ tiebreaker: ' : `seat ${i + 1}: `}
              {d.aName} vs {d.bName} → <span className="gold">{d.winnerName}</span>
            </p>
          ))}
          {m.probA != null && (
            <p className="dim small" style={{ fontStyle: 'normal' }}>
              odds were {Math.round(m.probA * 100)}%–{Math.round((1 - m.probA) * 100)}%
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
