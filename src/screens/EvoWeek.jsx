import { useEffect, useState } from 'react'
import { useStore } from '../state/store.jsx'
import MatchPlayback from '../components/MatchPlayback.jsx'

/**
 * EVO week, as a broadcast rather than a results table.
 *
 * The whole tournament is already simulated and sitting in the record before
 * any of this renders — this walks you through it in the order the day would
 * actually happen: the lights, sixteen pools you can dig through or skip, the
 * seeding, the noise online, the exhibition, the words either side of it, the
 * bracket, and then the champion with a camera in their face.
 *
 * Every step is skippable and the position is stored on the save, so closing
 * the tab mid-pools puts you back in pools.
 */
// `ours` is conditional — it only exists in a year one of your players actually
// won the thing. See `steps` below: it is filtered out entirely otherwise, so
// `next()` can't land on a beat with nothing to celebrate.
const STEPS = ['intro', 'pools', 'seeded', 'chatter', 'expo', 'expoTalk', 'bracket', 'champion', 'ours', 'end']

export default function EvoWeek({ record, onFinish }) {
  const { save, mutate } = useStore()
  const state = save.evoWeek || { step: 'intro', poolRound: 0, openPool: null, watched: [] }

  // Did somebody from this arcade win EVO? `arcadeResults` is your players'
  // placements, so place 1 is the whole question.
  const ourChampion = (record.arcadeResults || []).find((a) => a.place === 1)
  const steps = STEPS.filter((s) => s !== 'ours' || ourChampion)
  const step = steps.includes(state.step) ? state.step : 'intro'

  const set = (patch) => mutate((s) => {
    s.evoWeek = { ...(s.evoWeek || { step: 'intro', poolRound: 0, openPool: null, watched: [] }), ...patch }
  }, { ack: true }) // stepping through the broadcast, not a choice
  const go = (next) => set({ step: next, openPool: null })
  const idx = steps.indexOf(step)
  const next = () => go(steps[Math.min(steps.length - 1, idx + 1)])

  // Every match in the record, by id — pools and bracket alike.
  const byId = {}
  for (const r of record.rounds || []) for (const m of r.matches || []) byId[m.id] = m

  return (
    <div className="evo">
      {/* No chrome over a cinematic beat. `ours` joins the intro in this: a
          skip button sitting on top of the celebration undercuts it. */}
      {step !== 'intro' && step !== 'ours' && step !== 'end' && (
        <div className="row spread evo-chrome">
          <span className="dim small">EVO {record.year} · {record.entrantCount} entrants</span>
          <button className="small" onClick={() => go('end')}>Skip to the end →</button>
        </div>
      )}

      {step === 'intro' && <EvoIntro onDone={next} />}
      {step === 'pools' && (
        <Pools record={record} byId={byId} state={state} set={set} onDone={next} />
      )}
      {step === 'seeded' && <Seeded record={record} onNext={next} />}
      {step === 'chatter' && <Chatter record={record} onNext={next} />}
      {step === 'expo' && <Exhibition record={record} byId={byId} onNext={next} />}
      {step === 'expoTalk' && <Interviews record={record} onNext={next} />}
      {step === 'bracket' && <Bracket record={record} state={state} set={set} onNext={next} />}
      {step === 'champion' && <Champion record={record} onNext={next} />}
      {step === 'ours' && ourChampion && <ArcadeChampion name={ourChampion.name} onDone={next} />}
      {step === 'end' && <TheEnd record={record} onFinish={() => { set({ step: 'done' }); onFinish() }} />}
    </div>
  )
}

// ---------- 1. The lights ----------

function EvoIntro({ onDone }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const a = setTimeout(() => setOpen(true), 450)
    return () => clearTimeout(a)
  }, [])
  return (
    <div className={`evo-stage${open ? ' open' : ''}`} onClick={onDone}>
      <div className="evo-curtain left" />
      <div className="evo-curtain right" />
      <div className="evo-neon"><span>EVO</span></div>
      <div className="evo-skip small dim">click to continue</div>
    </div>
  )
}

// ---------- 2. Pools ----------

/**
 * `poolRound` counts rounds you have finished WATCHING, 0-3 — not the round you
 * are looking at. The difference is the whole spoiler problem: while you are on
 * round two, round two has not been revealed to you yet, even though it has
 * been on the record since the moment EVO was simulated.
 */
