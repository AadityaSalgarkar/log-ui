import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export interface Stat {
  label: string
  value: string
  hint?: string
}

export function StatCards({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => (
        <Card key={s.label} className="gap-1 py-4">
          <CardHeader className="px-4">
            <CardDescription className="text-xs">{s.label}</CardDescription>
            <CardTitle className="font-mono text-xl tabular-nums">{s.value}</CardTitle>
          </CardHeader>
          {s.hint && <CardContent className="px-4 text-xs text-muted-foreground">{s.hint}</CardContent>}
        </Card>
      ))}
    </div>
  )
}
