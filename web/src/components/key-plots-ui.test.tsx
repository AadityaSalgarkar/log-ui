import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { StylePicker } from "@/components/charts/KeyPlotPanel"
import { MetricChart, type LineSpec } from "@/components/charts/MetricChart"
import { PinMenu } from "@/components/charts/PinMenu"
import { DASH_ARRAY, autoStyle, type KeyPlot } from "@/lib/key-plots"

const xs = Array.from({ length: 40 }, (_, i) => i + 1)
const s = (f: (x: number) => number) => ({ x: xs, y: xs.map(f) })

describe("key plot chart", () => {
  it("draws one line per run x metric: colour is the run, dash is the metric", () => {
    const runs = { alpha: "#d62728", beta: "#1f77b4" }
    const keys = ["train/loss", "val/loss", "val/acc"]
    const series: Record<string, ReturnType<typeof s>> = {}
    const lines: LineSpec[] = []
    for (const [run, color] of Object.entries(runs)) {
      keys.forEach((key, i) => {
        series[`${run}|${key}`] = s((x) => (i + 1) / x)
        lines.push({ id: `${run}|${key}`, color, label: key, group: run, style: autoStyle(i) })
      })
    }
    const { container } = render(<MetricChart series={series} lines={lines} colors={runs} width={600} height={240} />)
    const paths = [...container.querySelectorAll(".recharts-line-curve")]
    expect(paths).toHaveLength(6)
    const byStroke = (color: string) => paths.filter((p) => p.getAttribute("stroke") === color)
    expect(byStroke("#d62728")).toHaveLength(3) // colour never changes with the metric
    const dashes = byStroke("#1f77b4").map((p) => p.getAttribute("stroke-dasharray"))
    expect(dashes[1]).toBe(DASH_ARRAY.dashed)
    expect(dashes[2]).toBe(DASH_ARRAY.dotted)
    expect(new Set(dashes).size).toBe(3)
  })
  it("draws sparse markers for metrics whose style has one", () => {
    const style = { dash: "solid", marker: "square", width: "regular" } as const
    const { container } = render(
      <MetricChart series={{ a: s((x) => x) }} lines={[{ id: "a", color: "#111", label: "m", group: "run", style }]} colors={{}} width={600} height={240} />,
    )
    const squares = container.querySelectorAll(".recharts-line-dots rect")
    expect(squares.length).toBeGreaterThan(1)
    expect(squares.length).toBeLessThan(xs.length) // sparse, not one per point
  })
})

describe("pin menu", () => {
  const plots: KeyPlot[] = [
    { id: "ab", title: null, keys: ["A", "B"], styles: {} },
    { id: "cd", title: "other", keys: ["C", "D"], styles: {} },
  ]
  it("starts a new key plot or ticks any number of existing ones, staying open", async () => {
    const onNew = vi.fn()
    const onToggle = vi.fn()
    render(<PinMenu metric="A" plots={plots} onNew={onNew} onToggle={onToggle} />)
    await userEvent.click(screen.getByRole("button", { name: "Key plots for A" }))
    expect(screen.getByRole("menuitemcheckbox", { name: "A + B" })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("menuitemcheckbox", { name: "other" })).toHaveAttribute("aria-checked", "false")
    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "other" }))
    expect(onToggle).toHaveBeenLastCalledWith("cd", "A") // A now also co-viewed with C and D
    expect(screen.getByRole("menuitem", { name: /New key plot/ })).toBeInTheDocument() // menu still open
    await userEvent.click(screen.getByRole("menuitem", { name: /New key plot/ }))
    expect(onNew).toHaveBeenCalledWith("A")
  })
})

describe("style picker", () => {
  it("changes dash, marker and thickness, and removes the metric", async () => {
    const onChange = vi.fn()
    const onRemove = vi.fn()
    render(<StylePicker metric="val/loss" style={autoStyle(0)} onChange={onChange} onRemove={onRemove} />)
    await userEvent.click(screen.getByRole("radio", { name: "dash dotted" }))
    expect(onChange).toHaveBeenLastCalledWith({ dash: "dotted", marker: "none", width: "regular" })
    await userEvent.click(screen.getByRole("radio", { name: "marker diamond" }))
    expect(onChange).toHaveBeenLastCalledWith({ dash: "solid", marker: "diamond", width: "regular" })
    await userEvent.click(screen.getByRole("radio", { name: "thickness thick" }))
    expect(onChange).toHaveBeenLastCalledWith({ dash: "solid", marker: "none", width: "thick" })
    await userEvent.click(screen.getByRole("button", { name: "Remove from this plot" }))
    expect(onRemove).toHaveBeenCalled()
  })
})
