import type { SeriesXY } from "@/types"

export type Row = { x: number } & Record<string, number | null>

/** Merge per-run {x,y} series into rows keyed by x (union of all x values), null where a run has no point. */
export function mergeSeries(series: Record<string, SeriesXY | undefined>, logY = false): Row[] {
  const byX = new Map<number, Row>()
  for (const [run, s] of Object.entries(series)) {
    if (!s) continue
    for (let i = 0; i < s.x.length; i++) {
      const x = s.x[i]
      let y: number | null = s.y[i]
      if (logY && !(y > 0)) y = null
      let row = byX.get(x)
      if (!row) {
        row = { x }
        byX.set(x, row)
      }
      row[run] = y
    }
  }
  return [...byX.values()].sort((a, b) => a.x - b.x)
}

/** Group metric keys by their prefix ("train", "val", ...), keys without a prefix under "". */
export function groupKeys(keys: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>()
  for (const k of [...keys].sort()) {
    const i = k.indexOf("/")
    const prefix = i < 0 ? "" : k.slice(0, i)
    if (!groups.has(prefix)) groups.set(prefix, [])
    groups.get(prefix)!.push(k)
  }
  return groups
}

export function lastValue(s: SeriesXY | undefined): number | null {
  if (!s || s.y.length === 0) return null
  return s.y[s.y.length - 1]
}
