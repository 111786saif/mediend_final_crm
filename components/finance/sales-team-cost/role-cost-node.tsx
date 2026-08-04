'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { formatCurrency } from '@/lib/finance/payroll-types'
import {
  computeDirectRollup,
  computeNodeTotal,
} from '@/lib/sales-team-cost/rollup'
import { SALES_TEAM_COST_ROLE_LABEL, type SalesTeamCostRole } from '@/lib/sales-team-cost/types'
interface RoleCostNodeProps {
  node: SalesTeamCostRole
  depth?: number
  month: number
  year: number
  canWrite: boolean
}

export function RoleCostNode({
  node,
  depth = 0,
  month,
  year,
  canWrite,
}: RoleCostNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2)

  const direct = computeDirectRollup(node)
  const subtreeTotal = computeNodeTotal(node)
  const hasChildren = node.children.length > 0

  const roleBadgeVariant =
    node.type === 'salesHead'
      ? 'default'
      : node.type === 'catManager'
        ? 'secondary'
        : node.type === 'tl'
          ? 'outline'
          : 'secondary'

  const isExpandedActive = hasChildren && expanded

  return (
    <div
      className={cn(
        'space-y-2',
        depth > 0 && 'ml-4 border-l pl-4',
        depth > 0 && (isExpandedActive ? 'border-primary/50' : 'border-border'),
      )}
    >
      <Card
        className={cn(
          'overflow-hidden transition-colors',
          isExpandedActive
            ? 'border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20'
            : 'border-border',
        )}
      >
        <CardHeader
          className={cn(
            'flex flex-row items-start justify-between gap-3 space-y-0 p-4 pb-2',
            isExpandedActive && 'bg-primary/5',
          )}
        >
          <div className="flex min-w-0 flex-1 items-start gap-2">
            {hasChildren ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-expanded={expanded}
                className={cn(
                  'mt-0.5 h-7 w-7 shrink-0',
                  isExpandedActive &&
                    'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
                )}
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            ) : (
              <span className="w-7 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'truncate font-semibold',
                    isExpandedActive && 'text-primary',
                  )}
                >
                  {node.name}
                </span>
                <Badge variant={isExpandedActive ? 'default' : roleBadgeVariant}>
                  {SALES_TEAM_COST_ROLE_LABEL[node.type]}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Subtree total:{' '}
                <span
                  className={cn(
                    'font-medium',
                    isExpandedActive ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {formatCurrency(subtreeTotal)}
                </span>
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 p-4 pt-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div className="rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">Salary</p>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(node.salaryPerHead)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {node.salaryIsOverride
                  ? '(Sales Team Cost override · payroll unchanged)'
                  : '(From Payroll)'}
              </p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">Incentive</p>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(node.incentiveAmount)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {node.incentiveAmount > 0
                  ? '(From Incentive module · approved)'
                  : 'No incentive for selected month'}
              </p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">Seating cost</p>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(node.seatingAmount)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {node.seatingAmount > 0
                  ? '(From Master / monthly seating)'
                  : 'No seating cost for selected month'}
              </p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">Misc cost</p>
              <p className="text-sm font-semibold tabular-nums">{formatCurrency(node.miscAmount)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {node.miscAmount > 0
                  ? '(Bulk Misc + monthly seating/misc)'
                  : 'No misc cost for selected month'}
              </p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">Marketing cost</p>
              <p className="text-sm font-semibold tabular-nums">
                {formatCurrency(node.marketingCost ?? 0)}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {node.type === 'bd'
                  ? node.marketingCost > 0
                    ? '(Campaign spend ÷ active BDs)'
                    : 'No marketing spend for selected month'
                  : 'Per-person share shown on BD cards'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 rounded-md bg-muted/40 px-3 py-2 text-xs">
            <span>
              Total salary: <strong>{formatCurrency(direct.salary)}</strong>
            </span>
            <span>
              Total incentives: <strong>{formatCurrency(direct.incentives)}</strong>
            </span>
            <span>
              Total seating: <strong>{formatCurrency(direct.seating)}</strong>
            </span>
            <span>
              Total misc: <strong>{formatCurrency(direct.misc)}</strong>
            </span>
            <span>
              Total marketing: <strong>{formatCurrency(direct.marketing)}</strong>
            </span>
            <span className="font-medium">
              Total: {formatCurrency(direct.total - direct.other)}
            </span>
          </div>
        </CardContent>
      </Card>

      {hasChildren && expanded && (
        <div className="space-y-2">
          {node.children.map((child) => (
            <RoleCostNode
              key={child.id}
              node={child}
              depth={depth + 1}
              month={month}
              year={year}
              canWrite={canWrite}
            />
          ))}
        </div>
      )}
    </div>
  )
}
