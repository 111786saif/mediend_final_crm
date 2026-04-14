'use client'

import { CalendarDays, Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'

export function CalendarStatStrip({
  upcomingMeets,
  upcomingInterviews,
  isLoading,
}: {
  upcomingMeets: number
  upcomingInterviews: number
  isLoading?: boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3">
      <StatCard
        icon={<CalendarDays className="h-4 w-4" />}
        label="Upcoming meets"
        value={isLoading ? '—' : upcomingMeets}
        sub="next 30 days"
        tone="indigo"
      />
      <StatCard
        icon={<Briefcase className="h-4 w-4" />}
        label="Interviews"
        value={isLoading ? '—' : upcomingInterviews}
        sub="next 30 days"
        tone="violet"
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
  tone: 'indigo' | 'violet'
}) {
  const toneClass =
    tone === 'indigo'
      ? 'from-indigo-50 to-indigo-100 border-indigo-200 text-indigo-700 dark:from-indigo-950/40 dark:to-indigo-900/30 dark:border-indigo-900 dark:text-indigo-200'
      : 'from-violet-50 to-violet-100 border-violet-200 text-violet-700 dark:from-violet-950/40 dark:to-violet-900/30 dark:border-violet-900 dark:text-violet-200'
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
