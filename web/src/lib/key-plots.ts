/**
 * Key plots: charts at the top of the page that overlay one or more metrics on a shared y axis.
 *
 * Membership is many-to-many: a metric can be in any number of key plots (A+B, A+C and A+D at once), and a key
 * plot holds any number of metrics. Colour always means run; each metric in a plot gets a line style (dash,
 * marker, thickness), assigned automatically and overridable per plot.
 */

export type Dash = "solid" | "dashed" | "dotted" | "dashdot" | "longdash" | "dashdotdot"
export type Marker = "none" | "circle" | "square" | "triangle" | "diamond"
export type Width = "thin" | "regular" | "thick"

export interface LineStyle {
  dash: Dash
  marker: Marker
  width: Width
}

export interface KeyPlot {
  id: string
  title: string | null // null: derived from the keys (see plotTitle)
  keys: string[]
  styles: Record<string, LineStyle> // per-key overrides; keys without one use autoStyle(index)
}

export const DASHES: Dash[] = ["solid", "dashed", "dotted", "dashdot", "longdash", "dashdotdot"]
export const MARKERS: Marker[] = ["none", "circle", "square", "triangle", "diamond"]
export const WIDTHS: Width[] = ["thin", "regular", "thick"]

export const DASH_ARRAY: Record<Dash, string | undefined> = {
  solid: undefined,
  dashed: "6 4",
  dotted: "1.5 3",
  dashdot: "8 3 1.5 3",
  longdash: "14 5",
  dashdotdot: "8 3 1.5 3 1.5 3",
}
export const WIDTH_PX: Record<Width, number> = { thin: 1, regular: 1.75, thick: 2.75 }

/**
 * Style for the i-th metric of a plot: dash patterns first (6 of them), then the same dashes again with each
 * marker, so the first 30 metrics all look different while the run colour stays fixed.
 */
export function autoStyle(index: number): LineStyle {
  const dash = DASHES[index % DASHES.length]
  const marker = MARKERS[Math.floor(index / DASHES.length) % MARKERS.length]
  return { dash, marker, width: "regular" }
}

export function styleFor(plot: KeyPlot, key: string): LineStyle {
  return plot.styles[key] ?? autoStyle(Math.max(0, plot.keys.indexOf(key)))
}

export const styleId = (s: LineStyle) => `${s.dash}/${s.marker}/${s.width}`

/** The plot's name: its own title, else the leaf all its keys share ("train/loss" + "val/loss" -> "loss"), else the keys. */
export function plotTitle(plot: KeyPlot): string {
  if (plot.title) return plot.title
  const leaves = new Set(plot.keys.map((k) => k.split("/").pop()!))
  if (plot.keys.length > 1 && leaves.size === 1) return [...leaves][0]
  return plot.keys.join(" + ")
}

// --- operations (pure; the hook persists the result) ---

let counter = 0
export function newId(): string {
  counter += 1
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function addPlot(plots: KeyPlot[], key: string, id = newId()): KeyPlot[] {
  return [...plots, { id, title: null, keys: [key], styles: {} }]
}

/** Add `key` to plot `id` (no-op if already there): the same key may sit in many plots. */
export function addKey(plots: KeyPlot[], id: string, key: string): KeyPlot[] {
  return plots.map((p) => (p.id === id && !p.keys.includes(key) ? { ...p, keys: [...p.keys, key] } : p))
}

/** Remove `key` from plot `id`; a plot left with no keys is dropped. */
export function removeKey(plots: KeyPlot[], id: string, key: string): KeyPlot[] {
  return plots
    .map((p) => {
      if (p.id !== id) return p
      const styles = { ...p.styles }
      delete styles[key]
      return { ...p, keys: p.keys.filter((k) => k !== key), styles }
    })
    .filter((p) => p.keys.length > 0)
}

export function toggleKey(plots: KeyPlot[], id: string, key: string): KeyPlot[] {
  const plot = plots.find((p) => p.id === id)
  return plot?.keys.includes(key) ? removeKey(plots, id, key) : addKey(plots, id, key)
}

export function renamePlot(plots: KeyPlot[], id: string, title: string): KeyPlot[] {
  const t = title.trim()
  return plots.map((p) => (p.id === id ? { ...p, title: t || null } : p))
}

export function setStyle(plots: KeyPlot[], id: string, key: string, style: LineStyle): KeyPlot[] {
  return plots.map((p) => (p.id === id ? { ...p, styles: { ...p.styles, [key]: style } } : p))
}

export function deletePlot(plots: KeyPlot[], id: string): KeyPlot[] {
  return plots.filter((p) => p.id !== id)
}

export const plotsWith = (plots: KeyPlot[], key: string) => plots.filter((p) => p.keys.includes(key))

// --- storage ---

const isStyle = (s: unknown): s is LineStyle => {
  const v = s as Partial<LineStyle> | null
  return !!v && DASHES.includes(v.dash as Dash) && MARKERS.includes(v.marker as Marker) && WIDTHS.includes(v.width as Width)
}

/** Tolerant parse: malformed plots or styles are dropped, never thrown. */
export function parsePlots(raw: string | null): KeyPlot[] | null {
  if (raw === null) return null
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  const out: KeyPlot[] = []
  for (const v of data as Record<string, unknown>[]) {
    if (!v || typeof v !== "object" || typeof v.id !== "string" || !Array.isArray(v.keys)) continue
    const keys = [...new Set((v.keys as unknown[]).filter((k): k is string => typeof k === "string" && k !== ""))]
    if (keys.length === 0) continue
    const styles: Record<string, LineStyle> = {}
    for (const [k, s] of Object.entries((v.styles as Record<string, unknown>) ?? {})) if (keys.includes(k) && isStyle(s)) styles[k] = s
    out.push({ id: v.id, title: typeof v.title === "string" && v.title.trim() ? v.title : null, keys, styles })
  }
  return out
}

/** Pins from before key plots (a JSON list of keys) become one single-metric plot each. */
export function migratePins(raw: string | null): KeyPlot[] {
  try {
    const keys = JSON.parse(raw ?? "[]") as unknown
    if (!Array.isArray(keys)) return []
    return keys.filter((k): k is string => typeof k === "string" && k !== "").map((k) => ({ id: `pin-${k}`, title: null, keys: [k], styles: {} }))
  } catch {
    return []
  }
}
