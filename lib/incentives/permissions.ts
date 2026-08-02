import type { EmployeeIncentiveStatus } from '@/generated/prisma/client'
import { hasPermission } from '@/lib/rbac'
import type { SessionUser } from '@/lib/auth'

export function canReadIncentives(user: SessionUser | null): boolean {
  return !!user && hasPermission(user, 'incentive:read')
}

export function canCreateIncentives(user: SessionUser | null): boolean {
  return !!user && hasPermission(user, 'incentive:write')
}

export function canApproveIncentives(user: SessionUser | null): boolean {
  return !!user && hasPermission(user, 'incentive:approve')
}

export function canPayIncentives(user: SessionUser | null): boolean {
  return !!user && hasPermission(user, 'incentive:pay')
}

export function canDeleteIncentive(
  user: SessionUser | null,
  status: EmployeeIncentiveStatus,
): boolean {
  if (!user || status !== 'PENDING') return false
  return canCreateIncentives(user)
}

export function canEditIncentiveFields(
  user: SessionUser | null,
  status: EmployeeIncentiveStatus,
): boolean {
  if (!user) return false
  if (status === 'PENDING' && canCreateIncentives(user)) return true
  return false
}

export function canTransitionIncentiveStatus(
  user: SessionUser | null,
  from: EmployeeIncentiveStatus,
  to: EmployeeIncentiveStatus,
): boolean {
  if (!user || from === to) return false
  if (from === 'PENDING' && to === 'APPROVED') return canApproveIncentives(user)
  if (from === 'APPROVED' && to === 'PAID') return canPayIncentives(user)
  return false
}
