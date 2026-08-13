import type { SessionUser } from '@/lib/auth'
import { hasEffectivePermission } from '@/lib/rbac-new'

// Async dynamic RBAC helpers for backend API gates
export async function canReadEffectiveItPnl(user: SessionUser | null): Promise<boolean> {
  if (!user) return false
  if (await hasEffectivePermission(user, 'it:pnl:read', 'main.it_pnl')) return true
  return hasEffectivePermission(user, 'pnl:read', 'main.company_pnl')
}

export async function canWriteEffectiveItPnl(user: SessionUser | null): Promise<boolean> {
  if (!user) return false
  return hasEffectivePermission(user, 'it:pnl:write', 'main.it_pnl')
}
