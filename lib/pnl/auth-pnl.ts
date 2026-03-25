import type { SessionUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

export function canReadPnl(user: SessionUser | null): boolean {
  if (!user) return false
  return hasPermission(user, 'pnl:read')
}

export function canWritePnl(user: SessionUser | null): boolean {
  if (!user) return false
  return hasPermission(user, 'pnl:write')
}

export function canReadLoanDemat(user: SessionUser | null): boolean {
  if (!user) return false
  return hasPermission(user, 'loan-demat:read') || hasPermission(user, 'loan-demat:write') || canReadPnl(user)
}

export function canWriteLoanDemat(user: SessionUser | null): boolean {
  if (!user) return false
  return hasPermission(user, 'loan-demat:write')
}
