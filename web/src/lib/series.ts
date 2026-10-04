import type { BandMode } from "@/lib/chart-settings"
import type { LineStyle } from "@/lib/key-plots"
import type { SeriesBand, SeriesXY } from "@/types"

export type Row = { x: number } & Record<string, number | null | [number, number]>

/** Row field holding a run's band as [low, high]. */
export const bandField = (run: string) => `${run}\u0000band`

/** [low, high] per window: mean ± std, or min..max. */
export function bandRange(b: SeriesBand, mode: Exclude<BandMode, "none">, i: number): [number, number] {
  return mode === "std" ? [b.mean[i] - b.std[i], b.mean[i] + b.std[i]] : [b.min[i], b.max[i]]
}

/**
 * Merge per-run {x,y} series into rows keyed by x (union of all x values), null where a run has no point.
 * With a band mode, each run's band is added under `bandField(run)`; on a log axis the low edge is clipped to the
 * smallest positive value in the band and non-positive bands are dropped.
 */
export function mergeSeries(series: Record<string, SeriesXY | undefined>, logY = false, band: BandMode = "none"): Row[] {
  const byX = new Map<number, Row>()
  const rowAt = (x: number) => {
    let row = byX.get(x)
    if (!row) {
      row = { x }
      byX.set(x, row)
    }
    return row
  }
  for (const [run, s] of Object.entries(series)) {
    if (!s) continue
    for (let i = 0; i < s.x.length; i++) {
      const y = s.y[i]
      rowAt(s.x[i])[run] = logY && !(y > 0) ? null : y
    }
    if (band === "none" || !s.band) continue
    const b = s.band
    const ranges = b.x.map((_, i) => bandRange(b, band, i))
    const floor = logY ? Math.min(...ranges.flat().filter((v) => v > 0)) : -Infinity
    ranges.forEach(([lo, hi], i) => {
      if (logY && !(hi > 0)) return
      rowAt(b.x[i])[bandField(run)] = [Math.max(lo, floor), hi]
    })
  }
  return [...byX.values()].sort((a, b) => a.x - b.x)
}

/** One drawn line. Without explicit lines, a chart draws one solid line per run (series keyed by run). */
export interface LineSpec {
  id: string // key into the chart's series
  color: string
  label: string // tooltip / legend text, e.g. the metric
  group?: string // tooltip groups rows by this, e.g. the run
  style?: LineStyle
}

/**
 * The logged point nearest to `x`, by binary search over the series' sorted x. Never extrapolates: outside the
 * series' own range (a run that ended earlier, a metric that starts later) there is no value.
 */
export function nearestPoint(s: SeriesXY | undefined, x: number): { x: number; y: number } | null {
  if (!s || s.x.length === 0 || x < s.x[0] || x > s.x[s.x.length - 1]) return null
  let lo = 0
  let hi = s.x.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (s.x[mid] <= x) lo = mid
    else hi = mid
  }
  const i = Math.abs(s.x[hi] - x) < Math.abs(x - s.x[lo]) ? hi : lo
  return { x: s.x[i], y: s.y[i] }
}

export interface TooltipRow extends LineSpec {
  value: number
  at: number // x of the value shown
  exact: boolean // logged exactly at the cursor; otherwise the nearest point, shown with its x
}

/**
 * One row per line with a value near the cursor. Lines logged at different steps (train every step, val every
 * 100) or downsampled to different points still show, at their nearest logged point. Grouped charts (key plots)
 * keep line order; plain charts sort highest first.
 */
export function tooltipRows(lines: LineSpec[], series: Record<string, SeriesXY | undefined>, x: number): TooltipRow[] {
  const rows: TooltipRow[] = []
  for (const line of lines) {
    const p = nearestPoint(series[line.id], x)
    if (p && Number.isFinite(p.y)) rows.push({ ...line, value: p.y, at: p.x, exact: p.x === x })
  }
  return lines.some((l) => l.group !== undefined) ? rows : rows.sort((a, b) => b.value - a.value)
}

/** One group of metric keys: `path` is its key prefix ("loss/train"), `depth` how many segments that is. */
export interface KeyNode {
  name: string // last segment of the path; "" for the root
  path: string
  depth: number
  keys: string[] // charts directly in this group (their last segment is the chart name)
  children: KeyNode[] // sub-groups, after the direct charts
  total: number // charts in this group and all sub-groups
}

/**
 * Nest keys by their path segments: `loss/train/xent` lands in group loss → train, `loss/total` directly in loss.
 * Keys without a "/" stay on the root. Groups and keys sort alphabetically, except `train` leads the top level.
 */
export function buildKeyTree(keys: string[]): KeyNode {
  const root: KeyNode = { name: "", path: "", depth: 0, keys: [], children: [], total: 0 }
  for (const key of [...keys].sort()) {
    const segments = key.split("/")
    let node = root
    for (const name of segments.slice(0, -1)) {
      let child = node.children.find((c) => c.name === name)
      if (!child) {
        child = { name, path: node.path ? `${node.path}/${name}` : name, depth: node.depth + 1, keys: [], children: [], total: 0 }
        node.children.push(child)
      }
      node = child
    }
    node.keys.push(key)
  }
  const finish = (node: KeyNode): number => {
    node.children.sort((a, b) => (node.depth === 0 && a.name === "train" ? -1 : node.depth === 0 && b.name === "train" ? 1 : a.name.localeCompare(b.name)))
    node.total = node.keys.length + node.children.reduce((sum, c) => sum + finish(c), 0)
    return node.total
  }
  finish(root)
  return root
}

export function lastValue(s: SeriesXY | undefined): number | null {
  if (!s || s.y.length === 0) return null
  return s.y[s.y.length - 1]
}
