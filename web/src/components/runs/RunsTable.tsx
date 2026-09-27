import { useMemo, useState } from "react"
import { Link } from "react-router"
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { runColor } from "@/lib/colors"
import { fmtDate, fmtDuration, fmtInt, fmtNum, timeAgo } from "@/lib/format"
import type { RunInfo } from "@/types"

export interface RunsTableProps {
  project: string
  runs: RunInfo[]
  colors: Record<string, string>
  selected: string[]
  onSelect: (names: string[]) => void
  summaryKeys?: string[] // summary columns to show
  maxConfigColumns?: number
}

/** Config keys whose values differ across runs, most-varying first. */
export function diffConfigKeys(runs: RunInfo[], max = 10): string[] {
  const values = new Map<string, Set<string>>()
  for (const r of runs) {
    for (const [k, v] of Object.entries(r.config)) {
      if (!values.has(k)) values.set(k, new Set())
      values.get(k)!.add(JSON.stringify(v))
    }
  }
  return [...values.entries()]
    .filter(([, s]) => s.size > 1)
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([k]) => k)
}

export function RunsTable({ project, runs, colors, selected, onSelect, summaryKeys = [], maxConfigColumns = 10 }: RunsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "created", desc: true }])
  const [filter, setFilter] = useState("")
  const sel = useMemo(() => new Set(selected), [selected])
  const configKeys = useMemo(() => diffConfigKeys(runs, maxConfigColumns), [runs, maxConfigColumns])

  const columns = useMemo<ColumnDef<RunInfo>[]>(() => {
    const cols: ColumnDef<RunInfo>[] = [
      {
        id: "select",
        enableSorting: false,
        header: () => (
          <Checkbox
            checked={runs.length > 0 && runs.every((r) => sel.has(r.name))}
            onCheckedChange={(v) => onSelect(v === true ? runs.map((r) => r.name) : [])}
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={sel.has(row.original.name)}
            onCheckedChange={(v) => {
              const next = new Set(sel)
              v === true ? next.add(row.original.name) : next.delete(row.original.name)
              onSelect(runs.map((r) => r.name).filter((n) => next.has(n)))
            }}
            aria-label={`Select ${row.original.name}`}
          />
        ),
      },
      {
        id: "name",
        accessorKey: "name",
        header: "run",
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <span className="inline-block size-2.5 rounded-full" style={{ background: runColor(colors, row.original.name) }} />
            <Link to={`/p/${encodeURIComponent(project)}/runs/${encodeURIComponent(row.original.name)}`} className="font-mono hover:underline">
              {row.original.name}
            </Link>
          </span>
        ),
      },
      {
        id: "status",
        accessorKey: "status",
        header: "status",
        cell: ({ getValue }) => <Badge variant={getValue() === "running" ? "default" : "secondary"}>{String(getValue())}</Badge>,
      },
      {
        id: "created",
        accessorKey: "created_epoch",
        header: "created",
        cell: ({ row }) => <span title={fmtDate(row.original.created_at)}>{timeAgo(row.original.created_epoch)}</span>,
      },
      { id: "step", accessorKey: "last_step", header: "step", cell: ({ getValue }) => <span className="tabular-nums">{fmtInt(getValue() as number | null)}</span> },
      {
        id: "duration",
        accessorFn: (r) => (r.last_logged_at && r.created_epoch ? r.last_logged_at - r.created_epoch : null),
        header: "duration",
        cell: ({ getValue }) => <span className="tabular-nums">{fmtDuration(getValue() as number | null)}</span>,
      },
      ...configKeys.map<ColumnDef<RunInfo>>((k) => ({
        id: `cfg:${k}`,
        accessorFn: (r) => r.config[k],
        header: k,
        cell: ({ getValue }) => {
          const v = getValue()
          return <span className="font-mono text-xs">{v === undefined || v === null ? "-" : typeof v === "number" ? fmtNum(v) : String(v)}</span>
        },
      })),
      ...summaryKeys.map<ColumnDef<RunInfo>>((k) => ({
        id: `sum:${k}`,
        accessorFn: (r) => r.summary[k] ?? null,
        header: k,
        cell: ({ getValue }) => <span className="font-mono text-xs tabular-nums">{fmtNum(getValue() as number | null)}</span>,
      })),
    ]
    return cols
  }, [runs, sel, colors, project, configKeys, summaryKeys, onSelect])

  const table = useReactTable({
    data: runs,
    columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _col, value: string) => {
      const needle = value.toLowerCase()
      return row.original.name.toLowerCase().includes(needle) || JSON.stringify(row.original.config).toLowerCase().includes(needle)
    },
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name or config" className="h-8 w-64 text-xs" aria-label="Filter runs table" />
        <span className="text-xs text-muted-foreground">
          {table.getRowModel().rows.length} of {runs.length} runs · {selected.length} selected
        </span>
      </div>
      <div className="overflow-auto rounded-xl border">
        <Table>
          <TableHeader className="sticky top-0 bg-card">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => {
                  const sorted = h.column.getIsSorted()
                  return (
                    <TableHead key={h.id} className="whitespace-nowrap text-xs">
                      {h.column.getCanSort() ? (
                        <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          {sorted === "asc" ? <ArrowUp className="size-3" /> : sorted === "desc" ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={sel.has(row.original.name) ? "selected" : undefined}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="whitespace-nowrap text-xs">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">
                  No runs
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
