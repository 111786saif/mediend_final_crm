'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { TabNavigation, type TabItem } from '@/components/employee/tab-navigation'
import { AttendanceTab } from '@/components/hr/attendance-tab'
import { NormalizationsTab } from '@/components/hr/normalizations-tab'
import { LeaveTypesTab } from '@/components/hr/leave-types-tab'
import { LeaveBalancesTab } from '@/components/hr/leave-balances-tab'
import { HolidaysManagementTab } from '@/components/hr/holidays-management-tab'
import { useAuth } from '@/hooks/use-auth'
import { hasPermission } from '@/lib/rbac'
import type { BadgeCounts } from '@/app/api/badge-counts/route'

const ALL_TABS: (TabItem & { permission?: string })[] = [
  { value: 'attendance', label: 'Attendance', permission: 'hrms:attendance:read' },
  { value: 'holidays', label: 'Holidays', permission: 'hrms:attendance:read' },
  { value: 'normalizations', label: 'Normalizations', permission: 'hrms:attendance:write' },
  { value: 'leave-types', label: 'Leave Types', permission: 'hrms:leaves:read' },
  { value: 'leave-balances', label: 'Leave Balances', permission: 'hrms:leaves:write' },
]

export default function HRAttendanceLeavesPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')

  const { data: badges } = useQuery<BadgeCounts>({
    queryKey: ['badge-counts'],
    queryFn: () => apiGet<BadgeCounts>('/api/badge-counts'),
    refetchInterval: 60_000,
  })

  const tabs = useMemo(() => {
    if (!user) return []
    return ALL_TABS.filter((t) => !t.permission || hasPermission(user, t.permission as any)).map(({ value, label }) => {
      let badge: number | undefined
      if (value === 'normalizations') badge = badges?.hrPendingNormalizations
      return { value, label, badge }
    })
  }, [user, badges])

  const [activeTab, setActiveTab] = useState(tabs[0]?.value ?? 'attendance')

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.value === activeTab)) {
      setActiveTab(tabs[0].value)
    }
  }, [tabs, activeTab])

  useEffect(() => {
    if (tabParam && tabs.some((t) => t.value === tabParam)) {
      setActiveTab(tabParam)
    }
  }, [tabParam, tabs])

  if (tabs.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        You do not have permission to view any section in Attendance & Leaves.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <TabNavigation
        tabs={tabs}
        value={activeTab}
        onValueChange={setActiveTab}
        variant="hr-core"
      />
      <div className="mt-6">
        {activeTab === 'attendance' && <AttendanceTab />}
        {activeTab === 'holidays' && <HolidaysManagementTab />}
        {activeTab === 'normalizations' && <NormalizationsTab />}
        {activeTab === 'leave-types' && <LeaveTypesTab />}
        {activeTab === 'leave-balances' && <LeaveBalancesTab />}
      </div>
    </div>
  )
}
