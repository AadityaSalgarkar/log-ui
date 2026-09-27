import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Toggle } from "@/components/ui/toggle"
import type { WsState } from "@/lib/url-state"
import type { XMode } from "@/types"

const X_LABELS: Record<XMode, string> = { step: "step", relative_time: "relative time", wall_time: "wall time" }

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={htmlFor} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

/** Axis, smoothing and sampling for every chart on the page; sticks under the header while scrolling. */
export function WorkspaceControls({ state, update }: { state: WsState; update: (p: Partial<WsState>) => void }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 -mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-b bg-background/90 px-4 py-2 backdrop-blur md:-mx-6 md:px-6">
      <Field label="x axis" htmlFor="ctl-x">
        <Select value={state.x} onValueChange={(v) => update({ x: v as XMode })}>
          <SelectTrigger id="ctl-x" size="sm" className="h-7 w-32 bg-card text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(X_LABELS) as XMode[]).map((m) => (
              <SelectItem key={m} value={m} className="text-xs">
                {X_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="smoothing">
        <Slider
          className="w-36"
          value={[state.smoothing]}
          min={0}
          max={0.99}
          step={0.01}
          onValueChange={([v]) => update({ smoothing: Number(v.toFixed(2)) })}
          aria-label="Smoothing"
        />
        <span className="w-8 font-mono text-xs tabular-nums">{state.smoothing.toFixed(2)}</span>
      </Field>
      <Field label="points" htmlFor="ctl-points">
        <Select value={String(state.maxPoints)} onValueChange={(v) => update({ maxPoints: Number(v) })}>
          <SelectTrigger id="ctl-points" size="sm" className="h-7 w-20 bg-card font-mono text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[200, 500, 1000, 2000, 5000, 0].map((n) => (
              <SelectItem key={n} value={String(n)} className="font-mono text-xs">
                {n === 0 ? "all" : n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Toggle
        size="sm"
        variant="outline"
        pressed={state.logy}
        onPressedChange={(v) => update({ logy: v })}
        aria-label="Log scale y axis"
        className="h-7 bg-card px-2.5 font-mono text-xs data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
      >
        log y
      </Toggle>
    </div>
  )
}
