import { memo, useMemo, useState } from "react"
import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { LineStyleSample, MarkerShape } from "@/components/charts/LineStyleSample"
import { RunSwatch } from "@/components/RunSwatch"
import { DEFAULT_CHART_SETTINGS, axisDomain, type ChartSettings } from "@/lib/chart-settings"
import { runColor } from "@/lib/colors"
import { fmtDuration, fmtInt, fmtNum, fmtTick } from "@/lib/format"
import { DASH_ARRAY, WIDTH_PX, type LineStyle } from "@/lib/key-plots"
import { bandField, mergeSeries, tooltipRows, type LineSpec, type TooltipRow } from "@/lib/series"
import { cn } from "@/lib/utils"
import type { SeriesXY, XMode } from "@/types"

export type { LineSpec } // defined in lib/series; without `lines`, a chart draws one solid line per run

export interface MetricChartProps {
  series: Record<string, SeriesXY | undefined> // line id (run, unless `lines` says otherwise) -> series
  lines?: LineSpec[]
  colors: Record<string, string>
  xMode?: XMode
  logY?: boolean
  syncId?: string
  height?: number | "fill" // "fill": take the parent's full height (the parent must have one)
  width?: number // when given, ResponsiveContainer is bypassed (tests)
  legend?: boolean
  brush?: boolean
  refX?: number | null
  refY?: number | null
  order?: string[]
  settings?: ChartSettings // band and axis limits
}

const TICK = { fontSize: 10, fill: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }

