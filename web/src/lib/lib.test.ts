import { describe, expect, it } from "vitest"

import { PALETTE, colorMap, runColor } from "./colors"
import { fmtDuration, fmtInt, fmtNum, fmtTick, splitKey, timeAgo } from "./format"
import { DEFAULT_CHART_SETTINGS, bandIds, bandRequests, isDefault, parseChartSettings, parseWindow } from "./chart-settings"
import { bandField, bandRange, buildKeyTree, lastValue, mergeSeries, tooltipItems } from "./series"
import type { RunInfo } from "@/types"
import { runsRevision } from "./project-context"
import { DEFAULTS, formatPoints, parsePoints, parseState, stateToParams } from "./url-state"

describe("colors", () => {
  it("assigns stable colors by creation order regardless of list order", () => {
    const a = { name: "a", created_epoch: 1 }
    const b = { name: "b", created_epoch: 2 }
    expect(colorMap([b, a])).toEqual(colorMap([a, b]))
    expect(colorMap([a, b]).a).toBe(PALETTE[0])
    expect(colorMap([a, b]).b).toBe(PALETTE[1])
  })
  it("wraps after the palette and falls back for unknown runs", () => {
    const runs = Array.from({ length: PALETTE.length + 1 }, (_, i) => ({ name: `r${i}`, created_epoch: i }))
    const m = colorMap(runs)
    expect(m[`r${PALETTE.length}`]).toBe(PALETTE[0])
    expect(runColor(m, "nope")).toBe("#888888")
  })
})

describe("format", () => {
  it("formats numbers compactly", () => {
    expect(fmtNum(null)).toBe("-")
    expect(fmtNum(1.234567)).toBe("1.235")
    expect(fmtNum(0.00001234)).toBe("1.23e-5")
    expect(fmtNum(123456789)).toBe("1.23e+8")
    expect(fmtNum(1234.5)).toBe("1,235")
    expect(fmtTick(1500)).toBe("1.5k")
    expect(fmtTick(2_000_000)).toBe("2M")
  })
  it("keeps zeros that belong to whole numbers in ticks", () => {
    expect(fmtTick(140e6)).toBe("140M") // was "14M"
    expect(fmtTick(900e3)).toBe("900k") // was "9k"
    expect(fmtTick(105e6)).toBe("105M")
    expect(fmtTick(1.2e6)).toBe("1.2M")
    expect(fmtTick(2000)).toBe("2k")
    expect(fmtTick(100)).toBe("100")
    expect(fmtNum(100)).toBe("100")
    expect(fmtNum(0.5)).toBe("0.5")
  })
  it("never throws on non-numbers (chart tooltips can pass arrays)", () => {
    for (const bad of [[1, 2], "x", undefined, null, NaN, Infinity] as unknown as number[]) {
      expect(fmtNum(bad)).toBe("-")
      expect(fmtTick(bad)).toBe("-")
      expect(fmtInt(bad)).toBe("-")
    }
  })
  it("formats durations and ages", () => {
    expect(fmtDuration(5)).toBe("5.0s")
    expect(fmtDuration(65)).toBe("1m 5s")
    expect(fmtDuration(3700)).toBe("1h 1m")
    expect(fmtDuration(90000)).toBe("1d 1h")
    expect(timeAgo(1000, 1030)).toBe("just now")
    expect(timeAgo(1000, 1000 + 120)).toBe("2 min ago")
    expect(splitKey("val/human/bpb")).toEqual(["val", "human/bpb"])
    expect(splitKey("loss")).toEqual(["", "loss"])
  })
})

