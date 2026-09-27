/** Per-chart display settings: an optional spread band and fixed axis limits. */

export type BandMode = "none" | "std" | "minmax"

export interface ChartSettings {
  band: BandMode
  xMin: number | null
  xMax: number | null
  yMin: number | null
  yMax: number | null
}

export const DEFAULT_CHART_SETTINGS: ChartSettings = { band: "none", xMin: null, xMax: null, yMin: null, yMax: null }

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
      xMin: finiteOrNull(v.xMin),
      xMax: finiteOrNull(v.xMax),
      yMin: finiteOrNull(v.yMin),
      yMax: finiteOrNull(v.yMax),
    }
  }
  return out
}

export function isDefault(s: ChartSettings): boolean {
  return s.band === "none" && s.xMin === null && s.xMax === null && s.yMin === null && s.yMax === null
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
