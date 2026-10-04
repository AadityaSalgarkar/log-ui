import { useCallback, useState } from "react"

import { addPlot, migratePins, parsePlots, toggleKey, type KeyPlot } from "@/lib/key-plots"

const STORAGE_KEY = "log-ui-keyplots"
const LEGACY_PINS = "log-ui-pins" // before key plots; migrated once

/** Key plots for one project, persisted in localStorage. `update` takes a pure operation from lib/key-plots. */
export function useKeyPlots(project: string): [KeyPlot[], (op: (plots: KeyPlot[]) => KeyPlot[]) => void] {
  const storageKey = `${STORAGE_KEY}:${project}`
  const [plots, setPlots] = useState<KeyPlot[]>(() => {
    try {
      return parsePlots(localStorage.getItem(storageKey)) ?? migratePins(localStorage.getItem(`${LEGACY_PINS}:${project}`))
    } catch {
      return []
    }
  })
  const update = useCallback(
    (op: (plots: KeyPlot[]) => KeyPlot[]) =>
      setPlots((prev) => {
        const next = op(prev)
        try {
          localStorage.setItem(storageKey, JSON.stringify(next))
        } catch {
          /* storage unavailable: changes last for this page view */
        }
        return next
      }),
    [storageKey],
  )
  return [plots, update]
}

/** Stable handlers for the pin menu on every metric chart. */
export function useKeyPlotHandlers(update: (op: (plots: KeyPlot[]) => KeyPlot[]) => void) {
  const onNewPlot = useCallback((metric: string) => update((plots) => addPlot(plots, metric)), [update])
  const onTogglePlot = useCallback((plotId: string, metric: string) => update((plots) => toggleKey(plots, plotId, metric)), [update])
  return { onNewPlot, onTogglePlot }
}
