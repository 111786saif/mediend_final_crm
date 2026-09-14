'use client'

import { usePathname } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import { useAuth } from '@/hooks/use-auth'
import { canAccessSalesOpdMonitoring } from '@/lib/opd-monitoring-access'
import { RESOURCE_MAP } from '@/lib/rbac/resourceMap'
import { PermissionsGuard } from '@/components/permissions-guard'
import * as React from 'react'

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAuth()
  const { hasAccess, isLoading } = usePermissions()

  // Find if the current path matches any resource path defined in RESOURCE_MAP
  const resourceKeys = Object.keys(RESOURCE_MAP).filter((key) => {
    const cfg = (RESOURCE_MAP as any)[key]
    return cfg.path !== undefined
  })

  // Sort by path length descending to ensure the most specific subpaths match first
  resourceKeys.sort((a, b) => {
    const pathA = (RESOURCE_MAP as any)[a].path || ''
    const pathB = (RESOURCE_MAP as any)[b].path || ''
    return pathB.length - pathA.length
  })

  const matchedKey = resourceKeys.find((key) => {
    const path = (RESOURCE_MAP as any)[key].path
    if (!path) return false
    return pathname === path || pathname.startsWith(path + '/')
  })

  let isAllowed = matchedKey ? hasAccess(matchedKey, 'READ') : true

  // OPD Monitoring: allow sales hierarchy even when RBAC grant is missing (matches sidebar + API).
  if (!isAllowed && matchedKey === 'sales.opd_monitoring') {
    isAllowed = canAccessSalesOpdMonitoring(user?.role)
  }

  // Inventory: allow for all roles as requested
  if (!isAllowed && (matchedKey === 'main.inventory' || matchedKey?.startsWith('inventory.') || pathname === '/inventory' || pathname?.startsWith('/inventory'))) {
    isAllowed = true
  }

  return (
    <PermissionsGuard
      isLoading={isLoading}
      hasAccess={isAllowed}
      resourceName={matchedKey ? (RESOURCE_MAP as any)[matchedKey].name : undefined}
      variant="page"
    >
      {children}
    </PermissionsGuard>
  )
}
