import { memo, useMemo } from "react"
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { runColor } from "@/lib/colors"
import { fmtDuration, fmtNum, fmtTick } from "@/lib/format"
import { mergeSeries } from "@/lib/series"
import type { SeriesXY, XMode } from "@/types"

export interface MetricChartProps {
  series: Record<string, SeriesXY | undefined> // run -> series
  colors: Record<string, string>
  xMode?: XMode
  logY?: boolean
  syncId?: string
  height?: number
  width?: number // when given, ResponsiveContainer is bypassed (tests)
  legend?: boolean
  brush?: boolean
  refX?: number | null
  refY?: number | null
  order?: string[]
}

interface TooltipPayloadItem {
  name?: string
  value?: number | null
  color?: string
}

function ChartTooltip({
  active,
  payload,
  label,
  xMode,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: number | string
  xMode: XMode
}) {
  if (!active || !payload?.length) return null
  const items = payload.filter((p) => p.value !== null && p.value !== undefined).sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  const x = typeof label === "number" ? label : Number(label)
  const head = xMode === "step" ? `step ${fmtTick(x)}` : xMode === "relative_time" ? fmtDuration(x) : new Date(x * 1000).toLocaleString()
  return (
    <div className="rounded-md border bg-popover px-2.5 py-2 text-xs shadow-md">
      <div className="mb-1 text-muted-foreground">{head}</div>
      {items.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-full" style={{ background: p.color }} />
          <span className="max-w-48 truncate font-mono">{p.name}</span>
          <span className="ml-auto font-mono tabular-nums">{fmtNum(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function MetricChartImpl({
  series,
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
}: MetricChartProps) {
  const runs = useMemo(() => order ?? Object.keys(series), [order, series])
  const data = useMemo(() => mergeSeries(series, logY), [series, logY])
  const xFmt = xMode === "relative_time" ? (v: number) => fmtDuration(v) : xMode === "wall_time" ? (v: number) => new Date(v * 1000).toLocaleTimeString() : fmtTick

  const chart = (
    <LineChart width={width} height={width ? height : undefined} data={data} syncId={syncId} margin={{ top: 8, right: 12, bottom: brush ? 4 : 0, left: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
      <XAxis
        dataKey="x"
        type="number"
        domain={["dataMin", "dataMax"]}
        tickFormatter={xFmt}
        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
        stroke="var(--border)"
        minTickGap={24}
      />
      <YAxis
        scale={logY ? "log" : "auto"}
        domain={["auto", "auto"]}
        allowDataOverflow={logY}
        tickFormatter={fmtTick}
        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
        stroke="var(--border)"
        width={52}
      />
      <Tooltip content={<ChartTooltip xMode={xMode} />} isAnimationActive={false} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "2 2" }} />
      {legend && <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />}
      {refX !== null && refX !== undefined && <ReferenceLine x={refX} stroke="var(--muted-foreground)" strokeDasharray="4 4" />}
      {refY !== null && refY !== undefined && <ReferenceLine y={refY} stroke="var(--muted-foreground)" strokeDasharray="4 4" />}
      {runs.map((run) => (
        <Line
          key={run}
          type="linear"
          dataKey={run}
          name={run}
          stroke={runColor(colors, run)}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3 }}
          connectNulls
          isAnimationActive={false}
        />
      ))}
      {brush && <Brush dataKey="x" height={20} stroke="var(--muted-foreground)" tickFormatter={xFmt} travellerWidth={8} />}
    </LineChart>
  )

  if (width) {
    return <div style={{ width, height }}>{chart}</div>
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      {chart}
    </ResponsiveContainer>
  )
}

export const MetricChart = memo(MetricChartImpl)
