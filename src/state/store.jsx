import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { startDay, simHour, endDay, advanceDay, whatHappensToday } from '../game/sim.js'
import { HOURS_PER_DAY } from '../game/constants.js'
import { runSinglesTournament, runTeamTournament, runEvo } from '../game/tournament.js'
import { generateEvoRoster } from '../game/generate.js'
import { migrateSave } from '../game/model.js'
import { computeMatchups } from '../game/balance.js'

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
    const save = JSON.parse(localStorage.getItem(saveKey(id)))
    return save ? migrateSave(save) : null
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
    computeMatchups(next.game) // the designed movesets decide the chart
    if (!next.evoRoster.length) next.evoRoster = generateEvoRoster(next)
    persistSave(next)
    setSave(next)
    setScreen({ name: 'arcade' })
  }, [setSave])

  const openSave = useCallback((id) => {
    const loaded = loadSaveById(id)
    if (loaded) {
      persistSave(loaded) // write migrations back immediately
      setSave(loaded)
      setScreen({ name: 'arcade' })
    }
  }, [setSave])

  const closeSave = useCallback(() => {
    setSave(null)
    setScreen({ name: 'menu' })
  }, [setSave])

  // Advance time one step: open the arcade (first hour), simulate the next
  // hour, or close up for the night. Tournament/EVO days replace the normal
  // arcade day entirely and jump to the tournament screen.
  const advance = useCallback(() => {
    const prev = saveRef.current
    if (!prev) return
    const next = structuredClone(prev)
    let outcome = { type: 'hour' }

    if (!next.dayInProgress) {
      const today = whatHappensToday(next)
      if (today === 'evo' || today) {
        const res = today === 'evo'
          ? runEvo(next)
          : today.type === 'teams' ? runTeamTournament(next, today) : runSinglesTournament(next, today)
        if (res.ok) {
          advanceDay(next)
          outcome = { type: 'tournament' }
        } else {
          // Tournament fell through — run a normal day instead.
          startDay(next)
          simHour(next)
          outcome = { type: 'hour', notice: res.reason }
        }
      } else {
        startDay(next)
        simHour(next)
      }
    } else if (next.hour < HOURS_PER_DAY) {
      simHour(next)
    } else {
      endDay(next) // produces the daily recap and ticks the calendar
      outcome = { type: 'recap' }
    }

    persistSave(next)
    setSave(next)
    setScreen(outcome.type === 'tournament' ? { name: 'tournament' } : { name: 'arcade', notice: outcome.notice })
  }, [setSave])

  // Skip straight to the daily recap: finish (or run) the whole day at once.
  // Tournament days still divert to the tournament screen.
  const skipDay = useCallback(() => {
    const prev = saveRef.current
    if (!prev) return
    const next = structuredClone(prev)
    let outcome = { type: 'recap' }
    if (!next.dayInProgress) {
      const today = whatHappensToday(next)
      if (today === 'evo' || today) {
        const res = today === 'evo'
          ? runEvo(next)
          : today.type === 'teams' ? runTeamTournament(next, today) : runSinglesTournament(next, today)
        if (res.ok) {
          advanceDay(next)
          persistSave(next)
          setSave(next)
          setScreen({ name: 'tournament' })
          return
        }
        outcome.notice = res.reason
      }
      startDay(next)
    }
    while (next.hour < HOURS_PER_DAY) simHour(next)
    endDay(next)
    persistSave(next)
    setSave(next)
    setScreen({ name: 'arcade', notice: outcome.notice })
  }, [setSave])

  const value = useMemo(() => ({
    save, screen, nav, mutate, startSave, openSave, closeSave, advance, skipDay,
  }), [save, screen, nav, mutate, startSave, openSave, closeSave, advance, skipDay])

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>
}

export function useStore() {
  return useContext(StoreCtx)
}
