import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { StatBar, moodFace, Portrait } from '../components/ui.jsx'
import { playerArt, charArt } from '../components/art.js'
import PlayerForm from '../components/PlayerForm.jsx'
import { PERSONAL_STATS, SOCIAL_STATS, statusOf, formatDay } from '../game/constants.js'
import { relLabel, moodLabel, gameOpinionOf, arcadeOpinionOf, opinionLabel, sceneVerdict, standingOf, standingLabel, getRel } from '../game/social.js'
import { passionLabel } from '../game/career.js'
import { displayName } from '../game/util.js'
import { skillCeiling } from '../game/match.js'
import { voiceSummary } from '../game/dialogue.js'
import { warnPlayer, banish, separate, warnableBehaviors, toxicityBlame } from '../game/discipline.js'

const bestSkill = (p) => Math.round(Math.max(0, ...Object.values(p.charSkill || {}), 0))

const SORTS = {
  name: (p) => (p.alias || p.firstName).toLowerCase(),
  elo: (p) => p.elo,
  skill: bestSkill,
  wins: (p) => p.wins,
  glory: (p) => p.glory,
  respect: (p) => p.respect,
  mood: (p) => p.mood,
  passion: (p) => p.passion ?? 80,
  status: (p) => p.daysAttended || 0,
}

const PASSION_COLOR = (v) => (v >= 55 ? 'var(--green)' : v >= 30 ? 'var(--gold)' : 'var(--red)')

// Stage belief — earned nerve under the lights. Untested players choke at EVO.
const beliefLabel = (v) => (
  v >= 90 ? 'ice in their veins'
    : v >= 70 ? 'stage veteran'
    : v >= 45 ? 'battle-tested'
    : v >= 20 ? 'still green'
    : 'untested')

