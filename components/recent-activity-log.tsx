'use client'

import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import type { RequestActivityItem } from '@/lib/finance/doctor-payoff/types'
import { cn } from '@/lib/utils'

interface RecentActivityLogProps {
  className?: string
  title?: string
  items?: RequestActivityItem[]
  emptyMessage?: string
  viewAllHref?: string
  isLoading?: boolean
  /** Use on light Finance pages; default matches doctor/hospital dark panels */
  variant?: 'dark' | 'light'
}

function actionDotClass(action: string): string {
  const a = action.toUpperCase()
  if (a === 'APPROVED' || a === 'VERIFIED') return 'bg-emerald-500'
  if (a === 'REJECTED') return 'bg-rose-500'
  if (a === 'SUBMITTED') return 'bg-amber-500'
  return 'bg-sky-500'
}

export function RequestActivityLogPanel({
  className = '',
  title = 'Recent Activity Log',
  items = [],
  emptyMessage = 'No activity yet',
  viewAllHref,
  isLoading,
  variant = 'dark',
}: RecentActivityLogProps) {
  const router = useRouter()
  const isLight = variant === 'light'

  return (
    <div
      className={cn(
        'rounded-xl flex flex-col shadow-lg border',
        isLight
          ? 'bg-card border-border'
          : 'bg-[#191D2E]/60 backdrop-blur-md border-[#283150]',
        className
      )}
    >
      <div
        className={cn(
          'px-3.5 py-2 border-b flex items-center justify-between',
          isLight ? 'border-border' : 'border-[#283150]'
        )}
      >
        <h3 className={cn('font-bold text-xs', isLight ? 'text-foreground' : 'text-white')}>
          {title}
        </h3>
        {viewAllHref ? (
          <button
            type="button"
            className={cn(
              'text-xs hover:underline',
              isLight ? 'text-primary' : 'text-[#22d3ee]'
            )}
            onClick={() => router.push(viewAllHref)}
          >
            View All
          </button>
        ) : (
          <span className="text-[10px] text-muted-foreground">{items.length} events</span>
        )}
      </div>
      <div className="p-3 space-y-2 max-h-[280px] overflow-y-auto">
        {isLoading ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Loading activity…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">{emptyMessage}</p>
        ) : (
          items.map((item, index) => (
            <div key={item.id}>
              {index > 0 && (
                <div
                  className={cn(
                    'h-px mb-2',
                    isLight ? 'bg-border/60' : 'bg-[#283150]/20'
                  )}
                />
              )}
              <div className="flex items-start gap-2">
                <div
                  className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${actionDotClass(item.action)}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <p
                      className={cn(
                        'text-xs leading-snug',
                        isLight ? 'text-foreground' : 'text-[#dce1ff]'
                      )}
                    >
                      {item.message}
                    </p>
                    <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-foreground">
                    <span>{item.actor.name}</span>
                    <span>·</span>
                    <span className="uppercase tracking-wide text-[10px]">{item.action}</span>
                  </div>
                  {item.remarks && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 italic truncate">
                      {item.remarks}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

/** Backward-compatible export used by doctor/hospital pages before props were added. */
export function RecentActivityLog(props: RecentActivityLogProps) {
  return <RequestActivityLogPanel {...props} />
}
