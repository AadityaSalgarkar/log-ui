// Mirrors the JSON returned by log_ui/api.py.

export interface ProjectInfo {
  name: string
  db_path: string
  n_runs: number
  updated_at: number
}

export type RunStatus = "running" | "finished"

export interface RunInfo {
  name: string
  run_id: string | null
  created_at: string
  created_epoch: number
  last_step: number | null
  last_logged_at: number | null
  status: RunStatus
  config: Record<string, unknown>
  summary: Record<string, number | null>
  n_rows: number
}

export interface RunDetail extends RunInfo {
  keys: string[]
  eval_steps: number[]
  system_keys: string[]
}

export interface KeyInfo {
  key: string
  prefix: string
  n_runs: number
}

export type XMode = "step" | "relative_time" | "wall_time"

export interface SeriesXY {
  x: number[]
  y: number[]
}

/** run -> key -> series */
export type SeriesMap = Record<string, Record<string, SeriesXY>>

export interface MetricsResponse {
  x: XMode
  smoothing: number
  last_id: number
  series: SeriesMap
}

export interface Category {
  id: string
  label: string
  group: string
  order: number
  meta: Record<string, unknown>
}

export interface MetricOption {
  id: string
  label: string
  help: string
}

export type PanelType = "ladder" | "heatmap" | "table" | "lines" | "stats"

export interface PanelSpec {
  type: PanelType
  title: string
  categories: Category[]
  key_template: unknown
  keys: string[]
  description: string
}

export interface ViewSpec {
  id: string
  title: string
  description: string
  panels: PanelSpec[]
  metrics: MetricOption[]
  default_metric: string | null
  best_key: string | null
  points: string[]
}

export interface ValuePanel {
  type: "ladder" | "heatmap" | "table" | "stats"
  title: string
  description?: string
  categories: Category[]
  keys: unknown[]
  series: Record<string, (number | null)[]>
  steps: Record<string, number | null>
  metric: string | null
  point: string
}

export interface LinesPanel {
  type: "lines"
  title: string
  keys: string[]
  categories: Category[]
  series: SeriesMap
}

export type Panel = ValuePanel | LinesPanel

export interface ResolvedView {
  spec: ViewSpec
  metric: string | null
  point: string
  panels: Panel[]
}

export interface Health {
  ok: boolean
  version: string
  store_dir: string
  trackio: string // supported trackio version range
  default_project: string | null
}
