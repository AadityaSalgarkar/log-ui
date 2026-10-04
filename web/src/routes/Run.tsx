import { useMemo, useState } from "react"
import { useParams } from "react-router"
import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { ChartCard } from "@/components/charts/ChartCard"
import { MetricPanel } from "@/components/charts/MetricPanel"
import { KeyGroups } from "@/components/KeyGroups"
import { RunSwatch } from "@/components/RunSwatch"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { settingsFor, useChartSettings } from "@/hooks/use-chart-settings"
import { useGroupState } from "@/hooks/use-group-state"
import { useUrlState } from "@/hooks/use-url-state"
import { api } from "@/lib/api"
import { SYSTEM_ID, bandRequests, type ChartSettings } from "@/lib/chart-settings"
import { fmtDate, fmtDuration, fmtInt, fmtNum } from "@/lib/format"
import { runsRevision, useProject } from "@/lib/project-context"
import { buildKeyTree } from "@/lib/series"


function KeyValueTable({ rows, filter }: { rows: [string, unknown][]; filter: string }) {
  const needle = filter.toLowerCase()
  const shown = rows.filter(([k, v]) => !needle || k.toLowerCase().includes(needle) || String(v).toLowerCase().includes(needle))
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-xs">key</TableHead>
          <TableHead className="text-xs">value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shown.map(([k, v]) => (
          <TableRow key={k}>
            <TableCell className="font-mono text-xs">{k}</TableCell>
            <TableCell className="font-mono text-xs tabular-nums">{typeof v === "number" ? fmtNum(v) : v === null ? "null" : String(v)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default function RunPage() {
  const { project, colors, runs } = useProject()
  const { run = "" } = useParams()
  const [state] = useUrlState()
  const [filter, setFilter] = useState("")
  const [chartSettings, setChartSettings] = useChartSettings(project)
  const sysBands = useMemo(() => bandRequests(chartSettings).system, [chartSettings])
  const revision = useMemo(() => runsRevision(runs, [run]), [runs, run])
  const runOnly = useMemo(() => [run], [run])
  // Keyed on the run's revision (from the polled runs list) instead of a timer: refetch only when it logs new rows.
  const detail = useQuery({ queryKey: ["run", project, run, revision], queryFn: () => api.run(project, run), placeholderData: keepPreviousData, staleTime: Infinity })
  const metrics = useQuery({
    queryKey: ["metrics", project, runOnly, state.x, state.smoothing, state.maxPoints, revision],
    queryFn: ({ signal }) => api.metrics(project, { runs: runOnly, x: state.x, smoothing: state.smoothing, maxPoints: state.maxPoints }, signal),
    placeholderData: keepPreviousData,
    staleTime: Infinity,
  })
  const system = useQuery({
    queryKey: ["system", project, run, sysBands],
    queryFn: () => api.system(project, [run], undefined, sysBands),
    placeholderData: keepPreviousData,
    enabled: (detail.data?.system_keys.length ?? 0) > 0,
  })
  const chartProps = (id: string) => ({ settings: settingsFor(chartSettings, id), onSettingsChange: (next: ChartSettings) => setChartSettings(id, next) })
  const perKey = useMemo(() => {
    const series = metrics.data?.series[run] ?? {}
    return new Map(Object.keys(series).map((k) => [k, { [run]: series[k] }]))
  }, [metrics.data, run])
  const tree = useMemo(() => buildKeyTree([...perKey.keys()]), [perKey])
  const groupState = useGroupState(project)

  if (detail.isPending) return <Skeleton className="h-40" />
  if (detail.isError) return <p className="text-sm text-destructive">{(detail.error as Error).message}</p>
  const d = detail.data
  const duration = d.last_logged_at && d.created_epoch ? d.last_logged_at - d.created_epoch : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <RunSwatch color={colors[run] ?? "currentColor"} className="h-1 w-5" />
        <h1 className="font-mono text-lg font-semibold">{run}</h1>
        <Badge variant={d.status === "running" ? "default" : "secondary"}>{d.status}</Badge>
        <span className="text-xs text-muted-foreground">
          created {fmtDate(d.created_at)} · step {fmtInt(d.last_step)} · {fmtDuration(duration)} · {d.eval_steps.length} evals
        </span>
      </div>
      <Tabs defaultValue="charts">
        <TabsList>
          <TabsTrigger value="charts">Charts</TabsTrigger>
          <TabsTrigger value="config">Config</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          {d.system_keys.length > 0 && <TabsTrigger value="system">System</TabsTrigger>}
        </TabsList>
        <TabsContent value="charts" className="pt-2">
          <KeyGroups
            root={tree}
            isOpen={groupState.isOpen}
            setOpen={groupState.setOpen}
            defaultOpenTop={Infinity}
            chart={(k, depth) => (
              <MetricPanel
                key={k}
                project={project}
                metric={k}
                series={perKey.get(k)!}
                runs={runOnly}
                colors={colors}
                xMode={state.x}
                logY={state.logy}
                smoothing={state.smoothing}
                maxPoints={state.maxPoints}
                revision={revision}
                syncId={`run-${run}`}
                hideDepth={depth}
                settings={settingsFor(chartSettings, k)}
                onSettingsChange={setChartSettings}
              />
            )}
          />
        </TabsContent>
        <TabsContent value="config">
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter config" className="mb-2 h-8 w-64 text-xs" />
          <KeyValueTable rows={Object.entries(d.config)} filter={filter} />
        </TabsContent>
        <TabsContent value="summary">
          <KeyValueTable rows={Object.entries(d.summary)} filter="" />
        </TabsContent>
        <TabsContent value="system">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {Object.keys(system.data?.series[run] ?? {}).map((k) => (
              <ChartCard key={k} title={k} series={{ [run]: system.data?.series[run]?.[k] }} colors={colors} order={[run]} xMode="relative_time" {...chartProps(SYSTEM_ID + k)} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
