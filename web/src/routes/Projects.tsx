import { useState } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { Activity, Search } from "lucide-react"

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Activity className="size-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Projects</h1>
          <p className="text-xs text-muted-foreground">{health.data?.store_dir}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 opacity-50" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search projects" className="h-8 w-56 pl-7 text-xs" />
          </div>
          <ThemeToggle />
        </div>
      </header>
      {projects.isPending ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : projects.isError ? (
        <p className="text-sm text-destructive">Could not load projects: {(projects.error as Error).message}</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects in this store yet. Log something with trackio and refresh.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <Link key={p.name} to={`/p/${encodeURIComponent(p.name)}`}>
              <Card className="h-full transition-colors hover:bg-accent/40">
                <CardHeader>
                  <CardTitle className="truncate font-mono text-sm">{p.name}</CardTitle>
                  <CardDescription>
                    {p.n_runs} run{p.n_runs === 1 ? "" : "s"} · updated {timeAgo(p.updated_at)}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
