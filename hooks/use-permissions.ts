'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
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
  const activeRole = typeof window !== 'undefined' ? localStorage.getItem('mediend_tester_active_role') : null

  const { data, isLoading, error } = useQuery({
    queryKey: ['me', 'permissions', activeRole],
    queryFn: () => {
      const url = activeRole ? `/api/me/permissions?role=${activeRole}` : '/api/me/permissions'
      return apiGet<{ permissions: Record<string, { level: PermissionLevel; canGrant: boolean }> }>(url)
    },
    staleTime: 5 * 60 * 1000, // Cache permissions for 5 minutes
    refetchOnWindowFocus: false,
  })

  const permissions = data?.permissions ?? {}

  /**
   * Check if the user has access to a resource key at the required permission level.
   * Centralized evaluation logic.
   */
  const hasAccess = (resourceKey: string, requiredLevel: PermissionLevel = PermissionLevel.READ): boolean => {
    const userPerm = permissions[resourceKey]
    if (!userPerm) return false

    const userRank = PERMISSION_RANKS[userPerm.level] ?? 0
    const requiredRank = PERMISSION_RANKS[requiredLevel] ?? 0

    return userRank >= requiredRank
  }

  return {
    permissions,
    hasAccess,
    isLoading: isLoading && !data, // Only consider loading if we don't have cached data yet
    error,
  }
}
