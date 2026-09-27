import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Toggle } from "@/components/ui/toggle"
import type { WsState } from "@/lib/url-state"
import type { XMode } from "@/types"

export function WorkspaceControls({ state, update }: { state: WsState; update: (p: Partial<WsState>) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border bg-card px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">x</Label>
        <Select value={state.x} onValueChange={(v) => update({ x: v as XMode })}>
          <SelectTrigger size="sm" className="h-7 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="step">step</SelectItem>
            <SelectItem value="relative_time">relative time</SelectItem>
            <SelectItem value="wall_time">wall time</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex w-52 items-center gap-2">
        <Label className="text-xs text-muted-foreground">smoothing</Label>
        <Slider value={[state.smoothing]} min={0} max={0.99} step={0.01} onValueChange={([v]) => update({ smoothing: Number(v.toFixed(2)) })} aria-label="Smoothing" />
        <span className="w-8 font-mono tabular-nums">{state.smoothing.toFixed(2)}</span>
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">points</Label>
        <Select value={String(state.maxPoints)} onValueChange={(v) => update({ maxPoints: Number(v) })}>
          <SelectTrigger size="sm" className="h-7 w-24 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[200, 500, 1000, 2000, 5000, 0].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n === 0 ? "all" : n}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Toggle size="sm" pressed={state.logy} onPressedChange={(v) => update({ logy: v })} aria-label="Log y axis" className="h-7 text-xs">
        log y
      </Toggle>
      <Toggle size="sm" pressed={state.live} onPressedChange={(v) => update({ live: v })} aria-label="Live updates" className="h-7 text-xs">
        <span className={state.live ? "mr-1 inline-block size-1.5 animate-pulse rounded-full bg-emerald-500" : "mr-1 inline-block size-1.5 rounded-full bg-muted-foreground"} />
        live
      </Toggle>
    </div>
  )
}
