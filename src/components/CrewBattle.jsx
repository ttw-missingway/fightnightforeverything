import { useState } from 'react'
import MatchPlayback from './MatchPlayback.jsx'

/**
 * A CREW BATTLE, WATCHED.
 *
 * A team match is not one match. It is four (or more) real sets played in an
 * order, and the order is the drama: who they send first, who is still standing
 * with two crews' worth of fatigue on them, who has to come in when their side
 * is one body from going out. Every one of those duels has always been a
 * complete match object with its own narration — the survivor loop and the
 * crew bracket both build them with the same resolver a bracket set uses.
 *
 * The first attempt at showing them was wrong in a specific and instructive
 * way: it printed the whole scoreline as a summary, and then offered a rewatch
 * button under it. Nothing about that is a broadcast. Knowing the result and
 * then being invited to sit through the footage is the opposite of tension —
 * it is a transcript with a replay attached.
 *
 * So this plays the duels IN SEQUENCE, and shows nothing past the one on
 * screen. Duel one runs; when it ends you learn who won, who is still on the
 * machine, and how many bodies each side has left; then, and only then, does
 * the next duel exist. In survivor format that ordering is load-bearing — the
 * winner stays on, so naming the next pairing early would give away the set you
 * are currently watching.
 *
 * `spoil` is for a set that already aired (an old bracket cell, a VOD you have
 * seen). There the whole card is fair game and each duel opens for a rewatch,
 * which is what a rewatch is actually for.
 */
export default function CrewBattle({ m, spoil = false, onFinished = null, compact = false }) {
  const duels = m.duels || []
  // How many duels have been played through. Starts at the end for a set that
  // already aired; at zero for one that is about to happen.
  const [done, setDone] = useState(spoil ? duels.length : 0)
  const [openIdx, setOpenIdx] = useState(null)
  const [started, setStarted] = useState(spoil)
  const allDone = done >= duels.length

  // SURVIVOR vs FIXED SEATS — two formats, two things it is safe to show.
  // The Squad Showdown stamps `aliveA`; there the lineup is public but the
  // pairings are not, because the winner stays on. A crew bracket is four
  // fixed seat-vs-seat sets, so the pairings are announced and only the
  // results are secret.
  const survivor = duels.some((d) => d.aliveA != null)

  if (!duels.length) return null

  const finish = () => { setDone(duels.length); onFinished?.() }

  return (
    <div className="crew-battle">
      <div className="row spread">
        <strong>
          <span className={allDone && m.winnerName === m.aName ? 'winner' : ''}>{m.aName}</span>
          <span className="dim"> vs </span>
          <span className={allDone && m.winnerName === m.bName ? 'winner' : ''}>{m.bName}</span>
        </strong>
        <span className="dim small">
          {survivor ? 'survivor rules — win and you stay on' : 'crew battle — four seats'}
          {' · '}
          {allDone ? `${duels.length} sets` : started ? `set ${Math.min(done + 1, duels.length)}` : 'about to start'}
        </span>
      </div>

      {!started && (
        <div style={{ marginTop: 8 }}>
          <p className="dim small" style={{ margin: '0 0 8px' }}>
            {survivor
              ? 'Weakest out first, ace anchoring. A player stays on the machine until somebody knocks them off — and gets heavier every set they survive. First crew with nobody left to send loses.'
              : 'Four seats, four sets, seat against seat. Level on sets and the two aces run it back.'}
          </p>
          <div className="row">
            <button className="primary small" onClick={() => setStarted(true)}>▶ Play the crew battle</button>
            <button className="small" onClick={finish}>⏭ Skip to the result</button>
          </div>
        </div>
      )}

      {started && duels.map((d, i) => {
        if (i > done) return null // nothing past the set on screen exists yet
        const current = i === done && !allDone
        const streak = Math.max(d.streakA || 0, d.streakB || 0)
        const open = current || openIdx === i

        if (current) {
          return (
            <div key={d.id || i} className="crew-duel current">
              <div className="row spread">
                <span className="small pink">
                  {d.tiebreaker ? '⚔ Tiebreaker — the aces' : `Set ${i + 1}`}
                  {survivor && streak >= 1 && (
                    <span className="gold" title="how long they have been on the machine without losing">
                      {' '}· 🔥 {d.streakA > d.streakB ? d.aName : d.bName} on {streak} straight
                    </span>
                  )}
                </span>
                {survivor && d.aliveA != null && (
                  <span className="dim small">{d.aliveA} v {d.aliveB} left standing</span>
                )}
              </div>
              <div style={{ fontSize: 16, margin: '2px 0 4px' }}>{d.aName} <span className="dim">vs</span> {d.bName}</div>
              <MatchPlayback
                m={d}
                autoStart
                startLabel="Play the set"
                onComplete={() => setDone((n) => Math.max(n, i + 1))}
              />
            </div>
          )
        }

        // Already played through: the result, and a rewatch if you want it.
        return (
          <div key={d.id || i} className="crew-duel">
            <div className="row spread clickable" style={{ cursor: 'pointer' }}
              onClick={() => setOpenIdx(open ? null : i)}>
              <span className="small">
                <span className="dim">{d.tiebreaker ? '⚔ tiebreaker' : `set ${i + 1}`}</span>{' '}
                <span className={d.winnerName === d.aName ? 'winner' : 'loser'}>{d.aName}</span>
                <span className="dim"> vs </span>
                <span className={d.winnerName === d.bName ? 'winner' : 'loser'}>{d.bName}</span>
              </span>
              <span className="small">
                <span className="gold">{d.setScore || ''}</span>
                {survivor && d.aliveA != null
                  ? <span className="dim"> · {d.aliveA}v{d.aliveB}</span>
                  : d.scoreAfter ? <span className="dim"> · {d.scoreAfter}</span> : null}
                <span className="cyan"> {open ? '▾' : '▸'}</span>
              </span>
            </div>
            {open && <MatchPlayback m={d} spoil autoStart />}
          </div>
        )
      })}

      {started && !allDone && (
        <div className="row" style={{ marginTop: 6 }}>
          <button className="small" onClick={finish}>⏭ Skip the rest of the crew battle</button>
        </div>
      )}

      {allDone && (
        <div className="crew-result">
          <strong className="gold">{m.winnerName} take it</strong>
          {m.score && <span className="dim"> — {m.score}</span>}
          {!compact && onFinished && (
            <button className="primary small" style={{ marginLeft: 10 }} onClick={onFinished}>
              Continue ▶
            </button>
          )}
        </div>
      )}
    </div>
  )
}
