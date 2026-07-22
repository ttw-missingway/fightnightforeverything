import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import StreamChat from '../components/StreamChat.jsx'
import { SpeechLine } from '../components/ui.jsx'
import MatchHud from '../components/MatchHud.jsx'

export default function Tournament() {
  const { save, screen, nav, mutate } = useStore()
  const vodId = screen.vodId
  // A VOD replay targets a specific record; otherwise show the most recent one.
  const t = vodId ? (save.vods || []).find((v) => v.id === vodId) : save.lastTournament

  if (!t) {
    return (
      <div className="card">
        <h2>Tournament Hall</h2>
        <p className="dim">
          {vodId
            ? 'That VOD is no longer available — older broadcasts roll off over time.'
            : 'No tournament has been run yet. Schedule one from the Manage screen, then play to that day.'}
        </p>
        <button onClick={() => nav(vodId ? 'vods' : 'arcade')}>{vodId ? 'Back to VODs' : 'Back to the arcade'}</button>
      </div>
    )
  }

  // Flatten the bracket into broadcast order (round by round).
  const flat = []
  const roundStarts = []
  t.rounds.forEach((round, ri) => {
    roundStarts.push(flat.length)
    round.matches.forEach((m) => flat.push({ m, ri, offScreen: round.offScreen }))
  })

  // Byes air instantly; an off-screen round means the broadcast is over.
  let cursor = Math.min(t.revealed ?? 0, flat.length)
  while (cursor < flat.length && flat[cursor].m.bye) cursor++
  const broadcastEnded = cursor < flat.length && flat[cursor].offScreen
  const revealedCount = broadcastEnded ? flat.length : cursor
  const done = revealedCount >= flat.length
  const current = done ? null : flat[revealedCount]
  const isRevealed = (idx) => idx < revealedCount || flat[idx].m.bye
  const roundDetermined = (ri) => ri === 0 || revealedCount >= roundStarts[ri]

  // Advance the reveal cursor on the matching record wherever it lives — the
  // latest tournament and its VOD copy may be the same object or two, so key
  // by id and update both.
  const setRevealed = (val) => mutate((s) => {
    if (s.lastTournament && s.lastTournament.id === t.id) s.lastTournament.revealed = val
    for (const v of s.vods || []) if (v.id === t.id) v.revealed = val
  })
  const playNext = () => setRevealed(revealedCount + 1)
  const skipAll = () => setRevealed(999999)

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
          {t.channelName && (
            <div className="small">
              <span className="pink">📡 live on {t.channelName}</span>
              {done && t.peakViewers > 0 && <span className="dim"> · peak {t.peakViewers} viewers</span>}
            </div>
          )}
        </div>
        <div className="row">
          {!done && <button onClick={skipAll}>⏭ Skip to results</button>}
          <button onClick={() => nav('halloffame')}>Hall of Fame</button>
          {vodId
            ? <button onClick={() => nav('vods')}>Back to VODs →</button>
            : <button onClick={() => nav('arcade')}>Back to arcade →</button>}
        </div>
      </div>

      {(t.storylines || []).length > 0 && (
        <div className="card sub">
          {t.storylines.map((s, i) => <p key={i} className="small" style={{ margin: '4px 0' }}>📰 {s}</p>)}
        </div>
      )}

      {!done && current && (
        <NowPlaying
          key={current.m.id}
          m={current.m}
          roundTitle={t.rounds[current.ri].title}
          onFinished={playNext}
        />
      )}

      {done && (
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
      )}

      <h2>Bracket</h2>
      <div className="bracket">
        {t.rounds.map((round, ri) => (
          <div className="round" key={ri}>
            <h4 className={round.offScreen ? 'dim' : 'cyan'} style={{ textAlign: 'center' }}>
              {round.title}{round.offScreen ? ' (off-screen)' : ''}
            </h4>
            {round.matches.map((m, mi) => {
              const flatIdx = roundStarts[ri] + mi
              return (
                <BracketMatch
                  key={m.id} m={m}
                  offScreen={round.offScreen}
                  revealed={isRevealed(flatIdx)}
                  determined={roundDetermined(ri)}
                  isNext={!done && current && flatIdx === revealedCount}
                />
              )
            })}
          </div>
        ))}
      </div>

      {done && t.placements && (
        <div className="card">
          <h3 className="gold">Final Standings</h3>
          <div className="row">
            {t.placements.slice(0, 8).map((pl, i) => (
              <span key={i} className={`pill ${pl.arcade ? 'on' : ''}`}>{ordinal(pl.place)} — {pl.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * The match currently on the big screen: narration reveals line by line
 * (winner only announced by the final line), with stream chat playing along.
 */
function NowPlaying({ m, roundTitle, onFinished }) {
  const [lines, setLines] = useState(0) // 0 = not started
  const total = m.narration?.length || 0
  const started = lines > 0
  const finished = started && lines >= total
  const isTeamMatch = !!m.duels

  return (
    <div className="card" style={{ borderColor: 'var(--pink)' }}>
      <h3 className="pink" style={{ marginTop: 0 }}>
        {started ? 'Now playing' : 'Up next'} — {roundTitle}
        {m.stream && started && <span className="small"> · 👁 {m.stream.viewers}</span>}
      </h3>
      {isTeamMatch ? (
        <p style={{ fontSize: 18 }}>
          {m.aName} <span className="dim">vs</span> {m.bName}
        </p>
      ) : (
        <MatchHud m={m} revealed={lines} />
      )}

      {!started && <button className="primary" onClick={() => setLines(1)}>▶ Play the match</button>}

      {started && (
        <div className={m.stream ? 'stream-split' : ''}>
          <div className="narration" style={{ marginTop: 0 }}>
            {m.narration.slice(0, lines).map((l, i) => <p key={i}>{l}</p>)}
            {!finished && (
              <button className="small" onClick={() => setLines(lines + 1)}>▶ What happens next?</button>
            )}
            {finished && isTeamMatch && m.duels.map((d, i) => (
              <p key={`d${i}`} className="small" style={{ fontStyle: 'normal' }}>
                {d.tiebreaker ? '⚔ tiebreaker: ' : `seat ${i + 1}: `}
                {d.aName} vs {d.bName} → <span className="gold">{d.winnerName}</span>
              </p>
            ))}
            {finished && (m.postMatch || []).map((s, i) => <SpeechLine key={`post${i}`} s={s} />)}
            {finished && m.probA != null && (
              <p className="dim small" style={{ fontStyle: 'normal' }}>
                odds were {Math.round(m.probA * 100)}%–{Math.round((1 - m.probA) * 100)}%
              </p>
            )}
          </div>
          {m.stream && <StreamChat stream={m.stream} revealed={lines} />}
        </div>
      )}

      {finished && (
        <button className="primary" style={{ marginTop: 8 }} onClick={onFinished}>
          Continue to the next match ▶
        </button>
      )}
    </div>
  )
}

function BracketMatch({ m, offScreen, revealed, determined, isNext }) {
  const [open, setOpen] = useState(false)
  if (m.bye) {
    return (
      <div className={`bmatch ${offScreen ? 'offscreen' : ''}`} style={{ cursor: 'default' }}>
        <span className="winner">{m.aName}</span> <span className="dim small">— bye</span>
      </div>
    )
  }
  if (!determined) {
    return (
      <div className="bmatch" style={{ cursor: 'default', opacity: 0.5 }}>
        <div className="dim">TBD</div>
        <div className="dim">TBD</div>
      </div>
    )
  }
  if (!revealed) {
    return (
      <div className="bmatch" style={isNext ? { borderColor: 'var(--pink)' } : { cursor: 'default' }}>
        <div>{m.aName} {m.aChar && <span className="dim small">({m.aChar})</span>}</div>
        <div>{m.bName} {m.bChar && <span className="dim small">({m.bChar})</span>}</div>
        <div className={`small ${isNext ? 'pink' : 'dim'}`}>{isNext ? '▶ up next' : 'waiting…'}</div>
      </div>
    )
  }
  const aWon = m.winnerName === m.aName
  return (
    <div className={`bmatch ${offScreen ? 'offscreen' : ''}`} onClick={() => setOpen(!open)}>
      <div className={aWon ? 'winner' : 'loser'}>{m.aName} {m.aChar && <span className="small">({m.aChar})</span>}</div>
      <div className={!aWon ? 'winner' : 'loser'}>{m.bName} {m.bChar && <span className="small">({m.bChar})</span>}</div>
      {m.score && <div className="gold small">{m.score}</div>}
      {m.stream && <div className="dim small">👁 {m.stream.viewers}</div>}
      {open && (
        <div className="narration" onClick={(e) => e.stopPropagation()}>
          <MatchHud m={m} />
          {(m.narration || []).map((l, i) => <p key={i}>{l}</p>)}
          {m.duels && m.duels.map((d, i) => (
            <p key={i} className="small" style={{ fontStyle: 'normal' }}>
              {d.tiebreaker ? '⚔ tiebreaker: ' : `seat ${i + 1}: `}
              {d.aName} vs {d.bName} → <span className="gold">{d.winnerName}</span>
            </p>
          ))}
          {(m.postMatch || []).map((s, i) => <SpeechLine key={`post${i}`} s={s} />)}
          {m.probA != null && (
            <p className="dim small" style={{ fontStyle: 'normal' }}>
              odds were {Math.round(m.probA * 100)}%–{Math.round((1 - m.probA) * 100)}%
            </p>
          )}
          {m.stream && m.stream.comments.length > 0 && (
            <StreamChat stream={m.stream} revealed={(m.narration || []).length} />
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