describe("series", () => {
  it("merges runs by x with nulls for missing points", () => {
    const rows = mergeSeries({ a: { x: [1, 2, 3], y: [1, 2, 3] }, b: { x: [2, 4], y: [20, 40] }, c: undefined })
    expect(rows).toEqual([
      { x: 1, a: 1 },
      { x: 2, a: 2, b: 20 },
      { x: 3, a: 3 },
      { x: 4, b: 40 },
    ])
  })
  it("nulls non-positive values when log scale is on", () => {
    const rows = mergeSeries({ a: { x: [1, 2], y: [0, 5] } }, true)
    expect(rows[0].a).toBeNull()
    expect(rows[1].a).toBe(5)
  })
  const band = { x: [1, 3], mean: [2, 4], std: [0.5, 1], min: [1, 2], max: [3, 7], window: 2 }
  it("adds band ranges per window when a band mode is chosen", () => {
    const s = { a: { x: [1, 2, 3], y: [2, 3, 4], band } }
    expect(mergeSeries(s)).toEqual(mergeSeries(s, false, "none"))
    const std = mergeSeries(s, false, "std")
    expect(std[0][bandField("a")]).toEqual([1.5, 2.5])
    expect(std[1][bandField("a")]).toBeUndefined() // x=2 is not a window middle
    expect(std[2][bandField("a")]).toEqual([3, 5])
    expect(mergeSeries(s, false, "minmax")[2][bandField("a")]).toEqual([2, 7])
    expect(bandRange(band, "minmax", 0)).toEqual([1, 3])
  })
  it("clips band lows to the smallest positive edge on a log axis", () => {
    const s = { a: { x: [1, 3], y: [1, 2], band: { ...band, mean: [0.2, 4], std: [1, 1] } } }
    const rows = mergeSeries(s, true, "std")
    expect(rows[0][bandField("a")]).toEqual([1.2, 1.2]) // low -0.8 clipped to the smallest positive edge, 1.2
    expect(rows[1][bandField("a")]).toEqual([3, 5])
    const allNegative = mergeSeries({ a: { x: [1], y: [1], band: { ...band, x: [1], mean: [-5], std: [1] } } }, true, "std")
    expect(allNegative[0][bandField("a")]).toBeUndefined()
  })
  it("tooltip keeps run lines and drops band areas (whose value is a [low, high] pair)", () => {
    const payload = [
      { name: "a", dataKey: "a", value: 1.5, color: "#111" },
      { name: bandField("a"), dataKey: bandField("a"), value: [1, 2], color: "#111" },
      { name: "b", dataKey: "b", value: 2.5, color: "#222" },
      { name: "c", dataKey: "c", value: null },
    ]
    expect(tooltipItems(payload).map((p) => p.name)).toEqual(["b", "a"])
  })
  it("nests keys into groups by path segment", () => {
    const root = buildKeyTree(["loss/train/xent", "loss/total", "loss/train/aux", "loss/val/xent", "val/acc", "lr", "train/loss"])
    expect(root.keys).toEqual(["lr"]) // no "/" -> root level
    expect(root.children.map((c) => c.name)).toEqual(["train", "loss", "val"]) // train first at the top level
    const loss = root.children.find((c) => c.name === "loss")!
    expect(loss.keys).toEqual(["loss/total"]) // direct charts
    expect(loss.children.map((c) => [c.path, c.depth, c.keys])).toEqual([
      ["loss/train", 2, ["loss/train/aux", "loss/train/xent"]],
      ["loss/val", 2, ["loss/val/xent"]],
    ])
    expect(loss.total).toBe(4)
    expect(root.total).toBe(7)
    expect(buildKeyTree(["a/b/c/d"]).children[0].children[0].children[0].keys).toEqual(["a/b/c/d"]) // any depth
  })
  it("requests bands as key:window, metric and system keys to their own endpoints", () => {
    const m = parseChartSettings(
      JSON.stringify({ "train/loss": { band: "std", window: 25 }, "system:gpu": { band: "minmax" }, "view:val/x": { band: "std" }, lr: { yMin: 0 } }),
    )
    expect(bandRequests(m)).toEqual({ metrics: ["train/loss:25"], system: ["gpu:10"] })
  })
  it("reads the last value of a series", () => {
    expect(lastValue({ x: [1, 2], y: [3, 4] })).toBe(4)
    expect(lastValue(undefined)).toBeNull()
  })
})

