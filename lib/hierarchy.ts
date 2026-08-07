import { Prisma, UserRole } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { MEET_MD_INVITE_EMPLOYEE_CODE } from '@/lib/meets'
import { headcountEmployeeWhere } from '@/lib/hrms/headcount'
import {
  CATEGORY_MANAGER_ROLES,
  TEAM_UNIT_ROLES,
} from '@/lib/sales-hierarchy-roles'

const employeeSelect = {
  id: true,
  userId: true,
  employeeCode: true,
  managerId: true,
  status: true,
  departmentId: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  department: {
    select: {
      id: true,
      name: true,
    },
  },
} as const

/**
 * Get direct or all nested subordinates for an employee.
 * @param employeeId - The manager's employee ID
 * @param recursive - If true, returns all descendants; if false, only direct reports
 */
export async function getSubordinates(
  employeeId: string,
  recursive: boolean = true
) {
  if (!recursive) {
    return prisma.employee.findMany({
      where: { managerId: employeeId, ...headcountEmployeeWhere },
      select: employeeSelect,
      orderBy: { user: { name: 'asc' } },
    })
  }

  const result: Awaited<ReturnType<typeof prisma.employee.findMany<{
    where: { managerId: string }
    select: typeof employeeSelect
  }>>> = []
  let currentLevel = await prisma.employee.findMany({
    where: { managerId: employeeId, ...headcountEmployeeWhere },
    select: employeeSelect,
  })

  while (currentLevel.length > 0) {
    result.push(...currentLevel)
    const ids = currentLevel.map((e) => e.id)
    currentLevel = await prisma.employee.findMany({
      where: { managerId: { in: ids }, ...headcountEmployeeWhere },
      select: employeeSelect,
    })
  }

  return result
}

/**
 * Get the management chain from an employee up to the root (MD).
 * First element is the employee, last is the top-level manager (e.g. MD).
 */
export async function getManagementChain(employeeId: string) {
  type ChainEmployee = Prisma.EmployeeGetPayload<{
    include: { user: { select: { id: true; name: true; email: true; role: true } }; department: { select: { id: true; name: true } } }
  }>
  const chain: ChainEmployee[] = []
  let currentId: string | null = employeeId

  while (currentId) {
    const emp: ChainEmployee | null = await prisma.employee.findUnique({
      where: { id: currentId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        department: { select: { id: true, name: true } },
      },
    })
    if (!emp) break
    chain.push(emp)
    currentId = emp.managerId
  }

  return chain
}

/**
 * Find the appropriate leave approver for an employee.
 * Returns the immediate manager, or walks up the chain if the immediate manager
 * is on leave during the given date range.
 */
export async function findLeaveApprover(
  employeeId: string,
  options?: { leaveStartDate?: Date; leaveEndDate?: Date }
) {
  const chain = await getManagementChain(employeeId)
  // Remove the applicant (first) - approver must be above
  const managers = chain.slice(1)

  const start = options?.leaveStartDate
  const end = options?.leaveEndDate

  for (const manager of managers) {
    if (!start || !end) {
      return manager
    }
    const onLeave = await prisma.leaveRequest.findFirst({
      where: {
        employeeId: manager.id,
        status: { in: ['PENDING', 'APPROVED'] },
        OR: [
          {
            startDate: { lte: end },
            endDate: { gte: start },
          },
        ],
      },
    })
    if (!onLeave) {
      return manager
    }
  }

  return managers.length > 0 ? managers[managers.length - 1] : null
}

/**
 * Check if the given managerId is in the management chain of the given employeeId.
 */
export async function isManagerOf(
  managerEmployeeId: string,
  subordinateEmployeeId: string
): Promise<boolean> {
  if (managerEmployeeId === subordinateEmployeeId) return false
  const chain = await getManagementChain(subordinateEmployeeId)
  return chain.some((e) => e.id === managerEmployeeId)
}

/**
 * Get employee by user ID (for use in APIs that have session user).
 */
export async function getEmployeeByUserId(userId: string) {
  return prisma.employee.findUnique({
    where: { userId },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      department: { select: { id: true, name: true } },
      manager: {
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      },
    },
  })
}

/**
 * Resolve the Team Lead (or ACM) for a lead owner via the employee manager chain.
 * If the owner is already TL/ACM, returns that owner. Returns null when no TL is found.
 */
