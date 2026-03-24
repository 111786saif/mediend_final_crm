import { UserRole } from '@/generated/prisma/enums'
import { SessionUser } from './auth'

export type Permission = 
  | 'leads:read'
  | 'leads:write'
  | 'leads:assign'
  | 'targets:read'
  | 'targets:write'
  | 'analytics:read'
  | 'users:read'
  | 'users:write'
  | 'insurance:read'
  | 'insurance:write'
  | 'pl:read'
  | 'pl:write'
  | 'reports:export'
  | 'hrms:read'
  | 'hrms:write'
  | 'hrms:attendance:read'
  | 'hrms:attendance:write'
  | 'hrms:leaves:read'
  | 'hrms:leaves:write'
  | 'hrms:payroll:read'
  | 'hrms:payroll:write'
  | 'hrms:employees:read'
  | 'hrms:employees:write'
  | 'finance:read'
  | 'finance:write'
  | 'finance:masters:write'
  | 'finance:approve'
  | 'finance:payroll:read'
  | 'finance:payroll:write'
  | 'departments:create'
  | 'departments:assign_head'
  | 'users:create_tl'
  | 'users:create_user'
  | 'hierarchy:read'
  | 'hierarchy:write'
  | 'hierarchy:team:read'
  | 'hierarchy:leave:approve'
  | 'it:permissions'
  | 'masters:read'
  | 'masters:write'

