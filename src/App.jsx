import { useState } from 'react'
import { useStore, useIdleLoop } from './state/store.jsx'
import MainMenu from './screens/MainMenu.jsx'
import Setup from './screens/Setup.jsx'
import Arcade from './screens/Arcade.jsx'
import Players from './screens/Players.jsx'
import Teams from './screens/Teams.jsx'
import Tournament from './screens/Tournament.jsx'
import HallOfFame from './screens/HallOfFame.jsx'
import Codex from './screens/Codex.jsx'
import Feed from './screens/Feed.jsx'
import GameStudio from './screens/GameStudio.jsx'
import TierList from './screens/TierList.jsx'
import Manage from './screens/Manage.jsx'
import Vods from './screens/Vods.jsx'
import { formatDay } from './game/constants.js'
import { isVodWatched } from './game/model.js'

export default function App() {
  const { save, screen, nav, closeSave } = useStore()
  useIdleLoop() // drives idle mode when it's running (no-op otherwise)

  if (!save) {
    return screen.name === 'setup' ? <Setup /> : <MainMenu />
  }

  const newVods = (save.vods || []).filter((v) => !isVodWatched(v)).length

  const tabs = [
    ['arcade', '🕹 Arcade'],
    ['players', '👥 Players'],
    ['teams', '🛡 Teams'],
    ['tournament', '🏆 Tournament'],
    ['vods', newVods > 0 ? `📼 VODs (${newVods})` : '📼 VODs'],
    ['halloffame', '🏛 Hall of Fame'],
    ['codex', '📖 Codex'],
    ['tiers', '📊 Tiers'],
    ['feed', '📱 Feed'],
    ['studio', '🛠 Studio'],
    ['manage', '⚙ Manage'],
  ]

  return (
    <div>
      <div className="topnav">
        <span className="brand">FIGHT NIGHT</span>
        {tabs.map(([k, label]) => (
          <button key={k}
            style={screen.name === k ? { borderColor: 'var(--pink)', color: 'var(--pink)' } : {}}
            onClick={() => nav(k)}>
            {label}
          </button>
        ))}
        <span className="spacer" />
        {save.idle?.enabled && (
          <span className="idle-badge" title={save.idle.running ? 'idle mode running' : 'idle mode paused'}>
            {save.idle.running ? '▶ IDLE' : '⏸ IDLE'}
          </span>
        )}
        <span className="dim small">{formatDay(save.day, save.year)}</span>
        <button className="small" onClick={closeSave}>Save & Quit</button>
      </div>

      {screen.name === 'arcade' && <Arcade />}
      {screen.name === 'players' && <Players />}
      {screen.name === 'teams' && <Teams />}
      {screen.name === 'tournament' && <Tournament />}
      {screen.name === 'vods' && <Vods />}
      {screen.name === 'halloffame' && <HallOfFame />}
      {screen.name === 'codex' && <Codex />}
      {screen.name === 'feed' && <Feed />}
      {screen.name === 'tiers' && <TierList />}
      {screen.name === 'studio' && <GameStudio />}
      {screen.name === 'manage' && <Manage />}

      <AwayModal />
    </div>
  )
}

// Paginated "while you were away" recap, shown when offline idle catch-up ran.
function AwayModal() {
  const { save, dismissAwayReport, nav } = useStore()
  const [page, setPage] = useState(0)
  const r = save?.idle?.awayReport
  if (!r) return null

  const pages = [
    <div key="summary">
      <h3 style={{ marginTop: 0 }}>⏱ While you were away</h3>
      <p>
        <strong>{r.daysPassed}</strong> day{r.daysPassed === 1 ? '' : 's'} passed
        {' · '}{r.hoursSimmed} hour{r.hoursSimmed === 1 ? '' : 's'} of arcade time simmed.
      </p>
      <ul style={{ margin: '8px 0', paddingLeft: 18 }}>
        <li>📡 {r.followersDelta >= 0 ? '+' : ''}{r.followersDelta} followers · hype {r.hypeDelta >= 0 ? '+' : ''}{r.hypeDelta}</li>
        {save.economy && <li>💰 {r.moneyDelta >= 0 ? '+' : '−'}${Math.abs(r.moneyDelta)}</li>}
      </ul>
      {r.capped && (
        <p className="dim small">Caught up as far as one pass allows — reopen the save to continue catching up.</p>
      )}
    </div>,
  ]
  if (r.tournaments.length) {
    pages.push(
      <div key="events">
        <h3 style={{ marginTop: 0 }}>🏆 Events you missed</h3>
        <p className="dim small">Ready to watch back spoiler-free in the VODs tab.</p>
        {r.tournaments.map((t) => (
          <div key={t.id} className="small" style={{ padding: '2px 0' }}>
            {t.type === 'evo' ? '🌏' : t.type === 'teams' ? '🛡' : '🏆'} {t.name} — <span className="dim">{t.dateLabel}</span>
          </div>
        ))}
        <button className="small" style={{ marginTop: 8 }} onClick={() => { dismissAwayReport(); nav('vods') }}>
          Go to VODs →
        </button>
      </div>,
    )
  }
  if (r.headlines.length) {
    pages.push(
      <div key="headlines">
        <h3 style={{ marginTop: 0 }}>📰 Headlines</h3>
        {r.headlines.map((h, i) => <div key={i} className="small" style={{ padding: '2px 0' }}>{h}</div>)}
      </div>,
    )
  }

  const p = Math.min(page, pages.length - 1)
  return (
    <div className="modal-backdrop">
      <div className="modal card">
        {pages[p]}
        <div className="row spread" style={{ marginTop: 12 }}>
          <span className="dim small">{p + 1} / {pages.length}</span>
          <div className="row">
            {p > 0 && <button className="small" onClick={() => setPage(p - 1)}>← Back</button>}
            {p < pages.length - 1
              ? <button className="small primary" onClick={() => setPage(p + 1)}>Next →</button>
              : <button className="small primary" onClick={dismissAwayReport}>Got it</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
