'use client'

import { useMemo, useState } from 'react'
import { Sankey, Tooltip, ResponsiveContainer } from 'recharts'
import type { PnlOverviewData } from '@/components/pnl/types'
import { PNL_EXPENSE_SOURCE_KEYS } from '@/lib/pnl/constants'

function formatLakhs(n: number): string {
  if (Math.abs(n) >= 100_000) {
    const l = n / 100_000
    return `₹${l.toFixed(l >= 10 ? 1 : 2)}L`
  }
  if (Math.abs(n) >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}

function formatInr(n: number): string {
  return '₹' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

function sumExpenseBySource(data: PnlOverviewData, sourceKey: (typeof PNL_EXPENSE_SOURCE_KEYS)[number]): number {
  let sum = 0
  for (const cat of data.categories) {
    if (cat.type !== 'EXPENSE' || cat.sourceKey !== sourceKey) continue
    for (const v of Object.values(cat.amounts)) sum += v
  }
  return sum
}

type NodeMeta = { name: string; color: string; labelSide: 'left' | 'right'; amount: number }

const COLORS = {
  surgeryRev: '#10b981',
  itRev: '#06b6d4',
  loanRev: '#8b5cf6',
  adsRev: '#f59e0b',
  totalRevenue: '#0284c7',
  netProfit: '#059669',
  netLoss: '#dc2626',
  totalExpenses: '#e11d48',
  salary: '#f43f5e',
  seatCost: '#fb7185',
  marketing: '#f97316',
  freelancers: '#a855f7',
  misc: '#64748b',
} as const

export function PnlSankeyChart({ data }: { data: PnlOverviewData }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const { graph, nodeMeta } = useMemo(() => {
    const dept = (key: string) => data.departments.find((d) => d.key === key)
    const surgery = dept('SURGERY')?.totalRevenue ?? 0
    const it = dept('IT')?.totalRevenue ?? 0
    const loan = dept('LOAN_DEMAT')?.totalRevenue ?? 0
    const ads = dept('GOOGLE_ADS')?.totalRevenue ?? 0

    const R = data.totals.totalRevenue
    const E = data.totals.totalExpenses
    const N = data.totals.netPnL

    const toProfit = Math.max(N, 0)
    const toExpenses = E

    const salary = sumExpenseBySource(data, 'SALARY')
    const seat = sumExpenseBySource(data, 'SEAT_COST')
    const mktg = sumExpenseBySource(data, 'MARKETING')
    const free = sumExpenseBySource(data, 'FREELANCERS')
    const misc = sumExpenseBySource(data, 'MISC')

    const meta: NodeMeta[] = [
      { name: 'Surgery', color: COLORS.surgeryRev, labelSide: 'left', amount: surgery },
      { name: 'IT', color: COLORS.itRev, labelSide: 'left', amount: it },
      { name: 'Loan & Demat', color: COLORS.loanRev, labelSide: 'left', amount: loan },
      { name: 'Google Ads', color: COLORS.adsRev, labelSide: 'left', amount: ads },
      { name: 'Total Revenue', color: COLORS.totalRevenue, labelSide: 'right', amount: R },
      { name: N >= 0 ? 'Net Profit' : 'Net Loss', color: N >= 0 ? COLORS.netProfit : COLORS.netLoss, labelSide: 'right', amount: Math.abs(N) },
      { name: 'Total Expenses', color: COLORS.totalExpenses, labelSide: 'right', amount: E },
      { name: 'Salary', color: COLORS.salary, labelSide: 'right', amount: salary },
      { name: 'Seat Cost', color: COLORS.seatCost, labelSide: 'right', amount: seat },
      { name: 'Marketing', color: COLORS.marketing, labelSide: 'right', amount: mktg },
      { name: 'Freelancers', color: COLORS.freelancers, labelSide: 'right', amount: free },
      { name: 'Misc', color: COLORS.misc, labelSide: 'right', amount: misc },
    ]

    const nodes = meta.map((m) => ({ name: m.name, color: m.color, amount: m.amount }))

    const links: { source: number; target: number; value: number; color: string }[] = [
      { source: 0, target: 4, value: surgery, color: COLORS.surgeryRev },
      { source: 1, target: 4, value: it, color: COLORS.itRev },
      { source: 2, target: 4, value: loan, color: COLORS.loanRev },
      { source: 3, target: 4, value: ads, color: COLORS.adsRev },
      { source: 4, target: 5, value: toProfit, color: N >= 0 ? COLORS.netProfit : COLORS.netLoss },
      { source: 4, target: 6, value: toExpenses, color: COLORS.totalExpenses },
      { source: 6, target: 7, value: salary, color: COLORS.salary },
      { source: 6, target: 8, value: seat, color: COLORS.seatCost },
      { source: 6, target: 9, value: mktg, color: COLORS.marketing },
      { source: 6, target: 10, value: free, color: COLORS.freelancers },
      { source: 6, target: 11, value: misc, color: COLORS.misc },
    ].filter((l) => l.value > 0)

    return { graph: { nodes, links }, nodeMeta: meta }
  }, [data])

  const noData = data.totals.totalRevenue === 0 && data.totals.totalExpenses === 0

  if (noData) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
        No P&amp;L data for this period — try a different date range or add entries
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="h-[460px] min-w-[600px]">
        <ResponsiveContainer width="100%" height="100%">
          <Sankey
            data={graph}
            nodePadding={22}
            nodeWidth={14}
            linkCurvature={0.5}
            iterations={64}
            margin={{ top: 16, right: 160, bottom: 16, left: 160 }}
            node={(props: any) => {
              const { x, y, width, height, index } = props
              const meta = nodeMeta[index]
              if (!meta) return <rect x={x} y={y} width={width} height={height} fill="#64748b" rx={3} />
              const isLeft = meta.labelSide === 'left'
              return (
                <g>
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    fill={meta.color}
                    rx={3}
                    opacity={0.92}
                    style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }}
                  />
                  <text
                    x={isLeft ? x - 6 : x + width + 6}
                    y={y + height / 2 - 6}
                    textAnchor={isLeft ? 'end' : 'start'}
                    fill="currentColor"
                    className="text-[11px] font-semibold fill-foreground"
                  >
                    {meta.name}
                  </text>
                  <text
                    x={isLeft ? x - 6 : x + width + 6}
                    y={y + height / 2 + 8}
                    textAnchor={isLeft ? 'end' : 'start'}
                    className="text-[10px] font-medium fill-muted-foreground"
                  >
                    {formatLakhs(meta.amount)}
                  </text>
                </g>
              )
            }}
            link={(props: any) => {
              const {
                sourceX,
                sourceY,
                sourceControlX,
                targetX,
                targetY,
                targetControlX,
                linkWidth,
                index,
              } = props
              const linkColor = graph.links[index]?.color ?? '#94a3b8'
              const isHovered = hoverIdx === index
              return (
                <path
                  d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
                  fill="none"
                  stroke={linkColor}
                  strokeWidth={linkWidth}
                  strokeOpacity={isHovered ? 0.55 : 0.25}
                  onMouseEnter={() => setHoverIdx(index)}
                  onMouseLeave={() => setHoverIdx(null)}
                  style={{ transition: 'stroke-opacity 150ms ease' }}
                />
              )
            }}
          >
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0]
                const name = p?.name ?? ''
                const value = (p?.value as number) ?? 0
                return (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-lg">
                    <div className="font-semibold text-popover-foreground">{name}</div>
                    <div className="tabular-nums font-medium text-muted-foreground mt-0.5">
                      {formatInr(value)}
                    </div>
                  </div>
                )
              }}
            />
          </Sankey>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
