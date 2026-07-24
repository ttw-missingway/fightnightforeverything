import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { TIER_ORDER } from '../game/balance.js'
import { formatDay, DAYS_PER_YEAR } from '../game/constants.js'
import { Portrait } from '../components/ui.jsx'
import { charArt } from '../components/art.js'

// Classic tiermaker colors: black text on candy rows.
const TIER_COLORS = {
  S: '#ff7f7f',
  A: '#ffbf7f',
  B: '#ffdf7f',
  C: '#7fff7f',
  D: '#7fbfff',
}

// The community's tier lists, tiermaker style. A new one drops about a week
// after every patch — long enough for the meta to be argued into shape.
export default function TierList() {
  const { save } = useStore()
  const lists = save.tierLists || []
  const [selectedId, setSelectedId] = useState(null)
  const list = lists.find((l) => l.id === selectedId) || lists[0]

  if (!list) {
    const daysLeft = save.pendingTierList
      ? Math.max(0, save.pendingTierList.dueAbs - ((save.year - 1) * DAYS_PER_YEAR + save.day))
      : null
    return (
      <div className="card">
        <h2 style={{ marginTop: 0 }}>📊 Community Tier List</h2>
        <p className="dim">
          {daysLeft != null
            ? `The community is still cooking — the v${save.pendingTierList.version} tier list drops in about ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`
            : 'No tier list yet. Give the community a week or so with the game (or with a fresh patch) and they will absolutely rank everything.'}
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="row spread">
        <div>
          <h2 style={{ margin: 0 }}>📊 Community Tier List <span className="dim">v{list.version}</span></h2>
          <span className="dim small">
            {formatDay(list.day, list.year)} · {list.votes} votes · {list.blurb}
          </span>
        </div>
        {lists.length > 1 && (
          <select value={list.id} onChange={(e) => setSelectedId(e.target.value)}>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>v{l.version} — {formatDay(l.day, l.year)}</option>
            ))}
          </select>
        )}
      </div>

      <div className="tierlist">
        {TIER_ORDER.map((tier) => {
          const chars = (list.tiers[tier] || [])
            .map((id) => save.game.characters.find((c) => c.id === id))
            .filter(Boolean)
          return (
            <div className="tierrow" key={tier}>
              <div className="tierlabel" style={{ background: TIER_COLORS[tier] }}>{tier}</div>
              <div className="tiercells">
                {chars.map((c) => (
                  <div className="tiercard" key={c.id} title={`${c.name} — ${c.archetype}`}>
                    <Portrait url={charArt(c)} size={40} alt={c.name} className="hud-char" />
                    <span className="tiercard-name">{c.name}</span>
                    <span className="tiercard-arch">{c.archetype}</span>
                  </div>
                ))}
                {!chars.length && <span className="dim small" style={{ alignSelf: 'center', padding: '0 10px' }}>—</span>}
              </div>
            </div>
          )
        })}
      </div>

      <p className="dim small" style={{ marginTop: 10 }}>
        Community perception — computed strength plus popularity, tournament results, and pure discourse.
        The Studio's Matchup Report has the objective numbers; this is what the scene <em>believes</em>.
      </p>
    </div>
  )
}
