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

export const ProjectContext = createContext<ProjectContextValue | null>(null)

export function useProject(): ProjectContextValue {
  const v = useContext(ProjectContext)
  if (!v) throw new Error("useProject outside ProjectContext")
  return v
}
