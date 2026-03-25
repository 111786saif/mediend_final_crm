import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'

const employeeSelect = {
  id: true,
  userId: true,
  employeeCode: true,
  managerId: true,
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
      where: { managerId: employeeId },
      select: employeeSelect,
      orderBy: { user: { name: 'asc' } },
    })
  }

  const result: Awaited<ReturnType<typeof prisma.employee.findMany<{
    where: { managerId: string }
    select: typeof employeeSelect
  }>>> = []
  let currentLevel = await prisma.employee.findMany({
    where: { managerId: employeeId },
    select: employeeSelect,
  })

  while (currentLevel.length > 0) {
    result.push(...currentLevel)
    const ids = currentLevel.map((e) => e.id)
    currentLevel = await prisma.employee.findMany({
      where: { managerId: { in: ids } },
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
 * Get user IDs of all BDs that report to this user (for TEAM_LEAD lead access).
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

/** BDs assigned to a CRM sales team (`User.teamId`), used with hierarchy for TL visibility. */
export async function getSalesTeamBdUserIds(teamId: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: { teamId, role: 'BD' },
    select: { id: true },
  })
  return users.map((u) => u.id)
}

/**
 * CRM team id for a team lead: `User.teamId` when set, else the `Team` row where they are `teamLeadId`.
 * Sales Heads sometimes set teamLead on the Team without syncing `user.teamId`.
 */
export async function getSalesTeamIdForTeamLeadUser(
  userId: string,
  sessionTeamId: string | null | undefined
): Promise<string | null> {
  if (sessionTeamId) return sessionTeamId
  const team = await prisma.team.findFirst({
    where: { teamLeadId: userId },
    select: { id: true },
  })
  return team?.id ?? null
}

/**
 * TEAM_LEAD lead visibility: HR org subordinates plus BDs on the same sales team (Sales Teams UI).
 * The latter may not appear under the TL in the employee tree.
 */
export async function getTeamLeadLeadAccessBdUserIds(
  userId: string,
  teamId: string | null | undefined
): Promise<string[]> {
  const resolvedTeamId = await getSalesTeamIdForTeamLeadUser(userId, teamId)
  const [hierarchyIds, teamBdIds] = await Promise.all([
    getSubordinateUserIdsForLeadAccess(userId),
    resolvedTeamId ? getSalesTeamBdUserIds(resolvedTeamId) : Promise.resolve([] as string[]),
  ])
  return Array.from(new Set([...hierarchyIds, ...teamBdIds]))
}

/** Employee rows for sales-team BDs (attendance, etc.). */
export async function getSalesTeamBdEmployeeIds(teamId: string): Promise<string[]> {
  const userIds = await getSalesTeamBdUserIds(teamId)
  if (userIds.length === 0) return []
  const employees = await prisma.employee.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  })
  return employees.map((e) => e.id)
}

/** Same as getSalesTeamBdEmployeeIds but resolves team from TL session / Team.teamLeadId. */
export async function getSalesTeamBdEmployeeIdsForTeamLead(
  userId: string,
  sessionTeamId: string | null | undefined
): Promise<string[]> {
  const teamId = await getSalesTeamIdForTeamLeadUser(userId, sessionTeamId)
  if (!teamId) return []
  return getSalesTeamBdEmployeeIds(teamId)
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
 * Used to grant expanded task-assignment scope (assign to anyone except MD/ADMIN).
 * NOTE: Indirect descendants of MD (e.g. reports-to-reports) are NOT included —
 * they can only assign tasks to themselves and their own direct subordinates.
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
 * Get user IDs of employees in an MD's task teams and watchlist.
 * Used to restrict MD tasks/stats to only their team + watchlist (not all subordinates).
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
