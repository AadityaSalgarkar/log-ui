import { useState } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { api } from "@/lib/api"
import { timeAgo } from "@/lib/format"

export default function ProjectsPage() {
  const [q, setQ] = useState("")
  const projects = useQuery({ queryKey: ["projects"], queryFn: api.projects, refetchInterval: 10_000 })
  const health = useQuery({ queryKey: ["health"], queryFn: api.health, staleTime: Infinity })
  const list = (projects.data ?? []).filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 md:px-6">
      <header className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">projects</h1>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground" title="trackio store directory">
            {health.data?.store_dir}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter projects" aria-label="Filter projects" className="h-8 w-56 bg-card pl-7 text-xs" />
          </div>
          <ThemeToggle />
        </div>
      </header>
      {projects.isPending ? (
        <Skeleton className="h-48 rounded-lg" />
      ) : projects.isError ? (
        <p className="text-sm text-destructive">Could not load projects: {(projects.error as Error).message}</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {q ? `No project matches "${q}".` : "This store has no projects yet. Log a run with trackio and it appears here."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <div className="grid grid-cols-[1fr_5rem_8rem] gap-4 border-b px-4 py-2 text-xs text-muted-foreground">
            <span>project</span>
            <span className="text-right">runs</span>
            <span className="text-right">last write</span>
          </div>
          <ul role="list">
            {list.map((p) => (
              <li key={p.name} className="border-b last:border-b-0">
                <Link
                  to={`/p/${encodeURIComponent(p.name)}`}
                  className="grid grid-cols-[1fr_5rem_8rem] items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60"
                >
                  <span className="truncate font-mono text-sm font-semibold">{p.name}</span>
                  <span className="text-right font-mono text-sm tabular-nums">{p.n_runs}</span>
                  <span className="text-right text-xs text-muted-foreground">{timeAgo(p.updated_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
