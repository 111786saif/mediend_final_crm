'use client'

import type { PipelineStatusBucket } from '@/lib/pipeline-lead-buckets'
import { countBuckets } from '@/lib/pipeline-lead-buckets'
import { cn } from '@/lib/utils'
import { useMemo, useState, useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sparkles,
  Clock,
  PhoneCall,
  CheckCircle2,
  Banknote,
  PhoneOff,
  Building2,
  Stethoscope,
  ClipboardCheck,
  CalendarClock,
  CalendarCheck,
  Trash2,
  MapPinOff,
  Copy,
  HeartCrack,
  PhoneMissed,
  Sprout,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'

export interface PipelineCategoryItem {
  id: string
  label: string
  bucket?: PipelineStatusBucket
  countKey?: string
  icon: LucideIcon
  strokeColor: string
  gradientBgClass: string
  iconBgClass: string
  borderClass: string
  hoverBorderClass: string
  textClass: string
  activeRingClass: string
}

export interface PipelineCategoryGroup {
  id: string
  title: string
  headerColorClass: string
  containerBgClass: string
  containerBorderClass: string
  items: PipelineCategoryItem[]
}

const NURTURE_LEVEL_ITEMS: PipelineCategoryItem[] = [1, 2, 3, 4, 5].map((level) => ({
  id: `nurture_${level}`,
  label: `Nurture ${level}`,
  bucket: `nurture_${level}` as PipelineStatusBucket,
  countKey: `nurture_${level}`,
  icon: Sprout,
  strokeColor: '#9333ea',
  gradientBgClass: 'bg-gradient-to-br from-purple-50/90 via-white/80 to-purple-100/50 dark:from-purple-950/40 dark:via-card dark:to-purple-900/20',
  iconBgClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
  borderClass: 'border-purple-200/80 dark:border-purple-800/50',
  hoverBorderClass: 'hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-purple-500/10',
  textClass: 'text-purple-700 dark:text-purple-400',
  activeRingClass: 'ring-2 ring-purple-500 border-purple-500 shadow-md shadow-purple-500/20 scale-[1.02]',
}))

const CATEGORY_GROUPS: PipelineCategoryGroup[] = [
  {
    id: 'relevant',
    title: 'Relevant Leads',
    headerColorClass: 'text-emerald-700 dark:text-emerald-400',
    containerBgClass: 'bg-gradient-to-b from-emerald-50/60 via-emerald-50/25 to-card dark:from-emerald-950/30 dark:via-emerald-950/15 dark:to-card',
    containerBorderClass: 'border-emerald-200/70 dark:border-emerald-900/40',
    items: [
      {
        id: 'new',
        label: 'New Lead',
        bucket: 'new_hot',
        countKey: 'new',
        icon: Sparkles,
        strokeColor: '#059669',
        gradientBgClass: 'bg-gradient-to-br from-emerald-50/90 via-white/80 to-emerald-100/50 dark:from-emerald-950/40 dark:via-card dark:to-emerald-900/20',
        iconBgClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        borderClass: 'border-emerald-200/80 dark:border-emerald-800/50',
        hoverBorderClass: 'hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-emerald-500/10',
        textClass: 'text-emerald-700 dark:text-emerald-400',
        activeRingClass: 'ring-2 ring-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20 scale-[1.02]',
      },
      {
        id: 'follow_up',
        label: 'Follow-up',
        bucket: 'follow_up',
        countKey: 'follow_up',
        icon: Clock,
        strokeColor: '#059669',
        gradientBgClass: 'bg-gradient-to-br from-emerald-50/90 via-white/80 to-emerald-100/50 dark:from-emerald-950/40 dark:via-card dark:to-emerald-900/20',
        iconBgClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        borderClass: 'border-emerald-200/80 dark:border-emerald-800/50',
        hoverBorderClass: 'hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-emerald-500/10',
        textClass: 'text-emerald-700 dark:text-emerald-400',
        activeRingClass: 'ring-2 ring-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20 scale-[1.02]',
      },
      {
        id: 'callback',
        label: 'Callback',
        bucket: 'callback',
        countKey: 'callback',
        icon: PhoneCall,
        strokeColor: '#059669',
        gradientBgClass: 'bg-gradient-to-br from-emerald-50/90 via-white/80 to-emerald-100/50 dark:from-emerald-950/40 dark:via-card dark:to-emerald-900/20',
        iconBgClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        borderClass: 'border-emerald-200/80 dark:border-emerald-800/50',
        hoverBorderClass: 'hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-emerald-500/10',
        textClass: 'text-emerald-700 dark:text-emerald-400',
        activeRingClass: 'ring-2 ring-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20 scale-[1.02]',
      },
      {
        id: 'closed',
        label: 'Closed',
        bucket: 'closed',
        countKey: 'closed',
        icon: CheckCircle2,
        strokeColor: '#059669',
        gradientBgClass: 'bg-gradient-to-br from-emerald-50/90 via-white/80 to-emerald-100/50 dark:from-emerald-950/40 dark:via-card dark:to-emerald-900/20',
        iconBgClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        borderClass: 'border-emerald-200/80 dark:border-emerald-800/50',
        hoverBorderClass: 'hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-emerald-500/10',
        textClass: 'text-emerald-700 dark:text-emerald-400',
        activeRingClass: 'ring-2 ring-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20 scale-[1.02]',
      },
      {
        id: 'fund_issues',
        label: 'Fund Issues',
        bucket: 'fund_issues',
        countKey: 'fund_issues',
        icon: Banknote,
        strokeColor: '#059669',
        gradientBgClass: 'bg-gradient-to-br from-emerald-50/90 via-white/80 to-emerald-100/50 dark:from-emerald-950/40 dark:via-card dark:to-emerald-900/20',
        iconBgClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        borderClass: 'border-emerald-200/80 dark:border-emerald-800/50',
        hoverBorderClass: 'hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-emerald-500/10',
        textClass: 'text-emerald-700 dark:text-emerald-400',
        activeRingClass: 'ring-2 ring-emerald-500 border-emerald-500 shadow-md shadow-emerald-500/20 scale-[1.02]',
      },
      {
        id: 'dnps',
        label: 'DNPs',
        bucket: 'dnp',
        countKey: 'dnp',
        icon: PhoneOff,
        strokeColor: '#059669',
        gradientBgClass: 'bg-gradient-to-br from-emerald-50/90 via-white/80 to-emerald-100/50 dark:from-emerald-950/40 dark:via-card dark:to-emerald-900/20',
        iconBgClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
        borderClass: 'border-emerald-200/80 dark:border-emerald-800/50',
        hoverBorderClass: 'hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-emerald-500/10',
        textClass: 'text-emerald-700 dark:text-emerald-400',
        activeRingClass: 'ring-2 ring-emerald-500 border-emerald-500 shadow-sm shadow-emerald-500/20 scale-[1.02]',
      },
    ],
  },
  {
    id: 'appointments',
    title: 'Appointments',
    headerColorClass: 'text-blue-700 dark:text-blue-400',
    containerBgClass: 'bg-gradient-to-b from-blue-50/60 via-blue-50/25 to-card dark:from-blue-950/30 dark:via-blue-950/15 dark:to-card',
    containerBorderClass: 'border-blue-200/70 dark:border-blue-900/40',
    items: [
      {
        id: 'ip_done',
        label: 'IPD Done',
        bucket: 'ipd_done',
        countKey: 'ip_done',
        icon: Building2,
        strokeColor: '#2563eb',
        gradientBgClass: 'bg-gradient-to-br from-blue-50/90 via-white/80 to-blue-100/50 dark:from-blue-950/40 dark:via-card dark:to-blue-900/20',
        iconBgClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
        borderClass: 'border-blue-200/80 dark:border-blue-800/50',
        hoverBorderClass: 'hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-blue-500/10',
        textClass: 'text-blue-700 dark:text-blue-400',
        activeRingClass: 'ring-2 ring-blue-500 border-blue-500 shadow-md shadow-blue-500/20 scale-[1.02]',
      },
      {
        id: 'op_done',
        label: 'OPD Done',
        bucket: 'opd_done',
        countKey: 'op_done',
        icon: ClipboardCheck,
        strokeColor: '#2563eb',
        gradientBgClass: 'bg-gradient-to-br from-blue-50/90 via-white/80 to-blue-100/50 dark:from-blue-950/40 dark:via-card dark:to-blue-900/20',
        iconBgClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
        borderClass: 'border-blue-200/80 dark:border-blue-800/50',
        hoverBorderClass: 'hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-blue-500/10',
        textClass: 'text-blue-700 dark:text-blue-400',
        activeRingClass: 'ring-2 ring-blue-500 border-blue-500 shadow-md shadow-blue-500/20 scale-[1.02]',
      },
      {
        id: 'ipd_sch',
        label: 'IPD Scheduled',
        bucket: 'ipd_sch',
        countKey: 'ipd_sch',
        icon: CalendarClock,
        strokeColor: '#2563eb',
        gradientBgClass: 'bg-gradient-to-br from-blue-50/90 via-white/80 to-blue-100/50 dark:from-blue-950/40 dark:via-card dark:to-blue-900/20',
        iconBgClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
        borderClass: 'border-blue-200/80 dark:border-blue-800/50',
        hoverBorderClass: 'hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-blue-500/10',
        textClass: 'text-blue-700 dark:text-blue-400',
        activeRingClass: 'ring-2 ring-blue-500 border-blue-500 shadow-md shadow-blue-500/20 scale-[1.02]',
      },
      {
        id: 'opd_sch',
        label: 'OPD Scheduled',
        bucket: 'opd_sch',
        countKey: 'opd_sch',
        icon: CalendarCheck,
        strokeColor: '#2563eb',
        gradientBgClass: 'bg-gradient-to-br from-blue-50/90 via-white/80 to-blue-100/50 dark:from-blue-950/40 dark:via-card dark:to-blue-900/20',
        iconBgClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
        borderClass: 'border-blue-200/80 dark:border-blue-800/50',
        hoverBorderClass: 'hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-blue-500/10',
        textClass: 'text-blue-700 dark:text-blue-400',
        activeRingClass: 'ring-2 ring-blue-500 border-blue-500 shadow-md shadow-blue-500/20 scale-[1.02]',
      },
    ],
  },
  {
    id: 'irrelevant',
    title: 'Irrelevant',
    headerColorClass: 'text-rose-700 dark:text-rose-400',
    containerBgClass: 'bg-gradient-to-b from-rose-50/60 via-rose-50/25 to-card dark:from-rose-950/30 dark:via-rose-950/15 dark:to-card',
    containerBorderClass: 'border-rose-200/70 dark:border-rose-900/40',
    items: [
      {
        id: 'junk',
        label: 'Junk',
        bucket: 'junk',
        countKey: 'junk',
        icon: Trash2,
        strokeColor: '#e11d48',
        gradientBgClass: 'bg-gradient-to-br from-rose-50/90 via-white/80 to-rose-100/50 dark:from-rose-950/40 dark:via-card dark:to-rose-900/20',
        iconBgClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
        borderClass: 'border-rose-200/80 dark:border-rose-800/50',
        hoverBorderClass: 'hover:border-rose-400 dark:hover:border-rose-600 hover:shadow-rose-500/10',
        textClass: 'text-rose-700 dark:text-rose-400',
        activeRingClass: 'ring-2 ring-rose-500 border-rose-500 shadow-md shadow-rose-500/20 scale-[1.02]',
      },
      {
        id: 'outstation',
        label: 'Out of Station',
        bucket: 'outstation',
        countKey: 'outstation',
        icon: MapPinOff,
        strokeColor: '#d97706',
        gradientBgClass: 'bg-gradient-to-br from-amber-50/90 via-white/80 to-amber-100/50 dark:from-amber-950/40 dark:via-card dark:to-amber-900/20',
        iconBgClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
        borderClass: 'border-amber-200/80 dark:border-amber-800/50',
        hoverBorderClass: 'hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-amber-500/10',
        textClass: 'text-amber-700 dark:text-amber-400',
        activeRingClass: 'ring-2 ring-amber-500 border-amber-500 shadow-md shadow-amber-500/20 scale-[1.02]',
      },
      {
        id: 'outstation_follow_up',
        label: 'Out of Station follow-up',
        bucket: 'outstation_follow_up',
        countKey: 'outstation_follow_up',
        icon: CalendarClock,
        strokeColor: '#d97706',
        gradientBgClass: 'bg-gradient-to-br from-amber-50/90 via-white/80 to-amber-100/50 dark:from-amber-950/40 dark:via-card dark:to-amber-900/20',
        iconBgClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
        borderClass: 'border-amber-200/80 dark:border-amber-800/50',
        hoverBorderClass: 'hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-amber-500/10',
        textClass: 'text-amber-700 dark:text-amber-400',
        activeRingClass: 'ring-2 ring-amber-500 border-amber-500 shadow-md shadow-amber-500/20 scale-[1.02]',
      },
      {
        id: 'duplicate',
        label: 'Duplicate',
        bucket: 'duplicate',
        countKey: 'duplicate',
        icon: Copy,
        strokeColor: '#e11d48',
        gradientBgClass: 'bg-gradient-to-br from-rose-50/90 via-white/80 to-rose-100/50 dark:from-rose-950/40 dark:via-card dark:to-rose-900/20',
        iconBgClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
        borderClass: 'border-rose-200/80 dark:border-rose-800/50',
        hoverBorderClass: 'hover:border-rose-400 dark:hover:border-rose-600 hover:shadow-rose-500/10',
        textClass: 'text-rose-700 dark:text-rose-400',
        activeRingClass: 'ring-2 ring-rose-500 border-rose-500 shadow-md shadow-rose-500/20 scale-[1.02]',
      },
      {
        id: 'ipd_loss',
        label: 'IPD Lost',
        bucket: 'ipd_loss',
        countKey: 'ipd_loss',
        icon: HeartCrack,
        strokeColor: '#e11d48',
        gradientBgClass: 'bg-gradient-to-br from-rose-50/90 via-white/80 to-rose-100/50 dark:from-rose-950/40 dark:via-card dark:to-rose-900/20',
        iconBgClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
        borderClass: 'border-rose-200/80 dark:border-rose-800/50',
        hoverBorderClass: 'hover:border-rose-400 dark:hover:border-rose-600 hover:shadow-rose-500/10',
        textClass: 'text-rose-700 dark:text-rose-400',
        activeRingClass: 'ring-2 ring-rose-500 border-rose-500 shadow-md shadow-rose-500/20 scale-[1.02]',
      },
      {
        id: 'dnp_exh',
        label: 'DNP Exhausted',
        bucket: 'dnp_exh',
        countKey: 'dnp_exh',
        icon: PhoneMissed,
        strokeColor: '#e11d48',
        gradientBgClass: 'bg-gradient-to-br from-rose-50/90 via-white/80 to-rose-100/50 dark:from-rose-950/40 dark:via-card dark:to-rose-900/20',
        iconBgClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
        borderClass: 'border-rose-200/80 dark:border-rose-800/50',
        hoverBorderClass: 'hover:border-rose-400 dark:hover:border-rose-600 hover:shadow-rose-500/10',
        textClass: 'text-rose-700 dark:text-rose-400',
        activeRingClass: 'ring-2 ring-rose-500 border-rose-500 shadow-md shadow-rose-500/20 scale-[1.02]',
      },
    ],
  },
  {
    id: 'churning',
    title: 'Churning Data',
    headerColorClass: 'text-purple-700 dark:text-purple-400',
    containerBgClass: 'bg-gradient-to-b from-purple-50/60 via-purple-50/25 to-card dark:from-purple-950/30 dark:via-purple-950/15 dark:to-card',
    containerBorderClass: 'border-purple-200/70 dark:border-purple-900/40',
    items: [
      {
        id: 'nurture',
        label: 'Nurture',
        bucket: 'nurture',
        countKey: 'nurture',
        icon: Sprout,
        strokeColor: '#9333ea',
        gradientBgClass: 'bg-gradient-to-br from-purple-50/90 via-white/80 to-purple-100/50 dark:from-purple-950/40 dark:via-card dark:to-purple-900/20',
        iconBgClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
        borderClass: 'border-purple-200/80 dark:border-purple-800/50',
        hoverBorderClass: 'hover:border-purple-400 dark:hover:border-purple-600 hover:shadow-purple-500/10',
        textClass: 'text-purple-700 dark:text-purple-400',
        activeRingClass: 'ring-2 ring-purple-500 border-purple-500 shadow-md shadow-purple-500/20 scale-[1.02]',
      },
      ...NURTURE_LEVEL_ITEMS,
      {
        id: 'analytics',
        label: 'Analytics',
        bucket: 'all',
        countKey: 'analytics',
        icon: BarChart3,
        strokeColor: '#64748b',
        gradientBgClass: 'bg-gradient-to-br from-slate-50/90 via-white/80 to-slate-200/50 dark:from-slate-900/50 dark:via-card dark:to-slate-800/30',
        iconBgClass: 'bg-slate-500/15 text-slate-600 dark:text-slate-400',
        borderClass: 'border-slate-200/80 dark:border-slate-800/50',
        hoverBorderClass: 'hover:border-slate-400 dark:hover:border-slate-600 hover:shadow-slate-500/10',
        textClass: 'text-slate-700 dark:text-slate-300',
        activeRingClass: 'ring-2 ring-slate-500 border-slate-500 shadow-md shadow-slate-500/20 scale-[1.02]',
      },
    ],
  },
]

export function PipelineStatusCards({
  leads,
  counts: countsProp,
  total: totalProp,
  selected,
  onSelect,
  isLoading,
}: {
  leads?: { status?: string | null }[]
  counts?: Record<Exclude<PipelineStatusBucket, 'all'>, number> | Record<string, number>
  total?: number
  selected: PipelineStatusBucket
  onSelect: (b: PipelineStatusBucket) => void
  isLoading?: boolean
}) {
  // Track exclusively selected card ID for single-card highlight
  const [activeCardId, setActiveCardId] = useState<string | null>(null)

  // Reset active card if 'all' is selected externally
  useEffect(() => {
    if (selected === 'all') {
      setActiveCardId(null)
    }
  }, [selected])

  const bucketCounts = useMemo(() => {
    if (countsProp) {
      return countsProp as Record<string, number>
    }
    return countBuckets(leads ?? []) as Record<string, number>
  }, [countsProp, leads])

  const total = totalProp ?? leads?.length ?? 0
  const totalForPct = total || 1

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:flex lg:flex-row gap-2.5 w-full min-w-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'p-2.5 rounded-xl border border-border/60 bg-muted/20 space-y-2 min-w-0',
              i === 3 ? 'lg:flex-[0.95] lg:min-w-[280px]' : 'lg:flex-[1.1] lg:min-w-[200px]'
            )}
          >
            <Skeleton className="h-3.5 w-24 rounded-md bg-muted/60" />
            <div className={cn('grid gap-1.5', i === 3 ? 'grid-cols-1' : 'grid-cols-2')}>
              {Array.from({ length: i === 3 ? 2 : 6 }).map((_, j) => (
                <Skeleton key={j} className="h-9 rounded-lg bg-muted/40" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:flex lg:flex-row gap-2.5 w-full min-w-0">
      {CATEGORY_GROUPS.map((group) => {
        const isChurning = group.id === 'churning'

        const groupTotal = group.items.reduce((sum, item) => {
          const count =
            bucketCounts[item.id] ??
            (item.bucket && item.bucket !== 'all' ? bucketCounts[item.bucket] : 0) ??
            0
          return sum + count
        }, 0)

        const pctValue = (groupTotal / totalForPct) * 100
        const groupPct = total > 0 ? (pctValue % 1 === 0 ? pctValue.toFixed(0) : pctValue.toFixed(1)) : '0'

        return (
          <div
            key={group.id}
            className={cn(
              'p-2.5 rounded-xl border transition-all duration-200 shadow-xs flex flex-col justify-between backdrop-blur-xs min-w-0',
              isChurning
                ? 'lg:flex-[0.95] lg:min-w-[280px]'
                : 'lg:flex-[1.1] lg:min-w-[200px]',
              group.containerBgClass,
              group.containerBorderClass
            )}
          >
            <div>
              <div className="flex items-center justify-between gap-1.5 px-1 mb-1.5 min-w-0">
                <h3
                  className={cn(
                    'text-[11px] font-extrabold uppercase tracking-wider truncate',
                    group.headerColorClass
                  )}
                >
                  {group.title}
                </h3>
                <div className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded-md bg-white/85 dark:bg-slate-900/70 border border-inherit/50 font-bold tabular-nums shadow-2xs">
                  <span className={cn('font-black text-[12px] leading-none', group.headerColorClass)}>
                    {groupTotal.toLocaleString()}
                  </span>
                  <span className={cn('font-bold text-[11px] leading-none', group.headerColorClass)}>
                    ({groupPct}%)
                  </span>
                </div>
              </div>

              <div
                className={cn(
                  'grid gap-1.5',
                  isChurning ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'
                )}
              >
                {group.items.map((item) => {
                  const targetBucket = item.bucket ?? 'all'
                  const isSelected = activeCardId === item.id
                  const IconComponent = item.icon

                  // Read count from bucket or specific count key
                  const count =
                    bucketCounts[item.id] ??
                    (item.bucket && item.bucket !== 'all' ? bucketCounts[item.bucket] : 0) ??
                    0

                  const pct = (count / totalForPct) * 100

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (activeCardId === item.id) {
                          setActiveCardId(null)
                          onSelect('all')
                        } else {
                          setActiveCardId(item.id)
                          onSelect(targetBucket)
                        }
                      }}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-xl border text-left transition-all duration-200 cursor-pointer shadow-2xs group relative overflow-hidden',
                        item.gradientBgClass,
                        item.borderClass,
                        item.hoverBorderClass,
                        isSelected ? item.activeRingClass : 'hover:-translate-y-0.5'
                      )}
                    >
                      {/* Left: Icon + Label */}
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
                        <div
                          className={cn(
                            'w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 shadow-2xs',
                            item.iconBgClass
                          )}
                        >
                          <IconComponent className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200 truncate group-hover:text-foreground">
                          {item.label}
                        </span>
                      </div>

                      {/* Right: Count */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={cn(
                            'text-xs font-black tabular-nums tracking-tight px-2 py-0.5 rounded-lg bg-white/70 dark:bg-slate-900/60 shadow-2xs border border-inherit',
                            item.textClass
                          )}
                        >
                          {count}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