function ChartTooltip({
  active,
  label,
  xMode,
  lines,
  series,
}: {
  active?: boolean
  label?: number | string
  xMode: XMode
  lines: LineSpec[]
  series: Record<string, SeriesXY | undefined>
}) {
  if (!active || label === undefined) return null
  const x = typeof label === "number" ? label : Number(label)
  const rows = tooltipRows(lines, series, x)
  if (rows.length === 0) return null
  // Exact steps here (ticks may round to 3 significant figures; a tooltip must not).
  const fmtX = (v: number) => (xMode === "step" ? fmtInt(v) : xMode === "relative_time" ? fmtDuration(v) : new Date(v * 1000).toLocaleTimeString())
  const head = xMode === "step" ? `step ${fmtInt(x)}` : xMode === "relative_time" ? fmtDuration(x) : new Date(x * 1000).toLocaleString()
  const grouped = rows.some((r) => r.group !== undefined)
  // Grouped (key plots): one block per run, a row per metric with its line style.
  const groups = new Map<string, TooltipRow[]>()
  for (const r of rows) {
    const g = grouped ? (r.group ?? "") : ""
    groups.set(g, [...(groups.get(g) ?? []), r])
  }
  return (
    <div className="min-w-44 rounded-md border bg-popover px-2.5 py-2 font-mono text-[11px] shadow-lg">
      <div className="mb-1.5 border-b pb-1 text-muted-foreground">{head}</div>
      {[...groups.entries()].map(([g, groupRows]) => (
        <div key={g} className={grouped ? "mb-1 last:mb-0" : undefined}>
          {grouped && (
            <div className="flex items-center gap-2 leading-5">
              <RunSwatch color={groupRows[0].color} />
              <span className="max-w-48 truncate font-medium">{g}</span>
            </div>
          )}
          {groupRows.map((r) => (
            <div key={r.id} className={cn("flex items-center gap-2 leading-5", grouped && "pl-5")}>
              {grouped && r.style ? <LineStyleSample style={r.style} color={r.color} width={22} /> : <RunSwatch color={r.color} />}
              <span className="max-w-48 truncate">{r.label}</span>
              <span className="ml-auto pl-3 font-medium tabular-nums">{fmtNum(r.value)}</span>
              {/* Not logged exactly here: the nearest logged point, with where it is. */}
              <span className={cn("w-12 text-right text-[10px] text-muted-foreground tabular-nums", r.exact && "invisible")} title={r.exact ? undefined : "nearest logged point"}>
                @{fmtX(r.at)}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** Dots drawn every `every` points in a marker shape, so styled lines stay distinguishable without clutter. */
function markerDot(style: LineStyle | undefined, color: string, every: number, lone: boolean) {
  if (lone) return { r: 2.5, strokeWidth: 0, fill: color } // lone points would be invisible as lines
  if (!style || style.marker === "none") return false
  return (props: { cx?: number; cy?: number; index?: number; value?: unknown }) => {
    const { cx, cy, index = 0, value } = props
    if (cx === undefined || cy === undefined || value === null || value === undefined || index % every !== 0) return <g key={index} />
    return (
      <g key={index}>
        <MarkerShape marker={style.marker} cx={cx} cy={cy} r={2.6} color={color} />
      </g>
    )
  }
}

function MetricChartImpl({
  series,
  lines: lineSpecs,
  colors,
  xMode = "step",
  logY = false,
  syncId,
  height = 220,
  width,
  legend = false,
  brush = false,
  refX,
  refY,
  order,
  settings = DEFAULT_CHART_SETTINGS,
}: MetricChartProps) {
  const lines = useMemo<LineSpec[]>(
    () => lineSpecs ?? (order ?? Object.keys(series)).map((run) => ({ id: run, color: runColor(colors, run), label: run })),
    [lineSpecs, order, series, colors],
  )
  const data = useMemo(() => mergeSeries(series, logY, settings.band), [series, logY, settings.band])
  const markerEvery = Math.max(1, Math.round(data.length / 14))
  const xFmt = xMode === "relative_time" ? (v: number) => fmtDuration(v) : xMode === "wall_time" ? (v: number) => new Date(v * 1000).toLocaleTimeString() : fmtTick
  const xAxis = axisDomain(settings.xMin, settings.xMax, ["dataMin", "dataMax"])
  const yLow = logY && settings.yMin !== null && settings.yMin <= 0 ? null : settings.yMin // log axes need a positive floor
  const yAxis = axisDomain(yLow, settings.yMax, ["auto", "auto"])
  const [hovered, setHovered] = useState(false)
  const hover = { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) }

  const chart = (
    <ComposedChart width={width} height={width && typeof height === "number" ? height : undefined} data={data} syncId={syncId} margin={{ top: 8, right: 12, bottom: brush ? 4 : 0, left: 0 }}>
      <CartesianGrid stroke="var(--rule)" strokeOpacity={0.7} vertical={false} />
      <XAxis
        dataKey="x"
        type="number"
        domain={xAxis.domain}
        allowDataOverflow={xAxis.clip}
        tickFormatter={xFmt}
        tick={TICK}
        stroke="var(--rule)"
        tickLine={false}
        minTickGap={24}
      />
      <YAxis
        scale={logY ? "log" : "auto"}
        domain={yAxis.domain}
        allowDataOverflow={logY || yAxis.clip}
        tickFormatter={fmtTick}
        tick={TICK}
        stroke="var(--rule)"
        tickLine={false}
        width={52}
      />
      {/* Synced charts share the cursor line; only the chart under the mouse draws a tooltip. */}
      <Tooltip content={hovered ? <ChartTooltip xMode={xMode} lines={lines} series={series} /> : () => null} isAnimationActive={false} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "2 2" }} />
      {legend && <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono)" }} iconType="plainline" iconSize={14} />}
      {refX !== null && refX !== undefined && <ReferenceLine x={refX} stroke="var(--muted-foreground)" strokeDasharray="4 4" />}
      {refY !== null && refY !== undefined && <ReferenceLine y={refY} stroke="var(--muted-foreground)" strokeDasharray="4 4" />}
      {settings.band !== "none" &&
        lines.map((l) => (
          <Area
            key={bandField(l.id)}
            type="linear"
            dataKey={bandField(l.id)}
            stroke="none"
            fill={l.color}
            fillOpacity={lines.length > 4 ? 0.1 : 0.18}
            connectNulls
            activeDot={false}
            tooltipType="none"
            legendType="none"
            isAnimationActive={false}
          />
        ))}
      {lines.map((l) => (
        <Line
          key={l.id}
          type="linear"
          dataKey={l.id}
          name={l.label}
          stroke={l.color}
          strokeWidth={l.style ? WIDTH_PX[l.style.width] : 1.75}
          strokeDasharray={l.style ? DASH_ARRAY[l.style.dash] : undefined}
          dot={markerDot(l.style, l.color, markerEvery, data.length <= 2)}
          activeDot={{ r: 3 }}
          connectNulls
          isAnimationActive={false}
        />
      ))}
      {brush && <Brush dataKey="x" height={20} stroke="var(--muted-foreground)" tickFormatter={xFmt} travellerWidth={8} />}
    </ComposedChart>
  )

  const fill = height === "fill"
  if (width) {
    return (
      <div style={{ width, height: fill ? "100%" : height }} {...hover}>
        {chart}
      </div>
    )
  }
  return (
    <div className={fill ? "h-full min-h-0" : undefined} {...hover}>
      <ResponsiveContainer width="100%" height={fill ? "100%" : height}>
        {chart}
      </ResponsiveContainer>
    </div>
  )
}

export const MetricChart = memo(MetricChartImpl)
