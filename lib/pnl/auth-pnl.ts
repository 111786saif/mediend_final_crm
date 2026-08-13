import type { SessionUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'
import { hasEffectivePermission } from '@/lib/rbac-new'

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

// Async dynamic RBAC helpers for backend API gates
export async function canReadEffectivePnl(user: SessionUser | null): Promise<boolean> {
  if (!user) return false
  return hasEffectivePermission(user, 'pnl:read', 'main.company_pnl')
}

export async function canWriteEffectivePnl(user: SessionUser | null): Promise<boolean> {
  if (!user) return false
  return hasEffectivePermission(user, 'pnl:write', 'main.company_pnl')
}

export async function canReadEffectiveLoanDemat(user: SessionUser | null): Promise<boolean> {
  if (!user) return false
  if (await hasEffectivePermission(user, 'loan-demat:read', 'main.loan_demat_revenue')) return true
  if (await hasEffectivePermission(user, 'loan-demat:write', 'main.loan_demat_revenue')) return true
  return canReadEffectivePnl(user)
}

export async function canWriteEffectiveLoanDemat(user: SessionUser | null): Promise<boolean> {
  if (!user) return false
  return hasEffectivePermission(user, 'loan-demat:write', 'main.loan_demat_revenue')
}
