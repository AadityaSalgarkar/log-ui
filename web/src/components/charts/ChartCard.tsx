import { memo, useState } from "react"
import { Maximize2, Pin, PinOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MetricChart, type MetricChartProps } from "@/components/charts/MetricChart"
import { cn } from "@/lib/utils"

export interface ChartCardProps extends Omit<MetricChartProps, "height" | "brush" | "legend"> {
  title: string
  subtitle?: string
  pinned?: boolean
  onPin?: () => void
  className?: string
}

function ChartCardImpl({ title, subtitle, pinned, onPin, className, ...chart }: ChartCardProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className={cn("group relative flex flex-col rounded-xl border bg-card p-3 shadow-xs", className)}>
      <div className="mb-1 flex items-center gap-1">
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-xs font-medium" title={title}>
            {title}
          </div>
          {subtitle && <div className="truncate text-[10px] text-muted-foreground">{subtitle}</div>}
        </div>
        {onPin && (
          <Button variant="ghost" size="icon" className={cn("size-6 opacity-0 group-hover:opacity-100", pinned && "opacity-100")} onClick={onPin} title={pinned ? "Unpin" : "Pin"}>
            {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
          </Button>
        )}
        <Button variant="ghost" size="icon" className="size-6 opacity-0 group-hover:opacity-100" onClick={() => setOpen(true)} title="Expand">
          <Maximize2 className="size-3.5" />
        </Button>
      </div>
      <MetricChart {...chart} height={200} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[min(1200px,92vw)] sm:max-w-[min(1200px,92vw)]">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{title}</DialogTitle>
            {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
          </DialogHeader>
          {open && <MetricChart {...chart} height={520} legend brush />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export const ChartCard = memo(ChartCardImpl)
