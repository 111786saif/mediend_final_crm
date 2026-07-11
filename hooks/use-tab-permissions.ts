import { usePermissions } from '@/hooks/use-permissions'
import { useMemo, useEffect } from 'react'

export interface TabConfig {
  value: string
  label: string
  icon?: any
  perm: string // Permission key in database / resource tree
  badge?: number
}

export function useTabPermissions<T extends string>(
  tabs: TabConfig[],
  activeTab: T,
  setActiveTab: (value: T) => void
) {
  const { hasAccess, isLoading } = usePermissions()

  // 1. Filter allowed tabs based on database permissions
  const allowedTabs = useMemo(() => {
    if (isLoading) return []
    return tabs.filter((t) => hasAccess(t.perm))
  }, [tabs, hasAccess, isLoading])

  // 2. Synchronize active state to the first allowed tab if current is unauthorized
  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.some((t) => t.value === activeTab)) {
      setActiveTab(allowedTabs[0].value as T)
    }
  }, [allowedTabs, activeTab, setActiveTab])

  return {
    allowedTabs,
    isLoading,
    hasAccess: allowedTabs.length > 0,
  }
}
