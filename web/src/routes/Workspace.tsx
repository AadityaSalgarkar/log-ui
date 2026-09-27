import { useCallback, useMemo, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ChevronDown } from "lucide-react"

import { ChartCard } from "@/components/charts/ChartCard"
import { StatCards, type Stat } from "@/components/StatCards"
import { WorkspaceControls } from "@/components/WorkspaceControls"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { useUrlState } from "@/hooks/use-url-state"
import { api } from "@/lib/api"
import { fmtInt, fmtNum, splitKey } from "@/lib/format"
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

function Section({ title, count, defaultOpen, children }: { title: string; count: number; defaultOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 py-1 text-left text-xs font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground">
        <ChevronDown className={`size-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
        {title || "(no prefix)"}
        <span className="font-normal normal-case">{count}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>{open && children}</CollapsibleContent>
    </Collapsible>
  )
}

export default function WorkspacePage() {
  const { project, runs, colors, selected, isLoading } = useProject()
  const [state, update] = useUrlState()
  const [pins, togglePin] = usePins(project)

  const anyRunning = runs.some((r) => selected.includes(r.name) && r.status === "running")
  const metricsQ = useQuery({
    queryKey: ["metrics", project, [...selected].sort(), state.x, state.smoothing, state.maxPoints],
    queryFn: ({ signal }) => api.metrics(project, { runs: selected, x: state.x, smoothing: state.smoothing, maxPoints: state.maxPoints }, signal),
    enabled: selected.length > 0,
    placeholderData: keepPreviousData,
    refetchInterval: state.live && anyRunning ? 5_000 : false,
  })

  const series: SeriesMap = useMemo(() => metricsQ.data?.series ?? {}, [metricsQ.data])
  const keys = useMemo(() => {
    const set = new Set<string>()
    for (const per of Object.values(series)) for (const k of Object.keys(per)) set.add(k)
    return [...set]
  }, [series])
  const groups = useMemo(() => groupKeys(keys.filter((k) => !pins.has(k))), [keys, pins])
  const orderedGroups = useMemo(() => {
    const names = [...groups.keys()]
    names.sort((a, b) => (a === "train" ? -1 : b === "train" ? 1 : a.localeCompare(b)))
    return names
  }, [groups])

  const stats: Stat[] = useMemo(() => {
    const sel = runs.filter((r) => selected.includes(r.name))
    const latest = Math.max(0, ...sel.map((r) => r.last_step ?? 0))
    const tps = sel.map((r) => r.summary["train/tokens_per_s"]).filter((v): v is number => typeof v === "number")
    const running = sel.filter((r) => r.status === "running").length
    const firstPinned = [...pins][0]
    const best = firstPinned ? Math.min(...sel.map((r) => r.summary[firstPinned] ?? Infinity)) : null
    return [
      { label: "selected runs", value: String(sel.length), hint: `${running} running` },
      { label: "latest step", value: fmtInt(latest) },
      { label: "tokens / s", value: tps.length ? fmtNum(Math.max(...tps), 3) : "-", hint: tps.length ? "max over selected" : "log train/tokens_per_s" },
      { label: firstPinned ? `best ${splitKey(firstPinned)[1]}` : "best (pin a key)", value: best !== null && Number.isFinite(best) ? fmtNum(best) : "-" },
    ]
  }, [runs, selected, pins])

  const card = (key: string) => {
    const per: Record<string, { x: number[]; y: number[] } | undefined> = {}
    for (const run of selected) per[run] = series[run]?.[key]
    return (
      <ChartCard key={key} title={key} series={per} colors={colors} order={selected} xMode={state.x} logY={state.logy} syncId={`ws-${project}`} pinned={pins.has(key)} onPin={() => togglePin(key)} />
    )
  }

  return (
    <>
      <StatCards stats={stats} />
      <WorkspaceControls state={state} update={update} />
      {selected.length === 0 ? (
        <p className="text-sm text-muted-foreground">Select runs in the sidebar to plot their metrics.</p>
      ) : metricsQ.isPending || (isLoading && keys.length === 0) ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-60" />
          ))}
        </div>
      ) : metricsQ.isError ? (
        <p className="text-sm text-destructive">{(metricsQ.error as Error).message}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {pins.size > 0 && (
            <Section title="pinned" count={pins.size} defaultOpen>
              <div className="grid grid-cols-1 gap-4 py-2 lg:grid-cols-2 2xl:grid-cols-3">{[...pins].filter((k) => keys.includes(k)).map(card)}</div>
            </Section>
          )}
          {orderedGroups.map((g, i) => (
            <Section key={g} title={g} count={groups.get(g)!.length} defaultOpen={i < 2}>
              <div className="grid grid-cols-1 gap-4 py-2 lg:grid-cols-2 2xl:grid-cols-3">{groups.get(g)!.map(card)}</div>
            </Section>
          ))}
          {keys.length === 0 && <p className="text-sm text-muted-foreground">No metrics logged yet for the selected runs.</p>}
        </div>
      )}
    </>
  )
}
