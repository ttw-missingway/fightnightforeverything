import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { displayName } from '../game/util.js'
import { formatDay } from '../game/constants.js'
import { Portrait } from '../components/ui.jsx'
import { charArt } from '../components/art.js'
import { selectableChars, formsOf, originOf } from '../game/forms.js'
import { guidesFor } from '../game/guides.js'

// The Codex: an index of every discovered technique (who found it, which
// character it belongs to) and every character (milestones, mains, tech).
export default function Codex() {
  const { save } = useStore()
  const [tab, setTab] = useState('techniques')
  const archives = (save.archives || []).filter((a) => (a.innovations || []).length)

  return (
    <div>
      <div className="row spread">
        <h2 style={{ marginTop: 0 }}>📖 Codex</h2>
        <div className="tabs" style={{ margin: 0 }}>
          <button className={`small ${tab === 'techniques' ? 'active' : ''}`} onClick={() => setTab('techniques')}>Technique Index</button>
          <button className={`small ${tab === 'characters' ? 'active' : ''}`} onClick={() => setTab('characters')}>Character Index</button>
          {archives.length > 0 && (
            <button className={`small ${tab === 'archive' ? 'active' : ''}`} onClick={() => setTab('archive')}>🗄 Archives</button>
          )}
        </div>
      </div>
      {tab === 'techniques' && <TechniqueIndex save={save} />}
      {tab === 'characters' && <CharacterIndex save={save} />}
      {tab === 'archive' && <ArchiveIndex save={save} archives={archives} />}
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
