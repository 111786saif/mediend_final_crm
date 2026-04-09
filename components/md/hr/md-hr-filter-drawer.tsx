'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { RotateCcw } from 'lucide-react'

export interface HRDashboardFilters {
  departments: string[]
  month: number
  year: number
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

interface MdHrFilterDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: HRDashboardFilters
  onApply: (filters: HRDashboardFilters) => void
}

export function MdHrFilterDrawer({ open, onOpenChange, filters, onApply }: MdHrFilterDrawerProps) {
  const isMobile = useIsMobile()
  const [localFilters, setLocalFilters] = useState<HRDashboardFilters>(filters)

  const { data: departments = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['departments-filter'],
    queryFn: () => apiGet<Array<{ id: string; name: string }>>('/api/departments'),
  })

  const sortedDepartments = useMemo(
    () => [...departments].sort((a, b) => a.name.localeCompare(b.name)),
    [departments]
  )

  const now = new Date()
  const currentYear = now.getFullYear()
  const years = [currentYear - 1, currentYear]

  const allSelected = localFilters.departments.length === 0

  const toggleDepartment = (id: string) => {
    setLocalFilters((prev) => {
      const has = prev.departments.includes(id)
      return {
        ...prev,
        departments: has
          ? prev.departments.filter((d) => d !== id)
          : [...prev.departments, id],
      }
    })
  }

  const toggleAll = () => {
    setLocalFilters((prev) => ({
      ...prev,
      departments: prev.departments.length === 0 ? [] : [],
    }))
  }

  const handleApply = () => {
    onApply(localFilters)
    onOpenChange(false)
  }

  const handleReset = () => {
    const defaults: HRDashboardFilters = {
      departments: [],
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    }
    setLocalFilters(defaults)
    onApply(defaults)
    onOpenChange(false)
  }

  // Sync local state when drawer opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) setLocalFilters(filters)
    onOpenChange(isOpen)
  }

  const content = (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-6">
          {/* Month & Year */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Period</h3>
            <div className="flex gap-2 mb-3">
              {years.map((y) => (
                <Button
                  key={y}
                  variant={localFilters.year === y ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLocalFilters((prev) => ({ ...prev, year: y }))}
                >
                  {y}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {MONTHS.map((m, i) => (
                <Button
                  key={m}
                  variant={localFilters.month === i + 1 ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs"
                  onClick={() => setLocalFilters((prev) => ({ ...prev, month: i + 1 }))}
                >
                  {m}
                </Button>
              ))}
            </div>
          </div>

          {/* Departments */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Departments</h3>
            <div className="space-y-2.5">
              <label className="flex items-center gap-3 cursor-pointer py-1">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                />
                <span className="text-sm font-medium">All departments</span>
              </label>
              {sortedDepartments.map((dept) => (
                <label key={dept.id} className="flex items-center gap-3 cursor-pointer py-1">
                  <Checkbox
                    checked={allSelected || localFilters.departments.includes(dept.id)}
                    onCheckedChange={() => toggleDepartment(dept.id)}
                  />
                  <span className="text-sm">{dept.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t px-4 py-3 flex gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button variant="outline" className="flex-1 gap-1.5" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <Button className="flex-1" onClick={handleApply}>
          Apply
        </Button>
      </div>
    </div>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHeader className="text-left px-4 pb-0">
            <DrawerTitle>Filters</DrawerTitle>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-[360px] p-0 flex flex-col">
        <SheetHeader className="px-4 pt-4 pb-0">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        {content}
      </SheetContent>
    </Sheet>
  )
}
