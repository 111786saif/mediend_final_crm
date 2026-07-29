/** Shared date helpers for AI tools */

export function currentMonthYYYYMM(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function monthToRange(month: string): { start: Date; end: Date } {
  const [year, mon] = month.split('-').map(Number)
  const start = new Date(year, mon - 1, 1)
  const end = new Date(year, mon, 0, 23, 59, 59, 999)
  return { start, end }
}

export function defaultDateRange(): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${d}` }
}

export function parseYmdRange(from?: string, to?: string): { start: Date; end: Date; from: string; to: string } {
  const defaults = defaultDateRange()
  const f = from || defaults.from
  const t = to || defaults.to
  const [sy, sm, sd] = f.split('-').map(Number)
  const [ey, em, ed] = t.split('-').map(Number)
  return {
    from: f,
    to: t,
    start: new Date(Date.UTC(sy, sm - 1, sd, 0, 0, 0, 0)),
    end: new Date(Date.UTC(ey, em - 1, ed, 23, 59, 59, 999)),
  }
}

export function progressStatus(percentage: number): 'completed' | 'on_track' | 'at_risk' {
  if (percentage >= 100) return 'completed'
  if (percentage >= 70) return 'on_track'
  return 'at_risk'
}
