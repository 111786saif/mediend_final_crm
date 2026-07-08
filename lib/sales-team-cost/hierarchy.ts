import { SalesTeamCostEntryType, UserRole } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getMarketingCostForBD } from '@/lib/sales-team-cost/marketing'
import { getSalaryForRole } from '@/lib/sales-team-cost/payroll'
import { buildSummary } from '@/lib/sales-team-cost/rollup'
import type {
  SalesTeamCostEntryRecord,
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

function mapEntry(e: {
  id: string
  amount: number
  entryDate: Date
  note: string | null
  createdAt: Date
  addedBy: { name: string }
}): SalesTeamCostEntryRecord {
  return {
    id: e.id,
    amount: e.amount,
    date: e.entryDate.toISOString().slice(0, 10),
    note: e.note,
    addedBy: e.addedBy.name,
    addedAt: e.createdAt.toISOString(),
  }
}

async function loadEntriesByEmployee(): Promise<
  Map<string, { incentives: SalesTeamCostEntryRecord[]; seatingCosts: SalesTeamCostEntryRecord[]; miscCosts: SalesTeamCostEntryRecord[] }>
> {
  const entries = await prisma.salesTeamCostEntry.findMany({
    orderBy: { entryDate: 'desc' },
    select: {
      id: true,
      employeeId: true,
      amount: true,
      entryDate: true,
      note: true,
      entryType: true,
      createdAt: true,
      addedBy: { select: { name: true } },
    },
  })

  const map = new Map<
    string,
    { incentives: SalesTeamCostEntryRecord[]; seatingCosts: SalesTeamCostEntryRecord[]; miscCosts: SalesTeamCostEntryRecord[] }
  >()

  for (const entry of entries) {
    let bucket = map.get(entry.employeeId)
    if (!bucket) {
      bucket = { incentives: [], seatingCosts: [], miscCosts: [] }
      map.set(entry.employeeId, bucket)
    }
    const mapped = mapEntry(entry)
    if (entry.entryType === SalesTeamCostEntryType.INCENTIVE) {
      bucket.incentives.push(mapped)
    } else if (entry.entryType === SalesTeamCostEntryType.SEATING) {
      bucket.seatingCosts.push(mapped)
    } else if (entry.entryType === SalesTeamCostEntryType.MISC) {
      bucket.miscCosts.push(mapped)
    }
  }

  return map
}

async function buildRoleNode(
  employee: EmployeeRow,
  employeesByManager: Map<string, EmployeeRow[]>,
  entriesByEmployee: Map<
    string,
    { incentives: SalesTeamCostEntryRecord[]; seatingCosts: SalesTeamCostEntryRecord[]; miscCosts: SalesTeamCostEntryRecord[] }
  >,
): Promise<SalesTeamCostRole | null> {
  if (!SALES_ROLES.includes(employee.user.role)) return null

  const roleType = toRoleType(employee.user.role)
  const allowedChildRoles = new Set(CHILD_ROLES[roleType])
  const childEmployees = (employeesByManager.get(employee.id) ?? []).filter((e) =>
    allowedChildRoles.has(e.user.role),
  )

  const children: SalesTeamCostRole[] = []
  for (const child of childEmployees) {
    const node = await buildRoleNode(child, employeesByManager, entriesByEmployee)
    if (node) children.push(node)
  }

  const salaryPerHead = await getSalaryForRole(employee.id)
  const entryBucket = entriesByEmployee.get(employee.id)
  const incentives = entryBucket?.incentives ?? []
  const seatingCosts = entryBucket?.seatingCosts ?? []
  const miscCosts = entryBucket?.miscCosts ?? []

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
    incentives,
    seatingCosts,
    miscCosts,
    marketingCost,
    children,
  }
}

export async function buildSalesTeamCostHierarchy(): Promise<SalesTeamCostResponse> {
  const [employees, entriesByEmployee] = await Promise.all([
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
    loadEntriesByEmployee(),
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
    const node = await buildRoleNode(root, employeesByManager, entriesByEmployee)
    if (node) roots.push(node)
  }

  return {
    roots,
    summary: buildSummary(roots),
  }
}
