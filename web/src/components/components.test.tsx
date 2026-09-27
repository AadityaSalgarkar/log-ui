import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"

import { LadderChart } from "@/components/charts/LadderChart"
import { ChartSettingsForm } from "@/components/charts/ChartSettingsForm"
import { MetricChart } from "@/components/charts/MetricChart"
import { DEFAULT_CHART_SETTINGS, axisDomain, parseLimit } from "@/lib/chart-settings"
import { cellColor } from "@/components/charts/Heatmap"
import { RunsTable, diffConfigKeys } from "@/components/runs/RunsTable"
import type { Category, RunInfo } from "@/types"

const now = Date.now() / 1000
const run = (name: string, created: number, cfg: Record<string, unknown>, step: number): RunInfo => ({
  name,
  run_id: name,
  created_at: new Date(created * 1000).toISOString(),
  created_epoch: created,
  last_step: step,
  last_logged_at: created + 600,
  status: "finished",
  config: cfg,
  summary: { "train/loss": 1 / step },
  n_rows: step,
})
const runs = [run("alpha", now - 3000, { lr: 1e-3, layers: 4, seed: 0 }, 100), run("beta", now - 2000, { lr: 3e-4, layers: 4, seed: 0 }, 50), run("gamma", now - 1000, { lr: 1e-3, layers: 8, seed: 0 }, 75)]
const colors = { alpha: "#111111", beta: "#222222", gamma: "#333333" }

describe("RunsTable", () => {
  it("shows varying config columns, sorts, and selects", async () => {
    expect(diffConfigKeys(runs)).toEqual(["layers", "lr"])
    const onSelect = vi.fn()
    render(
      <MemoryRouter>
        <RunsTable project="p" runs={runs} colors={colors} selected={["alpha"]} onSelect={onSelect} />
      </MemoryRouter>,
    )
    const rows = screen.getAllByRole("row").slice(1)
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByText("gamma")).toBeInTheDocument() // newest first by default
    expect(screen.getByRole("columnheader", { name: /layers/ })).toBeInTheDocument()
    expect(screen.queryByRole("columnheader", { name: /seed/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /^step/ }))
    expect(within(screen.getAllByRole("row")[1]).getByText("alpha")).toBeInTheDocument() // numeric columns sort descending first
    await userEvent.click(screen.getByRole("button", { name: /^step/ }))
    const afterSort = screen.getAllByRole("row").slice(1)
    expect(within(afterSort[0]).getByText("beta")).toBeInTheDocument() // then ascending by step
    await userEvent.click(screen.getByRole("checkbox", { name: "Select gamma" }))
    expect(onSelect).toHaveBeenCalledWith(["alpha", "gamma"])
    await userEvent.type(screen.getByLabelText("Filter runs table"), "gam")
    expect(screen.getAllByRole("row").slice(1)).toHaveLength(1)
  })
})

describe("charts", () => {
  const cats: Category[] = [
    { id: "human", label: "human", group: "train", order: 0, meta: { tier: 0 } },
    { id: "chimp", label: "chimp", group: "test", order: 1, meta: { tier: 1 } },
    { id: "fly", label: "fly", group: "test", order: 10, meta: { tier: 10 } },
  ]
  it("renders one ladder line per run and category ticks", () => {
    const { container } = render(<LadderChart categories={cats} series={{ alpha: [1.9, 1.91, null], beta: [1.95, null, 2.0] }} colors={colors} width={600} height={300} />)
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(2)
    expect(container.textContent).toContain("chimp")
    expect(container.textContent).toContain("fly")
  })
  it("renders a metric chart with a line per run", () => {
    const { container } = render(<MetricChart series={{ alpha: { x: [1, 2, 3], y: [3, 2, 1] }, beta: { x: [1, 3], y: [1, 2] } }} colors={colors} width={500} height={200} />)
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(2)
  })
  const banded = {
    alpha: { x: [1, 2, 3, 4], y: [4, 3, 2, 1], band: { x: [1, 3], mean: [3.5, 1.5], std: [0.5, 0.5], min: [3, 1], max: [4, 2], window: 2 } },
  }
  it("draws one band area per run only when a band mode is set", () => {
    const none = render(<MetricChart series={banded} colors={colors} width={500} height={200} />)
    expect(none.container.querySelectorAll(".recharts-area")).toHaveLength(0)
    none.unmount()
    const settings = { ...DEFAULT_CHART_SETTINGS, band: "std" as const }
    const { container } = render(<MetricChart series={banded} colors={colors} width={500} height={200} settings={settings} />)
    expect(container.querySelectorAll(".recharts-area")).toHaveLength(1)
    expect(container.querySelectorAll(".recharts-line")).toHaveLength(1)
  })
  it("fixed axis limits replace the data extent", () => {
    expect(axisDomain(null, null, ["dataMin", "dataMax"])).toEqual({ domain: ["dataMin", "dataMax"], clip: false })
    expect(axisDomain(2, null, ["auto", "auto"])).toEqual({ domain: [2, "auto"], clip: true })
    const settings = { ...DEFAULT_CHART_SETTINGS, yMin: 0, yMax: 10 }
    const { container } = render(<MetricChart series={banded} colors={colors} width={500} height={200} settings={settings} />)
    const yTicks = [...container.querySelectorAll(".recharts-yAxis .recharts-cartesian-axis-tick-value")].map((t) => t.textContent)
    expect(yTicks[0]).toBe("0")
    expect(yTicks[yTicks.length - 1]).toBe("10")
  })
  it("settings form sets the band and commits valid limits only", async () => {
    const onChange = vi.fn()
    render(<ChartSettingsForm value={DEFAULT_CHART_SETTINGS} onChange={onChange} bands window={4} />)
    expect(screen.getByText(/covers 4 raw points/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("radio", { name: "min – max" }))
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_CHART_SETTINGS, band: "minmax" })
    await userEvent.type(screen.getByLabelText("y max"), "1e-3{Enter}")
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_CHART_SETTINGS, yMax: 0.001 })
    await userEvent.type(screen.getByLabelText("x min"), "abc{Enter}")
    expect(onChange.mock.calls.every(([s]) => s.xMin === null)).toBe(true)
    expect(screen.getByLabelText("x min")).toHaveAttribute("aria-invalid", "true")
    expect(parseLimit("")).toBeNull()
    expect(parseLimit(" -2.5 ")).toBe(-2.5)
  })
  it("hides band modes where there are no windows", () => {
    render(<ChartSettingsForm value={DEFAULT_CHART_SETTINGS} onChange={() => {}} bands={false} />)
    expect(screen.queryByRole("radio", { name: "mean ± std" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("x max")).toBeInTheDocument()
  })
  it("heatmap colors diverge around zero", () => {
    expect(cellColor(null, -1, 1, true)).toBe("transparent")
    expect(cellColor(-1, -1, 1, true)).toContain("215")
    expect(cellColor(1, -1, 1, true)).toContain("5 75%")
    expect(cellColor(0.5, 0, 1, false)).toContain("215")
  })
})
