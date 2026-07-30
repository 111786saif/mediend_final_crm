'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

const COLORS = ['#7c3aed', '#a855f7', '#c084fc', '#22c55e', '#f59e0b', '#ef4444']

function Card({
  title,
  children,
  className,
}: {
  title?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border bg-background/80 p-3 mt-2', className)}>
      {title && (
        <div className="text-xs font-semibold text-muted-foreground mb-2">{title}</div>
      )}
      {children}
    </div>
  )
}

function StatGrid({
  items,
}: {
  items: { label: string; value: string | number }[]
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg bg-muted/50 px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {item.label}
          </div>
          <div className="text-sm font-semibold tabular-nums">{item.value}</div>
        </div>
      ))}
    </div>
  )
}

function DataTable({ rows }: { rows: Record<string, unknown>[] }) {
  if (!rows.length) return null
  const cols = Object.keys(rows[0]).slice(0, 6)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            {cols.map((c) => (
              <th key={c} className="py-1.5 pr-3 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 20).map((row, i) => (
            <tr key={i} className="border-b border-border/50">
              {cols.map((c) => (
                <td key={c} className="py-1.5 pr-3 tabular-nums">
                  {formatCell(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatCell(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(1)
  if (typeof v === 'boolean') return v ? 'yes' : 'no'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export function ToolWidget({
  toolName,
  output,
}: {
  toolName: string
  output: unknown
}) {
  if (!output || typeof output !== 'object') return null
  const data = output as Record<string, unknown>

  if (data.error) return null

  switch (toolName) {
    case 'getMyTargetProgress': {
      const targets = (data.targets as Array<Record<string, unknown>>) || []
      if (!targets.length) return null
      return (
        <Card title={`Target progress · ${String(data.month ?? '')}`}>
          <div className="space-y-3">
            {targets.map((t, i) => (
              <div key={i}>
                <StatGrid
                  items={[
                    { label: 'Metric', value: String(t.metric) },
                    { label: 'Target', value: Number(t.targetValue) },
                    { label: 'Actual', value: Number(t.actual) },
                    { label: '%', value: `${t.percentage}%` },
                    { label: 'Status', value: String(t.status) },
                  ]}
                />
                <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-600"
                    style={{
                      width: `${Math.min(100, Number(t.percentage) || 0)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )
    }

    case 'getMyTargetTrend': {
      const points = (data.points as Array<Record<string, unknown>>) || []
      if (!points.length) return null
      return (
        <Card title="Target trend">
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="targetValue"
                  stroke="#a855f7"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )
    }

    case 'getMyLeaveBalance': {
      const balances = (data.balances as Array<Record<string, unknown>>) || []
      if (!balances.length) return null
      return (
        <Card title="Leave balance">
          <StatGrid
            items={balances.map((b) => ({
              label: String(b.leaveTypeName),
              value: `${b.remaining} left / ${b.allocated}`,
            }))}
          />
        </Card>
      )
    }

    case 'getMyAttendanceStats':
    case 'getMyIpdCount':
    case 'getMyIncentive':
    case 'getOrgSalesKpis':
    case 'getOrgHrKpis': {
      const flat: { label: string; value: string | number }[] = []
      const walk = (obj: Record<string, unknown>, prefix = '') => {
        for (const [k, v] of Object.entries(obj)) {
          if (k === 'error' || k === 'message') continue
          if (v != null && typeof v === 'object' && !Array.isArray(v)) {
            walk(v as Record<string, unknown>, prefix)
          } else if (typeof v === 'number' || typeof v === 'string') {
            flat.push({ label: k, value: v })
          }
        }
      }
      walk(data)
      if (!flat.length) return null
      return (
        <Card title={toolName.replace(/^get/, '').replace(/([A-Z])/g, ' $1')}>
          <StatGrid items={flat.slice(0, 9)} />
        </Card>
      )
    }

    case 'getTeamAttendanceSummary': {
      const summary = data.summary as Record<string, number> | undefined
      const members = (data.members as Array<Record<string, unknown>>) || []
      const pie = summary
        ? [
            { name: 'Present', value: summary.present || 0 },
            { name: 'Absent', value: summary.absent || 0 },
            { name: 'Late', value: summary.late || 0 },
            { name: 'On leave', value: summary.onLeave || 0 },
          ].filter((d) => d.value > 0)
        : []
      return (
        <Card title="Team attendance">
          {pie.length > 0 && (
            <div className="h-36 mb-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" outerRadius={55} label>
                    {pie.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          {members.length > 0 && <DataTable rows={members} />}
        </Card>
      )
    }

    case 'getTeamIpdLeaderboard':
    case 'getOrgIpdLeaderboard': {
      const board =
        (data.leaderboard as Array<{ name: string; ipdDone: number }>) || []
      if (!board.length) return null
      return (
        <Card title="IPD leaderboard">
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={board.slice(0, 10)} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={80}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip />
                <Bar dataKey="ipdDone" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )
    }

    case 'searchKnowledgeBase': {
      const results =
        (data.results as Array<{ title: string; excerpt: string; documentId: string }>) ||
        []
      if (!results.length) return null
      return (
        <Card title="Sources">
          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={`${r.documentId}-${i}`}
                className="rounded-lg border px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-1.5 font-medium">
                  <FileText className="size-3.5 text-violet-500" />
                  {r.title}
                </div>
                <p className="mt-1 text-muted-foreground line-clamp-3">{r.excerpt}</p>
              </div>
            ))}
          </div>
        </Card>
      )
    }

    case 'getIpdBreakdown': {
      const breakdown = (data.breakdown as Array<Record<string, unknown>>) || []
      if (!breakdown.length) return null
      return (
        <Card title={`IPD by ${String(data.dimension)}`}>
          <DataTable rows={breakdown} />
        </Card>
      )
    }

    default: {
      // Generic: render first array of objects found
      for (const v of Object.values(data)) {
        if (
          Array.isArray(v) &&
          v.length > 0 &&
          typeof v[0] === 'object' &&
          v[0] !== null
        ) {
          return (
            <Card>
              <DataTable rows={v as Record<string, unknown>[]} />
            </Card>
          )
        }
      }
      return null
    }
  }
}
