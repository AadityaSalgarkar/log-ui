import { cn } from "@/lib/utils"

/** A run's colour drawn as a short stroke, the same mark the run makes on every chart. */
export function RunSwatch({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden className={cn("inline-block h-[3px] w-3.5 shrink-0 rounded-full", className)} style={{ background: color }} data-testid="run-color" />
}
