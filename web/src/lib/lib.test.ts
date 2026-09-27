import { describe, expect, it } from "vitest"

import { PALETTE, colorMap, runColor } from "./colors"
import { fmtDuration, fmtNum, fmtTick, splitKey, timeAgo } from "./format"
import { groupKeys, lastValue, mergeSeries } from "./series"
import { DEFAULTS, parseState, stateToParams } from "./url-state"

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
  it("groups keys by prefix", () => {
    const g = groupKeys(["val/x/bpb", "train/loss", "loss", "train/lr"])
    expect([...g.keys()]).toEqual(["", "train", "val"])
    expect(g.get("train")).toEqual(["train/loss", "train/lr"])
    expect(lastValue({ x: [1, 2], y: [3, 4] })).toBe(4)
    expect(lastValue(undefined)).toBeNull()
  })
})

describe("url state", () => {
  it("round-trips non-default values and keeps other params", () => {
    const state = { ...DEFAULTS, runs: ["a", "b"], x: "relative_time" as const, smoothing: 0.6, logy: true, live: false, metric: "bpb", point: "best" as const }
    const sp = stateToParams(state, new URLSearchParams("foo=1"))
    expect(sp.get("foo")).toBe("1")
    expect(sp.get("runs")).toBe("a,b")
    expect(sp.get("max_points")).toBeNull()
    expect(parseState(sp)).toEqual(state)
  })
  it("uses defaults for missing or invalid values", () => {
    const s = parseState(new URLSearchParams("x=bogus&smoothing=2&max_points=abc"))
    expect(s).toEqual(DEFAULTS)
    expect(parseState(new URLSearchParams("runs=")).runs).toEqual([])
    expect(stateToParams(DEFAULTS).toString()).toBe("")
  })
})
