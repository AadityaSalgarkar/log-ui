import { memo, useMemo } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { ChartCard } from "@/components/charts/ChartCard"
import { PinMenu } from "@/components/charts/PinMenu"
import { api } from "@/lib/api"
import type { ChartSettings } from "@/lib/chart-settings"
import type { KeyPlot } from "@/lib/key-plots"
import type { SeriesXY, XMode } from "@/types"

export interface MetricPanelProps {
  project: string
  metric: string // the metric key; also this chart's settings id
  series: Record<string, SeriesXY | undefined> // run -> plotted series, from the page-wide query
  runs: string[]
  colors: Record<string, string>
  xMode: XMode
  logY: boolean
  smoothing: number
  maxPoints: number
  revision: string // changes when the selected runs log new rows
  syncId: string
  hideDepth?: number // leading key segments already shown by enclosing group headers
  keyPlots?: KeyPlot[] // with the two handlers below, shows the pin menu
  onNewPlot?: (metric: string) => void
  onTogglePlot?: (plotId: string, metric: string) => void
  settings: ChartSettings
  onSettingsChange: (metric: string, next: ChartSettings) => void
}

/**
 * One metric chart. Its band is fetched by its own small query (one key, the selected runs), so changing a band or
 * window refetches and redraws only this chart. Memoized: it re-renders only when its own props change.
 */
function MetricPanelImpl(p: MetricPanelProps) {
  const banded = p.settings.band !== "none"
  const bandQ = useQuery({
    queryKey: ["band", p.project, p.metric, p.runs, p.xMode, p.smoothing, p.maxPoints, p.settings.window, p.revision],
    queryFn: ({ signal }) =>
      api.metrics(
        p.project,
        { runs: p.runs, keys: [p.metric], x: p.xMode, smoothing: p.smoothing, maxPoints: p.maxPoints, bands: [`${p.metric}:${p.settings.window}`] },
        signal,
      ),
    enabled: banded && p.runs.length > 0,
    placeholderData: keepPreviousData,
    staleTime: Infinity, // the revision in the key decides when data is stale
  })
  const series = useMemo(() => {
    if (!banded || !bandQ.data) return p.series
    const out: Record<string, SeriesXY | undefined> = {}
    for (const run of Object.keys(p.series)) out[run] = bandQ.data.series[run]?.[p.metric] ?? p.series[run]
    return out
  }, [banded, bandQ.data, p.series, p.metric])

  return (
    <ChartCard
      title={p.metric}
      hideDepth={p.hideDepth}
      series={series}
      colors={p.colors}
      order={p.runs}
      xMode={p.xMode}
      logY={p.logY}
      syncId={p.syncId}
      actions={
        p.keyPlots && p.onNewPlot && p.onTogglePlot ? (
          <PinMenu metric={p.metric} plots={p.keyPlots} onNew={p.onNewPlot} onToggle={p.onTogglePlot} />
        ) : undefined
      }
      settings={p.settings}
      onSettingsChange={(next) => p.onSettingsChange(p.metric, next)}
    />
  )
}

export const MetricPanel = memo(MetricPanelImpl)
