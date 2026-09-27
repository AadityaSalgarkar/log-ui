export function fmtNum(v: number | null | undefined, digits = 4): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "-"
  if (v === 0) return "0"
  const a = Math.abs(v)
  if (a >= 1e6 || a < 1e-4) return v.toExponential(2)
  if (a >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return v.toPrecision(digits).replace(/\.?0+$/, "")
}

export function fmtInt(v: number | null | undefined): string {
  if (v === null || v === undefined) return "-"
  return Math.round(v).toLocaleString()
}

export function fmtTick(v: number): string {
  const a = Math.abs(v)
  if (a >= 1e6) return `${(v / 1e6).toPrecision(3).replace(/\.?0+$/, "")}M`
  if (a >= 1e3) return `${(v / 1e3).toPrecision(3).replace(/\.?0+$/, "")}k`
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
