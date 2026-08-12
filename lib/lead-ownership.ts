import { EmployeeStatus, UserRole } from '@/generated/prisma/client'
import type { SessionUser } from '@/lib/auth'
import { formatLeadAssigneeName } from '@/lib/lead-assignee-display'
import { getCrmLeadRemarkSettings } from '@/lib/crm-lead-remarks'
import { getEmployeeByUserId, getSubordinates } from '@/lib/hierarchy'
import { prisma } from '@/lib/prisma'

const FULL_LEAD_ACCESS_ROLES = new Set<UserRole>([
  'SUPER_ADMIN',
  'ADMIN',
  'MD',
  'INSURANCE_HEAD',
  'PL_HEAD',
  'TESTER',
  'COMPLIANCE_HEAD',
])

const HIERARCHY_LEAD_ACCESS_ROLES = new Set<UserRole>([
  'EXECUTIVE_ASSISTANT',
  'TEAM_LEAD',
  'CATEGORY_MANAGER',
  'ASSISTANT_CATEGORY_MANAGER',
  'SALES_HEAD',
])

const LEAD_STATUS_OVERRIDE_ROLES = new Set<UserRole>(['SUPER_ADMIN', 'ADMIN', 'MD'])
const LEAD_PROFILE_OVERRIDE_ROLES = new Set<UserRole>(['SUPER_ADMIN', 'ADMIN'])

const LEAD_STATUS_HIERARCHY_ROLES = new Set<UserRole>([
  'EXECUTIVE_ASSISTANT',
  'TEAM_LEAD',
  'CATEGORY_MANAGER',
  'ASSISTANT_CATEGORY_MANAGER',
  'SALES_HEAD',
])
const LEAD_PROFILE_HIERARCHY_ROLES = new Set<UserRole>([
  'EXECUTIVE_ASSISTANT',
  'TEAM_LEAD',
  'CATEGORY_MANAGER',
  'ASSISTANT_CATEGORY_MANAGER',
  'SALES_HEAD',
])

const SALES_ASSIGNABLE_ROLES = new Set<UserRole>([
  'BD',
  'TEAM_LEAD',
  'CATEGORY_MANAGER',
  'ASSISTANT_CATEGORY_MANAGER',
  'SALES_HEAD',
])

const HIERARCHY_ASSIGNABLE_ROLE_SCOPE: Partial<Record<UserRole, UserRole[]>> = {
  EXECUTIVE_ASSISTANT: [
    UserRole.SALES_HEAD,
    UserRole.CATEGORY_MANAGER,
    UserRole.ASSISTANT_CATEGORY_MANAGER,
    UserRole.TEAM_LEAD,
    UserRole.BD,
  ],
  SALES_HEAD: [
    UserRole.SALES_HEAD,
    UserRole.CATEGORY_MANAGER,
    UserRole.ASSISTANT_CATEGORY_MANAGER,
    UserRole.TEAM_LEAD,
    UserRole.BD,
  ],
  CATEGORY_MANAGER: [
    UserRole.CATEGORY_MANAGER,
    UserRole.ASSISTANT_CATEGORY_MANAGER,
    UserRole.TEAM_LEAD,
    UserRole.BD,
  ],
  ASSISTANT_CATEGORY_MANAGER: [
    UserRole.ASSISTANT_CATEGORY_MANAGER,
    UserRole.TEAM_LEAD,
    UserRole.BD,
  ],
  TEAM_LEAD: [
    UserRole.TEAM_LEAD,
    UserRole.ASSISTANT_CATEGORY_MANAGER,
    UserRole.BD,
  ],
}

const EXECUTIVE_LEAD_HISTORY_ROLES = new Set<UserRole>([
  'SUPER_ADMIN',
  'ADMIN',
  'MD',
  'CRM_ADMIN',
  'EXECUTIVE_ASSISTANT',
  'SALES_HEAD',
  'CATEGORY_MANAGER',
  'ASSISTANT_CATEGORY_MANAGER',
  'TEAM_LEAD',
  'INSURANCE_HEAD',
  'PL_HEAD',
  'OUTSTANDING_HEAD',
  'HR_HEAD',
  'FINANCE_HEAD',
  'DIGITAL_MARKETING_HEAD',
  'IT_HEAD',
  'LOAN_DEMAT_HEAD',
  'COMPLIANCE_HEAD',
])

