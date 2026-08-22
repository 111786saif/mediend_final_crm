'use client'

import { cn } from '@/lib/utils'
import type { CaseEventStatus, CaseEventType } from '@/hooks/use-calendar'

const TYPE_OPTIONS: { value: CaseEventType; label: string }[] = [
  { value: 'IPD', label: 'IPD' },
  { value: 'OPD', label: 'OPD' },
]

const STATUS_OPTIONS: { value: CaseEventStatus; label: string; dot: string }[] = [
  { value: 'DONE', label: 'Done', dot: 'bg-emerald-500' },
  { value: 'SCHEDULED', label: 'Scheduled', dot: 'bg-blue-500' },
  { value: 'POSTPONED', label: 'Postponed', dot: 'bg-amber-500' },
  { value: 'CANCELLED', label: 'Cancelled', dot: 'bg-rose-500' },
  { value: 'POSSIBLE', label: 'Possible', dot: 'bg-purple-500' },
]

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

/**
 * Major IPD / OPD toggle with Done / Scheduled / Postponed / Cancelled
 * sub-filters underneath. Empty type or status selection is treated as
 * "all" by the caller (see ipd-calendar page) — this component just reports
 * what's checked.
 */
export function CaseTypeStatusFilter({
  types,
  onTypesChange,
  statuses,
  onStatusesChange,
}: {
  types: CaseEventType[]
  onTypesChange: (types: CaseEventType[]) => void
  statuses: CaseEventStatus[]
  onStatusesChange: (statuses: CaseEventStatus[]) => void
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 space-y-2.5">
      {/* Major filter: IPD / OPD */}
      <div className="flex items-center gap-2">
        {TYPE_OPTIONS.map((opt) => {
          const active = types.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onTypesChange(toggle(types, opt.value))}
              className={cn(
                'flex-1 rounded-xl py-2 text-sm font-semibold border transition-colors',
                active
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-transparent border-border text-muted-foreground hover:bg-muted/50'
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {/* Sub filter: status */}
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_OPTIONS.map((opt) => {
          const active = statuses.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onStatusesChange(toggle(statuses, opt.value))}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors',
                active
                  ? 'bg-muted border-border text-foreground'
                  : 'bg-transparent border-transparent text-muted-foreground/60 hover:text-muted-foreground'
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', opt.dot, !active && 'opacity-40')} />
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}