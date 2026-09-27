import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"

import { LadderChart } from "@/components/charts/LadderChart"
import { MetricChart } from "@/components/charts/MetricChart"
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
  it("heatmap colors diverge around zero", () => {
    expect(cellColor(null, -1, 1, true)).toBe("transparent")
    expect(cellColor(-1, -1, 1, true)).toContain("215")
    expect(cellColor(1, -1, 1, true)).toContain("5 75%")
    expect(cellColor(0.5, 0, 1, false)).toContain("215")
  })
})
