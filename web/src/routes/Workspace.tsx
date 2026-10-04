import { useCallback, useMemo, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ChevronDown } from "lucide-react"

import { MetricPanel } from "@/components/charts/MetricPanel"
import { CHART_GRID, KeyGroups } from "@/components/KeyGroups"
import { WorkspaceControls } from "@/components/WorkspaceControls"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { settingsFor, useChartSettings } from "@/hooks/use-chart-settings"
import { useGroupState } from "@/hooks/use-group-state"
import { useUrlState } from "@/hooks/use-url-state"
import { api } from "@/lib/api"
import { runsRevision, useProject } from "@/lib/project-context"
import { buildKeyTree } from "@/lib/series"
import type { SeriesMap, SeriesXY } from "@/types"

const PIN_KEY = "log-ui-pins"

function usePins(project: string): [Set<string>, (key: string) => void] {
  const storageKey = `${PIN_KEY}:${project}`
  const [pins, setPins] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(storageKey) ?? "[]") as string[])
    } catch {
      return new Set()
    }
  })
  const toggle = useCallback(
    (key: string) => {
      setPins((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        try {
          localStorage.setItem(storageKey, JSON.stringify([...next]))
        } catch {
          /* ignore */
        }
        return next
      })
    },
    [storageKey],
  )
  return [pins, toggle]
}


/** The pinned section: same look as a top-level metric group, never nested. */
function Section({ title, count, defaultOpen, children }: { title: string; count: number; defaultOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="group/section flex w-full items-center gap-3 rounded-md text-left">
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
        <span className="text-xl font-bold tracking-tight lowercase group-hover/section:text-primary">{title || "ungrouped"}</span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{count}</span>
        <span className="h-px flex-1 bg-rule" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">{open && children}</CollapsibleContent>
    </Collapsible>
  )
}

export default function WorkspacePage() {
  const { project, runs, colors, selected, isLoading } = useProject()
  const [state, update] = useUrlState()
  const [pins, togglePin] = usePins(project)
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
  // Pins persist per project, so some may name keys the selected runs never logged; show and count only the rest.
  const shownPins = useMemo(() => [...pins].filter((k) => keys.includes(k)), [pins, keys])
  const tree = useMemo(() => buildKeyTree(keys.filter((k) => !pins.has(k))), [keys, pins])
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
      pinned={pins.has(key)}
      onPin={togglePin}
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
          {shownPins.length > 0 && (
            <Section title="pinned" count={shownPins.length} defaultOpen>
              <div className={CHART_GRID}>{shownPins.map((k) => card(k, 0))}</div>
            </Section>
          )}
          <KeyGroups root={tree} chart={card} isOpen={groupState.isOpen} setOpen={groupState.setOpen} />
          {keys.length === 0 && <p className="text-sm text-muted-foreground">The selected runs have not logged any metrics yet.</p>}
        </div>
      )}
    </>
  )
}
