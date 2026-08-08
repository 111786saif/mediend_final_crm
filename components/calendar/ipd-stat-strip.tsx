'use client'

import { Stethoscope, CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'

export function IpdStatStrip({
  label = 'Cases',
  totalIpdInRange,
  ipdThisMonth,
  isLoading,
}: {
  /** Short label reflecting the active type filter, e.g. "IPD", "OPD", "IPD/OPD" */
  label?: string
  totalIpdInRange: number
  ipdThisMonth: number
  isLoading?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      <StatCard
        icon={<Stethoscope className="h-4 w-4" />}
        label={`${label} in view`}
        value={isLoading ? '—' : totalIpdInRange}
        sub="visible range"
        tone="emerald"
      />
      <StatCard
        icon={<CalendarClock className="h-4 w-4" />}
        label={`${label} this month`}
        value={isLoading ? '—' : ipdThisMonth}
        sub="current calendar month"
        tone="teal"
      />
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  sub: string
  tone: 'emerald' | 'teal'
}) {
  const toneClass =
    tone === 'emerald'
      ? 'from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700 dark:from-emerald-950/40 dark:to-emerald-900/30 dark:border-emerald-900 dark:text-emerald-200'
      : 'from-teal-50 to-teal-100 border-teal-200 text-teal-700 dark:from-teal-950/40 dark:to-teal-900/30 dark:border-teal-900 dark:text-teal-200'
  return (
    <div
      className={cn(
        'rounded-2xl border bg-gradient-to-br p-3 min-w-0',
        toneClass
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide opacity-80">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-2xl font-bold leading-none">{value}</div>
      <div className="mt-0.5 text-[10px] opacity-70">{sub}</div>
    </div>
  )
}