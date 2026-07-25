import { EmployeeStatus, UserRole } from '@/generated/prisma/client'
import type { SessionUser } from '@/lib/auth'
import { getCrmLeadRemarkSettings } from '@/lib/crm-lead-remarks'
import { getEmployeeByUserId, getSubordinates } from '@/lib/hierarchy'
import { prisma } from '@/lib/prisma'

const FULL_LEAD_ACCESS_ROLES = new Set<UserRole>([
  'SUPER_ADMIN',
  'ADMIN',
  'MD',
  'INSURANCE_HEAD',
  'PL_HEAD',
  'EXECUTIVE_ASSISTANT',
  'TESTER',
  'COMPLIANCE_HEAD',
])

const HIERARCHY_LEAD_ACCESS_ROLES = new Set<UserRole>([
  'TEAM_LEAD',
  'CATEGORY_MANAGER',
  'ASSISTANT_CATEGORY_MANAGER',
  'SALES_HEAD',
])

const LEAD_STATUS_OVERRIDE_ROLES = new Set<UserRole>(['SUPER_ADMIN', 'ADMIN', 'MD'])
const LEAD_PROFILE_OVERRIDE_ROLES = new Set<UserRole>(['SUPER_ADMIN', 'ADMIN'])

const LEAD_STATUS_HIERARCHY_ROLES = new Set<UserRole>([
  'TEAM_LEAD',
  'CATEGORY_MANAGER',
  'ASSISTANT_CATEGORY_MANAGER',
  'SALES_HEAD',
])
const LEAD_TRANSFER_CROSS_TEAM_ROLES = new Set<UserRole>([
  'EXECUTIVE_ASSISTANT',
  'TEAM_LEAD',
  'ASSISTANT_CATEGORY_MANAGER',
  'CATEGORY_MANAGER',
  'SALES_HEAD',
])
const LEAD_PROFILE_HIERARCHY_ROLES = new Set<UserRole>([
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

export type AssignableLeadUser = {
  id: string
  name: string
  email: string
  role: UserRole
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
  if (LEAD_STATUS_OVERRIDE_ROLES.has(user.role) || LEAD_TRANSFER_CROSS_TEAM_ROLES.has(user.role)) {
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

  if (!LEAD_STATUS_HIERARCHY_ROLES.has(user.role)) {
    return []
  }

  const employee = await getEmployeeByUserId(user.id)
  if (!employee) {
    return []
  }

  const subordinates = await getSubordinates(employee.id, true)

  return subordinates
    .filter((subordinate) => subordinate.user.role !== user.role)
    .filter((subordinate) => SALES_ASSIGNABLE_ROLES.has(subordinate.user.role))
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
