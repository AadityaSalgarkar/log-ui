import { useMemo } from "react"
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { runColor } from "@/lib/colors"
import { fmtNum, fmtTick } from "@/lib/format"
import type { Category } from "@/types"

export interface LadderChartProps {
  categories: Category[]
  series: Record<string, (number | null)[]> // run -> value per category
  colors: Record<string, string>
  yLabel?: string
  height?: number
  width?: number
}

type Row = { cat: string; id: string; meta: Record<string, unknown> } & Record<string, unknown>

interface TooltipItem {
  name?: string
  value?: number | null
  color?: string
  payload?: Row
}

function LadderTooltip({ active, payload }: { active?: boolean; payload?: TooltipItem[] }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  const items = payload.filter((p) => p.value !== null && p.value !== undefined)
  const meta = row?.meta ?? {}
  return (
    <div className="rounded-md border bg-popover px-2.5 py-2 text-xs shadow-md">
      <div className="font-medium">{row?.cat}</div>
      {Object.keys(meta).length > 0 && (
        <div className="mb-1 text-muted-foreground">
          {Object.entries(meta)
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join(" · ")}
        </div>
      )}
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

export function LadderChart({ categories, series, colors, yLabel, height = 360, width }: LadderChartProps) {
  const runs = Object.keys(series)
  const data = useMemo<Row[]>(
    () =>
      categories.map((c, i) => {
        const row: Row = { cat: c.label, id: c.id, meta: c.meta }
        for (const run of runs) row[run] = series[run]?.[i] ?? null
        return row
      }),
    [categories, series, runs],
  )
  const chart = (
    <LineChart width={width} height={width ? height : undefined} data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
      <XAxis dataKey="cat" type="category" interval={0} angle={-30} textAnchor="end" height={64} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
      <YAxis
        domain={["auto", "auto"]}
        tickFormatter={fmtTick}
        tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
        stroke="var(--border)"
        width={56}
        label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", fontSize: 10, fill: "var(--muted-foreground)" } : undefined}
      />
      <Tooltip content={<LadderTooltip />} isAnimationActive={false} />
      <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
      {runs.map((run) => (
        <Line key={run} type="linear" dataKey={run} name={run} stroke={runColor(colors, run)} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
      ))}
    </LineChart>
  )
  if (width) return <div style={{ width, height }}>{chart}</div>
  return (
    <ResponsiveContainer width="100%" height={height}>
      {chart}
    </ResponsiveContainer>
  )
}
