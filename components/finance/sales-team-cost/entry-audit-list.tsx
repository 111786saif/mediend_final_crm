'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/finance/payroll-types'
import type { SalesTeamCostEntryRecord } from '@/lib/sales-team-cost/types'

interface EntryAuditListProps {
  label: string
  total: number
  entries: SalesTeamCostEntryRecord[]
  emptyLabel?: string
}

export function EntryAuditList({ label, total, entries, emptyLabel = 'No entries yet' }: EntryAuditListProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-sm font-semibold">{formatCurrency(total)}</p>
        </div>
        {entries.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 px-2 text-xs"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </Button>
        )}
      </div>
      {entries.length === 0 && <p className="mt-1 text-xs text-muted-foreground">{emptyLabel}</p>}
      {expanded && entries.length > 0 && (
        <ul className={cn('mt-3 space-y-2 border-t pt-3')}>
          {entries.map((entry) => (
            <li key={entry.id} className="text-xs">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{formatCurrency(entry.amount)}</span>
                <span className="text-muted-foreground">{format(new Date(entry.date), 'dd MMM yyyy')}</span>
              </div>
              {entry.note && <p className="mt-0.5 text-muted-foreground">{entry.note}</p>}
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Added by {entry.addedBy} · {format(new Date(entry.addedAt), 'dd MMM yyyy, h:mm a')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
