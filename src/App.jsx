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

  // The Tournament screen lost its tab (VODs cover replays) but still shows
  // live events — reached from the Arcade on event days, and from VODs.
  const tabs = [
    ['arcade', '🕹 Arcade'],
    ['players', '👥 Players'],
    ['teams', '🛡 Teams'],
    ['vods', newVods > 0 ? `📼 VODs (${newVods})` : '📼 VODs'],
    ['halloffame', '🏛 Hall of Fame'],
    ['codex', '📖 Codex'],
    ['tiers', '📊 Tiers'],
    ['feed', '📱 Feed'],
    ['studio', '🛠 Studio'],
    ['manage', '🏪 Manage'],
  ]
  const activeTab = screen.name === 'tournament' ? (screen.vodId ? 'vods' : 'arcade') : screen.name

  return (
    <div>
      <div className="topnav">
        <span className="brand">FIGHT NIGHT</span>
        {tabs.map(([k, label]) => (
          <button key={k}
            style={activeTab === k ? { borderColor: 'var(--pink)', color: 'var(--pink)' } : {}}
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

      <ForeclosureModal />
      <RosterCollapseModal />
      <AwayModal />
    </div>
  )
}

// Consequential mode's fail state: too long in the red and the landlord
// takes the keys. The only way forward is a new run — the design and the
// roster survive, fame converts to prestige.
function ForeclosureModal() {
  const { save, resetCurrentRun, closeSave } = useStore()
  if (!save?.economy?.foreclosed) return null
  const prestige = save.prestige?.points || 0
  return (
    <div className="modal-backdrop">
      <div className="modal card" style={{ borderColor: 'var(--red)' }}>
        <h3 style={{ marginTop: 0 }} className="red">🔒 Foreclosed</h3>
        <p>
          The account stayed in the red too long. The landlord changed the locks on {save.arcade.name} —
          this run is over.
        </p>
        <p className="small dim">
          A new run keeps your game design and player roster (progress wiped), archives this run's
          chronicle, hall of fame, and VODs, and converts your arcade's fame into prestige points for
          player creation{prestige > 0 ? ` (${prestige} banked so far)` : ''}.
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" onClick={resetCurrentRun}>♻ Start a new run</button>
          <button onClick={closeSave}>Back to the main menu</button>
        </div>
      </div>
    </div>
  )
}

// The finite-cast fail state: the roster is fixed the day the run begins and
// never refills, so once the last of them has retired or been banished there's
// no scene left to run. A new run reseeds the cast from the same identities.
function RosterCollapseModal() {
  const { save, resetCurrentRun, closeSave } = useStore()
  if (!save?.rosterCollapsed || save?.economy?.foreclosed) return null
  return (
    <div className="modal-backdrop">
      <div className="modal card" style={{ borderColor: 'var(--red)' }}>
        <h3 style={{ marginTop: 0 }} className="red">🏁 The scene has run its course</h3>
        <p>
          Every last regular of {save.arcade.name} has hung it up. The cabinets still hum, but there's
          nobody left to play — a scene has a lifespan, and this one reached the end of its. This run is over.
        </p>
        <p className="small dim">
          A new run keeps your game design and player roster (progress wiped), archives this run's
          chronicle, hall of fame, and VODs, and converts your arcade's fame into prestige points.
        </p>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="primary" onClick={resetCurrentRun}>♻ Start a new run</button>
          <button onClick={closeSave}>Back to the main menu</button>
        </div>
      </div>
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
