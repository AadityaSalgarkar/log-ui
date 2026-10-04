import { DASH_ARRAY, WIDTH_PX, type LineStyle, type Marker } from "@/lib/key-plots"

/** An SVG marker shape centred on (cx, cy). */
export function MarkerShape({ marker, cx, cy, r, color }: { marker: Marker; cx: number; cy: number; r: number; color: string }) {
  switch (marker) {
    case "circle":
      return <circle cx={cx} cy={cy} r={r} fill={color} />
    case "square":
      return <rect x={cx - r} y={cy - r} width={2 * r} height={2 * r} fill={color} />
    case "triangle":
      return <path d={`M${cx},${cy - r * 1.2} L${cx + r * 1.1},${cy + r * 0.8} L${cx - r * 1.1},${cy + r * 0.8} Z`} fill={color} />
    case "diamond":
      return <path d={`M${cx},${cy - r * 1.25} L${cx + r},${cy} L${cx},${cy + r * 1.25} L${cx - r},${cy} Z`} fill={color} />
    default:
      return null
  }
}

/** A short line drawn in a given style: the legend, tooltip and style picker all use it. */
export function LineStyleSample({ style, color = "currentColor", width = 28 }: { style: LineStyle; color?: string; width?: number }) {
  return (
    <svg width={width} height={10} viewBox={`0 0 ${width} 10`} aria-hidden className="shrink-0 overflow-visible">
      <line x1={1} y1={5} x2={width - 1} y2={5} stroke={color} strokeWidth={WIDTH_PX[style.width]} strokeDasharray={DASH_ARRAY[style.dash]} strokeLinecap="butt" />
      <MarkerShape marker={style.marker} cx={width / 2} cy={5} r={2.6} color={color} />
    </svg>
  )
}
