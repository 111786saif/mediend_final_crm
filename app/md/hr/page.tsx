'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Filter } from 'lucide-react'
import { AuthenticatedLayout } from '@/components/authenticated-layout'
import { TabNavigation, type TabItem } from '@/components/employee/tab-navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useIsMobile } from '@/hooks/use-mobile'
import { MdHrFilterDrawer, type HRDashboardFilters } from '@/components/md/hr/md-hr-filter-drawer'
import { MdHrTodayTab } from '@/components/md/hr/md-hr-today-tab'
import { MdHrRecruitmentTab } from '@/components/md/hr/md-hr-recruitment-tab'
import { MdHrDepartmentsTab } from '@/components/md/hr/md-hr-departments-tab'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function MDHRDashboardPage() {
  const isMobile = useIsMobile()
  const now = new Date()
  const [activeTab, setActiveTab] = useState('today')
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState<HRDashboardFilters>({
    departments: [],
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  })

  const tabs: TabItem[] = useMemo(
    () => [
      { value: 'today', label: 'Today' },
      { value: 'recruitment', label: 'Recruitment' },
      { value: 'departments', label: 'Departments' },
    ],
    []
  )

  const validTabValues = useMemo(() => new Set(tabs.map((t) => t.value)), [tabs])

  const syncFromHash = useCallback(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash.slice(1)
    const effectiveHash = hash || 'today'
    setActiveTab(validTabValues.has(effectiveHash) ? effectiveHash : 'today')
  }, [validTabValues])

  useEffect(() => {
    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [syncFromHash])

  const handleTabChange = useCallback(
    (value: string) => {
      if (!validTabValues.has(value)) return
      if (typeof window !== 'undefined') window.location.hash = value
      setActiveTab(value)
    },
    [validTabValues]
  )

  const isDefaultFilters =
    filters.departments.length === 0 &&
    filters.month === now.getMonth() + 1 &&
    filters.year === now.getFullYear()

  return (
    <AuthenticatedLayout>
      <div className="flex flex-col min-h-0 w-full max-w-5xl mx-auto px-3 md:px-0">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between py-4 md:py-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">HR Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5 hidden sm:block">
              {MONTH_NAMES[filters.month - 1]} {filters.year} — Headcount, payroll & hiring
            </p>
          </div>
          <Button
            variant="outline"
            size={isMobile ? 'sm' : 'default'}
            className="gap-2 shrink-0"
            onClick={() => setFilterOpen(true)}
          >
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
            {!isDefaultFilters && (
              <Badge className="h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px] bg-emerald-600">
                !
              </Badge>
            )}
          </Button>
        </div>

        {/* Tabs */}
        <TabNavigation
          tabs={tabs}
          value={activeTab}
          onValueChange={handleTabChange}
          variant="md-hr"
          className="-mx-3 md:mx-0 px-3 md:px-0 mb-4"
        />

        {/* Tab Content */}
        <div className="flex-1 min-h-0 py-1 md:py-4">
          {activeTab === 'today' && <MdHrTodayTab filters={filters} />}
          {activeTab === 'recruitment' && <MdHrRecruitmentTab filters={filters} />}
          {activeTab === 'departments' && <MdHrDepartmentsTab filters={filters} />}
        </div>

        {/* Filter Drawer */}
        <MdHrFilterDrawer
          open={filterOpen}
          onOpenChange={setFilterOpen}
          filters={filters}
          onApply={setFilters}
        />
      </div>
    </AuthenticatedLayout>
  )
}
