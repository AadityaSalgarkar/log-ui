import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"

import { LadderChart } from "@/components/charts/LadderChart"
import { ChartCard } from "@/components/charts/ChartCard"
import { ChartSettingsForm } from "@/components/charts/ChartSettingsForm"
import { useState } from "react"

import { ErrorBoundary } from "@/components/ErrorBoundary"
import { KeyGroups } from "@/components/KeyGroups"
import { MetricKey } from "@/components/MetricKey"
import { PointsInput } from "@/components/WorkspaceControls"
import { MetricChart } from "@/components/charts/MetricChart"
import { DEFAULT_CHART_SETTINGS, axisDomain, parseLimit } from "@/lib/chart-settings"
import { cellColor } from "@/lib/colors"
import { RunsTable } from "@/components/runs/RunsTable"
import { diffConfigKeys } from "@/lib/runs"
import { buildKeyTree } from "@/lib/series"
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
  it("select-all acts only on the rows the filter shows", async () => {
    const onSelect = vi.fn()
    render(
      <MemoryRouter>
        <RunsTable project="p" runs={runs} colors={colors} selected={["alpha"]} onSelect={onSelect} />
      </MemoryRouter>,
    )
    await userEvent.type(screen.getByLabelText("Filter runs table"), "gam")
    await userEvent.click(screen.getByRole("checkbox", { name: "Select all shown runs" }))
    expect(onSelect).toHaveBeenLastCalledWith(["alpha", "gamma"]) // beta is hidden, so it stays unselected
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
    render(<ChartSettingsForm value={DEFAULT_CHART_SETTINGS} onChange={onChange} bands shortestRun={4} />)
    expect(screen.getByText(/spread of the last 10 raw values up to it/)).toBeInTheDocument()
    expect(screen.getByText(/shorter than that use all 4 of their points/)).toBeInTheDocument()
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
  it("settings form edits the band window in raw points", async () => {
    const onChange = vi.fn()
    render(<ChartSettingsForm value={{ ...DEFAULT_CHART_SETTINGS, band: "std" }} onChange={onChange} bands />)
    const input = screen.getByLabelText("window")
    await userEvent.clear(input)
    await userEvent.type(input, "25{Enter}")
    expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_CHART_SETTINGS, band: "std", window: 25 })
    await userEvent.clear(input)
    await userEvent.type(input, "0{Enter}")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(onChange).toHaveBeenCalledTimes(1)
  })
  it("hides band modes where there are no windows", () => {
    render(<ChartSettingsForm value={DEFAULT_CHART_SETTINGS} onChange={() => {}} bands={false} />)
    expect(screen.queryByRole("radio", { name: "mean ± std" })).not.toBeInTheDocument()
    expect(screen.getByLabelText("x max")).toBeInTheDocument()
  })
  it("chart card reports the range of window sizes across runs", () => {
    const b = (window: number) => ({ x: [1], mean: [1], std: [0], min: [1], max: [1], window })
    const series = { alpha: { x: [1, 2], y: [1, 2], band: b(4) }, beta: { x: [1, 2], y: [2, 1], band: b(11) } }
    const settings = { ...DEFAULT_CHART_SETTINGS, band: "minmax" as const }
    render(<ChartCard title="train/loss/total" hideDepth={1} series={series} colors={colors} settings={settings} />)
    expect(screen.getByText("min – max · 4–11-pt window")).toBeInTheDocument()
  })
  it("multi-level keys keep their inner path under the group header", () => {
    render(<MetricKey name="train/loss/aux" hideDepth={1} />)
    expect(screen.getByTitle("train/loss/aux")).toHaveTextContent(/^loss\/aux$/)
    expect(screen.getByText("aux")).toHaveClass("font-semibold")
  })
  it("points field takes any whole number or 'all', and ignores invalid text", async () => {
    const onCommit = vi.fn()
    render(<PointsInput value={1000} onCommit={onCommit} />)
    const input = screen.getByRole("combobox")
    await userEvent.clear(input)
    await userEvent.type(input, "750{Enter}")
    expect(onCommit).toHaveBeenLastCalledWith(750)
    await userEvent.clear(input)
    await userEvent.type(input, "lots{Enter}")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(onCommit).toHaveBeenCalledTimes(1)
    await userEvent.type(input, "{Escape}")
    expect(input).toHaveValue("1000")
    await userEvent.clear(input)
    await userEvent.type(input, "all{Enter}")
    expect(onCommit).toHaveBeenLastCalledWith(0)
  })
  it("nests groups as collapsible boxes and remembers what was closed", async () => {
    const opened = new Map<string, boolean>()
    const Harness = () => {
      const [, force] = useState(0)
      return (
        <KeyGroups
          root={buildKeyTree(["loss/total", "loss/train/xent", "loss/train/aux", "lr"])}
          chart={(k, depth) => <MetricKey key={k} name={k} hideDepth={depth} />}
          isOpen={(path, fallback) => opened.get(path) ?? fallback}
          setOpen={(path, open) => {
            opened.set(path, open)
            force((n) => n + 1)
          }}
        />
      )
    }
    render(<Harness />)
    // loss holds its direct chart, then a nested "loss / train" box whose charts show only their leaf.
    expect(screen.getByTitle("loss/total")).toHaveTextContent(/^total$/)
    expect(screen.getByTitle("loss/train/xent")).toHaveTextContent(/^xent$/)
    const sub = screen.getByRole("button", { name: /loss\s*\/\s*train\s*2/ })
    await userEvent.click(sub) // collapse the nested group only
    expect(opened.get("loss/train")).toBe(false)
    expect(screen.queryByTitle("loss/train/xent")).not.toBeInTheDocument()
    expect(screen.getByTitle("loss/total")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /^loss\s*3$/ })) // collapse the parent
    expect(screen.queryByTitle("loss/total")).not.toBeInTheDocument()
    expect(screen.getByTitle("lr")).toBeInTheDocument() // ungrouped keys get their own section
  })
  it("an error boundary contains a chart that throws, and the rest of the page stays", async () => {
    const Boom = () => {
      throw new Error("e.toPrecision is not a function")
    }
    render(
      <div>
        <p>other charts</p>
        <ErrorBoundary what="this chart" compact>
          <Boom />
        </ErrorBoundary>
      </div>,
    )
    expect(screen.getByText("other charts")).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("Could not draw this chart.")
    expect(screen.getByRole("alert")).toHaveTextContent("e.toPrecision is not a function")
  })
  it("heatmap colors diverge around zero", () => {
    expect(cellColor(null, -1, 1, true)).toBe("transparent")
    expect(cellColor(-1, -1, 1, true)).toContain("215")
    expect(cellColor(1, -1, 1, true)).toContain("5 75%")
    expect(cellColor(0.5, 0, 1, false)).toContain("215")
  })
})
