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
        label: 'New',
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
        bucket: 'follow_up',
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
        id: 'fund_issued',
        label: 'Fund Issued',
        bucket: 'closed',
        countKey: 'fund_issued',
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
        label: 'IP Done',
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
        id: 'ipd',
        label: 'IPD',
        bucket: 'ipd_done',
        countKey: 'ipd',
        icon: Stethoscope,
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
        label: 'OP Done',
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
        label: 'IPD Sch.',
        bucket: 'follow_up',
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
        label: 'OPD Sch.',
        bucket: 'follow_up',
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
        label: 'Outstation',
        bucket: 'lost',
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
        id: 'duplicate',
        label: 'Duplicate',
        bucket: 'lost',
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
        label: 'IPD Loss',
        bucket: 'lost',
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
        label: 'DNP Exh.',
        bucket: 'dnp',
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
        bucket: 'new_hot',
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

function MiniCircularProgress({
  pct,
  strokeColor,
  size = 28,
  strokeWidth = 2.5,
}: {
  pct: number
  strokeColor: string
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clampedPct = Math.min(100, Math.max(0, isNaN(pct) ? 0 : pct))
  const strokeDashoffset = circumference - (clampedPct / 100) * circumference

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        {/* Full 360-degree visible background track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200 dark:text-slate-700/80"
          fill="transparent"
        />
        {/* Highlighted active percentage arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
          fill="transparent"
        />
      </svg>
      <span className="absolute text-[8px] font-bold tabular-nums text-foreground/80 leading-none">
        {clampedPct < 1 && clampedPct > 0 ? clampedPct.toFixed(1) : Math.round(clampedPct)}%
      </span>
    </div>
  )
}

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-2.5 rounded-xl border border-border/60 bg-muted/20 space-y-2"
          >
            <Skeleton className="h-3.5 w-24 rounded-md bg-muted/60" />
            <div className="grid grid-cols-2 gap-1.5">
              {Array.from({ length: 6 }).map((_, j) => (
                <Skeleton key={j} className="h-9 rounded-lg bg-muted/40" />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
      {CATEGORY_GROUPS.map((group) => (
        <div
          key={group.id}
          className={cn(
            'p-2.5 rounded-xl border transition-all duration-200 shadow-xs flex flex-col justify-between backdrop-blur-xs',
            group.containerBgClass,
            group.containerBorderClass
          )}
        >
          <div>
            <div className="flex items-center justify-between px-1 mb-1.5">
              <h3
                className={cn(
                  'text-[10px] font-extrabold uppercase tracking-widest',
                  group.headerColorClass
                )}
              >
                {group.title}
              </h3>
            </div>

            <div
              className={cn(
                'grid gap-1.5',
                group.id === 'churning' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-1' : 'grid-cols-2'
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

                    {/* Right: Circular Progress + Count */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <MiniCircularProgress
                        pct={pct}
                        strokeColor={item.strokeColor}
                        size={26}
                        strokeWidth={2.5}
                      />
                      <span
                        className={cn(
                          'text-xs font-black tabular-nums tracking-tight',
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
      ))}
    </div>
  )
}
