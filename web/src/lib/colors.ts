import type { RunInfo } from "@/types"

/** Tableau-10 plus two extras: distinct in light and dark themes. */
export const PALETTE = [
  "#4e79a7",
  "#f28e2b",
  "#e15759",
  "#76b7b2",
  "#59a14f",
  "#edc948",
  "#b07aa1",
  "#ff9da7",
  "#9c755f",
  "#bab0ac",
  "#1f77b4",
  "#17becf",
]

export const FALLBACK_COLOR = "#888888"

/** Stable color per run: assigned by creation order within the project, independent of the selection. */
export function colorMap(runs: Pick<RunInfo, "name" | "created_epoch">[]): Record<string, string> {
  const ordered = [...runs].sort((a, b) => a.created_epoch - b.created_epoch || a.name.localeCompare(b.name))
  const out: Record<string, string> = {}
  ordered.forEach((r, i) => {
    out[r.name] = PALETTE[i % PALETTE.length]
  })
  return out
}

export function runColor(map: Record<string, string>, name: string): string {
  return map[name] ?? FALLBACK_COLOR
}
