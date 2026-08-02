import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { displayName } from '../game/util.js'
import { formatDay } from '../game/constants.js'
import { Portrait } from '../components/ui.jsx'
import { charArt } from '../components/art.js'
import { selectableChars, formsOf, originOf } from '../game/forms.js'
import { guidesFor, allGuides, readGuide } from '../game/guides.js'
import TierList from './TierList.jsx'

// The Codex: everything the scene knows about the cast in one place — the
// techniques it has discovered, the character index (with the guides written
// about each one), and what it currently believes the tier list is.
//
// Tier lists used to own a header tab, gated on an achievement. They are
// reference material about the same cast the rest of this screen documents, so
// they live here now — and they open when the community has actually made one,
// which is the only thing that ever made the tab worth opening.
export default function Codex() {
  const { save } = useStore()
  const [tab, setTab] = useState('techniques')
  const archives = (save.archives || []).filter((a) => (a.innovations || []).length)
  const tiersOpen = (save.tierLists || []).length > 0
  const guideCount = (save.guides || []).length

  return (
    <div>
      <div className="row spread">
        <h2 style={{ marginTop: 0 }}>📖 Codex</h2>
        <div className="tabs" style={{ margin: 0 }}>
          <button className={`small ${tab === 'techniques' ? 'active' : ''}`} onClick={() => setTab('techniques')}>Technique Index</button>
          <button className={`small ${tab === 'characters' ? 'active' : ''}`} onClick={() => setTab('characters')}>Character Index</button>
          {/* THE LIBRARY. Guides were a boolean on a record — you could see
              that one existed and never read it, which is a strange gap in a
              game whose argument for the quiet players is that the definitive
              write-up on a character IS the reputation. They have a shelf now. */}
          <button className={`small ${tab === 'guides' ? 'active' : ''}`}
            disabled={!guideCount}
            title={guideCount ? undefined : 'Nobody in the scene has written one yet'}
            onClick={() => { if (guideCount) setTab('guides') }}>
            {guideCount ? `📘 Guides (${guideCount})` : '🔒 Guides'}
          </button>
          <button className={`small ${tab === 'tiers' ? 'active' : ''}`}
            disabled={!tiersOpen}
            title={tiersOpen ? undefined : 'Locked — the community has not ranked anything yet'}
            onClick={() => { if (tiersOpen) setTab('tiers') }}>
            {tiersOpen ? '📊 Tier Lists' : '🔒 Tier Lists'}
          </button>
          {archives.length > 0 && (
            <button className={`small ${tab === 'archive' ? 'active' : ''}`} onClick={() => setTab('archive')}>🗄 Archives</button>
          )}
        </div>
      </div>
      {tab === 'techniques' && <TechniqueIndex save={save} />}
      {tab === 'characters' && <CharacterIndex save={save} />}
      {tab === 'guides' && guideCount > 0 && <GuideLibrary save={save} />}
      {tab === 'tiers' && tiersOpen && <TierList />}
      {tab === 'archive' && <ArchiveIndex save={save} archives={archives} />}
    </div>
  )
}

/**
 * The scene's own writing, in one place.
 *
 * Two columns: the shelf on the left (every guide the room has produced, with
 * whether it travelled), the open document on the right. A guide's body is
 * composed from what its author actually knew when they wrote it — see
 * readGuide — so a bad guide reads like a bad guide, which is the point. Most
 * of them sink, and saying so out loud is what makes the ones that travel mean
 * anything.
 */