describe("runs revision", () => {
  const r = (name: string, n_rows: number, last_step: number) => ({ name, n_rows, last_step }) as RunInfo
  it("changes only when a selected run logs new rows", () => {
    const before = runsRevision([r("a", 10, 9), r("b", 5, 4)], ["a"])
    expect(runsRevision([r("b", 99, 98), r("a", 10, 9)], ["a"])).toBe(before) // unselected runs and order don't matter
    expect(runsRevision([r("a", 11, 10), r("b", 5, 4)], ["a"])).not.toBe(before)
    expect(runsRevision([r("a", 10, 9)], ["a", "b"])).not.toBe(runsRevision([r("a", 10, 9), r("b", 1, 0)], ["a", "b"]))
  })
})

describe("chart settings", () => {
  it("parses stored settings tolerantly", () => {
    const stored = JSON.stringify({ a: { band: "std", window: 30, xMin: 10, yMax: 2.5 }, b: { band: "bogus", window: -3, xMin: "x" }, c: 3 })
    const m = parseChartSettings(stored)
    expect(m.a).toEqual({ band: "std", window: 30, xMin: 10, xMax: null, yMin: null, yMax: 2.5 })
    expect(m.b).toEqual(DEFAULT_CHART_SETTINGS)
    expect(m.c).toBeUndefined()
    expect(parseChartSettings("not json")).toEqual({})
    expect(parseChartSettings(null)).toEqual({})
  })
  it("lists band ids and detects defaults", () => {
    const m = parseChartSettings(JSON.stringify({ z: { band: "minmax" }, a: { band: "std" }, n: { band: "none", yMin: 0 } }))
    expect(bandIds(m, Object.keys(m))).toEqual(["a", "z"])
    expect(bandIds(m, ["a", "missing"])).toEqual(["a"])
    expect(isDefault(DEFAULT_CHART_SETTINGS)).toBe(true)
    expect(isDefault(m.n)).toBe(false)
    expect(isDefault({ ...DEFAULT_CHART_SETTINGS, window: 5 })).toBe(false)
    expect(parseWindow("12")).toBe(12)
    for (const bad of ["0", "1.5", "-2", "x", "10001"]) expect(parseWindow(bad)).toBeUndefined()
  })
})

describe("url state", () => {
  it("round-trips non-default values and keeps other params", () => {
    const state = { ...DEFAULTS, runs: ["a", "b"], x: "relative_time" as const, smoothing: 0.6, logy: true, metric: "bpb", point: "best" as const }
    const sp = stateToParams(state, new URLSearchParams("foo=1"))
    expect(sp.get("foo")).toBe("1")
    expect(sp.get("runs")).toBe("a,b")
    expect(sp.get("max_points")).toBeNull()
    expect(parseState(sp)).toEqual(state)
  })
  it("parses free-form point counts", () => {
    expect(parsePoints("750")).toBe(750)
    expect(parsePoints(" 10,000 ")).toBe(10000)
    expect(parsePoints("All")).toBe(0)
    expect(parsePoints("0")).toBe(0)
    for (const bad of ["", "-5", "1.5", "abc", "2000000"]) expect(parsePoints(bad)).toBeUndefined()
    expect(formatPoints(0)).toBe("all")
    expect(parseState(new URLSearchParams("max_points=750")).maxPoints).toBe(750)
    expect(parseState(new URLSearchParams("max_points=1.5")).maxPoints).toBe(DEFAULTS.maxPoints) // the API needs an integer
  })
  it("uses defaults for missing or invalid values", () => {
    const s = parseState(new URLSearchParams("x=bogus&smoothing=2&max_points=abc"))
    expect(s).toEqual(DEFAULTS)
    expect(parseState(new URLSearchParams("runs=")).runs).toEqual([])
    expect(stateToParams(DEFAULTS).toString()).toBe("")
  })
})
