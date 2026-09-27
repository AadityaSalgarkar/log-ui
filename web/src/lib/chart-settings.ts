/** Per-chart display settings: an optional spread band and fixed axis limits. */

export type BandMode = "none" | "std" | "minmax"

export interface ChartSettings {
  band: BandMode
  window: number // raw points per band window, centred on each plotted point
  xMin: number | null
  xMax: number | null
  yMin: number | null
  yMax: number | null
}

export const DEFAULT_WINDOW = 10
export const MAX_WINDOW = 10_000 // mirrors log_ui.series.MAX_BAND_WINDOW

export const DEFAULT_CHART_SETTINGS: ChartSettings = { band: "none", window: DEFAULT_WINDOW, xMin: null, xMax: null, yMin: null, yMax: null }

/** A band window: a whole number of raw points in [1, MAX_WINDOW]; undefined when invalid. */
export function parseWindow(text: string): number | undefined {
  const t = text.trim()
  if (!/^\d+$/.test(t)) return undefined
  const n = Number(t)
  return n >= 1 && n <= MAX_WINDOW ? n : undefined
}

export type ChartSettingsMap = Record<string, ChartSettings>

const BAND_MODES: BandMode[] = ["none", "std", "minmax"]

const finiteOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null)

/** Tolerant parse of stored settings: unknown ids are kept, malformed fields fall back to defaults. */
export function parseChartSettings(raw: string | null): ChartSettingsMap {
  let data: unknown
  try {
    data = JSON.parse(raw ?? "{}")
  } catch {
    return {}
  }
  if (!data || typeof data !== "object") return {}
  const out: ChartSettingsMap = {}
  for (const [id, v] of Object.entries(data as Record<string, Record<string, unknown>>)) {
    if (!v || typeof v !== "object") continue
    out[id] = {
      band: BAND_MODES.includes(v.band as BandMode) ? (v.band as BandMode) : "none",
      window: parseWindow(String(v.window ?? "")) ?? DEFAULT_WINDOW,
      xMin: finiteOrNull(v.xMin),
      xMax: finiteOrNull(v.xMax),
      yMin: finiteOrNull(v.yMin),
      yMax: finiteOrNull(v.yMax),
    }
  }
  return out
}

export function isDefault(s: ChartSettings): boolean {
  return s.band === "none" && s.window === DEFAULT_WINDOW && s.xMin === null && s.xMax === null && s.yMin === null && s.yMax === null
}

/** "" clears a limit (null); text that is not a finite number is invalid (undefined). */
export function parseLimit(text: string): number | null | undefined {
  const t = text.trim()
  if (t === "") return null
  const v = Number(t)
  return Number.isFinite(v) ? v : undefined
}

export type AxisBound = number | "auto" | "dataMin" | "dataMax"

/** Axis domain with optional fixed ends; a fixed end clips data outside it. */
export function axisDomain(lo: number | null, hi: number | null, fallback: [AxisBound, AxisBound]): { domain: [AxisBound, AxisBound]; clip: boolean } {
  return { domain: [lo ?? fallback[0], hi ?? fallback[1]], clip: lo !== null || hi !== null }
}

/** Ids whose charts need band data from the API. */
export function bandIds(map: ChartSettingsMap, ids: string[]): string[] {
  return ids.filter((id) => (map[id]?.band ?? "none") !== "none").sort()
}

/** Settings ids: metric charts use the bare key; system and view charts are namespaced. */
export const SYSTEM_ID = "system:"
export const VIEW_ID = "view:"

/** Band requests as the API's `key:window` entries, split by the endpoint that serves the key. */
export function bandRequests(map: ChartSettingsMap): { metrics: string[]; system: string[] } {
  const ids = bandIds(map, Object.keys(map))
  const spec = (key: string, id: string) => `${key}:${map[id].window}`
  return {
    metrics: ids.filter((id) => !id.startsWith(SYSTEM_ID) && !id.startsWith(VIEW_ID)).map((id) => spec(id, id)),
    system: ids.filter((id) => id.startsWith(SYSTEM_ID)).map((id) => spec(id.slice(SYSTEM_ID.length), id)),
  }
}
