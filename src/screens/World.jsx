import { Fragment, useState } from 'react'
import { useStore } from '../state/store.jsx'
import { worldRankings, rankedWorld, cutoffElo, bestRanked, theClimb, dossier, TIER_LABEL, WORLD_RANK_SIZE, WORLD_SEEN_GAMES } from '../game/world.js'
import { regionalRankings, REGIONAL_CUT, upcomingCircuit, circuitEventName, ENTRY_RULE } from '../game/circuit.js'
import { CircuitPrimer, circuitMeta } from '../components/Circuit.jsx'
import { absDayOf } from '../game/constants.js'
import { lookOf } from '../game/skins.js'
import { Portrait, PointDots, StatBar } from '../components/ui.jsx'
import { lookArt, playerArt } from '../components/art.js'
import { PERSONAL_STATS, SOCIAL_STATS, TEMPERAMENTS, SOCIAL_TEMPERAMENTS, STAT_UNIT, STAT_MAX_POINTS } from '../game/constants.js'

/**
 * The world rankings — the one screen that is not about your arcade.
 *
 * Open from the first day of a lineage and never locked, because its whole job
 * is to be the thing you are aiming at. It is deliberately unflattering: a
 * freshly created player sits somewhere in the seventies behind sixty-four
 * people who have been doing this for years, and the only way the number moves
 * is elo, which only moves by actually beating people.
 */
