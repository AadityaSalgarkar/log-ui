import type {
  Health,
  KeyInfo,
  MetricsResponse,
  ProjectInfo,
  ResolvedView,
  RunDetail,
  RunInfo,
  ViewSpec,
  XMode,
} from "@/types"

const BASE = "/api"

type Params = Record<string, string | number | boolean | undefined | null>

function qs(params?: Params): string {
  if (!params) return ""
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ""
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit, params?: Params): Promise<T> {
  const res = await fetch(`${BASE}${path}${qs(params)}`, init)
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = (await res.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, detail)
  }
  return (await res.json()) as T
}

const enc = encodeURIComponent

export interface MetricsQuery {
  runs: string[]
  keys?: string[]
  x?: XMode
  smoothing?: number
  maxPoints?: number
  bands?: string[] // "key:window" entries: rolling mean/std/min/max over window raw points
}

export const api = {
  health: () => request<Health>("/health"),
  projects: () => request<ProjectInfo[]>("/projects"),
  runs: (project: string, signal?: AbortSignal) => request<RunInfo[]>(`/projects/${enc(project)}/runs`, { signal }),
  run: (project: string, run: string) => request<RunDetail>(`/projects/${enc(project)}/runs/${enc(run)}`),
  keys: (project: string) => request<KeyInfo[]>(`/projects/${enc(project)}/keys`),
  metrics: (project: string, q: MetricsQuery, signal?: AbortSignal) =>
    request<MetricsResponse>(`/projects/${enc(project)}/metrics`, { signal }, {
      runs: q.runs.join(","),
      keys: q.keys?.join(","),
      x: q.x,
      smoothing: q.smoothing,
      max_points: q.maxPoints,
      bands: q.bands?.join(","),
    }),
  system: (project: string, runs: string[], maxPoints?: number, bands?: string[]) =>
    request<MetricsResponse>(`/projects/${enc(project)}/system`, undefined, {
      runs: runs.join(","),
      max_points: maxPoints,
      bands: bands?.join(","),
    }),
  views: (project: string) => request<ViewSpec[]>(`/projects/${enc(project)}/views`),
  view: (project: string, id: string, q: { runs: string[]; metric?: string | null; point?: string }) =>
    request<ResolvedView>(`/projects/${enc(project)}/views/${enc(id)}`, undefined, {
      runs: q.runs.join(","),
      metric: q.metric ?? undefined,
      point: q.point,
    }),
}