export async function resolveTeamLeadForLeadOwner(leadOwnerUserId: string): Promise<{
  userId: string
  name: string
  role: UserRole
} | null> {
  const ownerEmployee = await getEmployeeByUserId(leadOwnerUserId)
  if (!ownerEmployee?.user) return null

  const isTeamUnit = TEAM_UNIT_ROLES.includes(ownerEmployee.user.role as UserRole)
  if (isTeamUnit) {
    return {
      userId: ownerEmployee.user.id,
      name: ownerEmployee.user.name,
      role: ownerEmployee.user.role,
    }
  }

  const chain = await getManagementChain(ownerEmployee.id)
  const teamLead = chain.find((employee) =>
    TEAM_UNIT_ROLES.includes(employee.user.role as UserRole),
  )
  if (!teamLead?.user) return null

  return {
    userId: teamLead.user.id,
    name: teamLead.user.name,
    role: teamLead.user.role,
  }
}

/**
 * Get user IDs of all subordinates that report to this user (recursively).
 * Returns empty array if user has no employee record or no subordinates.
 */
export async function getSubordinateUserIdsForLeadAccess(userId: string): Promise<string[]> {
  const employee = await prisma.employee.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (!employee) return []
  const subordinates = await getSubordinates(employee.id, true)
  return subordinates.map((s) => s.userId)
}

/**
 * TEAM_LEAD / manager lead visibility: all recursive subordinates' user IDs.
 * This replaces the old dual-source (HR org + sales Team) lookup.
 */
export async function getTeamLeadLeadAccessBdUserIds(userId: string): Promise<string[]> {
  return getSubordinateUserIdsForLeadAccess(userId)
}

/**
 * Recursive descendant user IDs for a manager (Employee.id).
 */
export async function getDescendantUserIds(managerEmployeeId: string): Promise<string[]> {
  const subordinates = await getSubordinates(managerEmployeeId, true)
  return subordinates.map((s) => s.userId)
}

/**
 * Manager's own userId + all recursive descendants.
 * Used when selecting a CM/TL/ACM to roll up their full subtree (Mohit/Amir rule).
 */
export async function getTeamScopeUserIds(managerEmployeeId: string): Promise<string[]> {
  const manager = await prisma.employee.findUnique({
    where: { id: managerEmployeeId },
    select: { userId: true },
  })
  if (!manager) return []
  const descendantIds = await getDescendantUserIds(managerEmployeeId)
  return [manager.userId, ...descendantIds]
}

/**
 * Leaf BD user IDs under a manager (recursive), plus the manager's own userId
 * so personal leads/IPD owned by the manager still count.
 */
export async function resolveLeafBdUserIds(managerEmployeeId: string): Promise<{
  managerUserId: string
  managerName: string
  managerRole: UserRole
  allUserIds: string[]
  bdMembers: Array<{
    employeeId: string
    userId: string
    name: string
    profilePicture: string | null
  }>
}> {
  const manager = await prisma.employee.findUnique({
    where: { id: managerEmployeeId },
    select: {
      userId: true,
      user: { select: { id: true, name: true, role: true, profilePicture: true } },
    },
  })
  if (!manager) {
    throw new Error('Manager not found')
  }

  const subordinates = await getSubordinates(managerEmployeeId, true)
  const bdMembers = subordinates
    .filter((s) => s.user.role === UserRole.BD)
    .map((s) => ({
      employeeId: s.id,
      userId: s.userId,
      name: s.user.name,
      profilePicture: null as string | null,
    }))

  // Enrich profile pictures for BD members
  if (bdMembers.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: bdMembers.map((m) => m.userId) } },
      select: { id: true, profilePicture: true },
    })
    const picMap = new Map(users.map((u) => [u.id, u.profilePicture ?? null]))
    for (const m of bdMembers) {
      m.profilePicture = picMap.get(m.userId) ?? null
    }
  }

  const allUserIds = [manager.userId, ...bdMembers.map((m) => m.userId)]
  // Also include non-BD descendants who may personally own leads (TL/ACM/CM doing BD work)
  for (const sub of subordinates) {
    if (sub.user.role !== UserRole.BD && !allUserIds.includes(sub.userId)) {
      allUserIds.push(sub.userId)
    }
  }

  return {
    managerUserId: manager.userId,
    managerName: manager.user.name,
    managerRole: manager.user.role,
    allUserIds,
    bdMembers,
  }
}

