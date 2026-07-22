import { useStore } from '../state/store.jsx'
import { hash01 } from '../game/util.js'

const AVATAR_COLORS = ['#ff2d78', '#2de2e6', '#ffce4f', '#4fe07d', '#b28dff', '#ff9f45', '#6ec6ff']

// Fake social media about your scene. Wakes up once the channel has any
// traction; money matches, upsets, new tech and team drama drive posts.
export default function Feed() {
  const { save } = useStore()
  const posts = save.socialFeed || []

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h2 style={{ marginTop: 0 }}>📱 The Feed</h2>
      {posts.length === 0 && (
        <div className="card">
          <p className="dim">
            Nobody online is talking about {save.arcade.name} yet. Stream good matches, run
            tournaments, let the drama build — the internet will find you.
          </p>
        </div>
      )}
      {posts.map((p) => <Post key={p.id} p={p} />)}
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
