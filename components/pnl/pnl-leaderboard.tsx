'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Award, AlertTriangle } from 'lucide-react'

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

export function PnlLeaderboard({
  title,
  subtitle,
  items,
  variant,
}: {
  title: string
  subtitle?: string
  items: { id: string; name: string; subtitle?: string | null; value: number; meta?: string }[]
  variant: 'top' | 'bottom'
}) {
  const medal = ['🥇', '🥈', '🥉']
  return (
    <Card className={cn(variant === 'bottom' && 'border-amber-200/80 dark:border-amber-900')}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {variant === 'top' ? <Award className="h-5 w-5 text-amber-500" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
          {title}
        </CardTitle>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data</p>
        ) : (
          items.map((it, i) => (
            <div
              key={it.id}
              className={cn(
                'flex items-center justify-between rounded-lg border p-3',
                variant === 'top' && i === 0 && 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200',
                variant === 'bottom' && 'bg-orange-50/50 dark:bg-orange-950/20'
              )}
            >
              <div>
                <p className="font-medium">
                  {variant === 'top' && i < 3 ? <span className="mr-2">{medal[i]}</span> : null}
                  {it.name}
                </p>
                {(it.subtitle || it.meta) && (
                  <p className="text-xs text-muted-foreground">{it.subtitle || it.meta}</p>
                )}
              </div>
              <p className={cn('font-semibold tabular-nums', variant === 'top' ? 'text-emerald-600' : 'text-orange-700')}>
                {formatInr(it.value)}
              </p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
