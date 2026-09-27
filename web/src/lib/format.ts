// Formatters run inside chart tooltips and axes, where one throw blanks the page; anything non-numeric shows "-".
export function fmtNum(v: number | null | undefined, digits = 4): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "-"
  if (v === 0) return "0"
  const a = Math.abs(v)
  if (a >= 1e6 || a < 1e-4) return v.toExponential(2)
  if (a >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return trimZeros(v.toPrecision(digits))
}

export function fmtInt(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "-"
  return Math.round(v).toLocaleString()
}

/** Drop trailing zeros after a decimal point only: "1.50" -> "1.5", "2.00" -> "2", but "140" stays "140". */
const trimZeros = (s: string) => (s.includes(".") && !s.includes("e") ? s.replace(/0+$/, "").replace(/\.$/, "") : s)

export function fmtTick(v: number): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "-"
  const a = Math.abs(v)
  if (a >= 1e6) return `${trimZeros((v / 1e6).toPrecision(3))}M`
  if (a >= 1e3) return `${trimZeros((v / 1e3).toPrecision(3))}k`
  if (a > 0 && a < 1e-3) return v.toExponential(1)
  return Number(v.toPrecision(3)).toString()
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "-"
  const neg = seconds < 0
  let s = Math.abs(seconds)
  const d = Math.floor(s / 86400)
  s -= d * 86400
  const h = Math.floor(s / 3600)
  s -= h * 3600
  const m = Math.floor(s / 60)
  s -= m * 60
  let out: string
  if (d > 0) out = `${d}d ${h}h`
  else if (h > 0) out = `${h}h ${m}m`
  else if (m > 0) out = `${m}m ${Math.floor(s)}s`
  else out = `${s < 10 ? s.toFixed(1) : Math.floor(s)}s`
  return neg ? `-${out}` : out
}

export function timeAgo(epochSeconds: number | null | undefined, now = Date.now() / 1000): string {
  if (!epochSeconds) return "-"
  const diff = now - epochSeconds
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} h ago`
  return `${Math.floor(diff / 86400)} d ago`
}

export function fmtDate(iso: string): string {
  if (!iso) return "-"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

/** "val/human/bpb" -> ["val", "human/bpb"] */
export function splitKey(key: string): [string, string] {
  const i = key.indexOf("/")
  return i < 0 ? ["", key] : [key.slice(0, i), key.slice(i + 1)]
}
