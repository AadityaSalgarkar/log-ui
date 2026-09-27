import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { DEFAULT_CHART_SETTINGS, parseLimit, type BandMode, type ChartSettings } from "@/lib/chart-settings"

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
  window?: number | null // raw points per window, when known
}

export function ChartSettingsForm({ value, onChange, bands, window }: ChartSettingsFormProps) {
  const [draft, setDraft] = useState<Record<Limit, string>>(() => ({
    xMin: value.xMin?.toString() ?? "",
    xMax: value.xMax?.toString() ?? "",
    yMin: value.yMin?.toString() ?? "",
    yMax: value.yMax?.toString() ?? "",
  }))
  const invalid = (id: Limit) => parseLimit(draft[id]) === undefined
  const commit = (id: Limit) => {
    const v = parseLimit(draft[id])
    if (v !== undefined && v !== value[id]) onChange({ ...value, [id]: v })
  }

  return (
    <div className="flex flex-col gap-3 text-xs">
      {bands && (
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">band over each window</Label>
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
          <p className="text-[11px] text-muted-foreground">
            {window === undefined || window === null
              ? "Windows follow the 'points' setting: each plotted point covers n / points raw values."
              : window <= 1
                ? "Window is 1 point, so the band is flat. Lower 'points' to widen it."
                : `Each window covers ${window} raw points (set by 'points').`}
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
          onChange(DEFAULT_CHART_SETTINGS)
        }}
      >
        Reset
      </Button>
    </div>
  )
}
