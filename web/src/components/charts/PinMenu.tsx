import { Pin, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { plotTitle, type KeyPlot } from "@/lib/key-plots"
import { cn } from "@/lib/utils"

export interface PinMenuProps {
  metric: string
  plots: KeyPlot[]
  onNew: (metric: string) => void
  onToggle: (plotId: string, metric: string) => void
}

/**
 * Put a metric into key plots: start a new one, or tick any number of existing ones. Membership is
 * many-to-many, so A can be co-viewed with B, C and D in separate plots at once.
 */
export function PinMenu({ metric, plots, onNew, onToggle }: PinMenuProps) {
  const inAny = plots.some((p) => p.keys.includes(metric))
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-6 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100", inAny && "text-primary opacity-100")}
          title="Key plots"
          aria-label={`Key plots for ${metric}`}
        >
          <Pin className={cn("size-3.5", inAny && "fill-current")} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onSelect={() => onNew(metric)} className="text-xs">
          <Plus className="size-3.5" /> New key plot
        </DropdownMenuItem>
        {plots.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Show in key plot</DropdownMenuLabel>
            {plots.map((p) => (
              <DropdownMenuCheckboxItem
                key={p.id}
                checked={p.keys.includes(metric)}
                onCheckedChange={() => onToggle(p.id, metric)}
                onSelect={(e) => e.preventDefault()} // keep the menu open to tick several plots
                className="font-mono text-xs"
              >
                <span className="truncate">{plotTitle(p)}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
