import { useCallback, useMemo, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ChevronDown } from "lucide-react"

import { ChartCard } from "@/components/charts/ChartCard"
import { WorkspaceControls } from "@/components/WorkspaceControls"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { settingsFor, useChartSettings } from "@/hooks/use-chart-settings"
import { useUrlState } from "@/hooks/use-url-state"
import { api } from "@/lib/api"
import { bandRequests } from "@/lib/chart-settings"
import { useProject } from "@/lib/project-context"
import { groupKeys } from "@/lib/series"
import type { SeriesMap } from "@/types"

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
        next.has(key) ? next.delete(key) : next.add(key)
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

const GRID = "grid grid-cols-1 gap-3 pt-3 lg:grid-cols-2 2xl:grid-cols-3"

/** A metric-prefix group: the prefix set large, the key count beside it, a hairline to the edge. */
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
      <CollapsibleContent>{open && children}</CollapsibleContent>
    </Collapsible>
  )
}

export default function WorkspacePage() {
  const { project, runs, colors, selected, isLoading } = useProject()
  const [state, update] = useUrlState()
  const [pins, togglePin] = usePins(project)
  const [chartSettings, setChartSettings] = useChartSettings(project)
  const bands = useMemo(() => bandRequests(chartSettings).metrics, [chartSettings])

  const anyRunning = runs.some((r) => selected.includes(r.name) && r.status === "running")
  const metricsQ = useQuery({
    queryKey: ["metrics", project, [...selected].sort(), state.x, state.smoothing, state.maxPoints, bands],
    queryFn: ({ signal }) =>
      api.metrics(project, { runs: selected, x: state.x, smoothing: state.smoothing, maxPoints: state.maxPoints, bands }, signal),
    enabled: selected.length > 0,
    placeholderData: keepPreviousData,
    refetchInterval: anyRunning ? 5_000 : false,
  })

  const series: SeriesMap = useMemo(() => metricsQ.data?.series ?? {}, [metricsQ.data])
  const keys = useMemo(() => {
    const set = new Set<string>()
    for (const per of Object.values(series)) for (const k of Object.keys(per)) set.add(k)
    return [...set]
  }, [series])
  // Pins persist per project, so some may name keys the selected runs never logged; show and count only the rest.
  const shownPins = useMemo(() => [...pins].filter((k) => keys.includes(k)), [pins, keys])
  const groups = useMemo(() => groupKeys(keys.filter((k) => !pins.has(k))), [keys, pins])
  const orderedGroups = useMemo(() => {
    const names = [...groups.keys()]
    names.sort((a, b) => (a === "train" ? -1 : b === "train" ? 1 : a.localeCompare(b)))
    return names
  }, [groups])

  const card = (key: string, hidePrefix: boolean) => {
    const per: Record<string, { x: number[]; y: number[] } | undefined> = {}
    for (const run of selected) per[run] = series[run]?.[key]
    return (
      <ChartCard
        key={key}
        title={key}
        hidePrefix={hidePrefix}
        series={per}
        colors={colors}
        order={selected}
        xMode={state.x}
        logY={state.logy}
        syncId={`ws-${project}`}
        pinned={pins.has(key)}
        onPin={() => togglePin(key)}
        settings={settingsFor(chartSettings, key)}
        onSettingsChange={(next) => setChartSettings(key, next)}
      />
    )
  }

  return (
    <>
      <WorkspaceControls state={state} update={update} />
      {selected.length === 0 ? (
        <p className="text-sm text-muted-foreground">Select runs in the sidebar to plot their metrics.</p>
      ) : metricsQ.isPending || (isLoading && keys.length === 0) ? (
        <div className={GRID}>
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
              <div className={GRID}>{shownPins.map((k) => card(k, false))}</div>
            </Section>
          )}
          {orderedGroups.map((g, i) => (
            <Section key={g} title={g} count={groups.get(g)!.length} defaultOpen={i < 2}>
              <div className={GRID}>{groups.get(g)!.map((k) => card(k, g !== ""))}</div>
            </Section>
          ))}
          {keys.length === 0 && <p className="text-sm text-muted-foreground">The selected runs have not logged any metrics yet.</p>}
        </div>
      )}
    </>
  )
}