export type SalesTeamUnitLevel = 'cm' | 'tl'

export type SalesTeamUnit = {
  id: string
  userId: string
  name: string
  profilePicture: string | null
  employeeCode: string | null
  role: UserRole
  /** Direct BD reports only (for TL/ACM target member lists). */
  memberCount: number
  members: Array<{
    id: string
    employeeId: string
    name: string
    profilePicture: string | null
  }>
  /** Recursive BD + manager user IDs for analytics filters. */
  scopeUserIds: string[]
}

/**
 * List filterable sales team units at CM or TL/ACM level.
 */
export async function getSalesTeamUnits(options: {
  level: SalesTeamUnitLevel
}): Promise<SalesTeamUnit[]> {
  const roles =
    options.level === 'cm' ? CATEGORY_MANAGER_ROLES : TEAM_UNIT_ROLES

  const managers = await prisma.employee.findMany({
    where: { user: { role: { in: roles } } },
    select: {
      id: true,
      userId: true,
      employeeCode: true,
      user: {
        select: {
          id: true,
          name: true,
          profilePicture: true,
          role: true,
        },
      },
      subordinates: {
        where: { user: { role: UserRole.BD } },
        select: {
          id: true,
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              profilePicture: true,
            },
          },
        },
        orderBy: { user: { name: 'asc' } },
      },
    },
    orderBy: { user: { name: 'asc' } },
  })

  const units: SalesTeamUnit[] = []
  for (const m of managers) {
    const scopeUserIds = await getTeamScopeUserIds(m.id)
    units.push({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      profilePicture: m.user.profilePicture,
      employeeCode: m.employeeCode,
      role: m.user.role,
      memberCount: m.subordinates.length,
      members: m.subordinates.map((s) => ({
        id: s.userId,
        employeeId: s.id,
        name: s.user.name,
        profilePicture: s.user.profilePicture,
      })),
      scopeUserIds,
    })
  }
  return units
}

/**
 * For a session user in a subtree-scoped sales role, return user IDs in their scope
 * (self + recursive subordinates). Returns null for unscoped roles (caller decides).
 */
export async function getSubtreeScopeUserIdsForRole(
  userId: string,
  role: UserRole | string
): Promise<string[] | null> {
  if (
    role !== UserRole.TEAM_LEAD &&
    role !== UserRole.ASSISTANT_CATEGORY_MANAGER &&
    role !== UserRole.CATEGORY_MANAGER
  ) {
    return null
  }
  const subIds = await getSubordinateUserIdsForLeadAccess(userId)
  return [userId, ...subIds]
}

/**
 * Returns manager groups (manager + direct subordinates) for analytics / team performance views.
 * Each entry represents a "team" derived purely from the org chart.
 * Optionally filter by departmentId.
 */
export async function getManagerGroups(departmentId?: string): Promise<Array<{
  managerId: string
  managerUserId: string
  managerName: string
  managerRole: string
  departmentId: string | null
  departmentName: string | null
  subordinates: Array<{ employeeId: string; userId: string; name: string; role: string }>
}>> {
  const whereClause: Prisma.EmployeeWhereInput = {
    subordinates: { some: {} }, // only employees who have at least one direct report
  }
  if (departmentId) whereClause.departmentId = departmentId

  const managers = await prisma.employee.findMany({
    where: whereClause,
    select: {
      id: true,
      userId: true,
      departmentId: true,
      user: { select: { id: true, name: true, role: true } },
      department: { select: { name: true } },
      subordinates: {
        select: {
          id: true,
          userId: true,
          user: { select: { id: true, name: true, role: true } },
        },
      },
    },
    orderBy: { user: { name: 'asc' } },
  })

  return managers.map((m) => ({
    managerId: m.id,
    managerUserId: m.userId,
    managerName: m.user.name,
    managerRole: m.user.role,
    departmentId: m.departmentId,
    departmentName: m.department?.name ?? null,
    subordinates: m.subordinates.map((s) => ({
      employeeId: s.id,
      userId: s.userId,
      name: s.user.name,
      role: s.user.role,
    })),
  }))
}

/**
 * Build org chart tree: root employees (no manager) and their recursive subordinates.
 */
