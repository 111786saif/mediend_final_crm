import type { SessionUser } from '@/lib/auth'
import { hasPermission } from '@/lib/rbac'

export function canReadItPnl(user: SessionUser | null): boolean {
  if (!user) return false
  return hasPermission(user, 'it:pnl:read') || hasPermission(user, 'pnl:read')
}

export function canWriteItPnl(user: SessionUser | null): boolean {
  if (!user) return false
  return hasPermission(user, 'it:pnl:write')
}
