import { cn } from "@/lib/utils"

/**
 * A metric key rendered as the path it is: `val/human/bpb` reads as "val / human / bpb", with the parent
 * segments in graphite and the leaf (the quantity actually plotted) in ink. `hideDepth` drops that many leading
 * segments where enclosing group headers already show them (the leaf always stays).
 */
export function MetricKey({ name, hideDepth = 0, className }: { name: string; hideDepth?: number; className?: string }) {
  const parts = name.split("/")
  const shown = parts.slice(Math.min(hideDepth, parts.length - 1))
  const leaf = shown[shown.length - 1]
  return (
    <span className={cn("inline-flex min-w-0 items-baseline font-mono text-xs", className)} title={name}>
      <span className="truncate">
        {shown.slice(0, -1).map((p, i) => (
          <span key={i} className="text-muted-foreground">
            {p}
            <span className="px-1 text-muted-foreground/50">/</span>
          </span>
        ))}
        <span className="font-semibold text-foreground">{leaf}</span>
      </span>
    </span>
  )
}
