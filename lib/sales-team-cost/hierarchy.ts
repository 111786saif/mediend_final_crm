import { UserRole } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { loadApprovedIncentiveTotalsByEmployee, type SalesTeamCostPeriod } from '@/lib/sales-team-cost/incentives'
import { loadSharedBdMarketingCost } from '@/lib/sales-team-cost/marketing'
import { loadSalariesByEmployeeIds } from '@/lib/sales-team-cost/payroll'
import { loadSalaryOverridesByEmployee, type SalaryOverrideEntry } from '@/lib/sales-team-cost/salary-override'
import {
  loadBulkCostPeriodTotals,
  loadBulkCostTotalsByEmployee,
  loadUnallocatedBulkCostTotals,
} from '@/lib/sales-team-cost/bulk-cost-entries'
import { loadApprovedSeatingMiscByEmployee } from '@/lib/sales-team-cost/seating-misc'
import { buildSummary } from '@/lib/sales-team-cost/rollup'
import type {
  SalesTeamCostResponse,
  SalesTeamCostRole,
  SalesTeamCostRoleType,
} from '@/lib/sales-team-cost/types'

const SALES_ROLES: UserRole[] = [
  UserRole.SALES_HEAD,
  UserRole.CATEGORY_MANAGER,
  UserRole.ASSISTANT_CATEGORY_MANAGER,
  UserRole.TEAM_LEAD,
  UserRole.BD,
]

const CHILD_ROLES: Record<SalesTeamCostRoleType, UserRole[]> = {
  salesHead: [UserRole.CATEGORY_MANAGER, UserRole.ASSISTANT_CATEGORY_MANAGER, UserRole.TEAM_LEAD, UserRole.BD],
  // CM may have TL, ACM, or BDs directly under them
  catManager: [UserRole.TEAM_LEAD, UserRole.ASSISTANT_CATEGORY_MANAGER, UserRole.BD],
  tl: [UserRole.BD],
  bd: [],
}

type EmployeeRow = {
  id: string
  userId: string
  managerId: string | null
  user: { id: string; name: string; role: UserRole }
}

function toRoleType(role: UserRole): SalesTeamCostRoleType {
  switch (role) {
    case UserRole.SALES_HEAD:
      return 'salesHead'
    case UserRole.CATEGORY_MANAGER:
      return 'catManager'
    // ACM is functionally identical to Team Lead
    case UserRole.ASSISTANT_CATEGORY_MANAGER:
    case UserRole.TEAM_LEAD:
      return 'tl'
    case UserRole.BD:
    default:
      return 'bd'
  }
}

function buildRoleNode(
  employee: EmployeeRow,
  employeesByManager: Map<string, EmployeeRow[]>,
  incentiveTotals: Map<string, number>,
  seatingMiscTotals: Map<string, { seating: number; misc: number; other: number }>,
  bulkCostTotals: Map<string, { misc: number; other: number }>,
  salaryOverrides: Map<string, SalaryOverrideEntry>,
  salaries: Map<string, number>,
  sharedMarketingCost: number,
  hierarchyEmployeeIds: Set<string>,
): SalesTeamCostRole | null {
  if (!SALES_ROLES.includes(employee.user.role)) return null
  hierarchyEmployeeIds.add(employee.id)

  const roleType = toRoleType(employee.user.role)
  const allowedChildRoles = new Set(CHILD_ROLES[roleType])
  const childEmployees = (employeesByManager.get(employee.id) ?? []).filter((e) =>
    allowedChildRoles.has(e.user.role),
  )

  const children: SalesTeamCostRole[] = []
  for (const child of childEmployees) {
    const node = buildRoleNode(
      child,
      employeesByManager,
      incentiveTotals,
      seatingMiscTotals,
      bulkCostTotals,
      salaryOverrides,
      salaries,
      sharedMarketingCost,
      hierarchyEmployeeIds,
    )
    if (node) children.push(node)
  }

  const payrollSalary = salaries.get(employee.id) ?? 0
  const override = salaryOverrides.get(employee.id)
  const salaryIsOverride = override != null
  const salaryPerHead = salaryIsOverride ? override.amount : payrollSalary
  const costs = seatingMiscTotals.get(employee.id)
  const bulk = bulkCostTotals.get(employee.id)

  return {
    id: employee.id,
    userId: employee.userId,
    name: employee.user.name,
    type: roleType,
    count: 1,
    salaryPerHead,
    payrollSalary,
    salaryIsOverride,
    incentiveAmount: incentiveTotals.get(employee.id) ?? 0,
    seatingAmount: costs?.seating ?? 0,
    miscAmount: (costs?.misc ?? 0) + (bulk?.misc ?? 0),
    otherAmount: (costs?.other ?? 0) + (bulk?.other ?? 0),
    // Marketing is attributed per BD; other roles show 0 on their own card.
    marketingCost: roleType === 'bd' ? sharedMarketingCost : 0,
    children,
  }
}

