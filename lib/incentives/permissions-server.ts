import type { EmployeeIncentiveStatus } from '@/generated/prisma/client'
import { hasEffectivePermission } from '@/lib/rbac-new'
import type { SessionUser } from '@/lib/auth'

export async function canReadEffectiveIncentives(user: SessionUser | null): Promise<boolean> {
  return !!user && hasEffectivePermission(user, 'incentive:read', 'main.incentive')
}

export async function canCreateEffectiveIncentives(user: SessionUser | null): Promise<boolean> {
  return !!user && hasEffectivePermission(user, 'incentive:write', 'main.incentive')
}

export async function canApproveEffectiveIncentives(user: SessionUser | null): Promise<boolean> {
  return !!user && hasEffectivePermission(user, 'incentive:approve', 'main.incentive')
}

export async function canPayEffectiveIncentives(user: SessionUser | null): Promise<boolean> {
  return !!user && hasEffectivePermission(user, 'incentive:pay', 'main.incentive')
}

export async function canDeleteEffectiveIncentive(
  user: SessionUser | null,
  status: EmployeeIncentiveStatus,
): Promise<boolean> {
  if (!user || status !== 'PENDING') return false
  return canCreateEffectiveIncentives(user)
}

export async function canEditEffectiveIncentiveFields(
  user: SessionUser | null,
  status: EmployeeIncentiveStatus,
): Promise<boolean> {
  if (!user) return false
  if (status === 'PENDING' && (await canCreateEffectiveIncentives(user))) return true
  return false
}

export async function canTransitionEffectiveIncentiveStatus(
  user: SessionUser | null,
  from: EmployeeIncentiveStatus,
  to: EmployeeIncentiveStatus,
): Promise<boolean> {
  if (!user || from === to) return false
  if (from === 'PENDING' && to === 'APPROVED') return canApproveEffectiveIncentives(user)
  if (from === 'APPROVED' && to === 'PAID') return canPayEffectiveIncentives(user)
  return false
}
