'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { TabNavigation, type TabItem } from '@/components/employee/tab-navigation'
import { EmployeesTab } from '@/components/hr/employees-tab'
import { DepartmentsTab } from '@/components/hr/departments-tab'
import { OrgChartTab } from '@/components/hr/org-chart-tab'
import { FnFReminderCard } from '@/components/hr/fnf-reminder-card'
import { useAuth } from '@/hooks/use-auth'
import { hasPermission } from '@/lib/rbac'

const ALL_TABS: (TabItem & { permission?: string; roles?: string[] })[] = [
  { value: 'employees', label: 'Employees', permission: 'hrms:employees:read' },
  { value: 'departments', label: 'Departments', permission: 'hrms:employees:read' },
  { value: 'org-chart', label: 'Org Chart', roles: ['ADMIN', 'HR_HEAD'] },
]

export default function HRPeoplePage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')

  const tabs = useMemo(() => {
    if (!user) return []
    return ALL_TABS.filter((t) => {
      if (t.roles) return t.roles.includes(user.role)
      if (t.permission) return hasPermission(user, t.permission as any)
      return true
    }).map(({ value, label }) => ({ value, label }))
  }, [user])

  const [activeTab, setActiveTab] = useState(tabs[0]?.value ?? 'employees')

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
        You do not have permission to view any section in People & Org.
      </div>
    )
  }

  const showFnFCard = user && hasPermission(user, 'hrms:employees:read') && user.role !== 'ADMIN' && user.role !== 'MD'

  return (
    <div className="space-y-6">
      {showFnFCard && <FnFReminderCard />}
      <TabNavigation
        tabs={tabs}
        value={activeTab}
        onValueChange={setActiveTab}
        variant="hr-people"
      />
      <div className="mt-6">
        {activeTab === 'employees' && <EmployeesTab />}
        {activeTab === 'departments' && <DepartmentsTab />}
        {activeTab === 'org-chart' && <OrgChartTab />}
      </div>
    </div>
  )
}
