import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import MatchPlayback from '../components/MatchPlayback.jsx'
import { tabOpen } from '../game/tabs.js'
import { MajorSplash, QualifierSeats, EntryReport, hostLine } from '../components/Circuit.jsx'

export default function Tournament() {
  const { save, screen, nav, mutate } = useStore()
  const vodId = screen.vodId
  // A VOD replay targets a specific record; otherwise show the most recent one.
  const t = vodId ? (save.vods || []).find((v) => v.id === vodId) : save.lastTournament

  if (t && t.type === 'moneymatch') {
    return <MoneyMatchVod t={t} nav={nav} mutate={mutate} />
  }

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

  // A MAJOR ANNOUNCES ITSELF. The title card runs once, the first time the
  // record is opened, and then never again — `splashDone` on the record, so a
  // VOD replayed later goes straight to the bracket instead of re-staging an
  // event you have already sat through.
  if (t.circuitKind === 'major' && t.field && !t.splashDone) {
    return (
      <MajorSplash
        record={t}
        onDone={() => mutate((s) => {
          if (s.lastTournament?.id === t.id) s.lastTournament.splashDone = true
          for (const v of s.vods || []) if (v.id === t.id) v.splashDone = true
        }, { ack: true })}
      />
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
  }, { ack: true }) // a watch cursor, not a choice
  const playNext = () => setRevealed(revealedCount + 1)
  const skipAll = () => setRevealed(999999)
  // Watch in any order: clicking a later match fast-forwards the broadcast
  // to it — after fair warning, because everything before it gets revealed.
  const jumpTo = (flatIdx) => {
    if (flatIdx <= revealedCount) return
    if (!confirm('⚠️ SPOILER ALERT: this match is later in the broadcast, and it hasn\'t played through to it yet. Skip ahead to this match? Every result before it will be revealed.')) return
    setRevealed(flatIdx)
  }

  return (
    <div>
      <div className="row spread">
        <div>
          <h1 style={{ fontSize: 30, margin: '4px 0' }}>
            {t.type === 'evo' ? '🌏 ' : t.circuitKind === 'squad' ? '🏮 ' : t.circuitKind ? '🌐 ' : '🏆 '}{t.name}
          </h1>
          <span className="dim">{t.dateLabel} · {t.entrantCount} entrants · {
            t.type === 'evo' ? 'the biggest stage in the world' : t.circuitKind === 'squad' ? 'survivor format — one player stays on until they fall' : t.type === 'teams' ? 'crew battle format' : t.circuitKind === 'major' ? "a world major — sixteen invitations" : t.circuitKind === 'qualifier' ? 'four seats on the line — two by bracket, two by vote' : t.circuitKind === 'regional' ? 'the national top sixteen' : t.format === 'doubleelim' ? 'double elimination' : t.format === 'roundrobin' ? 'round robin' : 'single elimination'
          }</span>
          {hostLine(t) && <div className="small dim">📍 hosted in {hostLine(t)}</div>}
          {t.channelName && (
            <div className="small">
              <span className="pink">📡 live on {t.channelName}</span>
              {done && t.peakViewers > 0 && <span className="dim"> · peak {t.peakViewers} viewers</span>}
            </div>
          )}
        </div>
        <div className="row">
          {!done && <button onClick={skipAll}>⏭ Skip to results</button>}
          {/* The Hall of Fame is locked until the first EVO, and a local
              tournament can finish long before then — so this shortcut has to
              respect the same gate or it lands on a blank screen. */}
          {tabOpen(save, 'halloffame') && <button onClick={() => nav('halloffame')}>Hall of Fame</button>}
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

      {/* WHAT AM I WATCHING. Above the bracket, not buried under it: the
          question a circuit event has to answer is asked the moment it opens,
          not after you have scrolled past sixteen strangers. */}
      <EntryReport record={t} />
      {done && <QualifierSeats record={t} />}

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

      {/* A round robin is a GROUP STAGE, and a group stage is read as a table
          (the same shape EVO pools are drawn in). Held back until the
          broadcast finishes — the table is one big spoiler. */}
      {done && t.standings && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Group table</h3>
          <div className="table-scroll"><table>
            <thead>
              <tr><th>#</th><th>Player</th><th>MP</th><th>W</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th><th>Form</th></tr>
            </thead>
            <tbody>
              {t.standings.map((r, i) => (
                <tr key={r.id} className={r.kind === 'arcade' ? 'world-mine' : ''}>
                  <td className="dim">{i + 1}</td>
                  <td><strong>{r.name}</strong></td>
                  <td>{r.mp}</td><td>{r.w}</td><td>{r.l}</td><td>{r.gf}</td><td>{r.ga}</td>
                  <td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                  <td className="gold">{r.pts}</td>
                  <td className="small">{(r.form || []).map((f) => (f === 'w' ? '🟩' : '🟥')).join('')}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
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
                  onJump={() => jumpTo(flatIdx)}
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
  const [started, setStarted] = useState(false)
  const [finished, setFinished] = useState(false)
  const isTeamMatch = !!m.duels

  return (
    <div className="card" style={{ borderColor: 'var(--pink)' }}>
      <h3 className="pink" style={{ marginTop: 0 }}>
        {started ? 'Now playing' : 'Up next'} — {roundTitle}
        {m.stream && started && <span className="small"> · 👁 {m.stream.viewers}</span>}
      </h3>
      {isTeamMatch && (
        <p style={{ fontSize: 18 }}>
          {m.aName} <span className="dim">vs</span> {m.bName}
        </p>
      )}

      <MatchPlayback
        m={m}
        showHud={!isTeamMatch}
        startLabel={isTeamMatch ? 'Play the crew battle' : 'Play the match'}
        onStart={() => setStarted(true)}
        onComplete={() => setFinished(true)}
        footer={isTeamMatch
          ? <CrewBattle m={m} />
          : (m.probA != null && (
            <p className="dim small" style={{ fontStyle: 'normal' }}>
              odds were {Math.round(m.probA * 100)}%–{Math.round((1 - m.probA) * 100)}%
            </p>
          ))}
      />

      {finished && (
        <button className="primary" style={{ marginTop: 8 }} onClick={onFinished}>
          Continue to the next match ▶
        </button>
      )}
    </div>
  )
}

/**
 * A CREW BATTLE IS FOUR SETS, AND YOU COULD NEVER WATCH ONE.
 *
 * Every duel inside a team match has always been a complete match object with
 * its own narration — the survivor loop builds them with the same resolver a
 * bracket set uses. The screen just threw all of it away and printed one line
 * per duel saying who won, so the format the Squad Showdown is built around
 * (somebody stays on the machine, gets tired, and holds the wall anyway) was
 * invisible. This plays them back, one at a time, in order.
 *
 * The header on each is the thing a summary line cannot carry: how many bodies
 * each side has left, and how long the person still standing has been standing.
 */
function CrewBattle({ m }) {
  const [openSeat, setOpenSeat] = useState(0)
  const duels = m.duels || []
  return (
    <div style={{ fontStyle: 'normal' }}>
      <div className="row spread" style={{ marginTop: 6 }}>
        <strong className="small">⚔ The duels</strong>
        <span className="dim small">{duels.length} sets · click one to watch it back</span>
      </div>
      {duels.map((d, i) => {
        const streak = Math.max(d.streakA || 0, d.streakB || 0)
        const open = openSeat === i
        return (
          <div key={d.id || i} className="card sub" style={{ margin: '6px 0', padding: '6px 8px' }}>
            <div className="row spread clickable" style={{ cursor: 'pointer' }}
              onClick={() => setOpenSeat(open ? -1 : i)}>
              <span className="small">
                <span className="dim">set {i + 1}</span>{' '}
                <span className={d.winnerName === d.aName ? 'winner' : 'loser'}>{d.aName}</span>
                <span className="dim"> vs </span>
                <span className={d.winnerName === d.bName ? 'winner' : 'loser'}>{d.bName}</span>
                {d.tiebreaker && <span className="pink small"> · ⚔ aces, tiebreaker</span>}
                {streak >= 2 && (
                  <span className="gold small" title="they have been on the machine this long without losing">
                    {' '}· 🔥 {streak} straight
                  </span>
                )}
              </span>
              <span className="small">
                <span className="gold">{d.setScore || ''}</span>
                {d.aliveA != null
                  ? <span className="dim"> · {d.aliveA}v{d.aliveB} left</span>
                  : d.scoreAfter ? <span className="dim"> · {d.scoreAfter}</span> : null}
                <span className="cyan"> {open ? '▾' : '▸'}</span>
              </span>
            </div>
            {open && <MatchPlayback m={d} spoil autoStart />}
          </div>
        )
      })}
      {m.probA != null && (
        <p className="dim small" style={{ fontStyle: 'normal' }}>
          odds were {Math.round(m.probA * 100)}%–{Math.round((1 - m.probA) * 100)}%
        </p>
      )}
    </div>
  )
}

function BracketMatch({ m, offScreen, revealed, determined, isNext, onJump }) {
  const [open, setOpen] = useState(false)
  if (m.bye) {
    return (
      <div className={`bmatch ${offScreen ? 'offscreen' : ''}`} style={{ cursor: 'default' }}>
        <span className="winner">{m.aName}</span> <span className="dim small">— bye</span>
      </div>
    )
  }
  if (!determined) {
    // Not yet reached on the broadcast — click to skip ahead (spoiler prompt).
    return (
      <div className="bmatch" style={{ opacity: 0.5 }} onClick={onJump}
        title="skip the broadcast ahead to this match">
        <div className="dim">TBD</div>
        <div className="dim">TBD</div>
        <div className="dim small">click to skip ahead…</div>
      </div>
    )
  }
  if (!revealed) {
    return (
      <div className="bmatch" style={isNext ? { borderColor: 'var(--pink)' } : {}}
        onClick={isNext ? undefined : onJump}
        title={isNext ? undefined : 'skip the broadcast ahead to this match'}>
        <div>{m.aName} {m.aChar && <span className="dim small">({m.aChar})</span>}</div>
        <div>{m.bName} {m.bChar && <span className="dim small">({m.bChar})</span>}</div>
        <div className={`small ${isNext ? 'pink' : 'dim'}`}>{isNext ? '▶ up next' : 'click to skip ahead…'}</div>
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
        <div onClick={(e) => e.stopPropagation()}>
          {/* This set already aired — show it whole, with a replay option. */}
          <MatchPlayback
            m={m}
            spoil
            footer={m.duels
              ? <CrewBattle m={m} />
              : (m.probA != null && (
                <p className="dim small" style={{ fontStyle: 'normal' }}>
                  odds were {Math.round(m.probA * 100)}%–{Math.round((1 - m.probA) * 100)}%
                </p>
              ))}
          />
        </div>
      )}
    </div>
  )
}

/**
 * A money-match VOD: one marquee set, played back line by line with the
 * stream chat, exactly as it was broadcast. The reveal cursor persists on
 * the VOD record so it stays spoiler-free across sessions.
 */
function MoneyMatchVod({ t, nav, mutate }) {
  const m = t.match
  // Matches model.js isVodWatched, which floors at 1: a money match with no
  // narration lines would otherwise need `revealed >= 0` here and `>= 1`
  // there, so it could never be marked watched and would sit in the VOD list
  // as new forever.
  const total = m?.narration?.length || 1
  // Playback is LOCAL. Writing the cursor through mutate() on every line
  // would structuredClone and re-persist the whole save once a second; the
  // save only needs to learn that this VOD got watched, which it does once,
  // at the end. Rewatching replays without un-marking it.
  const alreadyWatched = (t.revealed ?? 0) >= total
  // Hooks run before the missing-VOD bail-out — they can't be conditional.
  const [finished, setFinished] = useState(alreadyWatched)
  if (!m) {
    return (
      <div className="card">
        <p className="dim">That broadcast didn't survive. Older VODs roll off over time.</p>
        <button onClick={() => nav('vods')}>Back to VODs</button>
      </div>
    )
  }
  const markWatched = () => {
    setFinished(true)
    mutate((s) => { for (const v of s.vods || []) if (v.id === t.id) v.revealed = total }, { ack: true })
  }

  return (
    <div>
      <div className="row spread">
        <div>
          <h1 style={{ fontSize: 30, margin: '4px 0' }}>💸 {t.name}</h1>
          <span className="dim">{t.dateLabel} · in-world stakes, whole-arcade audience</span>
          {t.channelName && (
            <div className="small">
              <span className="pink">📡 broadcast on {t.channelName}</span>
              {t.peakViewers > 0 && <span className="dim"> · peak {t.peakViewers} viewers</span>}
            </div>
          )}
        </div>
        <div className="row">
          <button onClick={() => nav('vods')}>Back to VODs →</button>
        </div>
      </div>

      <div className="card" style={{ borderColor: 'var(--gold)' }}>
        <h3 className="gold" style={{ marginTop: 0 }}>
          {m.aName} ({m.charAName}) vs {m.bName} ({m.charBName})
          {finished && <span> — {m.winnerName} wins {m.setScore || ''}</span>}
        </h3>
        <MatchPlayback
          m={m}
          spoil={alreadyWatched}
          startLabel="Play the match"
          onComplete={markWatched}
          footer={m.probA != null && (
            <p className="dim small" style={{ fontStyle: 'normal' }}>
              odds were {Math.round(m.probA * 100)}%–{Math.round((1 - m.probA) * 100)}%
            </p>
          )}
        />
      </div>
    </div>
  )
}

export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
