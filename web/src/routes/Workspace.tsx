import { useMemo } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { MetricPanel } from "@/components/charts/MetricPanel"
import { CHART_GRID, KeyGroups } from "@/components/KeyGroups"
import { KeyPlotsSection } from "@/components/KeyPlotsSection"
import { WorkspaceControls } from "@/components/WorkspaceControls"
import { Skeleton } from "@/components/ui/skeleton"
import { settingsFor, useChartSettings } from "@/hooks/use-chart-settings"
import { useGroupState } from "@/hooks/use-group-state"
import { useKeyPlotHandlers, useKeyPlots } from "@/hooks/use-key-plots"
import { useUrlState } from "@/hooks/use-url-state"
import { api } from "@/lib/api"
import { runsRevision, useProject } from "@/lib/project-context"
import { buildKeyTree } from "@/lib/series"
import type { SeriesMap, SeriesXY } from "@/types"

export default function WorkspacePage() {
  const { project, runs, colors, selected, isLoading } = useProject()
  const [state, update] = useUrlState()
  const [plots, updatePlots] = useKeyPlots(project)
  const { onNewPlot, onTogglePlot } = useKeyPlotHandlers(updatePlots)
  const [chartSettings, setChartSettings] = useChartSettings(project)
  const revision = useMemo(() => runsRevision(runs, selected), [runs, selected])

  // No timer: the runs list polls cheaply, and this refetches only when a selected run has new rows (revision).
  // Bands are fetched per chart by MetricPanel, so changing one chart's band never refetches this.
  const metricsQ = useQuery({
    queryKey: ["metrics", project, [...selected].sort(), state.x, state.smoothing, state.maxPoints, revision],
    queryFn: ({ signal }) => api.metrics(project, { runs: selected, x: state.x, smoothing: state.smoothing, maxPoints: state.maxPoints }, signal),
    enabled: selected.length > 0,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  })

  const series: SeriesMap = useMemo(() => metricsQ.data?.series ?? {}, [metricsQ.data])
  const keys = useMemo(() => {
    const set = new Set<string>()
    for (const per of Object.values(series)) for (const k of Object.keys(per)) set.add(k)
    return [...set]
  }, [series])
  // One stable object per chart so MetricPanel's memo holds across unrelated re-renders.
  const perKey = useMemo(() => {
    const out = new Map<string, Record<string, SeriesXY | undefined>>()
    for (const k of keys) out.set(k, Object.fromEntries(selected.map((run) => [run, series[run]?.[k]])))
    return out
  }, [keys, selected, series])
  // Metrics in key plots also stay in their groups: key plots are an extra view on top.
  const tree = useMemo(() => buildKeyTree(keys), [keys])
  const allKeys = useMemo(() => [...keys].sort(), [keys])
  const groupState = useGroupState(project)

  const card = (key: string, hideDepth: number) => (
    <MetricPanel
      key={key}
      project={project}
      metric={key}
      series={perKey.get(key)!}
      runs={selected}
      colors={colors}
      xMode={state.x}
      logY={state.logy}
      smoothing={state.smoothing}
      maxPoints={state.maxPoints}
      revision={revision}
      syncId={`ws-${project}`}
      hideDepth={hideDepth}
      keyPlots={plots}
      onNewPlot={onNewPlot}
      onTogglePlot={onTogglePlot}
      settings={settingsFor(chartSettings, key)}
      onSettingsChange={setChartSettings}
    />
  )

  return (
    <>
      <WorkspaceControls state={state} update={update} />
      {selected.length === 0 ? (
        <p className="text-sm text-muted-foreground">Select runs in the sidebar to plot their metrics.</p>
      ) : metricsQ.isPending || (isLoading && keys.length === 0) ? (
        <div className={CHART_GRID}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-64 rounded-lg" />
          ))}
        </div>
      ) : metricsQ.isError ? (
        <p className="text-sm text-destructive">Could not load metrics: {(metricsQ.error as Error).message}</p>
      ) : (
        <div className="flex flex-col gap-6">
          <KeyPlotsSection
            plots={plots}
            update={updatePlots}
            chartSettings={chartSettings}
            onSettingsChange={setChartSettings}
            isOpen={groupState.isOpen}
            setOpen={groupState.setOpen}
            project={project}
            perKey={perKey}
            allKeys={allKeys}
            runs={selected}
            colors={colors}
            xMode={state.x}
            logY={state.logy}
            smoothing={state.smoothing}
            maxPoints={state.maxPoints}
            revision={revision}
            syncId={`ws-${project}`}
          />
          <KeyGroups root={tree} chart={card} isOpen={groupState.isOpen} setOpen={groupState.setOpen} />
          {keys.length === 0 && <p className="text-sm text-muted-foreground">The selected runs have not logged any metrics yet.</p>}
        </div>
      )}
    </>
  )
}
