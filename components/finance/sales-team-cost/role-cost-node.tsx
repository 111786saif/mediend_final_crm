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
}

export function RoleCostNode({ node, depth = 0 }: RoleCostNodeProps) {
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

  return (
    <div className={cn('space-y-2', depth > 0 && 'ml-4 border-l border-border pl-4')}>
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 p-4 pb-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            {hasChildren ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 h-7 w-7 shrink-0"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            ) : (
              <span className="w-7 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-semibold">{node.name}</span>
                <Badge variant={roleBadgeVariant}>{SALES_TEAM_COST_ROLE_LABEL[node.type]}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Subtree total: <span className="font-medium text-foreground">{formatCurrency(subtreeTotal)}</span>
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3 p-4 pt-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">Salary</p>
              <p className="text-sm font-semibold">{formatCurrency(node.salaryPerHead)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">(From Payroll)</p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">Incentive</p>
              <p className="text-sm font-semibold">{formatCurrency(node.incentiveAmount)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {node.incentiveAmount > 0
                  ? '(From Incentive module · approved)'
                  : 'No incentive for selected month'}
              </p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">Seating cost</p>
              <p className="text-sm font-semibold">{formatCurrency(node.seatingAmount)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {node.seatingAmount > 0
                  ? '(From Seating & Misc Cost · approved)'
                  : 'No seating cost for selected month'}
              </p>
            </div>

            <div className="rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground">Misc cost</p>
              <p className="text-sm font-semibold">{formatCurrency(node.miscAmount)}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {node.miscAmount > 0
                  ? '(From Seating & Misc Cost · approved)'
                  : 'No misc cost for selected month'}
              </p>
            </div>

            {node.type === 'bd' && (
              <div className="rounded-md border p-3">
                <p className="text-xs font-medium text-muted-foreground">Marketing cost</p>
                <p className="text-sm font-semibold">{formatCurrency(node.marketingCost ?? 0)}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">(From Marketing)</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 rounded-md bg-muted/40 px-3 py-2 text-xs">
            <span>
              Direct salary: <strong>{formatCurrency(direct.salary)}</strong>
            </span>
            <span>
              Direct incentives: <strong>{formatCurrency(direct.incentives)}</strong>
            </span>
            <span>
              Direct seating: <strong>{formatCurrency(direct.seating)}</strong>
            </span>
            <span>
              Direct misc: <strong>{formatCurrency(direct.misc)}</strong>
            </span>
            {(node.type === 'bd' || node.type === 'tl' || node.type === 'salesHead') && (
              <span>
                Direct marketing: <strong>{formatCurrency(direct.marketing)}</strong>
              </span>
            )}
            <span className="font-medium">
              Direct total: {formatCurrency(direct.total)}
            </span>
          </div>
        </CardContent>
      </Card>

      {hasChildren && expanded && (
        <div className="space-y-2">
          {node.children.map((child) => (
            <RoleCostNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}