export default function Players() {
  const { save, screen, nav, mutate } = useStore()
  const [editing, setEditing] = useState(false)
  const [sortKey, setSortKey] = useState('elo')
  const [sortAsc, setSortAsc] = useState(false)
  const selId = screen.playerId || null
  // How the room feels about each player (incoming relationships) — the
  // liked/hated read. Computed once for the whole table.
  const standings = {}
  for (const p of Object.values(save.players)) standings[p.id] = standingOf(save, p)
  const sortFn = sortKey === 'standing' ? (p) => standings[p.id] : SORTS[sortKey]
  const players = Object.values(save.players).sort((a, b) => {
    const ka = sortFn(a)
    const kb = sortFn(b)
    const cmp = typeof ka === 'string' ? ka.localeCompare(kb) : ka - kb
    return sortAsc ? cmp : -cmp
  })
  const sel = save.players[selId]

  const sortBy = (key) => {
    if (sortKey === key) setSortAsc(!sortAsc)
    else { setSortKey(key); setSortAsc(key === 'name') }
  }
  const Th = ({ k, children }) => (
    <th style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => sortBy(k)}>
      {children}{sortKey === k ? (sortAsc ? ' ▲' : ' ▼') : ''}
    </th>
  )

  if (sel) {
    return (
      <PlayerDetail
        save={save} player={sel} mutate={mutate}
        editing={editing} setEditing={setEditing}
        back={() => { setEditing(false); nav('players') }}
        goTo={(id) => { setEditing(false); nav('players', { playerId: id }) }}
      />
    )
  }

  return (
    <div>
      <SceneHealthBanner scene={save.scene} />
      <div className="card">
      <h2 style={{ marginTop: 0 }}>Leaderboard <span className="dim small">(click a column to sort)</span></h2>
      <div className="table-scroll"><table>
        <thead>
          <tr>
            <th>#</th>
            <Th k="name">Player</Th>
            <th>Main</th>
            <Th k="elo">Elo</Th>
            <Th k="skill">Skill</Th>
            <Th k="wins">W–L</Th>
            <Th k="glory">Glory</Th>
            <Th k="respect">Respect</Th>
            <Th k="mood">Mood</Th>
            <Th k="passion">Passion</Th>
            <Th k="standing">Liked/Hated</Th>
            <Th k="status">Status</Th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => {
            const main = save.game.characters.find((c) => c.id === p.mainCharId)
            return (
              <tr key={p.id} className="clickable" onClick={() => nav('players', { playerId: p.id })}
                style={p.retired ? { opacity: 0.5 } : undefined}>
                <td className="dim">{i + 1}</td>
                <td>
                  <span className="row" style={{ gap: 8, flexWrap: 'nowrap', alignItems: 'center' }}>
                    <Portrait url={playerArt(p)} size={26} alt={displayName(p, save)} />
                    <span><strong>{displayName(p, save)}</strong>{p.retired && <span className="dim small"> 🏁</span>}<br />
                      <span className="dim small">{p.firstName} {p.lastName}</span></span>
                  </span>
                </td>
                <td className="cyan">
                  {main && <Portrait url={charArt(main)} size={20} alt={main.name} />}{main && ' '}
                  {main ? main.name : '—'}
                  {main && !p.settledMain && <span className="dim small"> (trying out)</span>}
                </td>
                <td>{Math.round(p.elo)}</td>
                <td className="cyan">{bestSkill(p) || <span className="dim">—</span>}</td>
                <td className="dim">{p.wins}–{p.losses}</td>
                <td className="gold">{Math.round(p.glory)}</td>
                <td className="dim">{Math.round(p.respect)}</td>
                <td title={moodLabel(p.mood)}>{moodFace(p.mood)}</td>
                <td className="small" style={{ color: PASSION_COLOR(p.passion ?? 80) }}
                  title={`${passionLabel(p.passion ?? 80)} — ${Math.round(p.passion ?? 80)}/100`}>
                  {p.retired ? <span className="dim">retired</span> : Math.round(p.passion ?? 80)}
                </td>
                <td className="small">
                  {p.retired || p.banished ? <span className="dim">—</span> : (() => {
                    const s = standingLabel(standings[p.id])
                    return <span style={{ color: s.color }} title={`the room's read on them — ${Math.round(standings[p.id])}`}>{s.label}</span>
                  })()}
                </td>
                <StatusCell player={p} />
              </tr>
            )
          })}
        </tbody>
      </table></div>
      {players.length === 0 && <p className="dim">No players exist yet.</p>}
      </div>
    </div>
  )
}

