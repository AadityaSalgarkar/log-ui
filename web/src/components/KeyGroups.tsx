import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { KeyNode } from "@/lib/series"
import { cn } from "@/lib/utils"

export const CHART_GRID = "grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3"

export interface KeyGroupsProps {
  root: KeyNode
  /** Render one chart; `depth` is how many leading key segments the enclosing group headers already show. */
  chart: (key: string, depth: number) => ReactNode
  isOpen: (path: string, fallback: boolean) => boolean
  setOpen: (path: string, open: boolean) => void
  /** Top-level groups open by default (in order); nested groups default to open. */
  defaultOpenTop?: number
}

const UNGROUPED = "\u0000ungrouped" // path for root-level keys; cannot collide with a real key prefix

/**
 * Metric groups nested by key path: `loss/train/xent` sits in a "train" box inside the "loss" section. Each
 * group collapses independently; a closed group renders none of its charts.
 */
export function KeyGroups({ root, chart, isOpen, setOpen, defaultOpenTop = 2 }: KeyGroupsProps) {
  const top = root.children.map((node, i) => ({ node, defaultOpen: i < defaultOpenTop }))
  return (
    <div className="flex flex-col gap-6">
      {top.map(({ node, defaultOpen }) => (
        <Group key={node.path} node={node} chart={chart} isOpen={isOpen} setOpen={setOpen} defaultOpen={defaultOpen} />
      ))}
      {root.keys.length > 0 && (
        <TopSection
          title="ungrouped"
          count={root.keys.length}
          open={isOpen(UNGROUPED, top.length < defaultOpenTop)}
          onOpenChange={(o) => setOpen(UNGROUPED, o)}
        >
          <div className={CHART_GRID}>{root.keys.map((k) => chart(k, 0))}</div>
        </TopSection>
      )}
    </div>
  )
}

function Group({ node, chart, isOpen, setOpen, defaultOpen }: Omit<KeyGroupsProps, "root" | "defaultOpenTop"> & { node: KeyNode; defaultOpen: boolean }) {
  const open = isOpen(node.path, defaultOpen)
  const body = (
    <div className="flex flex-col gap-3">
      {node.keys.length > 0 && <div className={CHART_GRID}>{node.keys.map((k) => chart(k, node.depth))}</div>}
      {node.children.map((child) => (
        <Group key={child.path} node={child} chart={chart} isOpen={isOpen} setOpen={setOpen} defaultOpen />
      ))}
    </div>
  )
  if (node.depth === 1) {
    return (
      <TopSection title={node.name} count={node.total} open={open} onOpenChange={(o) => setOpen(node.path, o)}>
        {body}
      </TopSection>
    )
  }
  return (
    <SubGroup path={node.path} count={node.total} open={open} onOpenChange={(o) => setOpen(node.path, o)}>
      {body}
    </SubGroup>
  )
}

interface SectionProps {
  count: number
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

/** Top-level group: the prefix set large, the chart count beside it, a hairline to the edge. */
function TopSection({ title, count, open, onOpenChange, children }: SectionProps & { title: string }) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className="group/section flex w-full items-center gap-3 rounded-md text-left">
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")} />
        <span className="text-xl font-bold tracking-tight lowercase group-hover/section:text-primary">{title}</span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{count}</span>
        <span className="h-px flex-1 bg-rule" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">{open && children}</CollapsibleContent>
    </Collapsible>
  )
}

/** Nested group: a box headed by its path ("loss / train"), parent segments dimmed like chart titles. */
function SubGroup({ path, count, open, onOpenChange, children }: SectionProps & { path: string }) {
  const parts = path.split("/")
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="rounded-lg border bg-muted/40 px-3 py-2">
      <CollapsibleTrigger className="group/sub flex w-full items-center gap-2 rounded-md py-0.5 text-left font-mono text-[13px]">
        <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")} />
        <span className="truncate">
          {parts.slice(0, -1).map((p, i) => (
            <span key={i} className="text-muted-foreground">
              {p}
              <span className="px-1 text-muted-foreground/50">/</span>
            </span>
          ))}
          <span className="font-semibold group-hover/sub:text-primary">{parts[parts.length - 1]}</span>
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-2 pb-1">{open && children}</CollapsibleContent>
    </Collapsible>
  )
}
