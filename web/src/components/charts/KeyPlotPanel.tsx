import { memo, useMemo, useState } from "react"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { Plus, X } from "lucide-react"

import { ChartCard } from "@/components/charts/ChartCard"
import { LineStyleSample } from "@/components/charts/LineStyleSample"
import type { LineSpec } from "@/components/charts/MetricChart"
import { MetricKey } from "@/components/MetricKey"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { api } from "@/lib/api"
import { PLOT_ID, type ChartSettings } from "@/lib/chart-settings"
import { runColor } from "@/lib/colors"
import {
  DASHES,
  MARKERS,
  WIDTHS,
  addKey,
  deletePlot,
  plotTitle,
  removeKey,
  renamePlot,
  setStyle,
  styleFor,
  type KeyPlot,
  type LineStyle,
} from "@/lib/key-plots"
import { cn } from "@/lib/utils"
import type { SeriesXY, XMode } from "@/types"

export interface KeyPlotPanelProps {
  project: string
  plot: KeyPlot
  perKey: Map<string, Record<string, SeriesXY | undefined>> // metric -> run -> series, from the page-wide query
  allKeys: string[] // for the "+ metric" picker
  runs: string[]
  colors: Record<string, string>
  xMode: XMode
  logY: boolean
  smoothing: number
  maxPoints: number
  revision: string
  syncId: string
  settings: ChartSettings
  onSettingsChange: (id: string, next: ChartSettings) => void
  update: (op: (plots: KeyPlot[]) => KeyPlot[]) => void
}

const lineId = (run: string, key: string) => `${run}\u0001${key}`

/** A key plot: several metrics on one y axis. Colour is the run; each metric has its own line style. */
function KeyPlotPanelImpl(p: KeyPlotPanelProps) {
  const { plot } = p
  const settingsId = `${PLOT_ID}${plot.id}`
  const banded = p.settings.band !== "none"
  const bandQ = useQuery({
    queryKey: ["band", p.project, plot.keys, p.runs, p.xMode, p.smoothing, p.maxPoints, p.settings.window, p.revision],
    queryFn: ({ signal }) =>
      api.metrics(
        p.project,
        {
          runs: p.runs,
          keys: plot.keys,
          x: p.xMode,
          smoothing: p.smoothing,
          maxPoints: p.maxPoints,
          bands: plot.keys.map((k) => `${k}:${p.settings.window}`),
        },
        signal,
      ),
    enabled: banded && p.runs.length > 0,
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  })

  const { series, lines, logged } = useMemo(() => {
    const series: Record<string, SeriesXY | undefined> = {}
    const lines: LineSpec[] = []
    const logged = new Set<string>()
    for (const run of p.runs) {
      for (const key of plot.keys) {
        const s = (banded && bandQ.data?.series[run]?.[key]) || p.perKey.get(key)?.[run]
        if (s) logged.add(key)
        series[lineId(run, key)] = s
        lines.push({ id: lineId(run, key), color: runColor(p.colors, run), label: key, group: run, style: styleFor(plot, key) })
      }
    }
    return { series, lines, logged }
  }, [p.runs, p.perKey, p.colors, plot, banded, bandQ.data])

  const title = plotTitle(plot)
  return (
    <ChartCard
      title={title}
      heading={<PlotName plot={plot} update={p.update} />}
      series={series}
      lines={lines}
      colors={p.colors}
      xMode={p.xMode}
      logY={p.logY}
      syncId={p.syncId}
      settings={p.settings}
      onSettingsChange={(next) => p.onSettingsChange(settingsId, next)}
      actions={
        <>
          <AddMetric plot={plot} allKeys={p.allKeys} update={p.update} />
          <Button
            variant="ghost"
            size="icon"
            className="size-6 opacity-0 group-hover:opacity-100"
            title="Remove key plot"
            aria-label={`Remove key plot ${title}`}
            onClick={() => p.update((plots) => deletePlot(plots, plot.id))}
          >
            <X className="size-3.5" />
          </Button>
        </>
      }
      footer={<Legend plot={plot} logged={logged} update={p.update} />}
    />
  )
}

export const KeyPlotPanel = memo(KeyPlotPanelImpl)