export type AssignableLeadUser = {
  id: string
  name: string
  email: string
  role: UserRole
}

export function canRoleViewLeadExecutiveHistory(role: UserRole | string | null | undefined) {
  if (!role) return false
  return EXECUTIVE_LEAD_HISTORY_ROLES.has(role as UserRole)
}

export function canRoleViewLeadActivityLogs(role: UserRole | string | null | undefined) {
  if (!role) return false
  const normalized = String(role).trim().toUpperCase()
  return normalized !== 'BD'
}

export function buildLeadOwnershipTransferUpdate(nextOwnerUserId: string, assignedAt: Date = new Date()) {
  return {
    bd: {
      connect: {
        id: nextOwnerUserId,
      },
    },
    assignedDate: assignedAt,
  } as const
}

export async function getLeadTeamLeadIdForAssigneeManager(nextOwnerUserId: string) {
  const assigneeEmployee = await prisma.employee.findUnique({
    where: { userId: nextOwnerUserId },
    select: {
      manager: {
        select: {
          bdNumber: true,
        },
      },
    },
  })

  return assigneeEmployee?.manager?.bdNumber ?? null
}

export async function buildLeadOwnershipTransferUpdateForAssigneeManager(
  nextOwnerUserId: string,
  assignedAt: Date = new Date(),
) {
  const update = {
    ...buildLeadOwnershipTransferUpdate(nextOwnerUserId, assignedAt),
  } as {
    bd: { connect: { id: string } }
    assignedDate: Date
    teamLeadId?: number | null
  }

  update.teamLeadId = await getLeadTeamLeadIdForAssigneeManager(nextOwnerUserId)
  return update
}

export async function getLeadVisibilityScopeUserIds(
  user: SessionUser
): Promise<string[] | null> {
  if (FULL_LEAD_ACCESS_ROLES.has(user.role)) {
    return null
  }

  if (user.role === 'BD') {
    return [user.id]
  }

  if (HIERARCHY_LEAD_ACCESS_ROLES.has(user.role)) {
    const employee = await getEmployeeByUserId(user.id)
    if (!employee) {
      return [user.id]
    }

    const subordinates = await getSubordinates(employee.id, true)
    return [user.id, ...subordinates.map((subordinate) => subordinate.userId)]
  }

  return []
}

export async function canUserViewLeadOwner(
  user: SessionUser,
  leadOwnerUserId: string
): Promise<boolean> {
  const scopeUserIds = await getLeadVisibilityScopeUserIds(user)
  if (scopeUserIds === null) {
    return true
  }

  return scopeUserIds.includes(leadOwnerUserId)
}

export async function canUserUpdateLeadStatus(
  user: SessionUser,
  leadOwnerUserId: string
): Promise<boolean> {
  if (LEAD_STATUS_OVERRIDE_ROLES.has(user.role)) {
    return true
  }

  if (user.role === 'BD') {
    return user.id === leadOwnerUserId
  }

  if (LEAD_STATUS_HIERARCHY_ROLES.has(user.role)) {
    const scopeUserIds = await getLeadVisibilityScopeUserIds(user)
    return Array.isArray(scopeUserIds) && scopeUserIds.includes(leadOwnerUserId)
  }

  return false
}

export async function canUserEditLeadProfile(
  user: SessionUser,
  leadOwnerUserId: string
): Promise<boolean> {
  if (LEAD_PROFILE_OVERRIDE_ROLES.has(user.role)) {
    return true
  }

  if (user.role === 'BD') {
    return user.id === leadOwnerUserId
  }

  if (LEAD_PROFILE_HIERARCHY_ROLES.has(user.role)) {
    const scopeUserIds = await getLeadVisibilityScopeUserIds(user)
    return Array.isArray(scopeUserIds) && scopeUserIds.includes(leadOwnerUserId)
  }

  return false
}

export async function canUserEditLeadRemarks(
  user: SessionUser,
  leadOwnerUserId: string
): Promise<boolean> {
  return canUserAddLeadRemarks(user, leadOwnerUserId)
}

