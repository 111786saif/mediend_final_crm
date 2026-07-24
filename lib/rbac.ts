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
  | 'hrms:recruitment:read'
  | 'hrms:recruitment:write'
  | 'finance:read'
  | 'finance:write'
  | 'finance:masters:write'
  | 'finance:approve'
  | 'finance:payroll:read'
  | 'finance:payroll:write'
  | 'incentive:read'
  | 'incentive:write'
  | 'departments:create'
  | 'departments:assign_head'
  | 'users:create_tl'
  | 'users:create_user'
  | 'hierarchy:read'
  | 'hierarchy:write'
  | 'hierarchy:team:read'
  | 'hierarchy:leave:approve'
  | 'it:permissions'
  | 'it:pnl:read'
  | 'it:pnl:write'
  | 'loan-demat:read'
  | 'loan-demat:write'
  | 'pnl:read'
  | 'pnl:write'
  /** Surgery / sales P&L slice only (no full company P&L) */
  | 'sales:pnl:read'
  | 'sales:read'
  | 'masters:read'
  | 'masters:write'
  | 'compliance:read'
  | 'compliance:write'
  | 'main.cumulative_report'


const rolePermissions: Record<UserRole, Permission[]> = {
  MD: [
    'leads:read',
    'leads:write',
    'analytics:read',
    'targets:read',
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
    'hrms:recruitment:read',
    'hrms:recruitment:write',
    'hierarchy:read',
    'hierarchy:write',
    'hierarchy:team:read',
    'hierarchy:leave:approve',
    'it:permissions',
    'pnl:read',
    'pnl:write',
    'it:pnl:read',
    'it:pnl:write',
    'loan-demat:read',
    'loan-demat:write',
    'masters:read',
    'masters:write',
    'compliance:read',
    'main.cumulative_report',
  ],
  EXECUTIVE_ASSISTANT: [
    'analytics:read',
    'leads:read',
    'leads:write',
    'leads:assign',
    'targets:read',
    'targets:write',
    'users:read',
    'users:write',
    'users:create_tl',
    'users:create_user',
    'insurance:read',
    'insurance:write',
    'pl:read',
    'hrms:read',
    'hrms:write',
    'hrms:attendance:read',
    'hrms:attendance:write',
    'hrms:leaves:read',
    'hrms:leaves:write',
    'hrms:employees:read',
    'hrms:employees:write',
    'hrms:recruitment:read',
    'hrms:recruitment:write',
    'hierarchy:read',
    'hierarchy:write',
    'hierarchy:team:read',
    'hierarchy:leave:approve',
    'masters:read',
    'masters:write',
    'sales:pnl:read',
    'compliance:read',
    'compliance:write',
    'incentive:read',
    'incentive:write',
    'main.cumulative_report',
  ],
  SALES_HEAD: [
    'leads:read',
    'leads:write',
    'leads:assign',
    'targets:read',
    'targets:write',
    'analytics:read',
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
    'sales:pnl:read',
    'incentive:read',
    'incentive:write',
    'pl:read',
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
    'targets:write',
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
    'main.cumulative_report',
  ],
  PL_HEAD: [
    'leads:read',
    'leads:write',
    'pl:read',
    'pl:write',
    'masters:read',
    'masters:write',
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
    'hrms:recruitment:read',
    'hrms:recruitment:write',
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
  LOAN_DEMAT_HEAD: [
    'analytics:read',
    'hierarchy:read',
    'hierarchy:team:read',
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
    'pnl:read',
    'pnl:write',
    'it:pnl:read',
    'loan-demat:read',
    'loan-demat:write',
  ],
  DIGITAL_MARKETING_HEAD: [
    'analytics:read',
    'leads:read',
    'pl:read',
    'sales:read',
    'sales:pnl:read',
    'hierarchy:read',
    'hierarchy:team:read',
    'hierarchy:leave:approve',
  ],
  IT_HEAD: [
    'users:read',
    'users:write',
    'it:permissions',
    'it:pnl:read',
    'it:pnl:write',
    'hrms:employees:read',
    'hierarchy:read',
    'hierarchy:team:read',
  ],
  OUTSTANDING_HEAD: [
    'leads:read',
    'analytics:read',
    'departments:create',
    'users:create_tl',
    'users:create_user',
    'hierarchy:read',
    'hierarchy:team:read',
    'hierarchy:leave:approve',
  ],
  COMPLIANCE_HEAD: [
    'leads:read',
    'compliance:read',
    'compliance:write',
    'hierarchy:read',
    'main.cumulative_report',
  ],
  SUPER_ADMIN: [],
  CRM_ADMIN: [],
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
    'pnl:read',
    'pnl:write',
    'it:pnl:read',
    'it:pnl:write',
    'loan-demat:read',
    'loan-demat:write',
    'compliance:read',
    'compliance:write',
    'incentive:read',
    'incentive:write',
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
    'loan-demat:read',
    'loan-demat:write',
    'sales:pnl:read',
    'compliance:read',
    'compliance:write',
  ],
  ACCESS_MATRIX: [
    'it:permissions',
  ],
}

export function hasPermission(user: SessionUser | null, permission: Permission): boolean {
  if (!user) return false
  const permissions = rolePermissions[user.role] || []
  return permissions.includes(permission)
}

