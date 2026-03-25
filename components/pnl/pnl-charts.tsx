'use client'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
} from 'recharts'

const DEPT_COLORS = {
  SURGERY: 'hsl(173 58% 39%)',
  IT: 'hsl(239 84% 67%)',
  LOAN_DEMAT: 'hsl(263 70% 50%)',
  GOOGLE_ADS: 'hsl(38 92% 50%)',
}

export function PnlTrendChart({
  chartSeries,
}: {
  chartSeries: { monthKey: string; month: number; year: number; revenue: number; expenses: number; net: number }[]
}) {
  const data = chartSeries.map((c) => ({
    label: `${c.month}/${String(c.year).slice(-2)}`,
    revenue: c.revenue,
    expenses: c.expenses,
    net: c.net,
  }))

  return (
    <ChartContainer
      config={{
        revenue: { label: 'Revenue', color: 'hsl(142 76% 36%)' },
        expenses: { label: 'Expenses', color: 'hsl(346 77% 49%)' },
        net: { label: 'Net P&L', color: 'hsl(221 83% 53%)' },
      }}
      className="h-[320px] w-full"
    >
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} className="text-xs" />
        <YAxis tickLine={false} axisLine={false} className="text-xs" tickFormatter={(v) => `${(v / 100000).toFixed(1)}L`} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
        <Line type="monotone" dataKey="net" stroke="var(--color-net)" strokeWidth={2} dot />
      </ComposedChart>
    </ChartContainer>
  )
}

export function PnlRevenueDonut({
  revenueByDepartment,
}: {
  revenueByDepartment: Record<string, Record<string, number>>
}) {
  const keys = ['SURGERY', 'IT', 'LOAN_DEMAT', 'GOOGLE_ADS'] as const
  const totals: Record<string, number> = {}
  keys.forEach((k) => {
    totals[k] = Object.values(revenueByDepartment[k] || {}).reduce((a, b) => a + b, 0)
  })
  const total = keys.reduce((s, k) => s + totals[k], 0)
  const data = keys.map((k) => ({
    name: k.replace('_', ' '),
    value: totals[k],
    fill: DEPT_COLORS[k],
  })).filter((d) => d.value > 0)

  if (total <= 0) {
    return <p className="text-sm text-muted-foreground py-12 text-center">No revenue in range</p>
  }

  return (
    <ChartContainer config={{}} className="h-[320px] w-full mx-auto aspect-square max-h-[280px]">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent />} />
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={56} outerRadius={96} paddingAngle={2}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}