export async function canUserAddLeadRemarks(
  user: SessionUser,
  leadOwnerUserId: string
): Promise<boolean> {
  const settings = await getCrmLeadRemarkSettings()
  if (!settings.allowAddRemarks) {
    return false
  }

  return canUserEditLeadProfile(user, leadOwnerUserId)
}

export async function canUserRemoveLeadRemarks(
  user: SessionUser,
  leadOwnerUserId: string
): Promise<boolean> {
  const settings = await getCrmLeadRemarkSettings()
  if (!settings.allowRemoveRemarks) {
    return false
  }

  return canUserEditLeadProfile(user, leadOwnerUserId)
}

export async function getAssignableLeadUsersForActor(
  user: SessionUser
): Promise<AssignableLeadUser[]> {
  if (LEAD_STATUS_OVERRIDE_ROLES.has(user.role)) {
    const users = await prisma.user.findMany({
      where: {
        role: { in: Array.from(SALES_ASSIGNABLE_ROLES) },
        employee: {
          is: {
            status: EmployeeStatus.ACTIVE,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    })

    return users
  }

  if (user.role === 'BD') {
    return []
  }

  if (!HIERARCHY_LEAD_ACCESS_ROLES.has(user.role)) {
    return []
  }

  const allowedRoles = new Set(HIERARCHY_ASSIGNABLE_ROLE_SCOPE[user.role] ?? [])
  const employee = await getEmployeeByUserId(user.id)
  const subordinates = employee ? await getSubordinates(employee.id, true) : []

  const assignableUsers = new Map<string, AssignableLeadUser>()

  if (
    employee?.status === EmployeeStatus.ACTIVE &&
    allowedRoles.has(user.role) &&
    SALES_ASSIGNABLE_ROLES.has(user.role)
  ) {
    assignableUsers.set(user.id, {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })
  }

  for (const subordinate of subordinates) {
    if (subordinate.status !== EmployeeStatus.ACTIVE) continue
    if (!allowedRoles.has(subordinate.user.role)) continue
    if (!SALES_ASSIGNABLE_ROLES.has(subordinate.user.role)) continue

    assignableUsers.set(subordinate.user.id, {
      id: subordinate.user.id,
      name: subordinate.user.name,
      email: subordinate.user.email,
      role: subordinate.user.role,
    })
  }

  return Array.from(assignableUsers.values()).sort((left, right) =>
    formatLeadAssigneeName(left.name, left.email).localeCompare(
      formatLeadAssigneeName(right.name, right.email),
    )
  )
}

export async function getBulkReassignableLeadUsersForActor(
  user: SessionUser
): Promise<AssignableLeadUser[]> {
  return getAssignableLeadUsersForActor(user)
}

export async function getBulkReassignableBdUsersForActor(
  user: SessionUser
): Promise<AssignableLeadUser[]> {
  if (LEAD_STATUS_OVERRIDE_ROLES.has(user.role) || user.role === 'EXECUTIVE_ASSISTANT') {
    const users = await prisma.user.findMany({
      where: {
        role: UserRole.BD,
        employee: {
          is: {
            status: EmployeeStatus.ACTIVE,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    })

    return users
  }

  if (user.role === 'BD') {
    return []
  }

  if (!LEAD_STATUS_HIERARCHY_ROLES.has(user.role)) {
    return []
  }

  const employee = await getEmployeeByUserId(user.id)
  if (!employee) {
    return []
  }

  const subordinates = await getSubordinates(employee.id, true)

  return subordinates
    .filter((subordinate) => subordinate.user.role === UserRole.BD)
    .filter((subordinate) => subordinate.status === EmployeeStatus.ACTIVE)
    .map((subordinate) => ({
      id: subordinate.user.id,
      name: subordinate.user.name,
      email: subordinate.user.email,
      role: subordinate.user.role,
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

export async function canUserReassignLead(
  user: SessionUser,
  leadOwnerUserId: string,
  nextOwnerUserId: string
): Promise<boolean> {
  if (!(await canUserUpdateLeadStatus(user, leadOwnerUserId))) {
    return false
  }

  const assignableUsers = await getAssignableLeadUsersForActor(user)
  return assignableUsers.some((assignableUser) => assignableUser.id === nextOwnerUserId)
}
