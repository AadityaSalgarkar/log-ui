import { memo, useState } from "react"
import { Maximize2, Pin, PinOff, SlidersHorizontal } from "lucide-react"

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
  pinned?: boolean
  onPin?: () => void
  onSettingsChange?: (next: ChartSettings) => void // settings are read-only without it
  bands?: boolean // offer band modes (needs band data from the API)
  hidePrefix?: boolean // drop the key's first segment when a group header already shows it
  className?: string
}

const BAND_LABEL = { none: "", std: "mean ± std", minmax: "min – max" } as const

function ChartCardImpl({ title, subtitle, pinned, onPin, onSettingsChange, bands = true, hidePrefix = false, className, ...chart }: ChartCardProps) {
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
          <MetricKey name={title} hidePrefix={hidePrefix} className="text-[13px]" />
          {(subtitle || note) && <div className="truncate font-mono text-[10px] text-muted-foreground">{[subtitle, note].filter(Boolean).join(" · ")}</div>}
        </div>
        {onPin && (
          <Button variant="ghost" size="icon" className={cn("size-6 opacity-0 group-hover:opacity-100", pinned && "opacity-100")} onClick={onPin} title={pinned ? "Unpin" : "Pin"}>
            {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
          </Button>
        )}
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
          {open && (
            <div className="min-h-0 flex-1">
              <ErrorBoundary what="this chart" resetKey={chart.settings}>
                <MetricChart {...chart} height="fill" legend brush />
              </ErrorBoundary>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export const ChartCard = memo(ChartCardImpl)