function Pools({ record, byId, state, set, onDone }) {
  const pools = record.pools || []
  const round = Math.min(state.poolRound || 0, 3)
  const openPool = state.openPool

  if (!pools.length) {
    return <div className="card"><p className="dim">This EVO has no pool stage on record.</p>
      <button className="primary" onClick={onDone}>Continue →</button></div>
  }

  if (openPool != null) {
    const pool = pools[openPool]
    return <PoolDetail pool={pool} round={round} byId={byId} state={state} set={set}
      back={() => set({ openPool: null })} />
  }

  return (
    <div>
      <div className="row spread">
        <h2 style={{ margin: 0 }}>
          {round >= 3 ? 'Pools · all three rounds played' : `Pools · Round ${round + 1} of 3`}
        </h2>
        <div className="row">
          {round < 3 && (
            <button className="primary" onClick={() => set({ poolRound: round + 1 })}>
              ▶ {round === 2 ? 'Play the final round' : 'Next round'}
            </button>
          )}
          <button onClick={onDone}>Skip pools →</button>
        </div>
      </div>
      <p className="dim small">
        Sixteen pools of four. Everybody plays everybody and exactly one player comes out of each —
        click a pool to watch its matches, or skip the whole stage and go straight to the bracket.
      </p>
      <div className="pool-grid">
        {pools.map((p, i) => {
          const done = round >= 3
          const leader = p.standings[0]
          return (
            <button className="pool-card" key={p.letter} onClick={() => set({ openPool: i })}>
              <div className="row spread">
                <strong>Pool {p.letter}</strong>
                {done && <span className="gold small">✓</span>}
              </div>
              {/* Before the pool has finished, list it in SEED order with no
                  places — the final standings are on the record from the
                  moment EVO is simulated, and rendering them at round one
                  hands you the answer before the first match. */}
              {(done ? p.standings : (p.entrants || p.standings)).slice(0, 4).map((r, ri) => (
                <div className="pool-mini" key={r.id}>
                  <span className={done && ri === 0 ? 'gold' : r.kind === 'arcade' ? 'cyan' : 'dim'}>
                    {done ? `${ri + 1}. ` : ''}{r.name.replace(/\s*\[[^\]]+\]$/, '')}
                  </span>
                  <span className="dim">{done ? r.pts : ''}</span>
                </div>
              ))}
              {done && <div className="small dim" style={{ marginTop: 4 }}>→ {leader.name} advances</div>}
            </button>
          )
        })}
      </div>
      {round >= 3 && (
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" onClick={onDone}>The seeds are in →</button>
        </div>
      )}
    </div>
  )
}

/**
 * One pool, as a group table. Standings only fill in as the rounds are played,
 * so reading them before round three is genuinely uncertain — which is the
 * point of walking through it rather than being handed the result.
 */