// The scene's competitive temperature — the mid-game's central tension. You
// want fierce rivalries (they develop players) without tipping into toxicity
// (which drives people away). Cultivated through events and a balanced game;
// a great venue lets you run a spicier scene without losing people.
function SceneHealthBanner({ scene }) {
  if (!scene || scene.regulars < 6) return null
  const v = sceneVerdict(scene)
  const meter = (label, value, good) => (
    <div style={{ flex: 1, minWidth: 160 }}>
      <div className="row spread">
        <span className="small dim">{label}</span>
        <span className="small">{Math.round(value * 100)}</span>
      </div>
      <div className="track" style={{ height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${Math.round(value * 100)}%`, height: '100%', background: good }} />
      </div>
    </div>
  )
  return (
    <div className="card" style={{ padding: '10px 14px' }}>
      <div className="row spread">
        <span className="small">⚔️ Scene health</span>
        <span className="small" style={{ color: `var(--${v.color})` }}>{v.label}</span>
      </div>
      <div className="row" style={{ gap: 16, marginTop: 6 }}>
        {meter('Competitive intensity', scene.rivalryIndex, 'linear-gradient(90deg, var(--cyan), var(--green))')}
        {meter('Toxicity', scene.toxicity, 'linear-gradient(90deg, var(--gold), var(--red))')}
      </div>
      <p className="dim small" style={{ margin: '6px 0 0' }}>
        Rivalries push players to improve; a scene of only friends plateaus. But bad blood — fed by a
        frustrating, unbalanced meta — turns toxic and drives regulars away (a clean, well-staffed venue softens the blow).
      </p>
    </div>
  )
}

const STATUS_COLORS = {
  newbie: 'var(--dim)',
  casual: 'var(--dim)',
  regular: 'var(--cyan)',
  veteran: 'var(--green)',
  star: 'var(--gold)',
  legend: 'var(--pink)',
}

function StatusCell({ player }) {
  if (player.retired) return <td className="small" style={{ color: 'var(--dim)' }}>🏁 retired</td>
  const st = statusOf(player)
  if (!st) return <td className="dim small">not yet visited</td>
  return (
    <td className="small" style={{ color: STATUS_COLORS[st.key] }}
      title={`${player.daysAttended} day${player.daysAttended === 1 ? '' : 's'} at the arcade`}>
      {st.key === 'star' && '⭐ '}{st.key === 'legend' && '👑 '}{st.label}
    </td>
  )
}

function PlayerDetail({ save, player: p, mutate, editing, setEditing, back, goTo }) {
  const main = save.game.characters.find((c) => c.id === p.mainCharId)
  const team = p.teamId ? save.teams[p.teamId] : null
  const rels = Object.entries(p.relationships)
    .map(([id, v]) => ({ other: save.players[id], v }))
    .filter((r) => r.other)
    .sort((a, b) => b.v - a.v)
  const mentorship = save.mentorships.find((m) => m.mentorId === p.id || m.studentId === p.id)
  const knownInnovs = save.innovations.filter((i) => p.knownInnovations.includes(i.id))
  const createdInnovs = save.innovations.filter((i) => i.creatorId === p.id)

  // Consequential worlds lock players in once the run has started — no
  // mid-game stat editing. Sandbox stays freely editable.
  const canEdit = save.settings.mode === 'sandbox'

  const patch = (fn) => mutate((s) => {
    const live = s.players[p.id]
    if (live) fn(live)
  })

  return (
    <div>
      <div className="row spread">
        <button onClick={back}>← Leaderboard</button>
        {canEdit
          ? <button onClick={() => setEditing(!editing)}>{editing ? 'Done editing' : '✎ Edit player'}</button>
          : <span className="pill" title="players are locked in once a consequential run begins">🔒 locked in</span>}
      </div>

      <div className="card">
        <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'nowrap' }}>
          <Portrait url={playerArt(p)} size={56} alt={displayName(p, save)} className="hud-char" />
          <h2 style={{ margin: '4px 0' }}>{displayName(p, save)} {moodFace(p.mood)}{p.retired && <span> 🏁</span>}</h2>
        </div>
        {p.retired && (
          <p className="dim" style={{ margin: '2px 0' }}>
            🏁 Retired in {formatDay(p.retiredDay || 1, p.retiredYear || 1)} — hung up the sticks after {p.daysAttended} nights. Their legacy stays in the record books.
          </p>
        )}
        <p className="dim">
          {p.firstName} "{p.alias || '—'}" {p.lastName} · {p.gender} · {p.createdBy === 'user' ? 'created player' : 'generated player'}
          {p.description && <> · {p.description}</>}
        </p>
        {p.catchphrase && <p className="cyan" style={{ margin: '2px 0' }}>“{p.catchphrase}”</p>}
        {p.voice && <p className="dim small" style={{ margin: '2px 0' }}>🗣 {voiceSummary(p.voice)}</p>}
        {(p.playerTags || []).length > 0 && (
          <div style={{ marginBottom: 4 }}>
            {p.playerTags.map((t) => <span key={t} className="pill">{t}</span>)}
          </div>
        )}
        <div className="row">
          <span className="pill">Elo {Math.round(p.elo)}</span>
          <span className="pill cyan" title="highest character skill">Skill {bestSkill(p)}</span>
          <span className="pill gold">Glory {Math.round(p.glory)}</span>
          <span className="pill">Respect {Math.round(p.respect)}</span>
          <span className="pill">{p.wins}–{p.losses}</span>
          <span className="pill">Mood: {moodLabel(p.mood)}</span>
          {!p.retired && (
            <span className="pill" title={`passion for the game — ${Math.round(p.passion ?? 80)}/100`}
              style={{ color: PASSION_COLOR(p.passion ?? 80) }}>
              🔥 {passionLabel(p.passion ?? 80)}
            </span>
          )}
          {!p.retired && (
            <span className="pill" title={`stage belief — the battle-tested nerve that lifts their skill ceiling and keeps them from choking at EVO. Grows from being featured on stream and going deep in tournaments. ${Math.round(p.belief || 0)}/100`}>
              🎤 {beliefLabel(p.belief || 0)}
            </span>
          )}
          {(p.popularity || 0) >= 5 && !p.retired && (
            <span className="pill" title={`public profile — grows when you feature them, fades when you don't. ${Math.round(p.popularity)}/100`}>
              ⭐ {Math.round(p.popularity)} pop
            </span>
          )}
          {statusOf(p) && !p.retired && (
            <span className="pill" title={`${p.daysAttended} days attended`} style={{ color: STATUS_COLORS[statusOf(p).key] }}>
              {statusOf(p).label}
            </span>
          )}
          <span className="pill" title={`what they think of ${save.game.name}`}>
            🎮 {opinionLabel(gameOpinionOf(save, p))}
          </span>
          <span className="pill" title={`what they think of ${save.arcade.name}`}>
            🕹 {opinionLabel(arcadeOpinionOf(save, p))}
          </span>
          {main && p.settledMain && <span className="pill on">Mains {main.name}{p.lockedMain ? ' 🔒' : ''}</span>}
          {main && !p.settledMain && <span className="pill">🔍 Exploring — {main.name} today ({(p.exploredChars || []).length} tried)</span>}
          {team && <span className="pill gold">{team.name} [{team.acronym}]</span>}
          {p.tournamentWins > 0 && <span className="pill gold">🏆 ×{p.tournamentWins}</span>}
        </div>
      </div>

      {editing && canEdit && (
        <div className="card">
          <PlayerForm save={save} player={p} patch={patch} />
        </div>
      )}

      <DisciplinePanel save={save} player={p} mutate={mutate} />
      {!p.retired && !p.banished && <ComparePanel save={save} player={p} mutate={mutate} goTo={goTo} />}

      <div className="grid2">
        <div className="card">
          <h3>Personal Stats</h3>
          {PERSONAL_STATS.map(([k, desc]) => <StatBar key={k} label={k} value={p.personal[k]} title={desc} />)}
          <h3>Social Stats</h3>
          {SOCIAL_STATS.map(([k, desc]) => <StatBar key={k} label={k} value={p.social[k]} title={desc} />)}
        </div>

        <div className="card">
          <h3>Character Skill</h3>
          {Object.entries(p.charSkill).sort((a, b) => b[1] - a[1]).map(([cid, v]) => {
            const c = save.game.characters.find((x) => x.id === cid)
            if (!c || v <= 0) return null
            const rec = p.charRecord?.[cid]
            return (
              <div key={cid}>
                <StatBar label={c.name} value={Math.round(v)} max={100} title={`ceiling ${Math.round(skillCeiling(save, p, cid))} — raised by rivalries and time on the big stage`} />
                {rec && <p className="dim small" style={{ margin: '0 0 4px 126px' }}>{rec.w}–{rec.l} lifetime</p>}
              </div>
            )
          })}
          {Object.values(p.charSkill).every((v) => !v) && <p className="dim">Hasn't put in the reps yet.</p>}

          <h3>Tech</h3>
          <div>
            {knownInnovs.map((i) => <span key={i.id} className="pill green" style={{ borderColor: 'var(--green)' }}>{i.name}</span>)}
            {knownInnovs.length === 0 && <span className="dim small">none yet</span>}
          </div>
          {createdInnovs.length > 0 && (
            <p className="small green">💡 Invented: {createdInnovs.map((i) => i.name).join(', ')}</p>
          )}
          {mentorship && (
            <p className="small gold">
              🎓 {mentorship.mentorId === p.id
                ? `Mentoring ${displayName(save.players[mentorship.studentId], save)}`
                : `Mentored by ${displayName(save.players[mentorship.mentorId], save)}`}
            </p>
          )}

          {(p.memories || []).length > 0 && (
            <>
              <h3>Defining Moments</h3>
              {[...p.memories].reverse().map((m, i) => (
                <p key={i} className="small" style={{ margin: '3px 0' }}>
                  <span className="gold">★</span> {m.text} <span className="dim">— Year {m.year}</span>
                </p>
              ))}
            </>
          )}

          <h3>Relationships</h3>
          {rels.length === 0 && <p className="dim">Hasn't met anyone yet.</p>}
          {rels.map(({ other, v }) => (
            <div className="row spread" key={other.id} style={{ borderBottom: '1px solid var(--border)', padding: '3px 0' }}>
              <span style={{ cursor: 'pointer' }} onClick={() => goTo(other.id)}>{displayName(other, save)}</span>
              <span className="row" style={{ gap: 6 }}>
                {v <= -40 && !p.retired && !p.banished && !other.retired && !other.banished && (
                  <button className="small" title="keep these two apart for 3 weeks so the bad blood can cool"
                    onClick={() => mutate((s) => separate(s, p.id, other.id))}>✋ keep apart</button>
                )}
                <span className={`small ${v >= 20 ? 'green' : v <= -20 ? 'red' : 'dim'}`}>
                  {relLabel(v)} ({Math.round(v)})
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Compare two players head to head: how they feel about each other (both ways),
// their lifetime record, and what's brewing between them.
function ComparePanel({ save, player: p, mutate, goTo }) {
  const [otherId, setOtherId] = useState('')
  const others = Object.values(save.players)
    .filter((o) => o.id !== p.id && o.isRegular && !o.banished)
    .sort((a, b) => displayName(a, save).localeCompare(displayName(b, save)))
  const o = save.players[otherId]
  const ab = o ? getRel(p, o) : 0
  const ba = o ? getRel(o, p) : 0
  const h = o ? (p.h2h?.[o.id] || { w: 0, l: 0 }) : null
  const mutual = o ? Math.min(ab, ba) : 0
  const drama = !o ? null
    : mutual <= -60 ? { text: 'Open feud — real bad blood. The room takes sides when these two are in it.', color: 'var(--red)' }
    : mutual <= -30 ? { text: 'Bad blood brewing. A few more sour sets and this curdles into a feud.', color: 'var(--gold)' }
    : mutual <= 10 && (h.w + h.l) >= 6 && Math.abs(p.elo - o.elo) < 170 ? { text: 'A real rivalry — competitive, close, and personal. This is the good kind of friction.', color: 'var(--cyan)' }
    : ab >= 40 && ba >= 40 ? { text: 'Close friends. They lift each other up (and rarely push each other).', color: 'var(--green)' }
    : { text: 'Cordial enough. Nothing much between them yet.', color: 'var(--dim)' }
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>⚖️ Compare head to head</h3>
      <select value={otherId} onChange={(e) => setOtherId(e.target.value)}>
        <option value="">Pick a player to compare…</option>
        {others.map((x) => <option key={x.id} value={x.id}>{displayName(x, save)}</option>)}
      </select>
      {o && (
        <div style={{ marginTop: 10 }}>
          <div className="row spread" style={{ borderBottom: '1px solid var(--border)', padding: '4px 0' }}>
            <span>{displayName(p, save)} → <span style={{ cursor: 'pointer' }} onClick={() => goTo(o.id)}>{displayName(o, save)}</span></span>
            <span className={`small ${ab >= 20 ? 'green' : ab <= -20 ? 'red' : 'dim'}`}>{relLabel(ab)} ({Math.round(ab)})</span>
          </div>
          <div className="row spread" style={{ borderBottom: '1px solid var(--border)', padding: '4px 0' }}>
            <span>{displayName(o, save)} → {displayName(p, save)}</span>
            <span className={`small ${ba >= 20 ? 'green' : ba <= -20 ? 'red' : 'dim'}`}>{relLabel(ba)} ({Math.round(ba)})</span>
          </div>
          <div className="row spread" style={{ padding: '4px 0' }}>
            <span className="dim small">lifetime record</span>
            <span className="small gold">{displayName(p, save)} {h.w}–{h.l} {displayName(o, save)}</span>
          </div>
          {drama && <p className="small" style={{ margin: '6px 0 0', color: drama.color }}>{drama.text}</p>}
          {mutual <= -40 && !p.retired && !p.banished && !o.retired && !o.banished && (
            <button className="small" style={{ marginTop: 6 }}
              onClick={() => mutate((s) => separate(s, p.id, o.id))}>✋ Keep these two apart (3 weeks)</button>
          )}
        </div>
      )}
    </div>
  )
}

// The owner's discipline lever: warn a problem player (risking backfire),
// or ban them outright. Available in every mode — this is a god action, not
// a stat edit.
function DisciplinePanel({ save, player: p, mutate }) {
  const [note, setNote] = useState(null)
  const [confirmBan, setConfirmBan] = useState(false)
  if (p.retired || p.banished) return null
  const behaviors = warnableBehaviors(save, p)
  const blame = toxicityBlame(save, p)
  const warnings = p.warnings || []
  if (!behaviors.length && !warnings.length && blame < 4) return null

  const doWarn = (behavior) => {
    let res
    mutate((s) => { const live = s.players[p.id]; if (live) res = warnPlayer(s, live, behavior) })
    if (res) setNote({ outcome: res.outcome, text: res.text })
  }
  const doBanish = () => { mutate((s) => { const live = s.players[p.id]; if (live) banish(s, live, null) }); setConfirmBan(false) }

  const LABEL = { toxicity: 'toxic behavior', hygiene: 'poor hygiene' }
  return (
    <div className="card" style={{ borderColor: 'var(--gold)' }}>
      <h3 style={{ marginTop: 0 }}>⚖️ Discipline</h3>
      {behaviors.length > 0 ? (
        <p className="small dim" style={{ marginTop: 0 }}>
          Problems worth addressing: {behaviors.map((b) => LABEL[b]).join(', ')}. A warning might straighten them
          out — or backfire and make it worse. How they take it comes down to their temperament.
        </p>
      ) : (
        <p className="small dim" style={{ marginTop: 0 }}>No active problems right now.</p>
      )}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {behaviors.map((b) => (
          <button key={b} className="small" onClick={() => doWarn(b)}>⚠ Warn about {LABEL[b]}</button>
        ))}
        {!confirmBan
          ? <button className="small" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={() => setConfirmBan(true)}>🚫 Banish…</button>
          : (
            <span className="row" style={{ gap: 6 }}>
              <span className="small red">Ban {displayName(p, save)} for good? (One of your finite roster — they never come back.)</span>
              <button className="small" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={doBanish}>Confirm ban</button>
              <button className="small" onClick={() => setConfirmBan(false)}>Cancel</button>
            </span>
          )}
      </div>
      {note && (
        <p className="small" style={{ margin: '8px 0 0', color: note.outcome === 'backfire' ? 'var(--red)' : note.outcome === 'reform' ? 'var(--green)' : 'var(--dim)' }}>
          {note.outcome === 'backfire' ? '💥 ' : note.outcome === 'reform' ? '✓ ' : '• '}{note.text}
        </p>
      )}
      {warnings.length > 0 && (
        <p className="small dim" style={{ margin: '6px 0 0' }}>
          Warned {warnings.length}× ({warnings.filter((w) => w.outcome === 'backfire').length} backfired).
        </p>
      )}
    </div>
  )
}
