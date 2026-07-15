'use client'

import { useAuth } from '@/hooks/use-auth'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { format } from 'date-fns'
import { Progress } from '@/components/ui/progress'
import { Target, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TargetProgress {
  id: string
  targetType: string
  targetForId: string
  periodType: 'WEEK' | 'MONTH'
  metric: string
  targetValue: number
  actual: number
  percentage: number
  entityName: string
  status?: string
  periodStartDate: string
  periodEndDate: string
  createdBy?: { id: string; name: string } | null
  bonusRules?: {
    ruleType: 'PERCENT_ABOVE_TARGET' | 'FIXED_COUNT'
    thresholdValue: number
    bonusAmount: number | null
    bonusPercentage: number | null
    capAmount: number | null
  }[]
}

// ── Config ────────────────────────────────────────────────────────────────────

const TARGET_ROLES = ['BD', 'TEAM_LEAD']

const METRIC_LABELS: Record<string, string> = {
  IPD_DONE: 'IPDs',
  SURGERIES_DONE: 'Surgeries',
  LEADS_CLOSED: 'Leads Closed',
  LEADS_GENERATED: 'Leads Generated',
  NET_PROFIT: 'Net Profit',
  BILL_AMOUNT: 'Bill Amount',
  REVENUE: 'Revenue',
  HEAD_COUNT: 'Hires',
}

function fmtVal(value: number, metric: string) {
  if (['NET_PROFIT', 'BILL_AMOUNT', 'REVENUE'].includes(metric)) {
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
    if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`
    return `₹${value}`
  }
  return String(value)
}

function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// ── Pick best matching target ─────────────────────────────────────────────────
// Prefers a currently-active period, falls back to the most recently started one.
// This handles test data with old dates gracefully.

function pickBest(list: TargetProgress[], periodType: 'WEEK' | 'MONTH') {
  const filtered = list.filter((t) => t.periodType === periodType)
  if (!filtered.length) return undefined
  const now = new Date()
  const active = filtered.find((t) => {
    const s = new Date(t.periodStartDate)
    const e = new Date(t.periodEndDate)
    return s <= now && now <= e
  })
  if (active) return active
  // fallback: most recently started
  return [...filtered].sort(
    (a, b) => new Date(b.periodStartDate).getTime() - new Date(a.periodStartDate).getTime()
  )[0]
}

// ── Shared progress hook ───────────────────────────────────────────────────────
// Used by both the banner ring (home page) and this dashboard's own hero card.

export function useMyTargetProgress() {
  const { user } = useAuth()
  const monthKey = useMemo(() => currentMonthKey(), [])
  const isTargetRole = !!user && TARGET_ROLES.includes(user.role)

  const { data: progress } = useQuery<TargetProgress[]>({
    queryKey: ['workspace-target-progress', monthKey, user?.id],
    queryFn: () => apiGet<TargetProgress[]>(`/api/targets/progress?month=${monthKey}`),
    enabled: !!user?.id && isTargetRole,
  })

  const monthly = pickBest(progress ?? [], 'MONTH')
  const weekly = pickBest(progress ?? [], 'WEEK')

  return { isTargetRole, monthly, weekly }
}

// ── Circular Ring ─────────────────────────────────────────────────────────────

export function Ring({ pct, size = 100, empty = false }: { pct: number; size?: number; empty?: boolean }) {
  const stroke = 9
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const clamped = Math.min(pct, 100)
  const offset = circ - (clamped / 100) * circ
  const color = pct >= 100 ? '#10b981' : pct >= 60 ? '#1EC5B7' : '#f59e0b'

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} />
      {!empty && (
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      )}
      <text
        x={size / 2} y={size / 2}
        textAnchor="middle" dominantBaseline="middle"
        fill="white" fontWeight="700" fontSize={size * 0.19}
        style={{ transform: 'rotate(90deg)', transformOrigin: '50% 50%' }}
      >
        {empty ? '–' : `${Math.round(clamped)}%`}
      </text>
    </svg>
  )
}

// ── Motivation text ───────────────────────────────────────────────────────────

function motivationText(actual: number, target: number, metric: string) {
  const label = METRIC_LABELS[metric] ?? metric.replace(/_/g, ' ').toLowerCase()
  const remaining = Math.max(0, target - actual)
  if (actual === 0) return `Set the pace — ${target} ${label} to go this month`
  if (remaining === 0) return `You've hit your goal! All ${target} ${label} done 🎉`
  return `You're ${actual} ${label} in — ${remaining} more to reach your goal`
}

// ── Hero Card ─────────────────────────────────────────────────────────────────

function HeroCard({ t }: { t: TargetProgress }) {
  const label = METRIC_LABELS[t.metric] ?? t.metric.replace(/_/g, ' ')

  return (
    <div
      className="relative rounded-2xl overflow-hidden p-5 shadow-lg"
      style={{ background: 'linear-gradient(135deg, #062D4C 0%, #0a4170 50%, #0e6b65 100%)' }}
    >
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top right, rgba(30,197,183,0.15), transparent 60%)' }} />

      <div className="relative flex gap-4 items-center">
        {/* Ring */}
        <div className="shrink-0 flex flex-col items-center gap-0.5">
          <Ring pct={t.percentage} size={92} />
          <p className="text-[10px] text-white/50 tracking-wide uppercase">of target</p>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-[15px] leading-snug">
            {motivationText(t.actual, t.targetValue, t.metric)}
          </p>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <div>
              <p className="text-white/50 text-[10px] uppercase tracking-wide">{label}</p>
              <p className="text-white font-bold text-sm tabular-nums">
                {fmtVal(t.actual, t.metric)}{' '}
                <span className="text-white/50 font-normal">/ {fmtVal(t.targetValue, t.metric)}</span>
              </p>
            </div>
            <div>
              <p className="text-white/50 text-[10px] uppercase tracking-wide">Period</p>
              <p className="text-white font-semibold text-sm">
                {format(new Date(t.periodStartDate), 'd MMM')} –{' '}
                {format(new Date(t.periodEndDate), 'd MMM')}
              </p>
            </div>
            {t.status && (
              <div>
                <p className="text-white/50 text-[10px] uppercase tracking-wide">Status</p>
                <p className={`font-semibold text-sm ${
                  t.status === 'completed' ? 'text-emerald-400'
                  : t.status === 'on_track' ? 'text-teal-300'
                  : 'text-amber-400'
                }`}>
                  {t.status === 'completed' ? 'Done ✓'
                   : t.status === 'on_track' ? 'On Track'
                   : 'At Risk'}
                </p>
              </div>
            )}
          </div>

          {t.createdBy?.name && (
            <p className="mt-2 text-white/40 text-[11px]">Assigned by {t.createdBy.name}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Inline ring for the greeting banner ────────────────────────────────────────
// Same content as HeroCard but without its own card background — meant to sit
// directly on top of the banner's gradient, next to "Good morning, {name}".

export function TargetRingInline({ t }: { t: TargetProgress }) {
  const label = METRIC_LABELS[t.metric] ?? t.metric.replace(/_/g, ' ')

  return (
    <div className="relative flex gap-4 items-center rounded-xl bg-black/20 backdrop-blur-sm px-4 py-3 max-w-full">
      <div className="shrink-0 flex flex-col items-center gap-0.5">
        <Ring pct={t.percentage} size={84} />
        <p className="text-[10px] text-white/60 tracking-wide uppercase">of target</p>
      </div>

      <div className="min-w-0">
        <p className="text-white font-semibold text-sm leading-snug whitespace-nowrap">
          {motivationText(t.actual, t.targetValue, t.metric)}
        </p>

        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          <div>
            <p className="text-white/50 text-[10px] uppercase tracking-wide">{label}</p>
            <p className="text-white text-xs font-bold">
              {fmtVal(t.actual, t.metric)}
              <span className="text-white/50 font-normal"> / {fmtVal(t.targetValue, t.metric)}</span>
            </p>
          </div>

          <div>
            <p className="text-white/50 text-[10px] uppercase tracking-wide">Period</p>
            <p className="text-white text-xs font-semibold whitespace-nowrap">
              {format(new Date(t.periodStartDate), 'd MMM')} – {format(new Date(t.periodEndDate), 'd MMM')}
            </p>
          </div>

          {t.status && (
            <div>
              <p className="text-white/50 text-[10px] uppercase tracking-wide">Status</p>
              <p className={`text-xs font-semibold ${
                t.status === 'completed' ? 'text-emerald-400'
                : t.status === 'on_track' ? 'text-teal-300'
                : 'text-amber-400'
              }`}>
                {t.status === 'completed' ? 'Done ✓'
                 : t.status === 'on_track' ? 'On Track'
                 : 'At Risk'}
              </p>
            </div>
          )}
        </div>

        {t.createdBy?.name && (
          <p className="mt-1.5 text-white/40 text-[11px]">Assigned by {t.createdBy.name}</p>
        )}
      </div>
    </div>
  )
}

// ── Empty state (no target assigned this period) ─────────────────────────────
// Keeps the banner slot / hero card / score card visible instead of hiding the
// whole block — shows dashes so the layout stays consistent across users.

export function TargetRingInlineEmpty() {
  return (
    <div className="relative flex gap-4 items-center rounded-xl bg-black/20 backdrop-blur-sm px-4 py-3 max-w-full">
      <div className="shrink-0 flex flex-col items-center gap-0.5">
        <Ring pct={0} size={84} empty />
        <p className="text-[10px] text-white/60 tracking-wide uppercase">of target</p>
      </div>

      <div className="min-w-0">
        <p className="text-white font-semibold text-sm leading-snug whitespace-nowrap">
          No target assigned yet
        </p>

        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          <div>
            <p className="text-white/50 text-[10px] uppercase tracking-wide">Progress</p>
            <p className="text-white text-xs font-bold">–</p>
          </div>
          <div>
            <p className="text-white/50 text-[10px] uppercase tracking-wide">Period</p>
            <p className="text-white text-xs font-semibold whitespace-nowrap">–</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyHeroCard() {
  return (
    <div
      className="relative rounded-2xl overflow-hidden p-5 shadow-lg"
      style={{ background: 'linear-gradient(135deg, #062D4C 0%, #0a4170 50%, #0e6b65 100%)' }}
    >
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at top right, rgba(30,197,183,0.15), transparent 60%)' }} />

      <div className="relative flex gap-4 items-center">
        <div className="shrink-0 flex flex-col items-center gap-0.5">
          <Ring pct={0} size={92} empty />
          <p className="text-[10px] text-white/50 tracking-wide uppercase">of target</p>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-[15px] leading-snug">No target assigned yet</p>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            <div>
              <p className="text-white/50 text-[10px] uppercase tracking-wide">Progress</p>
              <p className="text-white font-bold text-sm tabular-nums">–</p>
            </div>
            <div>
              <p className="text-white/50 text-[10px] uppercase tracking-wide">Period</p>
              <p className="text-white font-semibold text-sm">–</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Weekly Card ───────────────────────────────────────────────────────────────

function WeeklyCard({ t }: { t: TargetProgress }) {
  const pct = Math.min(100, t.percentage)
  const label = METRIC_LABELS[t.metric] ?? t.metric.replace(/_/g, ' ')

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center shrink-0">
            <Target className="size-3.5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Weekly target · {label}</p>
            <p className="text-sm font-bold">
              {fmtVal(t.actual, t.metric)}{' '}
              <span className="text-muted-foreground font-normal">/ {fmtVal(t.targetValue, t.metric)}</span>
            </p>
          </div>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          pct >= 100
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
            : pct >= 60
            ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-400'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
        }`}>
          {pct}%
        </span>
      </div>
      <Progress value={pct} className="h-1.5" />
      <div className="flex justify-between mt-1.5">
        <p className="text-[11px] text-muted-foreground">
          {format(new Date(t.periodStartDate), 'd MMM')} – {format(new Date(t.periodEndDate), 'd MMM')}
        </p>
        {t.createdBy?.name && (
          <p className="text-[11px] text-muted-foreground">by {t.createdBy.name}</p>
        )}
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function BDDashboard() {
  const { user } = useAuth()
  const { isTargetRole, monthly, weekly } = useMyTargetProgress()

  if (!isTargetRole) return null

  const trackerLink =
    user?.role === 'BD' ? '/bd/kyp'
    : user?.role === 'TEAM_LEAD' ? '/team-lead/pipeline'
    : '/sales/targets'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          My Target
        </h2>
        <Link href={trackerLink} className="text-xs text-primary hover:underline flex items-center gap-0.5">
          View details <ChevronRight className="size-3" />
        </Link>
      </div>

      {monthly ? <HeroCard t={monthly} /> : <EmptyHeroCard />}
      {weekly   && <WeeklyCard t={weekly} />}
    </div>
  )
}