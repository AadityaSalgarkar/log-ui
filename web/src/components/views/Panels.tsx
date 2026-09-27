import { ChartCard } from "@/components/charts/ChartCard"
import { Heatmap } from "@/components/charts/Heatmap"
import { LadderChart } from "@/components/charts/LadderChart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { fmtInt, fmtNum } from "@/lib/format"
import type { LinesPanel, Panel, ValuePanel } from "@/types"

function PanelCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function ValueTable({ panel }: { panel: ValuePanel }) {
  const runs = Object.keys(panel.series)
  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">run</TableHead>
            <TableHead className="text-xs">step</TableHead>
            {panel.categories.map((c) => (
              <TableHead key={c.id} className="text-right text-xs" title={String(c.meta?.relation ?? "")}>
                {c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run}>
              <TableCell className="font-mono text-xs">{run}</TableCell>
              <TableCell className="text-xs tabular-nums">{fmtInt(panel.steps[run])}</TableCell>
              {panel.series[run].map((v, i) => (
                <TableCell key={panel.categories[i]?.id ?? i} className="text-right font-mono text-xs tabular-nums">
                  {fmtNum(v)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function Stats({ panel }: { panel: ValuePanel }) {
  const runs = Object.keys(panel.series)
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {panel.categories.map((c, i) => (
        <div key={c.id} className="rounded-lg border p-3">
          <div className="truncate font-mono text-[11px] text-muted-foreground" title={c.label}>
            {c.label}
          </div>
          {runs.map((run) => (
            <div key={run} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-mono text-muted-foreground">{run}</span>
              <span className="font-mono text-base tabular-nums">{fmtNum(panel.series[run][i])}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function Lines({ panel, colors, order }: { panel: LinesPanel; colors: Record<string, string>; order: string[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      {panel.keys.map((key, i) => {
        const series: Record<string, { x: number[]; y: number[] } | undefined> = {}
        for (const run of order) series[run] = panel.series[run]?.[key]
        return <ChartCard key={key} title={panel.categories[i]?.label ?? key} subtitle={key} series={series} colors={colors} order={order} />
      })}
    </div>
  )
}

export function Panels({ panels, colors, order, metricLabel }: { panels: Panel[]; colors: Record<string, string>; order: string[]; metricLabel?: string }) {
  return (
    <div className="flex flex-col gap-4">
      {panels.map((p, i) => {
        if (p.type === "lines") return <PanelCard key={i} title={p.title}><Lines panel={p} colors={colors} order={order} /></PanelCard>
        const vp = p as ValuePanel
        const desc = vp.description || (vp.metric ? `${metricLabel ?? vp.metric} at ${vp.point} step` : undefined)
        if (vp.type === "ladder") return <PanelCard key={i} title={vp.title} description={desc}><LadderChart categories={vp.categories} series={vp.series} colors={colors} yLabel={vp.metric ?? undefined} /></PanelCard>
        if (vp.type === "heatmap") return <PanelCard key={i} title={vp.title} description={desc}><Heatmap categories={vp.categories} series={vp.series} diverging={/gap|diff|delta/i.test(vp.metric ?? "")} /></PanelCard>
        if (vp.type === "stats") return <PanelCard key={i} title={vp.title} description={desc}><Stats panel={vp} /></PanelCard>
        return <PanelCard key={i} title={vp.title} description={desc}><ValueTable panel={vp} /></PanelCard>
      })}
    </div>
  )
}
