import { memo, useState, type ReactNode } from "react"
import { Maximize2, SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { MetricKey } from "@/components/MetricKey"
import { ChartSettingsForm } from "@/components/charts/ChartSettingsForm"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { MetricChart, type MetricChartProps } from "@/components/charts/MetricChart"
import { DEFAULT_CHART_SETTINGS, isDefault, type ChartSettings } from "@/lib/chart-settings"
import { cn } from "@/lib/utils"

export interface ChartCardProps extends Omit<MetricChartProps, "height" | "brush" | "legend"> {
  title: string
  subtitle?: string
  heading?: ReactNode // replaces the key-path title in the card header (key plots: an editable name)
  actions?: ReactNode // extra header buttons, before settings (e.g. the pin menu)
  footer?: ReactNode // under the header, in the card and the expanded view (key plots: the metric legend)
  onSettingsChange?: (next: ChartSettings) => void // settings are read-only without it
  bands?: boolean // offer band modes (needs band data from the API)
  hideDepth?: number // leading key segments already shown by enclosing group headers
  className?: string
}

const BAND_LABEL = { none: "", std: "mean ± std", minmax: "min – max" } as const

function ChartCardImpl({ title, subtitle, heading, actions, footer, onSettingsChange, bands = true, hideDepth = 0, className, ...chart }: ChartCardProps) {
  const [open, setOpen] = useState(false)
  const settings = chart.settings ?? DEFAULT_CHART_SETTINGS
  // The API caps the window at each run's length, so short runs can use fewer points than the setting.
  const windows = Object.values(chart.series).flatMap((s) => (s?.band ? [s.band.window] : []))
  const [wMin, wMax] = windows.length ? [Math.min(...windows), Math.max(...windows)] : [null, null]
  const windowText = wMin === null ? "" : wMin === wMax ? `${wMin}-pt window` : `${wMin}–${wMax}-pt window`
  const customized = !isDefault(settings)
  const note = settings.band !== "none" ? [BAND_LABEL[settings.band], windowText].filter(Boolean).join(" · ") : ""

  return (
    <div className={cn("group relative flex flex-col rounded-lg border bg-card px-3 pt-2.5 pb-2 transition-colors hover:border-input", className)}>
      <div className="mb-1.5 flex min-h-6 items-center gap-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {heading ?? <MetricKey name={title} hideDepth={hideDepth} className="text-[13px]" />}
          {(subtitle || note) && <div className="truncate font-mono text-[10px] text-muted-foreground">{[subtitle, note].filter(Boolean).join(" · ")}</div>}
        </div>
        {actions}
        {onSettingsChange && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn("size-6 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100", customized && "text-primary opacity-100")}
                title="Chart settings"
                aria-label={`Chart settings for ${title}`}
              >
                <SlidersHorizontal className="size-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72">
              <ChartSettingsForm value={settings} onChange={onSettingsChange} bands={bands} shortestRun={wMin} />
            </PopoverContent>
          </Popover>
        )}
        <Button variant="ghost" size="icon" className="size-6 opacity-0 group-hover:opacity-100" onClick={() => setOpen(true)} title="Expand">
          <Maximize2 className="size-3.5" />
        </Button>
      </div>
      {footer}
      <ErrorBoundary what="this chart" resetKey={chart.settings} compact>
        <MetricChart {...chart} height={200} />
      </ErrorBoundary>
      <Dialog open={open} onOpenChange={setOpen}>
        {/* Fills the viewport (1rem margin), centred; the plot takes all height below the title. */}
        <DialogContent className="flex h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-none flex-col gap-3 sm:max-w-none">
          <DialogHeader>
            <DialogTitle>
              <MetricKey name={title} className="text-sm" />
            </DialogTitle>
            {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
          </DialogHeader>
          {footer}
          {open && (
            <div className="min-h-0 flex-1">
              <ErrorBoundary what="this chart" resetKey={chart.settings}>
                {/* Key plots carry their own legend (footer); the per-run legend would repeat every metric. */}
                <MetricChart {...chart} height="fill" legend={!footer} brush />
              </ErrorBoundary>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export const ChartCard = memo(ChartCardImpl)
