import { UserRole } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { loadApprovedIncentiveTotalsByEmployee, type SalesTeamCostPeriod } from '@/lib/sales-team-cost/incentives'
import { getMarketingCostForBD } from '@/lib/sales-team-cost/marketing'
import { getSalaryForRole } from '@/lib/sales-team-cost/payroll'
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
  salesHead: [UserRole.CATEGORY_MANAGER, UserRole.ASSISTANT_CATEGORY_MANAGER, UserRole.TEAM_LEAD],
  catManager: [UserRole.TEAM_LEAD],
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
    case UserRole.ASSISTANT_CATEGORY_MANAGER:
      return 'catManager'
    case UserRole.TEAM_LEAD:
      return 'tl'
    case UserRole.BD:
    default:
      return 'bd'
  }
}

async function buildRoleNode(
  employee: EmployeeRow,
  employeesByManager: Map<string, EmployeeRow[]>,
  incentiveTotals: Map<string, number>,
  seatingMiscTotals: Map<string, { seating: number; misc: number }>,
): Promise<SalesTeamCostRole | null> {
  if (!SALES_ROLES.includes(employee.user.role)) return null

  const roleType = toRoleType(employee.user.role)
  const allowedChildRoles = new Set(CHILD_ROLES[roleType])
  const childEmployees = (employeesByManager.get(employee.id) ?? []).filter((e) =>
    allowedChildRoles.has(e.user.role),
  )

  const children: SalesTeamCostRole[] = []
  for (const child of childEmployees) {
    const node = await buildRoleNode(child, employeesByManager, incentiveTotals, seatingMiscTotals)
    if (node) children.push(node)
  }

  const salaryPerHead = await getSalaryForRole(employee.id)
  const costs = seatingMiscTotals.get(employee.id)

  let marketingCost: number | undefined
  if (roleType === 'bd') {
    marketingCost = await getMarketingCostForBD(employee.userId, employee.id)
  }

  return {
    id: employee.id,
    userId: employee.userId,
    name: employee.user.name,
    type: roleType,
    count: 1,
    salaryPerHead,
    incentiveAmount: incentiveTotals.get(employee.id) ?? 0,
    seatingAmount: costs?.seating ?? 0,
    miscAmount: costs?.misc ?? 0,
    marketingCost,
    children,
  }
}

export async function buildSalesTeamCostHierarchy(
  period: SalesTeamCostPeriod,
): Promise<SalesTeamCostResponse> {
  const [employees, incentiveTotals, seatingMiscTotals] = await Promise.all([
    prisma.employee.findMany({
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
    }),
    loadApprovedIncentiveTotalsByEmployee(period),
    loadApprovedSeatingMiscByEmployee(period),
  ])

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
    rootEmployees = employees.filter((e) =>
      [UserRole.CATEGORY_MANAGER, UserRole.ASSISTANT_CATEGORY_MANAGER].includes(e.user.role),
    )
  }

  const roots: SalesTeamCostRole[] = []
  for (const root of rootEmployees) {
    const node = await buildRoleNode(root, employeesByManager, incentiveTotals, seatingMiscTotals)
    if (node) roots.push(node)
  }

  return {
    roots,
    summary: buildSummary(roots),
    month: period.month,
    year: period.year,
  }
}