function PoolDetail({ pool, round, byId, state, set, back }) {
  const [watching, setWatching] = useState(null)
  // A match is REVEALED if its round is finished, or if you sat and watched it.
  // Watching one set of the round you are on shows you that set and nothing
  // else — which is what "click a pool to watch its matches" promised.
  const watched = new Set(state?.watched || [])
  const revealedAt = (ri, id) => ri < round || watched.has(id)
  const playedSet = new Set(
    pool.rounds.flatMap((r, ri) => r.matchIds.filter((id) => revealedAt(ri, id))))
  const watch = (id) => {
    if (!watched.has(id)) set({ watched: [...(state?.watched || []), id] })
    setWatching(id)
  }

  // Recompute the table from only the matches that have "aired".
  const base = pool.entrants || pool.standings
  const meta = new Map(pool.standings.map((r) => [r.id, r]))
  const rows = base.map((e) => ({
    ...(meta.get(e.id) || e), id: e.id, name: e.name, kind: e.kind,
    mp: 0, w: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, form: [],
  }))
  const byName = new Map(rows.map((r) => [r.id, r]))
  for (const id of playedSet) {
    const m = byId[id]
    if (!m) continue
    const a = byName.get(m.aId), b = byName.get(m.bId)
    if (!a || !b) continue
    const target = m.ftTarget ?? 2
    const lg = m.setLoserGames ?? 0
    const aWon = m.winnerId === m.aId
    const w = aWon ? a : b, l = aWon ? b : a
    w.mp++; l.mp++; w.w++; l.l++
    w.gf += target; w.ga += lg; l.gf += lg; l.ga += target
    w.form.push('w'); l.form.push('l')
  }
  for (const r of rows) { r.gd = r.gf - r.ga; r.pts = r.w * 3 }
  rows.sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf)

  if (watching) {
    const m = byId[watching]
    return (
      <div>
        <button onClick={() => setWatching(null)}>← Back to Pool {pool.letter}</button>
        <MatchPlayback m={m} autoStart startLabel="Play the set"
          footer={<p className="dim small">Pool {pool.letter}</p>} />
      </div>
    )
  }

  return (
    <div>
      <div className="row spread">
        <h2 style={{ margin: 0 }}>Pool {pool.letter}</h2>
        <button onClick={back}>← All pools</button>
      </div>
      <div className="card">
        <div className="table-scroll"><table className="pool-table">
          <thead>
            <tr>
              <th>#</th><th>Player</th>
              <th>MP</th><th>W</th><th>D</th><th>L</th>
              <th>GF</th><th>GA</th><th>GD</th><th>Pts</th><th>Form</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className={i === 0 ? 'pool-lead' : undefined}>
                <td className="dim">{i + 1}</td>
                <td className={r.kind === 'arcade' ? 'cyan' : ''}><strong>{r.name}</strong></td>
                <td>{r.mp}</td><td>{r.w}</td><td className="dim">0</td><td>{r.l}</td>
                <td>{r.gf}</td><td>{r.ga}</td>
                <td className={r.gd > 0 ? 'green' : r.gd < 0 ? 'red' : 'dim'}>{r.gd > 0 ? '+' : ''}{r.gd}</td>
                <td><strong>{r.pts}</strong></td>
                <td>
                  {r.form.map((f, fi) => (
                    <span key={fi} className={`form-dot ${f}`}>{f === 'w' ? '✓' : '✕'}</span>
                  ))}
                  {Array.from({ length: 3 - r.form.length }).map((_, fi) => (
                    <span key={`e${fi}`} className="form-dot" />
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      {pool.rounds.map((r, ri) => (
        <div className="card" key={ri} style={ri > round ? { opacity: 0.4 } : undefined}>
          <h4 style={{ margin: '0 0 6px' }}>{r.title}{ri > round && <span className="dim small"> — not played yet</span>}</h4>
          {r.matchIds.map((id) => {
            const m = byId[id]
            if (!m) return null
            const playable = ri <= round
            const aired = revealedAt(ri, id)
            return (
              <div key={id} className={`row spread pool-match${playable ? ' clickable' : ''}`}
                onClick={playable ? () => watch(id) : undefined}>
                <span>
                  <span className={m.winnerId === m.aId && aired ? 'gold' : ''}>{m.aName}</span>
                  <span className="dim"> vs </span>
                  <span className={m.winnerId === m.bId && aired ? 'gold' : ''}>{m.bName}</span>
                </span>
                <span className="small">
                  {aired ? <span className="gold">{m.setScore}</span> : <span className="dim">—</span>}
                  {playable && <span className="dim"> · {aired ? 'rewatch' : 'watch'} ▸</span>}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// ---------- 3–8. The rest of the day ----------

function Seeded({ record, onNext }) {
  return (
    <div className="evo-beat">
      <h1 className="evo-headline">The tournament seeds have been set!</h1>
      <div className="card">
        <div className="seed-grid">
          {(record.seeds || []).map((s) => (
            <div className="seed-row" key={s.id}>
              <span className="dim">#{s.seed}</span>
              <span className={s.kind === 'arcade' ? 'cyan' : ''}>{s.name}</span>
            </div>
          ))}
        </div>
      </div>
      <button className="primary" onClick={onNext}>Continue →</button>
    </div>
  )
}

function Chatter({ record, onNext }) {
  return (
    <div className="evo-beat">
      <h2>The night before</h2>
      <p className="dim">Everybody has a take. Most of them are wrong.</p>
      {(record.talk || []).map((t, i) => (
        <div className="card chirp" key={i}>
          <div className="small cyan">@{t.handle}</div>
          <div>{t.text}</div>
        </div>
      ))}
      <button className="primary" onClick={onNext}>To the exhibition →</button>
    </div>
  )
}

function Exhibition({ record, byId, onNext }) {
  const [done, setDone] = useState(false)
  const m = record.expo ? byId[record.expo.matchId] : null
  if (!m) {
    return <div className="evo-beat"><h2>No exhibition this year</h2>
      <button className="primary" onClick={onNext}>On with it →</button></div>
  }
  return (
    <div>
      <h2>Media Day · The Exhibition</h2>
      <p className="dim small">Nothing on the line but pride, which is usually enough.</p>
      {/* autoStart, NOT spoil: spoil renders the finished match in one go,
          which skipped the exhibition straight to its own ending. */}
      <MatchPlayback m={m} autoStart startLabel="Play the exhibition" onComplete={() => setDone(true)} />
      {/* Never disabled: the complaint was that this match skipped itself, and
          forcing someone to sit through it is the same mistake facing the
          other way. */}
      <button className={done ? 'primary' : ''} onClick={onNext}>
        {done ? 'Get their reaction →' : 'Skip ahead →'}
      </button>
    </div>
  )
}

function Interviews({ record, onNext }) {
  const expo = record.expo
  if (!expo) { onNext(); return null }
  return (
    <div className="evo-beat">
      <h2>Backstage</h2>
      {[expo.winner, expo.loser].filter(Boolean).map((iv, i) => (
        <div className="card" key={i} style={{ borderColor: iv.won ? 'var(--gold)' : 'var(--border)' }}>
          <div className="row spread">
            <strong className={iv.won ? 'gold' : ''}>{iv.name}</strong>
            <span className="dim small">{iv.won ? 'won the exhibition' : 'lost the exhibition'}</span>
          </div>
          {iv.lines.map((l, li) => <p className="speech" key={li}>“{l}”</p>)}
        </div>
      ))}
      <button className="primary" onClick={onNext}>To the bracket →</button>
    </div>
  )
}

/**
 * The bracket, revealed the way a broadcast reveals one: one set at a time.
 *
 * The record holds every result from the moment EVO simulates, so rendering
 * the whole thing up front told you who won the tournament before the first
 * match of it — and worse, a round-two card reading "Miracle vs …" gives away
 * round one. Nothing past the cursor shows names at all.
 */
function Bracket({ record, state, set, onNext }) {
  const [watching, setWatching] = useState(null)
  const rounds = (record.rounds || []).filter((r) => r.phase === 'top16')
  const flat = []
  rounds.forEach((r, ri) => r.matches.forEach((m) => flat.push({ m, ri })))
  const order = new Map(flat.map((f, i) => [f.m.id, i]))
  // Byes never need watching, so they reveal themselves.
  let revealed = Math.min(state.bracketRevealed || 0, flat.length)
  while (revealed < flat.length && flat[revealed].m.bye) revealed++
  const done = revealed >= flat.length
  const nextMatch = done ? null : flat[revealed].m

  const reveal = (id) => {
    const i = order.get(id)
    set({ bracketRevealed: Math.max(revealed, (i ?? revealed) + 1) })
    setWatching(null)
  }

  if (watching) {
    return (
      <div>
        <button onClick={() => setWatching(null)}>← Back to the bracket</button>
        <MatchPlayback m={watching} autoStart startLabel="Play the set"
          onComplete={() => reveal(watching.id)} />
        <button className="primary" style={{ marginTop: 10 }} onClick={() => reveal(watching.id)}>
          Skip to the result →
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="row spread">
        <h2 style={{ margin: 0 }}>Top 16</h2>
        <div className="row">
          {!done && (
            <button className="primary" onClick={() => setWatching(nextMatch)}>
              ▶ Watch {nextMatch.aName} vs {nextMatch.bName}
            </button>
          )}
          {!done && (
            <button onClick={() => set({ bracketRevealed: flat.length })}>Skip to the result →</button>
          )}
        </div>
      </div>
      <p className="dim small">
        Double elimination. {done
          ? 'Click any set to watch it again.'
          : 'Sets air in order — watch the next one, or skip ahead if you cannot wait.'}
      </p>
      <div className="bracket">
        {rounds.map((r, ri) => (
          <div className="round" key={ri}>
            <h4 className="dim" style={{ margin: '0 0 6px' }}>{r.title}</h4>
            {r.matches.map((m) => {
              const i = order.get(m.id)
              const shown = i < revealed
              const isNext = m.id === nextMatch?.id
              if (!shown && !isNext) {
                return <div className="bmatch unrevealed" key={m.id}><div className="dim">—</div><div className="dim">—</div></div>
              }
              return (
                <div className={`bmatch${isNext ? ' up-next' : ''}`} key={m.id}
                  onClick={() => setWatching(m)}>
                  <div className={shown && m.winnerId === m.aId ? 'winner' : shown ? 'loser' : ''}>{m.aName}</div>
                  <div className={shown && m.winnerId === m.bId ? 'winner' : shown ? 'loser' : ''}>{m.bName}</div>
                  <div className="dim small">{shown ? m.setScore : isNext ? '▶ up next' : ''}</div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <button className="primary" style={{ marginTop: 12 }} disabled={!done} onClick={onNext}>
        {done ? 'The champion speaks →' : 'Finish the bracket first'}
      </button>
    </div>
  )
}

function Champion({ record, onNext }) {
  const iv = record.championInterview
  return (
    <div className="evo-beat">
      <h1 className="evo-headline gold">🏆 {record.champion}</h1>
      <p className="dim">EVO {record.year} champion.</p>
      {iv && (
        <div className="card" style={{ borderColor: 'var(--gold)' }}>
          {iv.lines.map((l, i) => <p className="speech" key={i}>“{l}”</p>)}
        </div>
      )}
      <button className="primary" onClick={onNext}>Continue →</button>
    </div>
  )
}

/**
 * One of yours won it.
 *
 * The third cinematic in the game and deliberately the third KIND of motion:
 * EVO's intro parts curtains sideways, the grand opening lifts a shutter
 * upward, and this one throws light outward from a point. Same grammar — a
 * held black frame, one sentence, click to continue — different gesture, so
 * the three don't blur into each other in memory.
 *
 * The bursts are authored rather than random: `Math.random()` in a render body
 * re-rolls every paint, which makes a firework twitch instead of fly. Angles
 * come from the spark's index and the spread from a cheap hash of it, so a
 * burst looks scattered and is actually the same every frame.
 */
const BURSTS = [
  { x: 26, y: 34, hue: 'gold', delay: 0 },
  { x: 72, y: 26, hue: 'pink', delay: 0.9 },
  { x: 48, y: 18, hue: 'cyan', delay: 1.7 },
  { x: 16, y: 58, hue: 'pink', delay: 2.6 },
  { x: 84, y: 54, hue: 'gold', delay: 3.2 },
]
const SPARKS = 16

function Firework({ x, y, hue, delay }) {
  return (
    <div className={`fw fw-${hue}`} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s` }}>
      {Array.from({ length: SPARKS }, (_, i) => {
        const angle = (i / SPARKS) * Math.PI * 2
        // Cheap deterministic jitter so the ring isn't a perfect circle.
        const wobble = ((i * 2654435761) % 41) / 100 // 0 .. 0.40
        const dist = 62 + wobble * 90
        return (
          <span key={i} className="fw-spark" style={{
            '--tx': `${Math.cos(angle) * dist}px`,
            '--ty': `${Math.sin(angle) * dist}px`,
            animationDelay: `${delay + wobble * 0.12}s`,
          }} />
        )
      })}
    </div>
  )
}

export function ArcadeChampion({ name, onDone }) {
  const [lit, setLit] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setLit(true), 350)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className={`fwk-stage${lit ? ' lit' : ''}`} onClick={onDone}>
      {BURSTS.map((b, i) => <Firework key={i} {...b} />)}
      <div className="fwk-copy">
        <div className="fwk-congrats">Congratulations!</div>
        <div className="fwk-name">{name}</div>
        <div className="fwk-title">is an EVO champion!</div>
      </div>
      <div className="fwk-skip small dim">click to continue</div>
    </div>
  )
}

function TheEnd({ record, onFinish }) {
  const mine = (record.arcadeResults || [])
  return (
    <div className="evo-beat">
      <h2>That's EVO {record.year}</h2>
      <div className="card">
        <p><strong className="gold">{record.champion}</strong> takes the title.</p>
        {mine.length > 0 ? (
          <p className="cyan">
            Your arcade: {mine.map((a) => `${a.name} (${a.place})`).join(' · ')}
          </p>
        ) : (
          <p className="dim">Nobody from your arcade was in it. There's always next year.</p>
        )}
      </div>
      <button className="primary" onClick={onFinish}>End of EVO</button>
    </div>
  )
}
