import { RunsTable } from "@/components/runs/RunsTable"
import { useProject } from "@/lib/project-context"

export default function RunsPage() {
  const { project, runs, colors, selected, setSelected } = useProject()
  return <RunsTable project={project} runs={runs} colors={colors} selected={selected} onSelect={setSelected} />
}
