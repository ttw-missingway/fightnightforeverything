import { useState } from 'react'
import { useStore, downloadJson, fileStem } from '../state/store.jsx'
import { StatBar, PointDots, moodFace, Portrait } from '../components/ui.jsx'
import { playerArt, lookArt } from '../components/art.js'
import { lookOf } from '../game/skins.js'
import PlayerForm from '../components/PlayerForm.jsx'
import { PERSONAL_STATS, SOCIAL_STATS, statusOf, formatDay, TEMPERAMENTS, SOCIAL_TEMPERAMENTS, STAT_UNIT, STAT_MAX_POINTS, spiritOf } from '../game/constants.js'
import { chooseBreakthrough, eurekaMeter, glowingStats, glowMap, evidenceFor, candidatesFor, veteranTier } from '../game/eureka.js'
import { isJournaled } from '../game/journal.js'
import { relLabel, moodLabel, gameOpinionOf, arcadeOpinionOf, opinionLabel, sceneVerdict, standingOf, standingLabel, getRel } from '../game/social.js'
import { passionLabel, careerStageOf } from '../game/career.js'
import { INTEREST_LABEL } from '../game/interest.js'
import { displayName } from '../game/util.js'
import { skillCeiling } from '../game/match.js'
import { voiceSummary } from '../game/dialogue.js'
import { banish } from '../game/discipline.js'
import { rosterOpen } from '../game/model.js'

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
  belief: (p) => p.belief || 0,
  popularity: (p) => p.popularity || 0,
  status: (p) => p.daysAttended || 0,
}

const PASSION_COLOR = (v) => (v >= 55 ? 'var(--green)' : v >= 30 ? 'var(--gold)' : 'var(--red)')


/**
 * The window between runs, made visible.
 *
 * Banked creation points were unspendable for a long time partly because
 * nothing ever told you where to spend them: the reset notice said "N points
 * to spend on player creation stats" and then dropped you on the arcade
 * screen. This says it on the screen where it is actually true, and closes
 * with the doors.
 */
function RosterWindow({ save }) {
  if (!rosterOpen(save) || save.settings?.mode === 'sandbox') return null
  // Run one only — `rosterOpen` closes for good after the first reset. There is
  // no legacy-points economy to spend here any more: what a lineage carries is
  // the people themselves, breakthroughs and temperaments intact.
  return (
    <div className="dangers">
      <div className="danger unlock">
        <span className="d-icon">🛠</span>
        <div>
          <div className="d-title">Your crew is still yours to change</div>
          <div className="d-detail">Nothing has happened yet. Open any player to rebuild them.</div>
          <div className="d-fix">
            This closes the moment you open the arcade for the first day — and it does not come
            back. From here they grow by breaking through, not by being edited.
          </div>
        </div>
      </div>
    </div>
  )
}

// Stage belief — earned nerve under the lights. Untested players choke at EVO.
const beliefLabel = (v) => (
  v >= 90 ? 'ice in their veins'
    : v >= 70 ? 'stage veteran'
    : v >= 45 ? 'battle-tested'
    : v >= 20 ? 'still green'
    : 'untested')