/** The plot's name; click to rename (blank resets to the derived name). */
function PlotName({ plot, update }: { plot: KeyPlot; update: KeyPlotPanelProps["update"] }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState("")
  const title = plotTitle(plot)
  if (editing) {
    const commit = () => {
      update((plots) => renamePlot(plots, plot.id, text))
      setEditing(false)
    }
    return (
      <Input
        autoFocus
        value={text}
        aria-label="Key plot name"
        placeholder={plotTitle({ ...plot, title: null })}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") setEditing(false)
        }}
        className="h-6 max-w-64 px-1.5 font-mono text-[13px]"
      />
    )
  }
  return (
    <button
      type="button"
      className="truncate text-left font-mono text-[13px] font-semibold hover:text-primary"
      title="Rename"
      onClick={() => {
        setText(plot.title ?? "")
        setEditing(true)
      }}
    >
      {title}
    </button>
  )
}

/** Add any metric to this plot; the same metric may already sit in other plots. */
function AddMetric({ plot, allKeys, update }: { plot: KeyPlot; allKeys: string[]; update: KeyPlotPanelProps["update"] }) {
  const [q, setQ] = useState("")
  const needle = q.trim().toLowerCase()
  const candidates = allKeys.filter((k) => !plot.keys.includes(k) && k.toLowerCase().includes(needle)).slice(0, 200)
  return (
    <Popover onOpenChange={(o) => !o && setQ("")}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-6 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100" title="Add a metric" aria-label={`Add a metric to ${plotTitle(plot)}`}>
          <Plus className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2">
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter metrics" aria-label="Filter metrics" className="mb-2 h-7 text-xs" />
        <ul className="max-h-72 overflow-y-auto" role="listbox" aria-label="Metrics">
          {candidates.map((k) => (
            <li key={k}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                className="flex w-full rounded px-2 py-1 text-left hover:bg-accent"
                onClick={() => update((plots) => addKey(plots, plot.id, k))}
              >
                <MetricKey name={k} />
              </button>
            </li>
          ))}
          {candidates.length === 0 && <li className="px-2 py-1 text-xs text-muted-foreground">No other metrics match.</li>}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

/** One entry per metric, drawn in its line style; click to restyle or remove it from this plot. */
function Legend({ plot, logged, update }: { plot: KeyPlot; logged: Set<string>; update: KeyPlotPanelProps["update"] }) {
  return (
    <div className="mb-1.5 flex flex-wrap gap-x-1 gap-y-0.5" aria-label="Metrics in this plot">
      {plot.keys.map((key) => {
        const style = styleFor(plot, key)
        const missing = !logged.has(key)
        return (
          <Popover key={key}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn("flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-accent", missing && "opacity-45")}
                title={missing ? `${key}: not logged by the selected runs` : `${key}: change style or remove`}
              >
                <LineStyleSample style={style} />
                <MetricKey name={key} className="text-[11px]" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72">
              <StylePicker
                metric={key}
                style={style}
                onChange={(s) => update((plots) => setStyle(plots, plot.id, key, s))}
                onRemove={() => update((plots) => removeKey(plots, plot.id, key))}
              />
            </PopoverContent>
          </Popover>
        )
      })}
    </div>
  )
}

export function StylePicker({ metric, style, onChange, onRemove }: { metric: string; style: LineStyle; onChange: (s: LineStyle) => void; onRemove: () => void }) {
  const row = <T extends string>(label: string, values: readonly T[], value: T, set: (v: T) => LineStyle) => (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <ToggleGroup type="single" variant="outline" size="sm" value={value} onValueChange={(v) => v && onChange(set(v as T))} aria-label={label} className="flex-wrap">
        {values.map((v) => (
          <ToggleGroupItem key={v} value={v} aria-label={`${label} ${v}`} title={v} className="h-7 px-2">
            <LineStyleSample style={set(v)} width={24} />
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
  return (
    <div className="flex flex-col gap-3 text-xs">
      <MetricKey name={metric} className="text-xs" />
      {row("dash", DASHES, style.dash, (dash) => ({ ...style, dash }))}
      {row("marker", MARKERS, style.marker, (marker) => ({ ...style, marker }))}
      {row("thickness", WIDTHS, style.width, (width) => ({ ...style, width }))}
      <Button variant="ghost" size="sm" className="h-7 self-start px-2 text-xs text-destructive" onClick={onRemove}>
        Remove from this plot
      </Button>
    </div>
  )
}
