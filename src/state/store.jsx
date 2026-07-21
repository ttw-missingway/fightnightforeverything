import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { simDay, advanceDay, whatHappensToday } from '../game/sim.js'
import { runSinglesTournament, runTeamTournament, runEvo } from '../game/tournament.js'
import { generateEvoRoster } from '../game/generate.js'

const INDEX_KEY = 'fightnight:index'
const saveKey = (id) => `fightnight:save:${id}`

export function loadIndex() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY)) || []
  } catch {
    return []
  }
}

function writeIndex(index) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index))
}

export function persistSave(save) {
  save.updatedAt = Date.now()
  localStorage.setItem(saveKey(save.id), JSON.stringify(save))
  const index = loadIndex().filter((e) => e.id !== save.id)
  index.unshift({
    id: save.id,
    saveName: save.saveName,
    gameName: save.game.name,
    arcadeName: save.arcade.name,
    day: save.day,
    year: save.year,
    updatedAt: save.updatedAt,
  })
  writeIndex(index)
}

export function loadSaveById(id) {
  try {
    return JSON.parse(localStorage.getItem(saveKey(id)))
  } catch {
    return null
  }
}

export function deleteSaveById(id) {
  localStorage.removeItem(saveKey(id))
  writeIndex(loadIndex().filter((e) => e.id !== id))
}

const StoreCtx = createContext(null)

export function StoreProvider({ children }) {
  const [save, _setSave] = useState(null)
  const saveRef = useRef(null)
  const [screen, setScreen] = useState({ name: 'menu' })

  const setSave = useCallback((s) => {
    saveRef.current = s
    _setSave(s)
  }, [])

  const nav = useCallback((name, params = {}) => setScreen({ name, ...params }), [])

  // All game mutations go through here: clone current save, mutate, persist.
  const mutate = useCallback((fn) => {
    const prev = saveRef.current
    if (!prev) return
    const next = structuredClone(prev)
    fn(next)
    persistSave(next)
    setSave(next)
  }, [setSave])

  const startSave = useCallback((draft) => {
    const next = structuredClone(draft)
    if (!next.evoRoster.length) next.evoRoster = generateEvoRoster(next)
    persistSave(next)
    setSave(next)
    setScreen({ name: 'arcade' })
  }, [setSave])

  const openSave = useCallback((id) => {
    const loaded = loadSaveById(id)
    if (loaded) {
      setSave(loaded)
      setScreen({ name: 'arcade' })
    }
  }, [setSave])

  const closeSave = useCallback(() => {
    setSave(null)
    setScreen({ name: 'menu' })
  }, [setSave])

  // Simulate the next day. Tournament/EVO days replace the normal arcade day
  // and the UI jumps to the tournament screen.
  const simulateDay = useCallback(() => {
    const prev = saveRef.current
    if (!prev) return
    const next = structuredClone(prev)
    let outcome = { type: 'day' }
    const today = whatHappensToday(next)
    if (today === 'evo') {
      const res = runEvo(next)
      outcome = res.ok ? { type: 'tournament' } : { type: 'day', notice: res.reason }
      if (!res.ok) simDay(next)
    } else if (today) {
      const res = today.type === 'teams' ? runTeamTournament(next, today) : runSinglesTournament(next, today)
      outcome = res.ok ? { type: 'tournament' } : { type: 'day', notice: res.reason }
      if (!res.ok) simDay(next)
    } else {
      simDay(next)
    }
    advanceDay(next)
    persistSave(next)
    setSave(next)
    setScreen(outcome.type === 'tournament' ? { name: 'tournament' } : { name: 'arcade', notice: outcome.notice })
  }, [setSave])

  const value = useMemo(() => ({
    save, screen, nav, mutate, startSave, openSave, closeSave, simulateDay,
  }), [save, screen, nav, mutate, startSave, openSave, closeSave, simulateDay])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  return useContext(StoreCtx)
}
