import { useParams } from "react-router"
import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { Panels } from "@/components/views/Panels"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useUrlState } from "@/hooks/use-url-state"
import { api } from "@/lib/api"
import { useProject } from "@/lib/project-context"

export default function ViewPage() {
  const { project, colors, selected, views, runs } = useProject()
  const { viewId = "" } = useParams()
  const [state, update] = useUrlState()
  const spec = views.find((v) => v.id === viewId)
  const anyRunning = runs.some((r) => selected.includes(r.name) && r.status === "running")
  const q = useQuery({
    queryKey: ["view", project, viewId, [...selected].sort(), state.metric, state.point],
    queryFn: () => api.view(project, viewId, { runs: selected, metric: state.metric, point: state.point }),
    enabled: selected.length > 0 && !!viewId,
    placeholderData: keepPreviousData,
    refetchInterval: anyRunning ? 10_000 : false,
  })
  const metric = q.data?.metric ?? state.metric ?? spec?.default_metric ?? null
  const metricLabel = spec?.metrics.find((m) => m.id === metric)?.label ?? metric ?? undefined

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-lg font-semibold">{spec?.title ?? viewId}</h1>
          {spec?.description && <p className="text-xs text-muted-foreground">{spec.description}</p>}
        </div>
        {spec && spec.metrics.length > 0 && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">metric</Label>
            <Select value={metric ?? undefined} onValueChange={(v) => update({ metric: v })}>
              <SelectTrigger size="sm" className="h-7 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {spec.metrics.map((m) => (
                  <SelectItem key={m.id} value={m.id} title={m.help}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {spec && spec.points.length > 1 && (
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">point</Label>
            <ToggleGroup type="single" size="sm" value={state.point} onValueChange={(v) => v && update({ point: v as "last" | "best" })}>
              <ToggleGroupItem value="last" className="h-7 text-xs">last</ToggleGroupItem>
              <ToggleGroupItem value="best" className="h-7 text-xs" title={spec.best_key ? `argmin ${spec.best_key}` : ""}>
                best
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}
      </div>
      {!spec && views.length > 0 && <p className="text-sm text-destructive">Unknown view {viewId}</p>}
      {selected.length === 0 ? (
        <p className="text-sm text-muted-foreground">Select runs in the sidebar.</p>
      ) : q.isPending ? (
        <Skeleton className="h-80" />
      ) : q.isError ? (
        <p className="text-sm text-destructive">{(q.error as Error).message}</p>
      ) : (
        <Panels panels={q.data.panels} colors={colors} order={selected} metricLabel={metricLabel} />
      )}
    </div>
  )
}
