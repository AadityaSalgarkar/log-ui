import type { XMode } from "@/types"

/** Workspace/view state that lives in the URL so links are shareable. */
export interface WsState {
  runs: string[] | null // null = "all runs" (not yet chosen explicitly)
  x: XMode
  smoothing: number
  logy: boolean
  maxPoints: number
  q: string
  metric: string | null
  point: "last" | "best"
}

export const DEFAULTS: WsState = {
  runs: null,
  x: "step",
  smoothing: 0,
  logy: false,
  maxPoints: 1000,
  q: "",
  metric: null,
  point: "last",
}

const X_MODES: XMode[] = ["step", "relative_time", "wall_time"]

export function parseState(sp: URLSearchParams): WsState {
  const runs = sp.get("runs")
  const x = sp.get("x")
  const sm = Number(sp.get("smoothing"))
  const mp = Number(sp.get("max_points"))
  const point = sp.get("point")
  return {
    runs: runs === null ? null : runs.split(",").filter(Boolean),
    x: X_MODES.includes(x as XMode) ? (x as XMode) : DEFAULTS.x,
    smoothing: Number.isFinite(sm) && sm >= 0 && sm < 1 ? sm : DEFAULTS.smoothing,
    logy: sp.get("logy") === "1",
    maxPoints: Number.isInteger(mp) && mp >= 0 && sp.get("max_points") !== null ? mp : DEFAULTS.maxPoints,
    q: sp.get("q") ?? "",
    metric: sp.get("metric"),
    point: point === "best" ? "best" : "last",
  }
}

export const POINT_PRESETS = [200, 500, 1000, 2000, 5000]

/** Points per series: a positive whole number, or "all"/0 for every logged point; undefined when invalid. */
export function parsePoints(text: string): number | undefined {
  const t = text.trim().toLowerCase().replace(/[,_\s]/g, "")
  if (t === "all" || t === "0") return 0
  if (!/^\d+$/.test(t)) return undefined
  const n = Number(t)
  return n >= 1 && n <= 1_000_000 ? n : undefined
}

export const formatPoints = (n: number) => (n === 0 ? "all" : String(n))

/** Writes only non-default values so URLs stay short. Unrelated params in `base` are preserved. */
export function stateToParams(state: WsState, base?: URLSearchParams): URLSearchParams {
  const sp = new URLSearchParams(base)
  const set = (k: string, v: string | null) => (v === null ? sp.delete(k) : sp.set(k, v))
  set("runs", state.runs === null ? null : state.runs.join(","))
  set("x", state.x === DEFAULTS.x ? null : state.x)
  set("smoothing", state.smoothing === DEFAULTS.smoothing ? null : String(state.smoothing))
  set("logy", state.logy ? "1" : null)
  set("max_points", state.maxPoints === DEFAULTS.maxPoints ? null : String(state.maxPoints))
  set("q", state.q ? state.q : null)
  set("metric", state.metric)
  set("point", state.point === "last" ? null : state.point)
  return sp
}
