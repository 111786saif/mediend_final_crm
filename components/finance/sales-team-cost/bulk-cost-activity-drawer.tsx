'use client'

import { useRef } from 'react'
import { format } from 'date-fns'
import { History, Loader2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatCurrency } from '@/lib/finance/payroll-types'
import { formatIncentiveMonthYear } from '@/lib/incentives/types'
import { useBulkCostActivity, type BulkCostType } from '@/hooks/use-sales-team-bulk-costs'
import { cn } from '@/lib/utils'

interface BulkCostActivityDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  costType: BulkCostType
  month: number
  year: number
}

function actionStyles(action: string) {
  const a = action.toUpperCase()
  if (a === 'CREATE') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
  if (a === 'UPDATE') return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
  if (a === 'DELETE') return 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
  return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300'
}

export function BulkCostActivityDrawer({
  open,
  onOpenChange,
  costType,
  month,
  year,
}: BulkCostActivityDrawerProps) {
  const costLabel = costType === 'MISC' ? 'Misc Cost' : 'Other Cost'
  const skipBackOnCloseRef = useRef(false)
  const { data, isLoading } = useBulkCostActivity(open, costType, month, year)
  const activity = data?.activity ?? []

  const handleOpenChange = (next: boolean) => {
    // Closing via X / overlay must not call history.back() (that leaves this page).
    if (!next) skipBackOnCloseRef.current = true
    onOpenChange(next)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange} skipBackOnCloseRef={skipBackOnCloseRef}>
      <SheetContent
        side="right"
        className="z-[100] flex w-full flex-col gap-0 p-0 sm:max-w-md"
        overlayClassName="z-[100]"
      >
        <SheetHeader className="border-b px-4 py-4 text-left">
          <SheetTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            {costLabel} Activity
          </SheetTitle>
          <SheetDescription className="text-xs">
            Create, update, and delete history for{' '}
            {formatIncentiveMonthYear(month, year)}.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading activity…
            </div>
          ) : activity.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No activity yet</p>
          ) : (
            <ul className="space-y-3">
              {activity.map((item) => (
                <li key={item.id} className="rounded-lg border bg-card p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        actionStyles(item.action),
                      )}
                    >
                      {item.action}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {format(new Date(item.changedAt), 'dd MMM yyyy, h:mm a')}
                    </span>
                  </div>

                  <div className="mt-2 space-y-1">
                    <p className="font-medium">{formatCurrency(item.amount)}</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{item.remark}</p>
                    <p className="text-xs text-muted-foreground">
                      Employee: {item.employeeName ?? '— (unassigned)'}
                    </p>
                    {item.action === 'UPDATE' && (
                      <p className="text-[11px] text-muted-foreground">
                        Was: {formatCurrency(item.previousAmount ?? 0)}
                        {item.previousRemark ? ` · ${item.previousRemark}` : ''}
                        {item.previousEmployeeName != null || item.previousEmployeeId != null
                          ? ` · ${item.previousEmployeeName ?? 'unassigned'}`
                          : ''}
                      </p>
                    )}
                    <p className="text-[11px] text-muted-foreground">By {item.changedBy}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
