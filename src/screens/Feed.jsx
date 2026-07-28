import { useState } from 'react'
import { useStore } from '../state/store.jsx'
import { hash01 } from '../game/util.js'
import { communityGameOpinion, communityArcadeOpinion, opinionLabel } from '../game/social.js'
import { relevanceLabel } from '../game/relevance.js'

const AVATAR_COLORS = ['#ff2d78', '#2de2e6', '#ffce4f', '#4fe07d', '#b28dff', '#ff9f45', '#6ec6ff']

// Fake social media about your scene. Wakes up once the channel has any
// traction; money matches, upsets, new tech and team drama drive posts.
export default function Feed() {
  const { save } = useStore()
  const [scope, setScope] = useState('all')
  const all = save.socialFeed || []
  // Posts written before scopes existed were all about the arcade.
  const scoped = (p) => p.scope || 'arcade'
  const posts = scope === 'all' ? all : all.filter((p) => scoped(p) === scope)
  const mineCount = all.filter((p) => scoped(p) === 'arcade').length
  const share = all.length ? Math.round((mineCount / all.length) * 100) : 0

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h2 style={{ marginTop: 0 }}>📱 The Feed</h2>
      <CommunityPulse save={save} />

      <div className="tabs">
        <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>Everything</button>
        <button className={scope === 'world' ? 'active' : ''} onClick={() => setScope('world')}>🌍 The world</button>
        <button className={scope === 'arcade' ? 'active' : ''} onClick={() => setScope('arcade')}>🏠 {save.arcade.name}</button>
      </div>
      {/* The mix is the progress bar. Early on this reads "3% about you" and
          the timeline is other people's business; it climbs as your players
          get ranked and your scene gets loud. */}
      {all.length > 0 && (
        <p className="dim small" style={{ marginTop: -4 }}>
          {share === 0
            ? `Nothing on the timeline is about ${save.arcade.name} yet.`
            : `${share}% of the timeline is about ${save.arcade.name}.`}
        </p>
      )}

      {posts.length === 0 && (
        <div className="card">
          <p className="dim">
            {scope === 'arcade'
              ? `Nobody online is talking about ${save.arcade.name} yet. Stream good matches, run tournaments, get somebody ranked — the internet will find you.`
              : 'Nothing here yet.'}
          </p>
        </div>
      )}
      {posts.map((p) => <Post key={p.id} p={p} />)}
    </div>
  )
}

// What the community currently thinks — of the game you patch, and of the
// room you run. Averaged over everyone who actually shows up.
function CommunityPulse({ save }) {
  const game = communityGameOpinion(save)
  const arcade = communityArcadeOpinion(save)
  if (game == null && arcade == null) return null
  const relevance = save.relevance
  return (
    <div className="card" style={{ padding: '10px 14px' }}>
      {relevance != null && (
        <div className="row spread" style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
          <span className="small">🌐 National interest in {save.game.name}</span>
          <span className="small" style={{ color: relevance >= 62 ? 'var(--green)' : relevance >= 24 ? 'var(--gold)' : 'var(--red)' }}>
            {relevanceLabel(relevance)} · {Math.round(relevance)}/100
          </span>
        </div>
      )}
      <div className="grid2">
        <OpinionMeter label={`🎮 ${save.game.name}`} value={game} />
        <OpinionMeter label={`🕹 ${save.arcade.name}`} value={arcade} />
      </div>
      <p className="dim small" style={{ margin: '6px 0 0' }}>
        Community sentiment, averaged across the regulars. National interest is the wider world's
        attention — it builds while the scene is young and hot, then fades with age unless you fight for it.
      </p>
    </div>
  )
}

function OpinionMeter({ label, value }) {
  if (value == null) return null
  const pct = Math.round(value * 10)
  const color = value >= 7 ? 'var(--green)' : value >= 4.5 ? 'var(--gold)' : 'var(--red)'
  return (
    <div>
      <div className="row spread">
        <span className="small">{label}</span>
        <span className="small" style={{ color }}>{opinionLabel(value)} · {value.toFixed(1)}/10</span>
      </div>
      <div className="track" style={{ height: 6, background: 'var(--bg2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color }} />
      </div>
    </div>
  )
}

function Post({ p }) {
  const color = AVATAR_COLORS[Math.floor(hash01(p.user) * AVATAR_COLORS.length)]
  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      {p.platform === 'boards' ? (
        <>
          <div className="row" style={{ gap: 6 }}>
            <span className="pill" style={{ borderColor: 'var(--gold)', color: 'var(--gold)' }}>{p.board}</span>
            <span className="dim small">posted by {p.user} · {p.dateLabel}</span>
          </div>
          {p.title && <h3 style={{ margin: '8px 0 4px' }}>{p.title}</h3>}
          <p style={{ margin: '4px 0' }}>{p.text}</p>
          <span className="dim small">▲ {p.likes} upvotes · {Math.max(0, Math.round(p.likes / 3))} comments</span>
        </>
      ) : (
        <>
          <div className="row" style={{ gap: 8 }}>
            <span className="feed-avatar" style={{ background: color }}>{p.user[1]?.toUpperCase() || '?'}</span>
            <div>
              <strong>{p.user}</strong>
              <div className="dim small">{p.dateLabel}</div>
            </div>
          </div>
          <p style={{ margin: '8px 0 4px' }}>{p.text}</p>
          <span className="dim small">❤️ {p.likes} · 🔁 {Math.max(0, Math.round(p.likes / 4))}</span>
        </>
      )}
    </div>
  )
}