export default function World() {
  const { save, nav } = useStore()
  const [scope, setScope] = useState('top')
  const [openId, setOpenId] = useState(null)
  const rows = worldRankings(save)
  const mine = bestRanked(save)
  const climb = theClimb(save)
  const cutoff = cutoffElo(save)
  const shown = scope === 'mine' ? rows.filter((r) => r.yours) : rankedWorld(save)

  const charName = (r) => {
    const c = save.game.characters.find((x) => x.id === r.charId)
    if (!c) return null
    return r.yours ? lookOf(r.id, c).name : c.name
  }

  if (openId) {
    return <Dossier save={save} id={openId} back={() => setOpenId(null)} nav={nav} />
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>🌍 World Rankings</h2>
      <p className="dim small" style={{ marginTop: 0 }}>
        The top {WORLD_RANK_SIZE} competitors on earth, by elo. It is a fixed number of PLACES — when one
        of yours climbs onto the list, somebody drops off it.
      </p>

      <div className="grid2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Your best</h3>
          {mine ? (
            <>
              <div className="row spread">
                <span className="clickable cyan" style={{ cursor: 'pointer', fontSize: 18 }}
                  onClick={() => nav('players', { playerId: mine.id })}>
                  <strong>{mine.flag} {mine.name}</strong>
                </span>
                {mine.rank != null
                  ? <span className="gold" style={{ fontSize: 22, fontWeight: 700 }}>#{mine.rank}</span>
                  : <span className="dim" style={{ fontSize: 16 }}>unranked</span>}
              </div>
              {/* No invented placing. Below the cut there is no number to give
                  them — only the gap they have to close. */}
              <p className="dim small" style={{ margin: '4px 0 0' }}>
                {mine.elo} elo{charName(mine) ? ` · ${charName(mine)}` : ''}
                {mine.rank != null
                  ? ` · on the world list`
                  : mine.seen === false && mine.elo >= cutoff
                    // The list ranks people the world has SEEN. The road —
                    // regionals, qualifiers, names a pot pulls in — is how.
                    ? ` · the elo is there, the world hasn't seen it: ${save.players[mine.id]?.roadGames || 0} of ${WORLD_SEEN_GAMES} road sets`
                    : ` · ${Math.max(1, cutoff - mine.elo)} elo short of the cut (#${WORLD_RANK_SIZE} sits at ${cutoff})`}
              </p>
            </>
          ) : (
            <p className="dim">You haven't made anybody yet.</p>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Next up the ladder</h3>
          {climb.length ? (
            <>
              {climb.map((r) => (
                <div className="row spread clickable" key={r.id} style={{ padding: '2px 0', cursor: 'pointer' }}
                  onClick={() => (r.yours ? nav('players', { playerId: r.id }) : setOpenId(r.id))}>
                  <span className="small">
                    <span className="dim">#{r.rank}</span> {r.flag} {r.name}
                  </span>
                  <span className="dim small">{r.elo}</span>
                </div>
              ))}
              <p className="dim small" style={{ margin: '6px 0 0' }}>
                {mine && mine.rank == null
                  ? 'The bottom of the world list. Take elo off people like these and you are on it.'
                  : 'Four people between yours and the next rung. Beating one of these is a real night.'}
              </p>
            </>
          ) : (
            <p className="dim small">Nobody above you. That is not a sentence this game expects to print.</p>
          )}
        </div>
      </div>

      {/* The world's calendar — always visible, always coming (P4). The next
          three dates are the budget problem: did you keep the fare money?
          Each one now says what KIND of event it is, because "Spring Major ·
          Japan" and "Spring Qualifier · Japan" are different problems three
          weeks apart and the names alone never said which. */}
      <div className="card">
        <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
          {upcomingCircuit(save, 4).map(({ def, year, startAbs }) => {
            const away = startAbs - absDayOf(save.day, save.year)
            const meta = circuitMeta(def.kind)
            return (
              <span className="small" key={`${def.key}:${year}`} title={ENTRY_RULE[def.kind]}>
                {meta?.icon || '🗓'} <strong style={{ color: meta?.accent }}>{circuitEventName(save, def, year)}</strong>
                <span className="dim"> · {away} day{away === 1 ? '' : 's'}</span>
                <br /><span className="dim" style={{ fontSize: 11 }}>{ENTRY_RULE[def.kind]}</span>
              </span>
            )
          })}
        </div>
      </div>

      <CircuitPrimer />

      <div className="tabs">
        <button className={scope === 'top' ? 'active' : ''} onClick={() => setScope('top')}>🌍 World top 64</button>
        <button className={scope === 'region' ? 'active' : ''} onClick={() => setScope('region')}>🗺 National board</button>
        <button className={scope === 'mine' ? 'active' : ''} onClick={() => setScope('mine')}>🏠 My cast</button>
      </div>

      {scope === 'region' && <NationalBoard save={save} nav={nav} openDossier={setOpenId} charName={charName} />}

      {scope !== 'region' && <div className="card">
        <div className="table-scroll"><table>
          <thead>
            <tr><th>#</th><th>Player</th><th>Scene</th><th>Main</th><th>Elo</th><th>Skill</th>
              <th title="EVO championships — the summit, once a year">EVO</th>
              <th title="world major titles — the circuit's three big weekends">Majors</th></tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className={`clickable${r.yours ? ' world-mine' : ''}`}
                onClick={() => (r.yours ? nav('players', { playerId: r.id }) : setOpenId(r.id))}
                style={r.retired ? { opacity: 0.45 } : undefined}>
                <td className="dim">{r.rank ?? <span title="not in the world top 64">—</span>}</td>
                <td>
                  <span className="row" style={{ gap: 6, flexWrap: 'nowrap', alignItems: 'center' }}>
                    {r.charId && (() => {
                      const c = save.game.characters.find((x) => x.id === r.charId)
                      return c ? <Portrait url={lookArt(c, r.id)} size={20} alt={c.name} /> : null
                    })()}
                    <span title={r.region === 'home' ? save.arcade.name : (r.regionName || r.region)}>{r.flag}</span>
                    <strong className={r.yours ? 'cyan' : ''}>{r.name}</strong>
                    {r.retired && <span className="dim small"> 🏁</span>}
                  </span>
                </td>
                <td className="dim small">{r.region === 'home' ? save.arcade.name : (r.regionName || r.region)}</td>
                <td className="small">{charName(r) || <span className="dim">—</span>}</td>
                <td>{r.elo}</td>
                <td className="cyan">{r.skill || <span className="dim">—</span>}</td>
                {/* Counted separately and drawn separately: a stack of five
                    identical cups told you nothing about which weekend was
                    which. Past three, the count says it instead of the row
                    growing a hedge of emoji. */}
                <td className="gold" title={r.titles ? `${r.titles} EVO title${r.titles === 1 ? '' : 's'}` : undefined}>
                  {r.titles ? (r.titles > 3 ? `🏆 ×${r.titles}` : '🏆'.repeat(r.titles)) : ''}
                </td>
                <td className="cyan" title={r.majorTitles ? `${r.majorTitles} world major${r.majorTitles === 1 ? '' : 's'}` : undefined}>
                  {r.majorTitles ? (r.majorTitles > 3 ? `🏛 ×${r.majorTitles}` : '🏛'.repeat(r.majorTitles)) : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {scope === 'mine' && shown.length === 0 && <p className="dim">No players yet.</p>}
      </div>}
    </div>
  )
}

/**
 * The national board — the missing rung (P4). Your country's own top 64,
 * strong in proportion to how much scene the country actually has. The top
 * sixteen make the regionals twice a year, and the cut line is drawn where
 * it bites. This is the ladder a year-two player can actually appear on.
 */
function NationalBoard({ save, nav, openDossier, charName }) {
  const rows = regionalRankings(save).slice(0, 64)
  const worldRanked = rows.filter((r) => r.kind === 'elite').length
  return (
    <div className="card">
      <p className="dim small" style={{ marginTop: 0 }}>
        {save.arcade.country || 'Your country'}'s own ladder, ranked by elo — everyone here is on it.
        The top {REGIONAL_CUT} are invited to the regionals, twice a year, winner takes the season.
      </p>
      {/* WHY SOME NAMES ARE GOLD, AND WHY THEY AREN'T AT THE TOP.
          Three kinds of person share this table and nothing said so, which
          made the obvious question unanswerable: how is somebody world-ranked
          at #15 when the fourteen names above them are not? Because the world
          list is not an elo list. It ranks people the world has SEEN — the
          circuit, the majors, the road — and a national grinder with a big
          local rating has simply never left the country. Same gate your own
          cast is held to (the road-sets counter on "Your best", above). */}
      <div className="row small" style={{ gap: 14, flexWrap: 'wrap', marginBottom: 8 }}>
        <span><span className="cyan">■</span> <span className="dim">yours</span></span>
        <span><span className="gold">■</span> 🌍 <span className="dim">world-ranked ({worldRanked} of your countrymen are on the world top {64})</span></span>
        <span><span style={{ color: 'var(--fg)' }}>■</span> <span className="dim">national circuit — never travelled, so the world list can't see them</span></span>
      </div>
      <p className="dim small" style={{ margin: '0 0 8px' }}>
        A big national elo is not a world ranking. Plenty of names here out-rate a 🌍 player and
        will never appear on the world list, because that list ranks who the world has watched —
        and these are people who have never left the country to be watched.
      </p>
      <div className="table-scroll"><table>
        <thead>
          <tr><th>#</th><th>Player</th><th>Main</th><th>Elo</th><th>Skill</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <Fragment key={r.id}>
              <tr className={`clickable${r.yours ? ' world-mine' : ''}`}
                onClick={() => (r.yours ? nav('players', { playerId: r.id }) : r.kind === 'elite' ? openDossier(r.id) : null)}
                style={r.kind === 'rc' ? { cursor: 'default' } : undefined}>
                <td className="dim">{r.rank}</td>
                <td>
                  <strong className={r.yours ? 'cyan' : r.kind === 'elite' ? 'gold' : ''}>{r.name}</strong>
                  {r.kind === 'elite' && <span className="dim small" title="also on the world top 64 — they travel, so the world has seen them play"> 🌍</span>}
                  {r.kind === 'rc' && <span className="dim small" title="national circuit only — never travelled, so the world list has never seen them"> </span>}
                </td>
                <td className="small">{charName(r) || <span className="dim">—</span>}</td>
                <td>{r.elo}</td>
                <td className="cyan">{r.skill || <span className="dim">—</span>}</td>
              </tr>
              {i === REGIONAL_CUT - 1 && (
                <tr><td colSpan={5} className="dim small" style={{ textAlign: 'center', padding: 2, borderBottom: '1px dashed var(--border)' }}>
                  — the regionals cut —
                </td></tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table></div>
    </div>
  )
}


const PERSONA_LABEL = {
  loyalist: 'character loyalist',
  'meta-chaser': 'meta chaser',
  'lab-monster': 'lab monster',
  showman: 'showman',
  veteran: 'grizzled veteran',
}

/**
 * A ranked competitor's file.
 *
 * Elites keep no history of their own — between tournaments they are a name
 * and an elo — so everything here is reconstructed from broadcasts you still
 * have. That is the honest answer to "what do you know about this person?":
 * you know what you watched, and nothing before you started watching.
 */
function Dossier({ save, id, back, nav }) {
  const d = dossier(save, id)
  if (!d) {
    return <div className="card"><p className="dim">No file on that competitor.</p>
      <button onClick={back}>← Back to the rankings</button></div>
  }
  const { row, bouts, record, vsYou, majors } = d
  const char = save.game.characters.find((c) => c.id === row.charId)
  const elite = (save.evoRoster || []).find((e) => e.id === id)
  // The card's subject: an elite from the world roster, or one of your own —
  // both carry the same sparse stat build, so one card fits everyone.
  const subject = elite || save.players?.[id] || null

  return (
    <div>
      <button onClick={back}>← Back to the rankings</button>
      <div className="card" style={{ borderColor: row.yours ? 'var(--cyan)' : 'var(--border)' }}>
        <div className="row" style={{ gap: 12, alignItems: 'center', flexWrap: 'nowrap' }}>
          <Portrait url={playerArt(subject || row.id)} size={56} alt={row.name} className="hud-char" />
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 30, margin: '2px 0' }}>{row.flag} {row.name}</h1>
            {subject && (
              <p className="dim" style={{ margin: '2px 0' }}>
                {subject.firstName} "{row.name}" {subject.lastName}
                {subject.gender && <> · {subject.gender}</>}
                {' '}· {row.regionName || row.region}
                {subject.description && <> · {subject.description}</>}
              </p>
            )}
            <div className="small">
              {TIER_LABEL[row.tier] || 'Ranked competitor'}
              {elite?.persona && <span className="dim"> · {PERSONA_LABEL[elite.persona] || elite.persona}</span>}
            </div>
            {subject?.catchphrase && <p className="cyan" style={{ margin: '2px 0' }}>“{subject.catchphrase}”</p>}
            <div className="row" style={{ marginTop: 6 }}>
              <span className="pill gold">#{row.rank ?? '—'} in the world</span>
              <span className="pill">Elo {row.elo}</span>
              <span className="pill cyan">Skill {row.skill || '—'}</span>
              {row.titles > 0 && <span className="pill gold">🏆 EVO ×{row.titles}</span>}
              {row.majorTitles > 0 && <span className="pill cyan">🏛 Majors ×{row.majorTitles}</span>}
              {char && <span className="pill on">Mains {char.name}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Stats <span className="dim small">(0–{STAT_MAX_POINTS} points, by temperament)</span></h3>
          {!subject?.personal && <p className="dim small">Nobody has scouted them properly.</p>}
          {subject?.personal && TEMPERAMENTS.map((t) => (
            <div key={t.key} style={{ marginBottom: 8 }}>
              <h4 style={{ margin: '6px 0 2px', color: t.color }}>
                {t.emoji} {t.label}
                {subject.temperament === t.key && <span className="small"> · their temperament</span>}
              </h4>
              {t.stats.map((k) => (
                <PointDots key={k} label={k} color={t.color} max={STAT_MAX_POINTS}
                  value={Math.round((subject.personal[k] || 0) / STAT_UNIT)}
                  granted={subject.temperament === t.key ? 1 : 0}
                  title={Object.fromEntries(PERSONAL_STATS)[k]} />
              ))}
            </div>
          ))}
          {subject?.social && (
            <>
              <h3 style={{ marginTop: 12 }}>Social</h3>
              {SOCIAL_TEMPERAMENTS.map((t) => (
                <div key={t.key} style={{ marginBottom: 8 }}>
                  <h4 style={{ margin: '6px 0 2px', color: t.color }}>
                    {t.emoji} {t.label}
                    {subject.socialTemperament === t.key && <span className="small"> · their temperament</span>}
                  </h4>
                  {t.stats.map((k) => (
                    <PointDots key={k} label={k} color={t.color} max={STAT_MAX_POINTS}
                      value={Math.round((subject.social[k] || 0) / STAT_UNIT)}
                      granted={subject.socialTemperament === t.key ? 1 : 0}
                      title={Object.fromEntries(SOCIAL_STATS)[k]} />
                  ))}
                </div>
              ))}
            </>
          )}
        </div>

        <div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Main</h3>
            {char ? (
              <div>
                <div className="row" style={{ gap: 8 }}>
                  <Portrait url={lookArt(char, row.id)} size={34} alt={char.name} />
                  <span><strong>{char.name}</strong><br /><span className="dim small">{char.archetype}</span></span>
                </div>
                {row.skill > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <StatBar label={char.name} value={row.skill} max={100} />
                  </div>
                )}
              </div>
            ) : <p className="dim">Nobody has seen what they play.</p>}
          </div>
          <div className="card">
          <h3 style={{ marginTop: 0 }}>Against your arcade</h3>
          {vsYou.w + vsYou.l === 0 ? (
            <p className="dim small">Never faced anyone of yours. That's the whole idea, isn't it.</p>
          ) : (
            <>
              <div style={{ fontSize: 22, fontWeight: 700 }}>
                <span className="red">{vsYou.w}</span><span className="dim"> – </span><span className="green">{vsYou.l}</span>
              </div>
              <p className="dim small" style={{ margin: '2px 0 6px' }}>their record against your people</p>
              {vsYou.bouts.slice(0, 4).map((b) => (
                <div className="row spread small" key={b.matchId} style={{ padding: '1px 0' }}>
                  <span className={b.won ? 'dim' : 'green'}>{b.won ? 'beat' : 'lost to'} {b.opponent}</span>
                  <span className="dim">{b.score}</span>
                </div>
              ))}
            </>
          )}
        </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>At the majors</h3>
        {majors.length === 0 ? (
          <p className="dim small" style={{ marginBottom: 0 }}>
            No major finish on record — either they haven't placed while you've been running this
            arcade, or they haven't placed at all.
          </p>
        ) : majors.map((mj, i) => (
          <div className="row spread" key={i} style={{ padding: '3px 0' }}>
            <span className="small">{mj.evo ? '🏆 ' : '🏛 '}{mj.event}</span>
            <span className={mj.place === 1 ? 'gold' : mj.place <= 8 ? 'cyan' : 'dim'}>
              {mj.place === 1 ? 'Champion' : `${ordinalish(mj.place)}`}
            </span>
          </div>
        ))}
      </div>

      {/* FRAGMENTS (REVISION §0.4): elites keep no journal — you know them
          through interviews, tweets, and lines of commentary. The asymmetry
          is the mythology; their actual journal stays locked until P5's
          retirements (or a genuine rivalry with one of yours) opens it. */}
      {(save.evoRoster.find((e) => e.id === id)?.fragments || []).length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>In their own words <span className="dim small">— what the world has heard</span></h3>
          {save.evoRoster.find((e) => e.id === id).fragments.slice(0, 6).map((f, i) => (
            <p key={i} className="small" style={{ margin: '4px 0', borderLeft: '2px solid var(--border)', paddingLeft: 8 }}>
              <span className="dim">[{f.kind}]</span> {f.text}
            </p>
          ))}
        </div>
      )}

      <div className="card">
        <div className="row spread">
          <h3 style={{ margin: 0 }}>What you've watched them do</h3>
          <span className="dim small">{record.w}–{record.l} on tape</span>
        </div>
        {bouts.length === 0 ? (
          <p className="dim small" style={{ marginBottom: 0 }}>
            Nothing on tape. You've never had a broadcast with them in it.
          </p>
        ) : bouts.slice(0, 12).map((b) => (
          <div className="row spread" key={b.matchId} style={{ borderBottom: '1px solid var(--border)', padding: '4px 0' }}>
            <span className="small">
              <span className={b.won ? 'gold' : 'dim'}>{b.won ? 'W' : 'L'}</span>
              {' '}vs <span className={b.versusYou ? 'cyan' : ''}>{b.opponent}</span>
              <span className="dim"> · {b.event} · {b.round}</span>
            </span>
            <span className="dim small">{b.score}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const ordinalish = (n) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
