import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { DEFAULT_CHART_SETTINGS, parseLimit, parseWindow, type BandMode, type ChartSettings } from "@/lib/chart-settings"

type Limit = "xMin" | "xMax" | "yMin" | "yMax"
const LIMITS: { id: Limit; label: string }[] = [
  { id: "xMin", label: "x min" },
  { id: "xMax", label: "x max" },
  { id: "yMin", label: "y min" },
  { id: "yMax", label: "y max" },
]

export interface ChartSettingsFormProps {
  value: ChartSettings
  onChange: (next: ChartSettings) => void
  bands: boolean // whether this chart can show bands
  shortestRun?: number | null // smallest window the API actually used, when a run is shorter than the setting
}

export function ChartSettingsForm({ value, onChange, bands, shortestRun }: ChartSettingsFormProps) {
  const [draft, setDraft] = useState<Record<Limit, string>>(() => ({
    xMin: value.xMin?.toString() ?? "",
    xMax: value.xMax?.toString() ?? "",
    yMin: value.yMin?.toString() ?? "",
    yMax: value.yMax?.toString() ?? "",
  }))
  const [windowText, setWindowText] = useState(String(value.window))
  const invalid = (id: Limit) => parseLimit(draft[id]) === undefined
  const commit = (id: Limit) => {
    const v = parseLimit(draft[id])
    if (v !== undefined && v !== value[id]) onChange({ ...value, [id]: v })
  }
  const commitWindow = () => {
    const w = parseWindow(windowText)
    if (w !== undefined && w !== value.window) onChange({ ...value, window: w })
  }

  return (
    <div className="flex flex-col gap-3 text-xs">
      {bands && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">band</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={value.band}
            onValueChange={(v) => v && onChange({ ...value, band: v as BandMode })}
            aria-label="Band"
          >
            <ToggleGroupItem value="none" className="h-7 text-xs">none</ToggleGroupItem>
            <ToggleGroupItem value="std" className="h-7 text-xs">mean ± std</ToggleGroupItem>
            <ToggleGroupItem value="minmax" className="h-7 text-xs">min – max</ToggleGroupItem>
          </ToggleGroup>
          <div className="mt-1 flex items-center gap-2">
            <Label htmlFor="band-window" className="text-xs text-muted-foreground">
              window
            </Label>
            <Input
              id="band-window"
              inputMode="numeric"
              value={windowText}
              aria-invalid={parseWindow(windowText) === undefined}
              onChange={(e) => setWindowText(e.target.value)}
              onBlur={commitWindow}
              onKeyDown={(e) => e.key === "Enter" && commitWindow()}
              className="h-7 w-20 font-mono text-xs"
            />
            <span className="text-[11px] text-muted-foreground">raw points</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Each plotted point shows the spread of the {value.window} raw values centred on it, whatever 'points' is set to.
            {shortestRun !== null && shortestRun !== undefined && shortestRun < value.window && ` Runs shorter than that use all ${shortestRun} of their points.`}
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {LIMITS.map(({ id, label }) => (
          <div key={id} className="flex flex-col gap-1">
            <Label htmlFor={`limit-${id}`} className="text-xs text-muted-foreground">
              {label}
            </Label>
            <Input
              id={`limit-${id}`}
              inputMode="decimal"
              placeholder="auto"
              value={draft[id]}
              aria-invalid={invalid(id)}
              onChange={(e) => setDraft((d) => ({ ...d, [id]: e.target.value }))}
              onBlur={() => commit(id)}
              onKeyDown={(e) => e.key === "Enter" && commit(id)}
              className="h-7 font-mono text-xs"
            />
          </div>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 self-end text-xs"
        onClick={() => {
          setDraft({ xMin: "", xMax: "", yMin: "", yMax: "" })
          setWindowText(String(DEFAULT_CHART_SETTINGS.window))
          onChange(DEFAULT_CHART_SETTINGS)
        }}
      >
        Reset
      </Button>
    </div>
  )
}