export async function buildSalesTeamCostHierarchy(
  period: SalesTeamCostPeriod,
): Promise<SalesTeamCostResponse> {
  // Sequential loads: Supabase session pooler is tiny (often max 15 across all apps),
  // and this process uses a single pooled connection — avoid request stampedes.
  const employees = await prisma.employee.findMany({
    where: {
      status: 'ACTIVE',
      user: { role: { in: SALES_ROLES } },
    },
    select: {
      id: true,
      userId: true,
      managerId: true,
      user: { select: { id: true, name: true, role: true } },
    },
    orderBy: { user: { name: 'asc' } },
  })
  const incentiveTotals = await loadApprovedIncentiveTotalsByEmployee(period)
  const seatingMiscTotals = await loadApprovedSeatingMiscByEmployee(period)
  const bulkCostTotals = await loadBulkCostTotalsByEmployee(period)
  const unallocatedBulk = await loadUnallocatedBulkCostTotals(period)
  const bulkPeriodTotals = await loadBulkCostPeriodTotals(period)
  const salaryOverrides = await loadSalaryOverridesByEmployee(period)
  const salaries = await loadSalariesByEmployeeIds(employees.map((e) => e.id))
  const sharedMarketingCost = await loadSharedBdMarketingCost(period)

  const employeesByManager = new Map<string, EmployeeRow[]>()
  for (const employee of employees) {
    if (!employee.managerId) continue
    const list = employeesByManager.get(employee.managerId) ?? []
    list.push(employee)
    employeesByManager.set(employee.managerId, list)
  }

  const salesHeads = employees.filter((e) => e.user.role === UserRole.SALES_HEAD)
  let rootEmployees = salesHeads

  if (rootEmployees.length === 0) {
    rootEmployees = employees.filter((e) => e.user.role === UserRole.CATEGORY_MANAGER)
  }

  const hierarchyEmployeeIds = new Set<string>()
  const roots: SalesTeamCostRole[] = []
  for (const root of rootEmployees) {
    const node = buildRoleNode(
      root,
      employeesByManager,
      incentiveTotals,
      seatingMiscTotals,
      bulkCostTotals,
      salaryOverrides,
      salaries,
      sharedMarketingCost,
      hierarchyEmployeeIds,
    )
    if (node) roots.push(node)
  }

  // Orphan sales employees (manager gap / role mismatch) — attach as flat roots
  // (no children) so each person is counted once and costs are not dropped.
  const emptyByManager = new Map<string, EmployeeRow[]>()
  for (const orphan of employees) {
    if (hierarchyEmployeeIds.has(orphan.id)) continue
    const node = buildRoleNode(
      orphan,
      emptyByManager,
      incentiveTotals,
      seatingMiscTotals,
      bulkCostTotals,
      salaryOverrides,
      salaries,
      sharedMarketingCost,
      hierarchyEmployeeIds,
    )
    if (node) roots.push(node)
  }

  // Bulk assigned outside the sales-role set (e.g. HR employee picker) + null employee.
  let outsideMisc = 0
  let outsideOther = 0
  for (const [employeeId, totals] of bulkCostTotals) {
    if (hierarchyEmployeeIds.has(employeeId)) continue
    outsideMisc += totals.misc
    outsideOther += totals.other
  }

  const unallocated = {
    misc: unallocatedBulk.misc + outsideMisc,
    other: unallocatedBulk.other + outsideOther,
  }

  // Monthly seating-misc "other/misc" for sales employees (separate from bulk entries).
  const salesEmployeeIds = new Set(employees.map((e) => e.id))
  let seatingMiscFromMonthly = 0
  let seatingOtherFromMonthly = 0
  for (const [employeeId, totals] of seatingMiscTotals) {
    if (!salesEmployeeIds.has(employeeId)) continue
    seatingMiscFromMonthly += totals.misc
    seatingOtherFromMonthly += totals.other
  }

  const summary = buildSummary(roots, unallocated)

  // Authoritative Misc/Other: bulk entry list total + monthly seating-misc fields.
  // Hierarchy walk alone can under-count when assignees sit outside the tree.
  const authoritativeMisc = bulkPeriodTotals.misc + seatingMiscFromMonthly
  const authoritativeOther = bulkPeriodTotals.other + seatingOtherFromMonthly
  const miscDelta = authoritativeMisc - summary.rollup.misc
  const otherDelta = authoritativeOther - summary.rollup.other
  summary.rollup.misc = authoritativeMisc
  summary.rollup.other = authoritativeOther
  summary.rollup.total += miscDelta + otherDelta
  summary.grandTotal = summary.rollup.total

  return {
    roots,
    summary,
    month: period.month,
    year: period.year,
  }
}
