import { UserRole } from '@/generated/prisma/enums'

export const ROLE_LABELS: Record<UserRole, string> = {
  MD: 'MD',
  EXECUTIVE_ASSISTANT: 'Executive Assistant',
  SALES_HEAD: 'Sales Head',
  CATEGORY_MANAGER: 'Category Manager',
  ASSISTANT_CATEGORY_MANAGER: 'Assistant Category Manager',
  TEAM_LEAD: 'Team Lead',
  BD: 'BD',
  INSURANCE_HEAD: 'Insurance Head',
  PL_HEAD: 'P&L Head',
  OUTSTANDING_HEAD: 'Outstanding Head',
  HR_HEAD: 'HR Head',
  FINANCE_HEAD: 'Finance Head',
  DIGITAL_MARKETING_HEAD: 'Digital Marketing Head',
  IT_HEAD: 'IT Head',
  LOAN_DEMAT_HEAD: 'Loan & Demat Head',
  COMPLIANCE_HEAD: 'Compliance Head',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
  CRM_ADMIN: 'CRM Admin',
  USER: 'User (HRMS Only)',
  TESTER: 'Tester',
}

export function isUserRole(value: string): value is UserRole {
  return value in ROLE_LABELS
}

export function getRoleLabel(role: string): string {
  if (isUserRole(role)) {
    return ROLE_LABELS[role]
  }
  return role.replace(/_/g, ' ')
}