// The 40 line is QUALIFIER_BELIEF — under it they cannot enter a qualifier at
// all, which makes it the one threshold on this scale worth colouring for.
const BELIEF_COLOR = (v) => (v >= 70 ? 'var(--green)' : v >= 40 ? 'var(--cyan)' : 'var(--dim)')

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
  const players = Object.values(save.players).filter((p) => !p.npc).sort((a, b) => {
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
      <RosterWindow save={save} />
      <SceneHealthBanner scene={save.scene} />
      <div className="card">
      <div className="row spread">
        <h2 style={{ marginTop: 0 }}>Leaderboard <span className="dim small">(click a column to sort)</span></h2>
        <button className="small" title="download your cast (identities & stats, progress excluded) to import into another world"
          onClick={() => downloadJson(
            `${fileStem(save.saveName, 'cast')}.players.fightnight.json`,
            { format: 'fightnight-players', formatVersion: 1, exportedAt: Date.now(), players })}>
          📤 Export cast
        </button>
      </div>
      <div className="table-scroll"><table>
        <thead>
          <tr>
            <th>#</th>
            <Th k="name">Player</Th>
            <th>Main</th>
            <Th k="elo">Elo</Th>
            <Th k="skill">Skill</Th>
            <Th k="mood">Mood</Th>
            <th title="how close they are to a breakthrough — fills as things happen to them">Eureka</th>
            <Th k="standing">Liked/Hated</Th>
            <Th k="status">Status</Th>
            <Th k="belief">Belief</Th>
            <Th k="wins">W–L</Th>
            <Th k="popularity">Pop</Th>
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
                    <span><strong>{displayName(p, save)}</strong>
                      {p.eureka?.pending && !p.retired && <span title="on the verge of a breakthrough — open them and choose"> ✨</span>}
                      {p.retired && <span className="dim small"> 🏁</span>}<br />
                      <span className="dim small">{p.firstName} {p.lastName}</span></span>
                  </span>
                </td>
                <td className="cyan">
                  {/* A person shown WITH their character wears their skin —
                      that's Jade's Ryu, and Jade plays the red one. The tier
                      list and the chart keep the base name. */}
                  {main && <Portrait url={lookArt(main, p.id)} size={20} alt={lookOf(p.id, main).name} />}{main && ' '}
                  {main ? lookOf(p.id, main).name : '—'}
                  {main && !p.settledMain && <span className="dim small"> (trying out)</span>}
                  {/* Their main is what they ARE; the lab character is what
                      they're on this month. Both belong in the roster view or
                      a patch looks like it changed nothing. */}
                  {p.settledMain && p.currentInterest && (() => {
                    const ic = save.game.characters.find((c) => c.id === p.currentInterest.charId)
                    return ic ? <span className="dim small"> · 🧪 {lookOf(p.id, ic).name}</span> : null
                  })()}
                </td>
                <td>{Math.round(p.elo)}</td>
                <td className="cyan">{bestSkill(p) || <span className="dim">—</span>}</td>
                <td title={moodLabel(p.mood)}>{moodFace(p.mood)}</td>
                {/* THE BAR, IN THE LIST. Which of six people is closest to
                    something is a question about the roster, not about one
                    card — and it is the read that decides who you point the
                    camera at this week. */}
                <td><MiniMeter player={p} /></td>
                <td className="small">
                  {p.retired || p.banished ? <span className="dim">—</span> : (() => {
                    const s = standingLabel(standings[p.id])
                    return <span style={{ color: s.color }} title={`the room's read on them — ${Math.round(standings[p.id])}`}>{s.label}</span>
                  })()}
                </td>
                <StatusCell player={p} />
                {/* Belief gates the qualifier at 40 and scales what a loss is
                    worth as pressure — a roster-level read, not a card detail. */}
                <td className="small" style={{ color: BELIEF_COLOR(p.belief || 0) }}
                  title={p.retired ? undefined : `${beliefLabel(p.belief || 0)} — ${Math.round(p.belief || 0)}/100 · a qualifier wants 40`}>
                  {p.retired ? <span className="dim">—</span> : Math.round(p.belief || 0)}
                </td>
                <td className="dim">{p.wins}–{p.losses}</td>
                <td className="small" title="public profile — grows when you feature them, fades when you don't">
                  {(p.popularity || 0) >= 1
                    ? <span className="gold">{Math.round(p.popularity)}</span>
                    : <span className="dim">—</span>}
                </td>
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

/** The eureka meter at roster scale — a bar and nothing else. */
function MiniMeter({ player }) {
  if (player.retired || player.banished || !isJournaled(player)) return <span className="dim small">—</span>
  const m = eurekaMeter(player)
  if (!m) return <span className="dim small">—</span>
  if (m.pending) return <span className="gold" title="on the verge — open them and choose">✨ ready</span>
  const ready = glowingStats(player).filter((g) => g.ready).length
  return (
    <span className="mini-meter" title={`${Math.round(m.frac * 100)}% to a breakthrough${ready ? ` · ${ready} stat${ready === 1 ? '' : 's'} ready to take it` : ''}`}>
      <span className="mini-meter-fill" style={{ width: `${m.frac * 100}%` }} />
      {ready > 0 && <span className="mini-meter-dots">{'·'.repeat(Math.min(ready, 4))}</span>}
    </span>
  )
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
    // Relationships with filler exist mechanically (feuds still poison the
    // room, discipline still works on them) but aren't part of your player's
    // STORY — only cast-to-cast bonds are worth reading about.
    .filter((r) => r.other && !r.other.npc)
    .sort((a, b) => b.v - a.v)
  const mentorship = save.mentorships.find((m) => m.mentorId === p.id || m.studentId === p.id)
  const knownInnovs = save.innovations.filter((i) => p.knownInnovations.includes(i.id))
  const createdInnovs = save.innovations.filter((i) => i.creatorId === p.id)

  // Locked once the doors open — but a run that hasn't started yet is still
  // yours to set up, which is the window a reset lands you in. See rosterOpen.
  const canEdit = rosterOpen(save)
  // Live pressure per stat, so the sheet below can glow. Cheap — it reads the
  // pressure map the sim already maintains and derives nothing.
  const glows = glowMap(p)

  const patch = (fn) => mutate((s) => {
    const live = s.players[p.id]
    if (live) fn(live)
  })

  return (
    <div>
      <div className="row spread">
        <div className="row" style={{ gap: 6 }}>
          <button onClick={back}>← Leaderboard</button>
          {/* Cycle the roster without going back through the table — reading
              six cards in a row is the actual loop of the Players tab. */}
          {(() => {
            const roster = Object.values(save.players)
              .filter((x) => !x.npc && !x.banished)
              .sort((a, b) => (b.elo || 0) - (a.elo || 0))
            const i = roster.findIndex((x) => x.id === p.id)
            // Filler is reachable from the day report now, and filler is not
            // ON the roster — so from an NPC card there is no "next" to cycle
            // to and the counter would read 0/6. Cycling is a cast tool; it
            // simply isn't offered here.
            if (roster.length < 2 || i < 0) return null
            const prev = roster[(i - 1 + roster.length) % roster.length]
            const next = roster[(i + 1) % roster.length]
            return (
              <>
                <button className="small" title={`← ${prev.alias || prev.firstName}`} onClick={() => goTo(prev.id)}>‹</button>
                <span className="dim small">{i + 1}/{roster.length}</span>
                <button className="small" title={`${next.alias || next.firstName} →`} onClick={() => goTo(next.id)}>›</button>
              </>
            )
          })()}
        </div>
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
          {/* THE OTHER CLOCK (P5). Retirement must never arrive as a surprise:
              age is the one pressure no lever tops back up, so where somebody
              sits in their career is on the card next to the passion they
              still have for it. The blurb says what the stage means; the
              number is just their age. */}
          {!p.retired && (
            <span className="pill" title={`${p.age} years old — ${careerStageOf(p).blurb}`}>
              ⏳ {careerStageOf(p).label}
            </span>
          )}
          {!p.retired && (
            <span className="pill" title={`passion for the game — ${Math.round(p.passion ?? 80)}/100`}
              style={{ color: PASSION_COLOR(p.passion ?? 80) }}>
              🔥 {passionLabel(p.passion ?? 80)}
            </span>
          )}
          {/* BELIEF IS NOT A FLAVOUR PILL. It gates entry to a qualifier
              (40+), it scales how much a loss is even WORTH as pressure (§1.8:
              belief sets the expectation adversity is measured against), and
              it lifts the skill ceiling. All of that was behind a tooltip on a
              word. The number is on the card now, like passion's is. */}
          {!p.retired && (
            <span className="pill" title="the battle-tested nerve that lifts their skill ceiling, keeps them from choking on the big stage, and decides how much a loss is worth as pressure. Grows from being featured on stream and going deep in brackets."
              style={{ color: BELIEF_COLOR(p.belief || 0) }}>
              🎤 {beliefLabel(p.belief || 0)} — {Math.round(p.belief || 0)}
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
          {main && p.settledMain && <span className="pill on">Mains {lookOf(p.id, main).name}{p.lockedMain ? ' 🔒' : ''}</span>}
          {main && !p.settledMain && <span className="pill">🔍 Exploring — {lookOf(p.id, main).name} today ({(p.exploredChars || []).length} tried)</span>}
          <CharSlots save={save} p={p} lookOf={lookOf} />
          {team && <span className="pill gold">{team.name} [{team.acronym}]</span>}
          {p.tournamentWins > 0 && <span className="pill gold">🏆 ×{p.tournamentWins}</span>}
          {(() => {
            // Spirit shows its NAME, never its numbers — the rolls are the
            // career's discovery (REVISION §1.6).
            const s = spiritOf(p.spirit)
            return s ? <span className="pill" style={{ color: 'var(--gold)' }} title={s.blurb}>{s.emoji} {s.label}</span> : null
          })()}
        </div>
      </div>

      {editing && canEdit && (
        <div className="card">
          <PlayerForm save={save} player={p} patch={patch} />
        </div>
      )}

      <EurekaPanel save={save} player={p} mutate={mutate} />
      <EurekaMeter player={p} />
      <BanishPanel save={save} player={p} mutate={mutate} />
      {!p.retired && !p.banished && <ComparePanel save={save} player={p} mutate={mutate} goTo={goTo} />}

      <div className="grid2">
        <div className="card">
          <h3>Stats <span className="dim small">(0–{STAT_MAX_POINTS} points, by temperament)</span></h3>
          {/* THE SHEET IS THE METER'S OTHER HALF. Pressure lands on specific
              stats, so the stats themselves say so — warming rows pulse, ready
              ones are lit, and the dot the pressure is reaching for is drawn
              as a ghost. Reading down this column tells you what kind of player
              they are becoming before it happens. */}
          {TEMPERAMENTS.map((t) => (
            <div key={t.key} style={{ marginBottom: 8 }}>
              <h4 style={{ margin: '6px 0 2px', color: t.color }}>
                {t.emoji} {t.label}
                {p.temperament === t.key && <span className="small"> · their temperament</span>}
              </h4>
              {t.stats.map((k) => (
                <PointDots key={k} label={k} color={t.color} max={STAT_MAX_POINTS}
                  value={Math.round((p.personal[k] || 0) / STAT_UNIT)}
                  granted={p.temperament === t.key ? 1 : 0}
                  glow={glows[k] || null}
                  title={Object.fromEntries(PERSONAL_STATS)[k]} />
              ))}
            </div>
          ))}
          <h3 style={{ marginTop: 12 }}>Social</h3>
          {SOCIAL_TEMPERAMENTS.map((t) => (
            <div key={t.key} style={{ marginBottom: 8 }}>
              <h4 style={{ margin: '6px 0 2px', color: t.color }}>
                {t.emoji} {t.label}
                {p.socialTemperament === t.key && <span className="small"> · their temperament</span>}
              </h4>
              {t.stats.map((k) => (
                <PointDots key={k} label={k} color={t.color} max={STAT_MAX_POINTS}
                  value={Math.round((p.social[k] || 0) / STAT_UNIT)}
                  granted={p.socialTemperament === t.key ? 1 : 0}
                  glow={glows[k] || null}
                  title={Object.fromEntries(SOCIAL_STATS)[k]} />
              ))}
            </div>
          ))}
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

          {/* Cast only — filler and elites keep no journal. Shown even when
              empty, or nobody can tell the feature exists on a save whose
              entries haven't started accruing yet. */}
          {!p.npc && p.createdBy === 'user' && (
            <>
              <h3>📔 Journal <span className="dim small">— their own words{(p.journalWritten || 0) > 0 ? ` · ${p.journalWritten} entries` : ''}</span></h3>
              {(p.journal || []).length === 0 && (
                <p className="dim small">Blank pages so far — entries arrive as things happen to them: losses that
                  sting, streaks, fallings-out, breakthroughs. This is where the early warnings show up first.</p>
              )}
              {[...(p.journal || [])].slice(-14).reverse().map((e, i) => (
                <p key={i} className="small" style={{ margin: '4px 0', borderLeft: '2px solid var(--border)', paddingLeft: 8 }}>
                  <span className="dim">{formatDay(e.day, e.year)}</span><br />
                  {e.text}
                </p>
              ))}
            </>
          )}

          <h3>Relationships</h3>
          {rels.length === 0 && <p className="dim">Hasn't met anyone yet.</p>}
          {rels.map(({ other, v }) => (
            <div className="row spread" key={other.id} style={{ borderBottom: '1px solid var(--border)', padding: '3px 0' }}>
              <span style={{ cursor: 'pointer' }} onClick={() => goTo(other.id)}>{displayName(other, save)}</span>
              <span className={`small ${v >= 20 ? 'green' : v <= -20 ? 'red' : 'dim'}`}>
                {relLabel(v)} ({Math.round(v)})
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
  const others = Object.values(save.players).filter((p) => !p.npc)
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
        </div>
      )}
    </div>
  )
}

// How a candidate reads at the moment of choosing (REVISION §1.3): wounds and
// edges must be visually distinct, because the choice between fixing the flaw
// and sharpening the blade IS the system.
const EUREKA_KIND = {
  wound: { icon: '🩹', label: 'the wound', color: 'var(--red)', verb: 'Fix what keeps costing them' },
  edge: { icon: '🗡', label: 'the edge', color: 'var(--gold)', verb: 'Sharpen what keeps working' },
  influence: { icon: '🌊', label: 'the company', color: 'var(--cyan)', verb: 'Grow into who they’re around' },
}

/**
 * THE METER, ON THE CARD, EVERY DAY.
 *
 * The eureka spine is the most important system in the game and it used to be
 * completely invisible until the instant it resolved: pressure accrued in
 * silence for weeks, then a toast appeared with a single button on it. Nothing
 * about that reads as "something has been building" — it reads as a chore the
 * game periodically hands you.
 *
 * So the bar is here, always, filling. Under it are the stats that are warming
 * up, with the evidence that warmed them. You can watch a loss land on
 * composure. You can see three things approaching the line at once and start
 * hoping for the one you want. By the time the meter fills you already know
 * what the choice is going to be about — which is what makes answering it feel
 * like a decision instead of a notification.
 */
function EurekaMeter({ player: p }) {
  const [openStat, setOpenStat] = useState(null)
  if (!p.eureka || p.retired || p.banished || !isJournaled(p)) return null
  const m = eurekaMeter(p)
  if (!m) return null
  const glowing = glowingStats(p)
  const ready = glowing.filter((g) => g.ready)
  // The deadline band: how close the hottest single stat is to resolving
  // itself badly (§1.4). Only drawn once it is genuinely in play.
  const forceFrac = m.hottest / m.forcedAt
  const veteran = veteranTier(p)

  return (
    <div className="card eureka-card">
      <div className="row spread">
        <h3 style={{ margin: 0 }}>
          ✨ Pressure
          <span className="dim small">
            {' '}— {m.count === 0 ? 'no breakthroughs yet' : `${m.count} breakthrough${m.count === 1 ? '' : 's'} so far`}
          </span>
        </h3>
        <span className="small" style={{ color: m.full ? 'var(--gold)' : 'var(--dim)' }}>
          {m.full ? 'FULL — something is about to give' : `${Math.round(m.frac * 100)}%`}
        </span>
      </div>

      <div className="eureka-track" title={`${Math.round(m.pressure * 10) / 10} of ${Math.round(m.threshold * 10) / 10} — the bar fills as things happen to them, good and bad`}>
        <div className={`eureka-fill${m.full ? ' full' : ''}`} style={{ width: `${m.frac * 100}%` }} />
        {forceFrac > 0.5 && !m.full && (
          <div className="eureka-force" style={{ left: `${Math.min(99, forceFrac * 100)}%` }}
            title="one thing is building far faster than the rest — past the line it resolves itself, badly" />
        )}
      </div>

      <p className="dim small" style={{ margin: '6px 0 0' }}>
        {veteran
          ? 'Their climbing years are behind them. What builds up now comes out as tech, teaching and reads on the game — not as a point on their sheet.'
          : m.full && ready.length
            ? 'The meter is full and something has come to a head. Pick what clicks — below.'
            : m.full
              ? 'The meter is full, and nothing has come to a head yet. Everything they do from here pushes harder on whatever is closest — it will break soon, and nothing is being lost while it waits.'
              : ready.length
                ? `${ready.length} thing${ready.length === 1 ? ' is' : 's are'} ready to break. The meter has to fill before ${ready.length === 1 ? 'it' : 'any of them'} can.`
                : glowing.length
                  ? 'Something is starting to gather. Nothing is ready yet.'
                  : 'Quiet. Wins that mean nothing and losses that cost nothing build no pressure — this fills when things actually happen to them.'}
      </p>

      {glowing.length > 0 && (
        <div className="eureka-glows">
          {glowing.slice(0, 8).map((g) => {
            const kind = EUREKA_KIND[g.kind] || EUREKA_KIND.wound
            const open = openStat === g.stat
            return (
              <div key={g.stat} className={`eureka-glow${g.ready ? ' ready' : ''}`}
                style={{ borderColor: kind.color, cursor: 'pointer' }}
                onClick={() => setOpenStat(open ? null : g.stat)}>
                <div className="row spread">
                  <span className="small">
                    <span style={{ color: kind.color }}>{kind.icon}</span>{' '}
                    <strong style={{ color: g.ready ? kind.color : undefined }}>{g.stat}</strong>
                    {!g.inRow && <span className="dim small" title="outside their temperament — becoming someone a bit different"> ↗</span>}
                  </span>
                  <span className="small" style={{ color: g.ready ? kind.color : 'var(--dim)' }}>
                    {g.ready ? 'ready' : `${Math.round(Math.min(1, g.heat) * 100)}%`}
                  </span>
                </div>
                <div className="eureka-subtrack">
                  <div style={{ width: `${Math.min(100, g.heat * 100)}%`, background: kind.color }} />
                </div>
                {open && (
                  <div style={{ marginTop: 4 }}>
                    {evidenceFor(p, g.stat).map((ev, i) => (
                      <p key={i} className="small dim" style={{ margin: '1px 0' }}>
                        · {ev.why}{ev.n > 1 && <span style={{ opacity: 0.7 }}> ×{ev.n}</span>}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * The breakthrough choice (REVISION §1). You cannot call a eureka, only
 * answer it when it arrives — and leaving one unanswered has a deadline:
 * pressure keeps building, and past ~2.5× the threshold it stops being a
 * choice. The WHY under each candidate is the inspector's evidence, so the
 * most opaque system in the game stays defensible.
 *
 * It is a REAL choice now, and every option in it is genuinely lit. Talent
 * breadth floors at two and the glow line was cut to a fraction the arithmetic
 * can clear several times over, so this shows two to five different directions
 * rather than one button labelled "click me" — and it does not open at all
 * until something has actually come to a head, because a choice between things
 * that haven't happened yet is worse than no choice. The evidence under each is
 * deduped; the old version printed the same influence sentence three times.
 */
function EurekaPanel({ save, player: p, mutate }) {
  const pending = p.eureka?.pending
  if (!pending || p.retired || p.banished) return null
  const doChoose = (stat) => {
    mutate((s) => {
      const live = s.players[p.id]
      if (live?.eureka?.pending) chooseBreakthrough(s, live, stat)
    }, { kind: 'eureka' })
  }
  // Candidates are recomputed live rather than read off the frozen `pending`
  // snapshot: pressure keeps accruing while you think about it, and a panel
  // showing last week's shortlist would contradict the meter directly above it.
  const candidates = candidatesFor(p)
  // The engine withdraws a shortlist that has emptied under it on the next
  // tick; until then, a card with no buttons is worse than no card.
  if (!candidates.length) return null

  return (
    <div className="card eureka-choice">
      <h3 style={{ marginTop: 0 }}>✨ Breakthrough — {displayName(p, save)} is on the verge</h3>
      <p className="small dim" style={{ marginTop: 0 }}>
        The pressure is at the top of the meter and something has come to a head. Everything below
        is genuinely ready to break; pick the one that clicks. The point is permanent, the rest
        keeps simmering — and sit on this too long and they resolve it themselves, badly.
      </p>
      <div className="eureka-candidates">
        {candidates.map((c) => {
          const kind = EUREKA_KIND[c.kind] || EUREKA_KIND.wound
          return (
            <div key={c.stat} className="card sub eureka-cand"
              style={{ margin: 0, borderColor: kind.color }}>
              <div className="row spread">
                <strong style={{ color: kind.color }}>{kind.icon} {c.stat}</strong>
                <span className="small" style={{ color: kind.color }}>{kind.label}</span>
              </div>
              <p className="dim small" style={{ margin: '4px 0 2px' }}>
                {kind.verb}{c.inRow ? '' : ' — outside who they are today'}.
              </p>
              {/* THE INSPECTOR'S EVIDENCE. Deduped and counted, so a stat lit by
                  one bad night reads differently from one lit by four months of
                  the same character asking the same thing. */}
              {c.evidence.slice(0, 4).map((ev, i) => (
                <p key={i} className="small" style={{ margin: '1px 0', color: 'var(--dim)' }}>
                  · {ev.why}{ev.n > 1 && <span style={{ opacity: 0.7 }}> ×{ev.n}</span>}
                </p>
              ))}
              <button className="small primary" style={{ marginTop: 6 }} onClick={() => doChoose(c.stat)}>
                Break through on {c.stat}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// The one nuclear option. Warnings and separations went to the deprecation
// lane with the revision (docs/DEPRECATED.md) — the room is shaped by the
// levers now, not by punishment — but you can still ask someone to leave.
// Always available, never gated: rare, painful, and yours.
function BanishPanel({ save, player: p, mutate }) {
  const [confirmBan, setConfirmBan] = useState(false)
  if (p.retired || p.banished) return null
  const doBanish = () => { mutate((s) => { const live = s.players[p.id]; if (live) banish(s, live, null) }); setConfirmBan(false) }
  return (
    <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 8 }}>
      {!confirmBan
        ? <button className="small" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
            title="ask them to leave for good — the one thing an owner can still make final"
            onClick={() => setConfirmBan(true)}>🚫 Ask them to leave…</button>
        : (
          <span className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span className="small red">Ban {displayName(p, save)} for good? (One of your finite roster — they never come back.)</span>
            <button className="small" style={{ color: 'var(--red)', borderColor: 'var(--red)' }} onClick={doBanish}>Confirm ban</button>
            <button className="small" onClick={() => setConfirmBan(false)}>Cancel</button>
          </span>
        )}
    </div>
  )
}

/**
 * The three things a player's character choices can mean, made visible.
 *
 * MAIN is who they are — it's already on the pill above, and it's what a
 * tournament bracket is built from. POCKET PICKS are what they fall back on
 * when the matchup is bad; the sim has tracked them since characters had
 * matchups and never once showed them, so counterpicks read as random. The
 * LAB slot is what they're currently messing about with — the new release,
 * the character that just got buffed, whatever the best player in the room
 * keeps winning with. It carries its reason, because "they're on Zoner this
 * month" and "they're on Zoner this month because it got buffed" are
 * different facts about the scene.
 */
function CharSlots({ save, p, lookOf }) {
  if (!p.settledMain) return null
  const charOf = (id) => save.game.characters.find((c) => c.id === id)
  const ci = p.currentInterest
  const lab = ci ? charOf(ci.charId) : null
  const pockets = (p.pocketPicks || []).map(charOf).filter(Boolean)
  if (!lab && !pockets.length) return null
  return (
    <>
      {lab && (
        <span className="pill lab" title={`Trying this out — ${INTEREST_LABEL[ci.reason] || 'curious'}. Casual sets only; brackets still get their main.`}>
          🧪 Labbing {lookOf(p.id, lab).name}
          <span className="dim"> — {INTEREST_LABEL[ci.reason] || 'curious'}</span>
        </span>
      )}
      {pockets.length > 0 && (
        <span className="pill" title="Counterpicks — pulled out when the matchup is bad">
          🎒 Pocket: {pockets.map((c) => lookOf(p.id, c).name).join(', ')}
        </span>
      )}
    </>
  )
}
