"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Plus } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"
import { useTabPermissions } from "@/hooks/use-tab-permissions"
import { PermissionsGuard } from "@/components/permissions-guard"
import { TabNavigation, type TabItem } from "@/components/employee/tab-navigation"
import { TaskInput } from "@/components/tasks/task-input"
import { MobileTaskDrawer } from "@/components/tasks/mobile-task-drawer"
import { OverviewTab } from "@/components/tasks/overview-tab"

import { TeamTab } from "@/components/tasks/team-tab"
import { MyTasksTab } from "@/components/tasks/my-tasks-tab"
import { PerformanceTab } from "@/components/tasks/performance-tab"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import { apiGet } from "@/lib/api-client"
import { useBadgeCounts } from "@/hooks/use-badge-counts"

export default function MDTasksPage() {
  const { user } = useAuth()
  const [isManager, setIsManager] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState("overview")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isMobile = useIsMobile()

  const { data: badgeCounts } = useBadgeCounts()

  useEffect(() => {
    let cancelled = false
    async function checkManager() {
      try {
        await apiGet("/api/md/team-overview")
        if (!cancelled) setIsManager(true)
      } catch {
        if (!cancelled) setIsManager(false)
      }
    }
    checkManager()
    return () => {
      cancelled = true
    }
  }, [])

  const tabs = useMemo(
    () => [
      {
        value: "overview",
        label: "Overview",
        badge: badgeCounts?.taskOverviewCount || undefined,
        perm: "main.tasks.overview",
      },
      ...(isManager !== false ? [{ value: "team", label: "Team" as const, perm: "main.tasks.overview" }] : []),
      { value: "mytasks", label: "My Tasks", perm: "main.tasks.my_tasks" },
      ...(user?.role === "MD" ? [{ value: "performance", label: "Performance" as const, perm: "main.tasks.my_tasks" }] : []),
    ],
    [isManager, user?.role, badgeCounts]
  )

  const { allowedTabs, isLoading: isPermsLoading } = useTabPermissions(tabs, activeTab, setActiveTab)

  const validTabValues = useMemo(() => new Set(allowedTabs.map((t) => t.value)), [allowedTabs])

  const syncFromHash = useCallback(() => {
    if (typeof window === "undefined") return
    const hash = window.location.hash.slice(1)
    const defaultTab = allowedTabs.length > 0 ? allowedTabs[0].value : "overview"
    const effectiveHash = hash || defaultTab
    if (effectiveHash === "all" || effectiveHash === "approval") {
      setActiveTab(defaultTab)
      if (typeof window !== "undefined") window.location.hash = defaultTab
      return
    }
    if (effectiveHash === "team" && isManager === false) {
      setActiveTab(defaultTab)
      return
    }
    if (effectiveHash === "performance" && user?.role !== "MD") {
      setActiveTab(defaultTab)
      return
    }
    setActiveTab(validTabValues.has(effectiveHash) ? effectiveHash : defaultTab)
  }, [isManager, user?.role, validTabValues, allowedTabs])

  useEffect(() => {
    syncFromHash()
    window.addEventListener("hashchange", syncFromHash)
    return () => window.removeEventListener("hashchange", syncFromHash)
  }, [syncFromHash])

  const handleTabChange = useCallback(
    (value: string) => {
      if (!validTabValues.has(value)) return
      if (value === "team" && !isManager) {
        value = allowedTabs.length > 0 ? allowedTabs[0].value : "overview"
      }
      if (typeof window !== "undefined") {
        window.location.hash = value
      }
      setActiveTab(value)
    },
    [isManager, validTabValues, allowedTabs]
  )

  return (
    <PermissionsGuard
      isLoading={isPermsLoading}
      hasAccess={allowedTabs.length > 0}
      resourceName="MD Tasks"
      variant="page"
    >
      <div className="flex flex-col min-h-0 w-full max-w-5xl mx-auto px-2 md:px-0">
      <div className="shrink-0 space-y-3 md:space-y-4 pb-3 md:pb-4">
        {!isMobile && (
          <TaskInput
            onSuccess={() => {}}
            className="w-full"
            isMD={user?.role === "MD"}
          />
        )}
      </div>

      <TabNavigation
        tabs={allowedTabs}
        value={activeTab}
        onValueChange={handleTabChange}
        variant="tasks"
        className="-mx-2 md:mx-0 px-2 md:px-0 mb-4"
      />

      <div className="flex-1 min-h-0 py-0 md:py-4">
        {activeTab === "team" && isManager && <TeamTab />}
        {activeTab === "mytasks" && <MyTasksTab />}
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "performance" && <PerformanceTab />}
      </div>

      {isMobile && (
        <>
          <Button
            size="icon"
            className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full shadow-lg"
            onClick={() => setDrawerOpen(true)}
            aria-label="New task"
          >
            <Plus className="h-12 w-12 font-bold" />
          </Button>
          <MobileTaskDrawer
            open={drawerOpen}
            onOpenChange={setDrawerOpen}
            onSuccess={() => {}}
            isMD={user?.role === "MD"}
          />
        </>
      )}
    </div>
    </PermissionsGuard>
  )
}