const rolePermissions: Record<UserRole, Permission[]> = {
  MD: [
    'leads:read',
    'leads:write',
    'analytics:read',
    'reports:export',
    'users:read',
    'insurance:read',
    'pl:read',
    'finance:read',
    'finance:approve',
    'finance:payroll:read',
    'finance:payroll:write',
    'departments:create',
    'departments:assign_head',
    'users:create_tl',
    'users:create_user',
    'hrms:attendance:read',
    'hrms:employees:read',
    'hierarchy:read',
    'hierarchy:write',
    'hierarchy:team:read',
    'hierarchy:leave:approve',
    'it:permissions',
    'masters:read',
    'masters:write',
  ],
  EXECUTIVE_ASSISTANT: [
    'analytics:read',
    'leads:read',
    'hrms:read',
    'hrms:attendance:read',
    'hrms:leaves:read',
    'hrms:employees:read',
    'hierarchy:read',
    'hierarchy:team:read',
    'masters:read',
    'masters:write',
  ],
  SALES_HEAD: [
    'leads:read',
    'leads:write',
    'leads:assign',
    'targets:read',
    'targets:write',
    'analytics:read',
    'reports:export',
    'users:read',
    'users:write',
    'departments:create',
    'users:create_tl',
    'users:create_user',
    'hierarchy:read',
    'hierarchy:team:read',
    'hierarchy:leave:approve',
    'hrms:employees:read',
    'hrms:employees:write',
  ],
  CATEGORY_MANAGER: [
    'leads:read',
    'leads:write',
    'leads:assign',
    'targets:read',
    'analytics:read',
    'hierarchy:read',
    'hierarchy:team:read',
    'hierarchy:leave:approve',
  ],
  ASSISTANT_CATEGORY_MANAGER: [
    'leads:read',
    'leads:write',
    'leads:assign',
    'targets:read',
    'analytics:read',
    'hierarchy:read',
    'hierarchy:team:read',
    'hierarchy:leave:approve',
  ],
  // Same lead pipeline permissions as BD; access is scoped by canAccessLead (own team / subordinates).
  TEAM_LEAD: [
    'leads:read',
    'leads:write',
    'leads:assign',
    'targets:read',
    'analytics:read',
    'hierarchy:read',
    'hierarchy:team:read',
    'hierarchy:leave:approve',
  ],
  BD: [
    'leads:read',
    'leads:write',
    'leads:assign',
    'targets:read',
    'analytics:read',
  ],
  INSURANCE_HEAD: [
    'leads:read',
    'leads:write',
    'insurance:read',
    'insurance:write',
    'analytics:read',
    'departments:create',
    'users:create_tl',
    'users:create_user',
    'hierarchy:read',
    'hierarchy:team:read',
    'hierarchy:leave:approve',
  ],
  PL_HEAD: [
    'leads:read',
    'leads:write',
    'pl:read',
    'pl:write',
    'analytics:read',
    'departments:create',
    'users:create_tl',
    'users:create_user',
    'hierarchy:read',
    'hierarchy:team:read',
    'hierarchy:leave:approve',
  ],
  HR_HEAD: [
    'users:read',
    'users:write',
    'analytics:read',
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
    'finance:payroll:read',
    'finance:payroll:write',
    'departments:create',
    'users:create_tl',
    'users:create_user',
    'hierarchy:read',
    'hierarchy:write',
    'hierarchy:team:read',
    'hierarchy:leave:approve',
  ],
  FINANCE_HEAD: [
    'analytics:read',
    'finance:read',
    'finance:write',
    'finance:masters:write',
    'finance:payroll:read',
    'finance:payroll:write',
    'hrms:employees:read',
    'departments:create',
    'users:create_tl',
    'users:create_user',
    'hierarchy:read',
    'hierarchy:team:read',
    'hierarchy:leave:approve',
  ],
  DIGITAL_MARKETING_HEAD: [
    'analytics:read',
    'hierarchy:read',
    'hierarchy:team:read',
    'hierarchy:leave:approve',
  ],
  IT_HEAD: [
    'users:read',
    'users:write',
    'it:permissions',
    'hierarchy:read',
    'hierarchy:team:read',
  ],
  OUTSTANDING_HEAD: [
    'leads:read',
    'analytics:read',
    'reports:export',
    'departments:create',
    'users:create_tl',
    'users:create_user',
    'hierarchy:read',
    'hierarchy:team:read',
    'hierarchy:leave:approve',
  ],
  ADMIN: [
    'leads:read',
    'leads:write',
    'leads:assign',
    'targets:read',
    'targets:write',
    'analytics:read',
    'users:read',
    'users:write',
    'it:permissions',
    'insurance:read',
    'insurance:write',
    'pl:read',
    'pl:write',
    'reports:export',
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
    'finance:read',
    'finance:write',
    'finance:masters:write',
    'finance:approve',
    'finance:payroll:read',
    'finance:payroll:write',
    'departments:create',
    'departments:assign_head',
    'users:create_tl',
    'users:create_user',
    'hierarchy:read',
    'hierarchy:write',
    'hierarchy:team:read',
    'hierarchy:leave:approve',
    'masters:read',
    'masters:write',
  ],
  USER: [
    'hrms:read',
    'hrms:attendance:read',
    'hrms:leaves:read',
    'hrms:payroll:read',
    'hrms:employees:read',
  ],
  TESTER: [
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
    'reports:export',
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
    'finance:read',
    'finance:write',
    'finance:masters:write',
    'finance:approve',
    'finance:payroll:read',
    'finance:payroll:write',
    'departments:create',
    'departments:assign_head',
    'users:create_tl',
    'users:create_user',
    'hierarchy:read',
    'hierarchy:write',
    'hierarchy:team:read',
    'hierarchy:leave:approve',
    'masters:read',
    'masters:write',
  ],
}

export function hasPermission(user: SessionUser | null, permission: Permission): boolean {
  if (!user) return false
  const permissions = rolePermissions[user.role] || []
  return permissions.includes(permission)
}

export function canAccessLead(
  user: SessionUser | null,
  leadBdId: string,
  leadTeamId?: string | null,
  /** When provided for TEAM_LEAD, allow if leadBdId is in this list (hierarchy-based access) */
  subordinateUserIds?: string[]
): boolean {
  if (!user) return false

  // MD, Sales Head, Insurance Head, PL Head, Admin, Tester can access all leads
  if (['MD', 'SALES_HEAD', 'INSURANCE_HEAD', 'PL_HEAD', 'ADMIN', 'TESTER'].includes(user.role)) {
    return true
  }

  // Team Lead: same mutation scope as BD on accessible leads — own team BDs' leads (subordinates + legacy teamId match)
  if (user.role === 'TEAM_LEAD') {
    if (leadBdId === user.id) return true
    if (subordinateUserIds && subordinateUserIds.includes(leadBdId)) return true
    if (leadTeamId && user.teamId === leadTeamId) return true
    return false
  }

  // BD can only access their own leads
  if (user.role === 'BD' && user.id === leadBdId) {
    return true
  }

  return false
}

