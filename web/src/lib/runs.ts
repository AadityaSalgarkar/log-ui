import type { RunInfo } from "@/types"

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
