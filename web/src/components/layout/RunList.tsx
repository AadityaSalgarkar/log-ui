import { useMemo, useState } from "react"
import { Link } from "react-router"
import { Search } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { runColor } from "@/lib/colors"
import { fmtInt, timeAgo } from "@/lib/format"
import type { RunInfo } from "@/types"

export interface RunListProps {
  project: string
  runs: RunInfo[]
  colors: Record<string, string>
  selected: string[]
  onSelect: (names: string[]) => void
}

export function RunList({ project, runs, colors, selected, onSelect }: RunListProps) {
  const [q, setQ] = useState("")
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? runs.filter((r) => r.name.toLowerCase().includes(needle)) : runs
  }, [runs, q])
  const sel = new Set(selected)
  const allVisibleSelected = visible.length > 0 && visible.every((r) => sel.has(r.name))

  const toggle = (name: string, on: boolean) => {
    const next = new Set(sel)
    if (on) next.add(name)
    else next.delete(name)
    onSelect(runs.map((r) => r.name).filter((n) => next.has(n)))
  }
  const toggleAll = () => {
    const next = new Set(sel)
    for (const r of visible) allVisibleSelected ? next.delete(r.name) : next.add(r.name)
    onSelect(runs.map((r) => r.name).filter((n) => next.has(n)))
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 opacity-50" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter runs"
          className="h-8 pl-7 text-xs"
          aria-label="Filter runs"
        />
      </div>
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>
          {selected.length}/{runs.length} selected
        </span>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={toggleAll}>
          {allVisibleSelected ? "None" : "All"}
        </Button>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto pr-1" role="list">
        {visible.map((r) => {
          const on = sel.has(r.name)
          return (
            <li
              key={r.name}
              className={cn(
                "group flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-sidebar-accent",
                on ? "" : "opacity-70",
              )}
            >
              <Checkbox
                checked={on}
                onCheckedChange={(v) => toggle(r.name, v === true)}
                aria-label={`Select ${r.name}`}
                className="size-3.5"
              />
              <span
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{ background: runColor(colors, r.name) }}
                data-testid="run-color"
              />
              <Link
                to={`/p/${encodeURIComponent(project)}/runs/${encodeURIComponent(r.name)}`}
                className="min-w-0 flex-1 truncate font-mono text-xs"
                title={`${r.name} · step ${fmtInt(r.last_step)} · ${timeAgo(r.last_logged_at)}`}
              >
                {r.name}
              </Link>
              {r.status === "running" && (
                <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500" title="running" />
              )}
            </li>
          )
        })}
        {visible.length === 0 && <li className="px-1.5 py-2 text-xs text-muted-foreground">No runs</li>}
      </ul>
    </div>
  )
}