export function canManageTeam(user: SessionUser | null, teamSalesHeadId?: string): boolean {
  if (!user) return false

  if (['MD', 'ADMIN', 'TESTER'].includes(user.role)) {
    return true
  }

  if (user.role === 'SALES_HEAD' && teamSalesHeadId === user.id) {
    return true
  }

  return false
}

// Hierarchy validation functions

const DEPT_HEAD_ROLES: UserRole[] = ['INSURANCE_HEAD', 'PL_HEAD', 'SALES_HEAD', 'HR_HEAD', 'FINANCE_HEAD', 'OUTSTANDING_HEAD', 'DIGITAL_MARKETING_HEAD', 'IT_HEAD']

export function isDepartmentHead(role: UserRole): boolean {
  return DEPT_HEAD_ROLES.includes(role)
}

export function canCreateDepartment(user: SessionUser | null): boolean {
  if (!user) return false
  return user.role === 'MD' || isDepartmentHead(user.role) || user.role === 'ADMIN'
}

export function canAssignDepartmentHead(user: SessionUser | null): boolean {
  if (!user) return false
  return user.role === 'MD' || user.role === 'ADMIN' || user.role === 'HR_HEAD'
}

export function canCreateRole(user: SessionUser | null, targetRole: UserRole): boolean {
  if (!user) return false

  // MD cannot be created by anyone
  if (targetRole === 'MD') {
    return false
  }

  // MD and ADMIN can create any role except MD
  if (user.role === 'MD' || user.role === 'ADMIN') {
    return true
  }

  // HR_HEAD can create department head roles when creating departments
  if (user.role === 'HR_HEAD') {
    return isDepartmentHead(targetRole) || targetRole === 'EXECUTIVE_ASSISTANT' || targetRole === 'CATEGORY_MANAGER' || targetRole === 'ASSISTANT_CATEGORY_MANAGER' || targetRole === 'TEAM_LEAD' || targetRole === 'USER' || targetRole === 'BD'
  }

  // IT_HEAD can create IT_HEAD (for succession)
  if (user.role === 'IT_HEAD' && targetRole === 'IT_HEAD') {
    return true
  }

  // Department heads can create TL and USER/BD
  if (isDepartmentHead(user.role)) {
    return targetRole === 'TEAM_LEAD' || targetRole === 'USER' || targetRole === 'BD'
  }

  return false
}

export function getAvailableRolesForCreator(user: SessionUser | null): UserRole[] {
  if (!user) return []

  // MD cannot be created
  const allRolesExceptMD: UserRole[] = ['EXECUTIVE_ASSISTANT', 'SALES_HEAD', 'CATEGORY_MANAGER', 'ASSISTANT_CATEGORY_MANAGER', 'TEAM_LEAD', 'BD', 'INSURANCE_HEAD', 'PL_HEAD', 'OUTSTANDING_HEAD', 'HR_HEAD', 'FINANCE_HEAD', 'DIGITAL_MARKETING_HEAD', 'IT_HEAD', 'ADMIN', 'USER', 'TESTER']

  if (user.role === 'MD' || user.role === 'ADMIN' || user.role === 'TESTER') {
    return allRolesExceptMD
  }

  // HR_HEAD can create department head roles
  if (user.role === 'HR_HEAD') {
    return ['INSURANCE_HEAD', 'PL_HEAD', 'SALES_HEAD', 'HR_HEAD', 'FINANCE_HEAD', 'OUTSTANDING_HEAD', 'DIGITAL_MARKETING_HEAD', 'IT_HEAD', 'EXECUTIVE_ASSISTANT', 'CATEGORY_MANAGER', 'ASSISTANT_CATEGORY_MANAGER', 'TEAM_LEAD', 'USER', 'BD']
  }

  if (isDepartmentHead(user.role)) {
    return ['TEAM_LEAD', 'USER', 'BD']
  }

  return []
}