export async function getOrgChartRoots() {
  const roots = await prisma.employee.findMany({
    where: { managerId: null },
    select: employeeSelect,
    orderBy: { user: { name: 'asc' } },
  })
  return roots
}

/**
 * Get a single employee with subordinates for tree building.
 */
export async function getEmployeeWithSubordinates(employeeId: string) {
  return prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      id: true,
      userId: true,
      employeeCode: true,
      managerId: true,
      departmentId: true,
      user: { select: { id: true, name: true, email: true, role: true } },
      department: { select: { id: true, name: true } },
      subordinates: {
        select: employeeSelect,
        orderBy: { user: { name: 'asc' } },
      },
    },
  })
}

/**
 * Returns true if the user is a direct MD team member: direct report of MD,
 * explicitly in any MD's task team, or in MD's watchlist.
 */
export async function isUserInMDManagedCohort(userId: string): Promise<boolean> {
  const employee = await getEmployeeByUserId(userId)
  if (employee) {
    // Direct report: immediate manager has MD role
    if (employee.manager?.user?.role === 'MD') return true
    // Explicitly added to an MD's task team
    const inTaskTeam = await prisma.mDTaskTeamMember.findFirst({
      where: {
        employeeId: employee.id,
        team: { owner: { role: 'MD' } },
      },
      select: { id: true },
    })
    if (inTaskTeam) return true
  }
  // Explicitly on MD's watchlist
  const inWatchlist = await prisma.mDWatchlistEmployee.findFirst({
    where: { employee: { userId } },
    select: { id: true },
  })
  return !!inWatchlist
}

/**
 * Prisma filter for employees in the MD-managed cohort (same rules as {@link isUserInMDManagedCohort}).
 */
export function employeeMDManagedCohortWhere(): Prisma.EmployeeWhereInput {
  return {
    OR: [
      { manager: { user: { role: 'MD' } } },
      {
        mdTaskTeamMemberships: {
          some: { team: { owner: { role: 'MD' } } },
        },
      },
      { mdWatchlistMemberships: { some: {} } },
    ],
  }
}

/** Employees not in the MD-managed cohort (for HR-only queues). */
export function employeeNotInMDManagedCohortWhere(): Prisma.EmployeeWhereInput {
  return { NOT: employeeMDManagedCohortWhere() }
}

/**
 * User IDs the creator may add as meet participants (same rules as task assignable-users).
 */
export async function getMeetInviteableUserIds(user: { id: string; role: string }): Promise<Set<string>> {
  const isMDOrAdmin = user.role === 'MD' || user.role === 'ADMIN'
  const inCohort = !isMDOrAdmin && (await isUserInMDManagedCohort(user.id))
  let ids: Set<string>
  if (isMDOrAdmin || inCohort) {
    const all = await prisma.user.findMany({
      where: { role: { notIn: ['MD', 'ADMIN'] } },
      select: { id: true },
    })
    ids = new Set(all.map((u) => u.id))
  } else {
    ids = new Set<string>([user.id])
    const employee = await getEmployeeByUserId(user.id)
    if (employee) {
      const directReports = await getSubordinates(employee.id, false)
      for (const sub of directReports) {
        if (sub.user?.role !== 'MD' && sub.user?.role !== 'ADMIN') {
          ids.add(sub.userId)
        }
      }
    }
  }
  const mdRow = await prisma.employee.findFirst({
    where: { employeeCode: MEET_MD_INVITE_EMPLOYEE_CODE },
    select: { userId: true },
  })
  if (mdRow?.userId) ids.add(mdRow.userId)
  return ids
}

/**
 * Get user IDs of employees in an MD's task teams and watchlist.
 */
export async function getMDTeamAndWatchlistUserIds(ownerId: string): Promise<string[]> {
  const [teamMembers, watchlistEntries] = await Promise.all([
    prisma.mDTaskTeamMember.findMany({
      where: { team: { ownerId } },
      include: { employee: { select: { userId: true } } },
    }),
    prisma.mDWatchlistEmployee.findMany({
      where: { ownerId },
      include: { employee: { select: { userId: true } } },
    }),
  ])
  const userIds = new Set<string>()
  for (const m of teamMembers) {
    if (m.employee.userId) userIds.add(m.employee.userId)
  }
  for (const w of watchlistEntries) {
    if (w.employee.userId) userIds.add(w.employee.userId)
  }
  return Array.from(userIds)
}
