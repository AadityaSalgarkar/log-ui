import { useMemo } from "react"
import { ChevronDown } from "lucide-react"

import { KeyPlotPanel, type KeyPlotPanelProps } from "@/components/charts/KeyPlotPanel"
import { CHART_GRID } from "@/components/KeyGroups"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { settingsFor } from "@/hooks/use-chart-settings"
import { PLOT_ID, type ChartSettingsMap } from "@/lib/chart-settings"
import type { KeyPlot } from "@/lib/key-plots"
import { cn } from "@/lib/utils"

const SECTION_PATH = "\u0000keyplots" // open/closed state id; cannot collide with a metric group path

export interface KeyPlotsSectionProps extends Omit<KeyPlotPanelProps, "plot" | "settings"> {
  plots: KeyPlot[]
  chartSettings: ChartSettingsMap
  isOpen: (path: string, fallback: boolean) => boolean
  setOpen: (path: string, open: boolean) => void
}

/**
 * Key plots at the top of the page. Only plots with at least one metric the selected runs logged are shown
 * (and counted); the rest stay saved and come back when such runs are selected.
 */
export function KeyPlotsSection({ plots, chartSettings, isOpen, setOpen, ...panel }: KeyPlotsSectionProps) {
  const shown = useMemo(() => plots.filter((p) => p.keys.some((k) => panel.perKey.has(k))), [plots, panel.perKey])
  if (shown.length === 0) return null
  const open = isOpen(SECTION_PATH, true)
  return (
    <Collapsible open={open} onOpenChange={(o) => setOpen(SECTION_PATH, o)}>
      <CollapsibleTrigger className="group/section flex w-full items-center gap-3 rounded-md text-left">
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")} />
        <span className="text-xl font-bold tracking-tight lowercase group-hover/section:text-primary">key plots</span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{shown.length}</span>
        <span className="h-px flex-1 bg-rule" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        {open && (
          <div className={CHART_GRID}>
            {shown.map((plot) => (
              <KeyPlotPanel key={plot.id} plot={plot} settings={settingsFor(chartSettings, `${PLOT_ID}${plot.id}`)} {...panel} />
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
