import { useMemo } from "react"

import { cellColor } from "@/lib/colors"
import { fmtNum } from "@/lib/format"
import type { Category } from "@/types"

export interface HeatmapProps {
  categories: Category[]
  series: Record<string, (number | null)[]>
  diverging?: boolean // color around zero (gap-like metrics)
}

export function Heatmap({ categories, series, diverging = false }: HeatmapProps) {
  const runs = Object.keys(series)
  const [lo, hi] = useMemo(() => {
    const vals = runs.flatMap((r) => series[r].filter((v): v is number => v !== null && Number.isFinite(v)))
    return vals.length ? [Math.min(...vals), Math.max(...vals)] : [0, 1]
  }, [runs, series])
  return (
    <div className="overflow-x-auto">
      <table className="text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-card pr-2 text-left font-medium">run</th>
            {categories.map((c) => (
              <th key={c.id} className="px-1 pb-1 text-center font-normal text-muted-foreground" title={String(c.meta?.relation ?? "")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run}>
              <td className="sticky left-0 bg-card pr-2 font-mono whitespace-nowrap">{run}</td>
              {series[run].map((v, i) => (
                <td key={categories[i]?.id ?? i} className="p-0.5">
                  <div
                    className="flex h-8 min-w-14 items-center justify-center rounded-sm font-mono tabular-nums"
                    style={{ background: cellColor(v, lo, hi, diverging) }}
                    title={`${run} · ${categories[i]?.label}: ${fmtNum(v)}`}
                  >
                    {fmtNum(v, 3)}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
