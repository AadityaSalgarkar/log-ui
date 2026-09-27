import { memo, useState } from "react"
import { Maximize2, Pin, PinOff, SlidersHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { MetricKey } from "@/components/MetricKey"
import { ChartSettingsForm } from "@/components/charts/ChartSettingsForm"
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
  const windowSize = Object.values(chart.series).find((s) => s?.band)?.band?.window ?? null
  const customized = !isDefault(settings)
  const note = settings.band !== "none" ? `${BAND_LABEL[settings.band]}${windowSize ? ` · ${windowSize}-pt windows` : ""}` : ""

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
              <ChartSettingsForm value={settings} onChange={onSettingsChange} bands={bands} window={windowSize} />
            </PopoverContent>
          </Popover>
        )}
        <Button variant="ghost" size="icon" className="size-6 opacity-0 group-hover:opacity-100" onClick={() => setOpen(true)} title="Expand">
          <Maximize2 className="size-3.5" />
        </Button>
      </div>
      <MetricChart {...chart} height={200} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(1200px,92vw)] sm:max-w-[min(1200px,92vw)]">
          <DialogHeader>
            <DialogTitle>
              <MetricKey name={title} className="text-sm" />
            </DialogTitle>
            {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
          </DialogHeader>
          {open && <MetricChart {...chart} height={520} legend brush />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export const ChartCard = memo(ChartCardImpl)
