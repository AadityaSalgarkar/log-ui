import { useCallback, useState } from "react"

import { DEFAULT_CHART_SETTINGS, isDefault, parseChartSettings, type ChartSettings, type ChartSettingsMap } from "@/lib/chart-settings"

const STORAGE_KEY = "log-ui-charts"

/** Chart settings for one project, persisted in localStorage like pins. */
export function useChartSettings(project: string): [ChartSettingsMap, (id: string, next: ChartSettings) => void] {
  const storageKey = `${STORAGE_KEY}:${project}`
  const [map, setMap] = useState<ChartSettingsMap>(() => {
    try {
      return parseChartSettings(localStorage.getItem(storageKey))
    } catch {
      return {}
    }
  })
  const set = useCallback(
    (id: string, next: ChartSettings) => {
      setMap((prev) => {
        const out = { ...prev }
        if (isDefault(next)) delete out[id]
        else out[id] = next
        try {
          localStorage.setItem(storageKey, JSON.stringify(out))
        } catch {
          /* storage unavailable: settings last for this page view */
        }
        return out
      })
    },
    [storageKey],
  )
  return [map, set]
}

export function settingsFor(map: ChartSettingsMap, id: string): ChartSettings {
  return map[id] ?? DEFAULT_CHART_SETTINGS
}
