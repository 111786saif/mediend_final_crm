'use client'

import type { PipelineStatusBucket } from '@/lib/pipeline-lead-buckets'
import { PIPELINE_BUCKET_LABELS, countBuckets } from '@/lib/pipeline-lead-buckets'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

const BUCKET_ORDER: Exclude<PipelineStatusBucket, 'all'>[] = [
  'new_hot',
  'follow_up',
  'ipd_done',
  'dnp',
  'junk',
  'lost',
  'closed',
]

const BUCKET_COLORS: Record<Exclude<PipelineStatusBucket, 'all'>, string> = {
  new_hot: '#007AFF',
  follow_up: '#5856D6',
  ipd_done: '#34C759',
  dnp: '#FF9500',
  junk: '#FF3B30',
  lost: '#8E8E93',
  closed: '#34C759',
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
  counts?: Record<Exclude<PipelineStatusBucket, 'all'>, number>
  total?: number
  selected: PipelineStatusBucket
  onSelect: (b: PipelineStatusBucket) => void
  isLoading?: boolean
}) {
  const counts = useMemo(() => {
    if (countsProp) return countsProp
    return countBuckets(leads ?? [])
  }, [countsProp, leads])

  const total = totalProp ?? leads?.length ?? 0
  const totalForPct = total || 1

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[96px] rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
      <button
        type="button"
        onClick={() => onSelect('all')}
        className={cn(
          'rounded-xl border bg-card p-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
          selected === 'all' ? 'ring-2 ring-primary' : 'border-border/80',
        )}
      >
        <p className="text-[11px] font-medium text-muted-foreground">All in view</p>
        <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{total}</p>
        <p className="text-[11px] text-muted-foreground">Leads</p>
      </button>
      {BUCKET_ORDER.map((key) => {
        const c = counts[key]
        const pct = ((c / totalForPct) * 100).toFixed(1)
        const color = BUCKET_COLORS[key]
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={cn(
              'rounded-xl border bg-card p-3.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
              selected === key ? 'ring-2 ring-primary' : 'border-border/80',
            )}
          >
            <p className="line-clamp-2 text-[11px] font-medium leading-snug text-muted-foreground">
              {PIPELINE_BUCKET_LABELS[key]}
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight" style={{ color }}>
              {c}
            </p>
            <p className="text-[11px] text-muted-foreground">{pct}% of view</p>
            <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (c / totalForPct) * 100)}%`, background: color }}
              />
            </div>
          </button>
        )
      })}
    </div>
  )
}
