'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
export type PermissionLevel = 'NONE' | 'READ' | 'READ_WRITE' | 'READ_WRITE_DELETE' | 'FULL_ACCESS'

export const PermissionLevel = {
  NONE: 'NONE',
  READ: 'READ',
  READ_WRITE: 'READ_WRITE',
  READ_WRITE_DELETE: 'READ_WRITE_DELETE',
  FULL_ACCESS: 'FULL_ACCESS',
} as const

const PERMISSION_RANKS: Record<PermissionLevel, number> = {
  NONE: 0,
  READ: 1,
  READ_WRITE: 2,
  READ_WRITE_DELETE: 3,
  FULL_ACCESS: 4,
}

export function usePermissions() {
  const { user } = useAuth()
  const activeRole =
    (user?.role === 'TESTER' || user?.role === 'ADMIN' || user?.role === 'MD') && typeof window !== 'undefined'
      ? localStorage.getItem('mediend_tester_active_role')
      : null

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['me', 'permissions', user?.id, activeRole],
    enabled: !!user?.id,
    queryFn: () => {
      const url = activeRole ? `/api/me/permissions?role=${activeRole}` : '/api/me/permissions'
      return apiGet<{ permissions: Record<string, { level: PermissionLevel; canGrant: boolean }> }>(url)
    },
    staleTime: 60_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const permissions = data?.permissions ?? {}
  const permissionsReady = !!user?.id && !!data

  /**
   * Check if the user has access to a resource key at the required permission level.
   * Centralized evaluation logic.
   */
  const hasAccess = (resourceKey: string, requiredLevel: PermissionLevel = PermissionLevel.READ): boolean => {
    if (!permissionsReady) return true

    const userPerm = permissions[resourceKey]
    if (!userPerm) return false

    const userRank = PERMISSION_RANKS[userPerm.level] ?? 0
    const requiredRank = PERMISSION_RANKS[requiredLevel] ?? 0

    return userRank >= requiredRank
  }

  return {
    permissions,
    hasAccess,
    isLoading: !!user?.id && (isLoading || isFetching) && !data,
    permissionsReady,
    error,
  }
}
