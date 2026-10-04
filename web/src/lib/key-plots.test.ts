import { describe, expect, it } from "vitest"

import {
  addKey,
  addPlot,
  autoStyle,
  deletePlot,
  migratePins,
  parsePlots,
  plotTitle,
  plotsWith,
  removeKey,
  renamePlot,
  setStyle,
  styleFor,
  styleId,
  toggleKey,
  type KeyPlot,
} from "./key-plots"

const plot = (id: string, keys: string[], title: string | null = null): KeyPlot => ({ id, title, keys, styles: {} })

describe("key plots", () => {
  it("pairs are many-to-many: A can be co-viewed with B, C and D in separate plots", () => {
    let plots: KeyPlot[] = []
    plots = addPlot(plots, "A", "ab")
    plots = addPlot(plots, "A", "ac")
    plots = addPlot(plots, "A", "ad")
    plots = addKey(plots, "ab", "B")
    plots = addKey(plots, "ac", "C")
    plots = addKey(plots, "ad", "D")
    expect(plots.map((p) => p.keys)).toEqual([["A", "B"], ["A", "C"], ["A", "D"]])
    expect(plotsWith(plots, "A").map((p) => p.id)).toEqual(["ab", "ac", "ad"])
    expect(plotsWith(plots, "C").map((p) => p.id)).toEqual(["ac"])
    plots = addKey(plots, "ab", "C") // C now in two plots
    expect(plotsWith(plots, "C").map((p) => p.id)).toEqual(["ab", "ac"])
    expect(addKey(plots, "ab", "B")).toEqual(plots) // adding twice is a no-op
  })
  it("removing a key only affects that plot; an emptied plot disappears", () => {
    let plots = [plot("ab", ["A", "B"]), plot("ac", ["A", "C"])]
    plots = removeKey(plots, "ab", "A")
    expect(plots).toEqual([plot("ab", ["B"]), plot("ac", ["A", "C"])])
    plots = removeKey(plots, "ab", "B")
    expect(plots.map((p) => p.id)).toEqual(["ac"])
    expect(toggleKey(plots, "ac", "D")[0].keys).toEqual(["A", "C", "D"])
    expect(toggleKey(plots, "ac", "C")[0].keys).toEqual(["A"])
    expect(deletePlot(plots, "ac")).toEqual([])
  })
  it("titles: explicit, else the shared leaf, else the keys", () => {
    expect(plotTitle(plot("1", ["train/loss", "val/loss"]))).toBe("loss")
    expect(plotTitle(plot("1", ["train/loss", "val/acc"]))).toBe("train/loss + val/acc")
    expect(plotTitle(plot("1", ["train/loss"]))).toBe("train/loss") // a single metric keeps its full path
    expect(plotTitle(renamePlot([plot("1", ["a"])], "1", "  my plot ")[0])).toBe("my plot")
    expect(renamePlot([plot("1", ["a"], "x")], "1", "   ")[0].title).toBeNull() // blank resets to derived
  })
  it("styles: the first 30 metrics are all distinct; overrides stick per plot", () => {
    const ids = Array.from({ length: 30 }, (_, i) => styleId(autoStyle(i)))
    expect(new Set(ids).size).toBe(30)
    expect(autoStyle(0)).toEqual({ dash: "solid", marker: "none", width: "regular" })
    const plots = setStyle([plot("p", ["a", "b"])], "p", "b", { dash: "dotted", marker: "square", width: "thick" })
    expect(styleFor(plots[0], "b")).toEqual({ dash: "dotted", marker: "square", width: "thick" })
    expect(styleFor(plots[0], "a")).toEqual(autoStyle(0))
    expect(removeKey(plots, "p", "b")[0].styles).toEqual({}) // a removed key takes its style with it
  })
  it("parses stored plots tolerantly and migrates old pins", () => {
    const stored = JSON.stringify([
      { id: "ok", title: "t", keys: ["a", "a", "b"], styles: { a: { dash: "dotted", marker: "none", width: "thin" }, b: { dash: "bogus" } } },
      { id: "empty", keys: [] },
      { keys: ["no-id"] },
      "junk",
    ])
    expect(parsePlots(stored)).toEqual([{ id: "ok", title: "t", keys: ["a", "b"], styles: { a: { dash: "dotted", marker: "none", width: "thin" } } }])
    expect(parsePlots(null)).toBeNull() // nothing stored yet: caller migrates
    expect(parsePlots("not json")).toEqual([])
    expect(migratePins(JSON.stringify(["train/loss", "val/acc"])).map((p) => p.keys)).toEqual([["train/loss"], ["val/acc"]])
    expect(migratePins(null)).toEqual([])
    expect(migratePins("{}")).toEqual([])
  })
})
