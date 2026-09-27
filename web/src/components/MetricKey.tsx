import { cn } from "@/lib/utils"

/**
 * A metric key rendered as the path it is: `val/human/bpb` reads as "val / human / bpb", with the parent
 * segments in graphite and the leaf (the quantity actually plotted) in ink. `hidePrefix` drops the first
 * segment where a surrounding group header already says it.
 */
export function MetricKey({ name, hidePrefix = false, className }: { name: string; hidePrefix?: boolean; className?: string }) {
  const parts = name.split("/")
  const shown = hidePrefix && parts.length > 1 ? parts.slice(1) : parts
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
