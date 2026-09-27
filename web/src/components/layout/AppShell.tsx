import { useMemo } from "react"
import { Link, Outlet, useLocation, useParams } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { ChevronsUpDown, LayoutDashboard, Table2, Layers } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { api } from "@/lib/api"
import { colorMap } from "@/lib/colors"
import { ProjectContext, type ProjectContextValue } from "@/lib/project-context"
import { useUrlState } from "@/hooks/use-url-state"
import { RunList } from "@/components/layout/RunList"
import { ThemeToggle } from "@/components/layout/ThemeToggle"
import { ErrorBoundary } from "@/components/ErrorBoundary"

const MAX_DEFAULT_SELECTED = 8

export function AppShell() {
  const { project = "" } = useParams()
  const location = useLocation()
  const [state, update] = useUrlState()

  const runsQ = useQuery({
    queryKey: ["runs", project],
    queryFn: ({ signal }) => api.runs(project, signal),
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === "running") ? 5_000 : 30_000),
    enabled: !!project,
  })
  const viewsQ = useQuery({ queryKey: ["views", project], queryFn: () => api.views(project), enabled: !!project, staleTime: 60_000 })
  const projectsQ = useQuery({ queryKey: ["projects"], queryFn: api.projects, staleTime: 30_000 })
  const healthQ = useQuery({ queryKey: ["health"], queryFn: api.health, staleTime: Infinity })

  const runs = useMemo(() => runsQ.data ?? [], [runsQ.data])
  const colors = useMemo(() => colorMap(runs), [runs])
  const selected = useMemo(() => {
    if (state.runs !== null) return state.runs.filter((n) => runs.some((r) => r.name === n))
    return runs.slice(0, MAX_DEFAULT_SELECTED).map((r) => r.name) // newest first, capped
  }, [state.runs, runs])

  const ctx: ProjectContextValue = {
    project,
    runs,
    colors,
    selected,
    setSelected: (names) => update({ runs: names }),
    views: viewsQ.data ?? [],
    isLoading: runsQ.isPending,
  }

  const base = `/p/${encodeURIComponent(project)}`
  const nav = [
    { to: base, label: "Workspace", icon: LayoutDashboard, active: location.pathname === base },
    { to: `${base}/runs`, label: "Runs", icon: Table2, active: location.pathname.startsWith(`${base}/runs`) },
  ]
  const search = location.search

  return (
    <ProjectContext.Provider value={ctx}>
      <SidebarProvider>
        <Sidebar variant="sidebar" collapsible="offcanvas">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent" aria-label="Switch project">
                      <div className="grid flex-1 text-left leading-tight">
                        <span className="truncate text-base font-bold tracking-tight">{project}</span>
                        <span className="truncate font-mono text-[11px] text-muted-foreground">
                          {runs.length} runs · {runs.filter((r) => r.status === "running").length} running
                        </span>
                      </div>
                      <ChevronsUpDown className="ml-auto size-4 opacity-60" />
                    </SidebarMenuButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-64">
                    {(projectsQ.data ?? []).map((p) => (
                      <DropdownMenuItem key={p.name} asChild>
                        <Link to={`/p/${encodeURIComponent(p.name)}`}>
                          <span className="flex-1 truncate">{p.name}</span>
                          <span className="text-xs text-muted-foreground">{p.n_runs}</span>
                        </Link>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem asChild>
                      <Link to="/">All projects</Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {nav.map((n) => (
                    <SidebarMenuItem key={n.to}>
                      <SidebarMenuButton asChild isActive={n.active}>
                        <Link to={`${n.to}${search}`}>
                          <n.icon className="size-4" />
                          <span>{n.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  {(viewsQ.data ?? []).map((v) => {
                    const to = `${base}/views/${encodeURIComponent(v.id)}`
                    return (
                      <SidebarMenuItem key={v.id}>
                        <SidebarMenuButton asChild isActive={location.pathname === to} title={v.description}>
                          <Link to={`${to}${search}`}>
                            <Layers className="size-4" />
                            <span>{v.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarGroup className="min-h-0 flex-1">
              <SidebarGroupLabel>Runs</SidebarGroupLabel>
              <SidebarGroupContent className="flex min-h-0 flex-1 flex-col">
                <RunList project={project} runs={runs} colors={colors} selected={selected} onSelect={ctx.setSelected} />
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <div className="truncate px-2 font-mono text-[10px] text-muted-foreground" title={healthQ.data?.store_dir}>
              log-ui {healthQ.data?.version ?? ""} · {healthQ.data?.store_dir ?? ""}
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="min-w-0">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 md:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 font-mono text-xs">
              <Link to="/" className="text-muted-foreground hover:text-foreground">
                projects
              </Link>
              <span className="text-muted-foreground/50">/</span>
              <Link to={`${base}${search}`} className="truncate font-semibold">
                {project}
              </Link>
            </nav>
            <div className="ml-auto flex items-center gap-1">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex min-w-0 flex-1 flex-col gap-5 px-4 pt-5 pb-10 md:px-6">
            <ErrorBoundary what="this page" resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ProjectContext.Provider>
  )
}
