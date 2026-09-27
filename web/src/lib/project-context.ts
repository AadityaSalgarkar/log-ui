import { createContext, useContext } from "react"

import type { RunInfo, ViewSpec } from "@/types"

export interface ProjectContextValue {
  project: string
  runs: RunInfo[]
  colors: Record<string, string>
  selected: string[] // names of selected runs
  setSelected: (names: string[]) => void
  views: ViewSpec[]
  isLoading: boolean
}

/**
 * A string that changes exactly when any of the named runs logs new rows. Metric queries key on it instead of
 * polling on a timer, so charts refetch and redraw only when there is something new to draw.
 */
export function runsRevision(runs: RunInfo[], names: string[]): string {
  const wanted = new Set(names)
  return runs
    .filter((r) => wanted.has(r.name))
    .map((r) => `${r.name}:${r.n_rows}:${r.last_step ?? ""}`)
    .sort()
    .join("|")
}

export const ProjectContext = createContext<ProjectContextValue | null>(null)

export function useProject(): ProjectContextValue {
  const v = useContext(ProjectContext)
  if (!v) throw new Error("useProject outside ProjectContext")
  return v
}