/** Outstanding / doctor / hospital list: shared by P&L and Finance modules */
export function hasPlOrFinanceRead(user: SessionUser | null): boolean {
  return hasPermission(user, 'pl:read') || hasPermission(user, 'finance:read')
}

export function hasPlOrFinanceWrite(user: SessionUser | null): boolean {
  return hasPermission(user, 'pl:write') || hasPermission(user, 'finance:write')
}

export function canAccessLead(
  user: SessionUser | null,
  leadBdId: string,
  /** When provided for TEAM_LEAD, allow if leadBdId is in this list (hierarchy-based access) */
  subordinateUserIds?: string[]
): boolean {
  if (!user) return false

  // MD, Sales Head, Insurance Head, PL Head, Admin, Tester, Executive Assistant, Compliance Head can access all leads
  if (['MD', 'SALES_HEAD', 'INSURANCE_HEAD', 'PL_HEAD', 'ADMIN', 'TESTER', 'EXECUTIVE_ASSISTANT', 'COMPLIANCE_HEAD'].includes(user.role)) {
    return true
  }

  // Team Lead: own leads + hierarchy subordinates' leads
  if (user.role === 'TEAM_LEAD') {
    if (leadBdId === user.id) return true
    if (subordinateUserIds && subordinateUserIds.includes(leadBdId)) return true
    return false
  }

  // BD can only access their own leads
  if (user.role === 'BD' && user.id === leadBdId) {
    return true
  }

  return false
}

// Hierarchy validation functions

const DEPT_HEAD_ROLES: UserRole[] = [
  'INSURANCE_HEAD',
  'PL_HEAD',
  'SALES_HEAD',
  'HR_HEAD',
  'FINANCE_HEAD',
  'OUTSTANDING_HEAD',
  'DIGITAL_MARKETING_HEAD',
  'IT_HEAD',
  'LOAN_DEMAT_HEAD',
  'COMPLIANCE_HEAD',
]

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

  // CRM-only roles are intentionally excluded from legacy HR/user-management flows.
  if (targetRole === 'SUPER_ADMIN' || targetRole === 'CRM_ADMIN') {
    return false
  }

  // MD and ADMIN can create any role except MD
  if (user.role === 'MD' || user.role === 'ADMIN') {
    return true
  }

  // Executive Assistant can create TL, USER, and BD (same as department heads)
  if (user.role === 'EXECUTIVE_ASSISTANT') {
    return targetRole === 'TEAM_LEAD' || targetRole === 'USER' || targetRole === 'BD'
  }

  // HR_HEAD can assign dept heads (except IT/Finance) and common staff roles — not Admin/Tester/EA
  if (user.role === 'HR_HEAD') {
    if (
      targetRole === 'EXECUTIVE_ASSISTANT' ||
      targetRole === 'IT_HEAD' ||
      targetRole === 'FINANCE_HEAD' ||
      targetRole === 'ADMIN' ||
      targetRole === 'TESTER'
    ) {
      return false
    }
    return (
      isDepartmentHead(targetRole) ||
      targetRole === 'CATEGORY_MANAGER' ||
      targetRole === 'ASSISTANT_CATEGORY_MANAGER' ||
      targetRole === 'TEAM_LEAD' ||
      targetRole === 'USER' ||
      targetRole === 'BD' ||
      targetRole === 'ACCESS_MATRIX'
    )
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
  const allRolesExceptMD: UserRole[] = [
    'EXECUTIVE_ASSISTANT',
    'SALES_HEAD',
    'CATEGORY_MANAGER',
    'ASSISTANT_CATEGORY_MANAGER',
    'TEAM_LEAD',
    'BD',
    'INSURANCE_HEAD',
    'PL_HEAD',
    'OUTSTANDING_HEAD',
    'HR_HEAD',
    'FINANCE_HEAD',
    'DIGITAL_MARKETING_HEAD',
    'IT_HEAD',
    'LOAN_DEMAT_HEAD',
    'COMPLIANCE_HEAD',
    'ADMIN',
    'USER',
    'TESTER',
    'ACCESS_MATRIX',
  ]

  if (user.role === 'MD' || user.role === 'ADMIN' || user.role === 'TESTER') {
    return allRolesExceptMD
  }

  // Executive Assistant can create TL, USER, and BD
  if (user.role === 'EXECUTIVE_ASSISTANT') {
    return ['TEAM_LEAD', 'USER', 'BD']
  }

  // HR_HEAD: dept heads + staff; exclude Admin, Tester, EA, IT Head, Finance Head
  if (user.role === 'HR_HEAD') {
    return [
      'INSURANCE_HEAD',
      'PL_HEAD',
      'SALES_HEAD',
      'HR_HEAD',
      'OUTSTANDING_HEAD',
      'DIGITAL_MARKETING_HEAD',
      'LOAN_DEMAT_HEAD',
      'COMPLIANCE_HEAD',
      'CATEGORY_MANAGER',
      'ASSISTANT_CATEGORY_MANAGER',
      'TEAM_LEAD',
      'USER',
      'BD',
      'ACCESS_MATRIX',
    ]
  }

  if (isDepartmentHead(user.role)) {
    return ['TEAM_LEAD', 'USER', 'BD']
  }

  return []
}
