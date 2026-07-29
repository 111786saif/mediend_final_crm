import { NextRequest } from 'next/server'
import { UserRole } from '@/generated/prisma/client'
import { SessionUser, getUserById } from '@/lib/auth'
import { getSessionFromRequest } from '@/lib/session'
import { getEmployeeByUserId, getSubordinates } from '@/lib/hierarchy'
import { hasPermission, type Permission } from '@/lib/rbac'
import { isSubtreeScopedSalesRole } from '@/lib/sales-hierarchy-roles'
import { cachedJson } from '@/lib/ai/redis-cache'

const GLOBAL_ROLES: UserRole[] = [
  UserRole.MD,
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.SALES_HEAD,
  UserRole.EXECUTIVE_ASSISTANT,
]

const ALL_PERMISSIONS: Permission[] = [
  'leads:read',
  'leads:write',
  'leads:assign',
  'targets:read',
  'targets:write',
  'analytics:read',
  'users:read',
  'users:write',
  'insurance:read',
  'insurance:write',
  'pl:read',
  'pl:write',
  'hrms:read',
  'hrms:write',
  'hrms:attendance:read',
  'hrms:attendance:write',
  'hrms:leaves:read',
  'hrms:leaves:write',
  'hrms:payroll:read',
  'hrms:payroll:write',
  'hrms:employees:read',
  'hrms:employees:write',
  'hrms:recruitment:read',
  'hrms:recruitment:write',
  'finance:read',
  'finance:write',
  'finance:masters:write',
  'finance:approve',
  'finance:payroll:read',
  'finance:payroll:write',
  'incentive:read',
  'incentive:write',
  'departments:create',
  'departments:assign_head',
  'users:create_tl',
  'users:create_user',
  'hierarchy:read',
  'hierarchy:write',
  'hierarchy:team:read',
  'hierarchy:leave:approve',
  'it:permissions',
  'it:pnl:read',
  'it:pnl:write',
  'loan-demat:read',
  'loan-demat:write',
  'pnl:read',
  'pnl:write',
  'sales:pnl:read',
  'sales:read',
  'masters:read',
  'masters:write',
  'compliance:read',
  'compliance:write',
  'main.cumulative_report',
]

export interface AiActor {
  user: SessionUser
  employeeId: string | null
  departmentId: string | null
  subordinateUserIds: string[]
  subordinateEmployeeIds: string[]
  isGlobal: boolean
  permissions: Set<Permission>
  /** Cookie header forwarded for internal HTTP tool calls */
  cookieHeader: string
}

function collectPermissions(user: SessionUser): Set<Permission> {
  const set = new Set<Permission>()
  for (const p of ALL_PERMISSIONS) {
    if (hasPermission(user, p)) set.add(p)
  }
  return set
}

async function loadSubordinateTree(employeeId: string): Promise<{
  subordinateUserIds: string[]
  subordinateEmployeeIds: string[]
}> {
  return cachedJson(`ai:subs:${employeeId}`, 300, async () => {
    const subs = await getSubordinates(employeeId, true)
    return {
      subordinateUserIds: subs.map((s) => s.userId).filter(Boolean),
      subordinateEmployeeIds: subs.map((s) => s.id),
    }
  })
}

/**
 * Build the AI actor for a request: identity + hierarchy scope + permissions.
 * This is the single source of truth for what tools/data the model can access.
 */
export async function buildAiActor(req: NextRequest): Promise<AiActor | null> {
  const session = getSessionFromRequest(req)
  if (!session) return null

  const fullUser = await getUserById(session.id)
  if (!fullUser) return null

  const employee = await getEmployeeByUserId(fullUser.id)
  let subordinateUserIds: string[] = []
  let subordinateEmployeeIds: string[] = []

  if (employee) {
    const tree = await loadSubordinateTree(employee.id)
    subordinateUserIds = tree.subordinateUserIds
    subordinateEmployeeIds = tree.subordinateEmployeeIds
  }

  const isGlobal = GLOBAL_ROLES.includes(fullUser.role)

  return {
    user: fullUser,
    employeeId: employee?.id ?? null,
    departmentId: employee?.departmentId ?? null,
    subordinateUserIds,
    subordinateEmployeeIds,
    isGlobal,
    permissions: collectPermissions(fullUser),
    cookieHeader: req.headers.get('cookie') || '',
  }
}

/** Build an actor from an already-resolved SessionUser (tests / scripts). */
export async function buildAiActorFromUser(
  user: SessionUser,
  cookieHeader = ''
): Promise<AiActor> {
  const employee = await getEmployeeByUserId(user.id)
  let subordinateUserIds: string[] = []
  let subordinateEmployeeIds: string[] = []

  if (employee) {
    const tree = await loadSubordinateTree(employee.id)
    subordinateUserIds = tree.subordinateUserIds
    subordinateEmployeeIds = tree.subordinateEmployeeIds
  }

  return {
    user,
    employeeId: employee?.id ?? null,
    departmentId: employee?.departmentId ?? null,
    subordinateUserIds,
    subordinateEmployeeIds,
    isGlobal: GLOBAL_ROLES.includes(user.role),
    permissions: collectPermissions(user),
    cookieHeader,
  }
}

export function actorHasTeamScope(actor: AiActor): boolean {
  if (actor.isGlobal) return true
  if (actor.subordinateUserIds.length > 0) return true
  if (actor.permissions.has('hierarchy:team:read')) return true
  if (isSubtreeScopedSalesRole(actor.user.role)) return true
  return false
}

export function actorCanManageKnowledge(actor: AiActor): boolean {
  return (
    actor.user.role === UserRole.SUPER_ADMIN ||
    actor.user.role === UserRole.EXECUTIVE_ASSISTANT
  )
}
