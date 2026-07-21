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
  /** Use on light Finance pages; default matches responsive light/dark panels */
  variant?: 'dark' | 'light'
}

function actionDotClass(action: string): string {
  const a = action.toUpperCase()
  if (a === 'APPROVED' || a === 'VERIFIED') return 'bg-emerald-500 ring-2 ring-emerald-500/20'
  if (a === 'REJECTED') return 'bg-rose-500 ring-2 ring-rose-500/20'
  if (a === 'SUBMITTED') return 'bg-amber-500 ring-2 ring-amber-500/20'
  return 'bg-sky-500 ring-2 ring-sky-500/20'
}

export function RequestActivityLogPanel({
  className = '',
  title = 'Recent Activity Log',
  items = [],
  emptyMessage = 'No activity yet',
  viewAllHref,
  isLoading,
  variant,
}: RecentActivityLogProps) {
  const router = useRouter()
  const isLight = variant === 'light'
  const isDark = variant === 'dark'

  return (
    <div
      className={cn(
        'rounded-xl flex flex-col border shadow-sm transition-all duration-200',
        isLight
          ? 'bg-white border-slate-200 text-slate-900'
          : isDark
          ? 'bg-[#191D2E]/60 backdrop-blur-md border-[#283150] text-[#dce1ff]'
          : 'bg-white border-slate-200 text-slate-900 dark:bg-[#191D2E]/60 dark:border-[#283150] dark:text-[#dce1ff]',
        className
      )}
    >
      <div
        className={cn(
          'px-4 py-3 border-b flex items-center justify-between',
          isLight
            ? 'border-slate-100 bg-slate-50/50'
            : isDark
            ? 'border-[#283150] bg-[#191D2E]/40'
            : 'border-slate-100 bg-slate-50/50 dark:border-[#283150] dark:bg-[#191D2E]/40'
        )}
      >
        <h3
          className={cn(
            'font-bold text-xs tracking-tight',
            isLight
              ? 'text-slate-900'
              : isDark
              ? 'text-white'
              : 'text-slate-900 dark:text-white'
          )}
        >
          {title}
        </h3>
        {viewAllHref ? (
          <button
            type="button"
            className={cn(
              'text-xs font-medium hover:underline transition-colors',
              isLight
                ? 'text-cyan-600'
                : isDark
                ? 'text-[#22d3ee]'
                : 'text-cyan-600 dark:text-[#22d3ee]'
            )}
            onClick={() => router.push(viewAllHref)}
          >
            View All
          </button>
        ) : (
          <span className="text-[10px] text-muted-foreground font-medium">{items.length} events</span>
        )}
      </div>
      <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
        {isLoading ? (
          <p className="text-xs text-muted-foreground py-6 text-center animate-pulse">Loading activity…</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">{emptyMessage}</p>
        ) : (
          items.map((item, index) => (
            <div key={item.id}>
              {index > 0 && (
                <div
                  className={cn(
                    'h-px my-2.5',
                    isLight
                      ? 'bg-slate-100'
                      : isDark
                      ? 'bg-[#283150]/30'
                      : 'bg-slate-100 dark:bg-[#283150]/30'
                  )}
                />
              )}
              <div className="flex items-start gap-2.5">
                <div
                  className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${actionDotClass(item.action)}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <p
                      className={cn(
                        'text-xs font-medium leading-relaxed',
                        isLight
                          ? 'text-slate-800'
                          : isDark
                          ? 'text-[#dce1ff]'
                          : 'text-slate-800 dark:text-[#dce1ff]'
                      )}
                    >
                      {item.message}
                    </p>
                    <span className="text-[10px] text-slate-400 dark:text-muted-foreground font-mono whitespace-nowrap">
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500 dark:text-muted-foreground">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{item.actor.name}</span>
                    <span>·</span>
                    <span className="uppercase tracking-wider text-[10px] font-bold text-slate-600 dark:text-slate-400">{item.action}</span>
                  </div>
                  {item.remarks && (
                    <div className="mt-1.5 text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-md border border-slate-100 dark:border-slate-800 italic">
                      {item.remarks}
                    </div>
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