function GuideLibrary({ save }) {
  const guides = allGuides(save)
  const [openId, setOpenId] = useState(guides[0]?.id || null)
  const guide = guides.find((g) => g.id === openId) || guides[0]
  const doc = readGuide(save, guide)
  const landed = guides.filter((g) => g.landed === true).length

  return (
    <div className="grid-main">
      <div className="card" style={{ order: 2 }}>
        {doc ? (
          <>
            <div className="row spread">
              <h3 style={{ margin: 0 }}>📘 {doc.title}</h3>
              <span className="dim small">{formatDay(guide.day, guide.year)}</span>
            </div>
            <p className="cyan" style={{ margin: '2px 0 2px' }}>by {doc.byline}</p>
            <p className="dim small" style={{ margin: '0 0 10px' }}>
              {doc.reps} lifetime games on {doc.char?.name || 'the character'} · skill {guide.skill} when it was written
              {guide.landed === true && <span className="green"> · widely read</span>}
              {guide.landed === null && <span> · just published, nobody has picked it up yet</span>}
              {guide.landed === false && <span> · never caught on</span>}
            </p>
            {doc.sections.map((s) => (
              <div key={s.heading} style={{ marginBottom: 10 }}>
                <h4 style={{ margin: '0 0 2px', color: 'var(--cyan)' }}>{s.heading}</h4>
                <p style={{ margin: 0 }}>{s.body}</p>
              </div>
            ))}
            {/* The numbers the prose is describing, so the two can be checked
                against each other — a guide claiming a good matchup while the
                chart says otherwise is an author being wrong, not a bug. */}
            <div className="card sub" style={{ marginTop: 4 }}>
              <div className="row spread small">
                <span className="green">best: {doc.matchups.best} ({Math.round(doc.matchups.bestPct)}%)</span>
                <span className="red">worst: {doc.matchups.worst} ({Math.round(doc.matchups.worstPct)}%)</span>
              </div>
              {doc.tech.length > 0 && (
                <div className="small dim" style={{ marginTop: 4 }}>tech covered: {doc.tech.join(' · ')}</div>
              )}
            </div>
          </>
        ) : <p className="dim">Nothing on the shelf yet.</p>}
      </div>

      <div className="card" style={{ order: 1 }}>
        <h3 style={{ marginTop: 0 }}>The shelf <span className="dim small">— {guides.length} written, {landed} caught on</span></h3>
        <p className="dim small" style={{ marginTop: 0 }}>
          Anybody with real reps on a character can write one. Whether it travels depends on
          whether the advice is any good — which is mostly whether the author is.
        </p>
        {guides.map((g) => {
          const char = save.game.characters.find((c) => c.id === g.charId)
          const author = save.players[g.authorId]
          const on = g.id === (guide && guide.id)
          return (
            <div key={g.id} className="row spread clickable"
              style={{
                padding: '4px 6px', cursor: 'pointer', borderRadius: 6,
                borderBottom: '1px solid var(--border)',
                background: on ? 'var(--card2)' : undefined,
              }}
              onClick={() => setOpenId(g.id)}>
              <span className="small">
                <span className={g.landed ? 'cyan' : 'dim'}>📘 {char?.name || '???'}</span>
                <span className="dim"> — {author ? displayName(author, save) : 'a departed regular'}</span>
              </span>
              <span className="small dim">
                {g.landed === true ? <span className="green">read widely</span>
                  : g.landed === null ? 'new'
                  : 'sank'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Techniques discovered in past runs — the knowledge died with the reset,
// but the record keeps the names alive.
function ArchiveIndex({ save, archives }) {
  return (
    <div>
      {[...archives].reverse().map((a) => (
        <div className="card" key={a.run}>
          <h3 style={{ marginTop: 0 }}>Run {a.run} <span className="dim small">— ended {a.endedDateLabel}</span></h3>
          <div className="table-scroll"><table>
            <thead><tr><th>Innovation</th><th>Character</th><th>When</th></tr></thead>
            <tbody>
              {[...a.innovations].reverse().map((i) => (
                <tr key={i.id}>
                  <td><strong className="green">{i.name}</strong></td>
                  <td className="cyan">{charName(save, i.charId) || <span className="dim">universal</span>}</td>
                  <td className="dim small">{formatDay(i.day, i.year)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      ))}
    </div>
  )
}

function charName(save, charId) {
  if (!charId) return null
  const c = save.game.characters.find((x) => x.id === charId)
  return c ? c.name : '???'
}

function TechniqueIndex({ save }) {
  const players = Object.values(save.players).filter((p) => !p.npc)
  const knowsInnov = (iid) => players.filter((p) => p.knownInnovations.includes(iid)).length

  return (
    <div>
      <div className="card">
        <h3>Discovered Techniques ({save.innovations.length})</h3>
        <p className="dim small">All tech is discovered by the community, in play. Knowing every innovation for a character is the only path to skill 100.</p>
        {save.innovations.length === 0 && <p className="dim">Nothing has been discovered yet. High-innovation players will get there.</p>}
        {save.innovations.length > 0 && (
          <div className="table-scroll"><table>
            <thead><tr><th>Innovation</th><th>Character</th><th>Discovered by</th><th>When</th><th>Known by</th></tr></thead>
            <tbody>
              {[...save.innovations].reverse().map((i) => {
                const creator = save.players[i.creatorId]
                return (
                  <tr key={i.id}>
                    <td><strong className="green">{i.name}</strong></td>
                    <td className="cyan">{charName(save, i.charId) || <span className="dim">universal</span>}</td>
                    <td>{creator ? displayName(creator, save) : '???'}</td>
                    <td className="dim small">{formatDay(i.day, i.year)}</td>
                    <td>{knowsInnov(i.id)} player{knowsInnov(i.id) === 1 ? '' : 's'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table></div>
        )}
      </div>
    </div>
  )
}

function CharacterIndex({ save }) {
  const players = Object.values(save.players).filter((p) => !p.npc)
  // The index shows the whole cast, forms included — they're part of the game
  // and people talk about them — but ordered under the character who turns
  // into them, and marked, because a form has no mains of its own by
  // definition and an unexplained empty "Mains (0)" reads as a bug.
  const ordered = selectableChars(save.game)
    .flatMap((c) => [c, ...formsOf(save.game, c.id)])
  return (
    <div className="grid2">
      {ordered.map((c) => {
        const origin = originOf(save.game, c)
        const mains = players.filter((p) => p.mainCharId === c.id && p.isRegular)
          .sort((a, b) => (b.charSkill[c.id] || 0) - (a.charSkill[c.id] || 0))
        const innovs = save.innovations.filter((i) => i.charId === c.id)
        const milestones = [...(save.charMilestones || [])].filter((m) => m.charId === c.id).reverse()
        const guides = guidesFor(save, c.id)
        return (
          <div className="card" key={c.id}>
            <div className="row spread">
              <span className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
                <Portrait url={charArt(c)} size={36} alt={c.name} className="hud-char" />
                <h3 style={{ margin: 0 }}>{c.name}</h3>
              </span>
              <span className="pill">{c.archetype}</span>
            </div>
            {origin && (
              <p className="gold small" style={{ margin: '2px 0 4px' }}>
                ⟳ A form of {origin.name} — not on character select. Reached mid-round, gone at the bell.
              </p>
            )}
            <p className="dim small">
              difficulty {c.difficulty} · popularity {c.popularity}
              {(c.tags || []).map((t) => <span key={t} className="pill on" style={{ marginLeft: 6 }}>{t}</span>)}
            </p>
            {c.description && <p className="small dim">{c.description}</p>}

            {!origin && <h4>Mains ({mains.length})</h4>}
            {!origin && mains.length === 0 && <p className="dim small">Nobody mains {c.name} yet.</p>}
            {!origin && mains.slice(0, 6).map((p) => (
              <div className="row spread" key={p.id} style={{ padding: '2px 0' }}>
                <span className="small">{displayName(p, save)}</span>
                <span className="small dim">skill {Math.round(p.charSkill[c.id] || 0)}</span>
              </div>
            ))}

            {innovs.length > 0 && (
              <>
                <h4>Tech</h4>
                <div>
                  {innovs.map((i) => {
                    const creator = save.players[i.creatorId]
                    return (
                      <span key={i.id} className="pill green" style={{ borderColor: 'var(--green)' }}
                        title={creator ? `discovered by ${displayName(creator, save)}` : ''}>
                        {i.name}
                      </span>
                    )
                  })}
                </div>
              </>
            )}

            {guides.length > 0 && (
              <>
                {/* The definitive write-ups. This is how somebody who never
                    courted a camera ends up known for a character. */}
                <h4>Guides</h4>
                {guides.map((g) => {
                  const author = save.players[g.authorId]
                  return (
                    <div className="row spread" key={g.id}
                      style={{ borderBottom: '1px solid var(--border)', padding: '3px 0' }}>
                      <span className="small">
                        <span className={g.landed ? 'cyan' : 'dim'}>📘 {c.name} guide</span>
                        <span className="dim"> by {author ? displayName(author, save) : 'a departed regular'}</span>
                        {g.landed === true && <span className="green"> · widely read</span>}
                        {g.landed === null && <span className="dim"> · just published</span>}
                        {/* Most guides sink, and saying so is the point — it is
                            what makes the ones that travel mean anything. */}
                        {g.landed === false && <span className="dim"> · never caught on</span>}
                      </span>
                      <span className="dim small">{formatDay(g.day, g.year)}</span>
                    </div>
                  )
                })}
              </>
            )}

            <h4>Milestones</h4>
            {milestones.length === 0 && <p className="dim small">No history written yet.</p>}
            {milestones.slice(0, 8).map((m, i) => (
              <div className="row spread" key={i} style={{ borderBottom: '1px solid var(--border)', padding: '3px 0' }}>
                <span className="small gold">{m.text}</span>
                <span className="dim small">{formatDay(m.day, m.year)}</span>
              </div>
            ))}
          </div>
        )
      })}
      {save.game.characters.length === 0 && <p className="dim">No characters exist.</p>}
    </div>
  )
}
