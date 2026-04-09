"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Plus } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/hooks/use-auth"
import { TabNavigation, type TabItem } from "@/components/employee/tab-navigation"
import { TaskInput } from "@/components/tasks/task-input"
import { MobileTaskDrawer } from "@/components/tasks/mobile-task-drawer"
import { ApprovalTab } from "@/components/tasks/approval-tab"
import { OverviewTab } from "@/components/tasks/overview-tab"

import { TeamTab } from "@/components/tasks/team-tab"
import { MyTasksTab } from "@/components/tasks/my-tasks-tab"
import { TodayTab } from "@/components/tasks/today-tab"
import { PerformanceTab } from "@/components/tasks/performance-tab"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import { apiGet } from "@/lib/api-client"
import type { BadgeCounts } from "@/app/api/badge-counts/route"

export default function MDTasksPage() {
  const { user } = useAuth()
  const [isManager, setIsManager] = useState<boolean | null>(null)
  const [activeTab, setActiveTab] = useState("overview")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const isMobile = useIsMobile()

  const { data: badges } = useQuery<BadgeCounts>({
    queryKey: ["badge-counts"],
    queryFn: () => apiGet<BadgeCounts>("/api/badge-counts"),
    refetchInterval: 60_000,
  })

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

  useEffect(() => {
    if (isManager === false && activeTab === "team") {
      setActiveTab("overview")
      if (typeof window !== "undefined") window.location.hash = "overview"
    }
  }, [isManager, activeTab])

  useEffect(() => {
    if (user?.role !== "MD" && activeTab === "performance") {
      setActiveTab("overview")
      if (typeof window !== "undefined") window.location.hash = "overview"
    }
  }, [user?.role, activeTab])

  const tabs: TabItem[] = useMemo(
    () => [
      {
        value: "overview",
        label: "Overview",
        badge: badges?.taskOverdueCount,
      },
      ...(isManager !== false ? [{ value: "team", label: "Team" as const }] : []),
      { value: "mytasks", label: "My Tasks" },
      {
        value: "approval",
        label: "Approval",
        badge: badges?.taskApprovalCount,
      },
      { value: "all", label: "All tasks" },
      ...(user?.role === "MD" ? [{ value: "performance", label: "Performance" as const }] : []),
    ],
    [isManager, user?.role, badges]
  )

  const validTabValues = useMemo(() => new Set(tabs.map((t) => t.value)), [tabs])

  const syncFromHash = useCallback(() => {
    if (typeof window === "undefined") return
    const hash = window.location.hash.slice(1)
    const defaultTab = "overview"
    const effectiveHash = hash || defaultTab
    if (effectiveHash === "team" && isManager === false) {
      setActiveTab("all")
      return
    }
    if (effectiveHash === "performance" && user?.role !== "MD") {
      setActiveTab("overview")
      return
    }
    setActiveTab(validTabValues.has(effectiveHash) ? effectiveHash : defaultTab)
  }, [isManager, user?.role, validTabValues])

  useEffect(() => {
    syncFromHash()
    window.addEventListener("hashchange", syncFromHash)
    return () => window.removeEventListener("hashchange", syncFromHash)
  }, [syncFromHash])

  const handleTabChange = useCallback(
    (value: string) => {
      if (!validTabValues.has(value)) return
      if (value === "team" && !isManager) {
        value = "overview"
      }
      if (typeof window !== "undefined") {
        window.location.hash = value
      }
      setActiveTab(value)
    },
    [isManager, validTabValues]
  )

  return (
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
        tabs={tabs}
        value={activeTab}
        onValueChange={handleTabChange}
        variant="tasks"
        className="-mx-2 md:mx-0 px-2 md:px-0 mb-4"
      />

      <div className="flex-1 min-h-0 py-0 md:py-4">
        {activeTab === "team" && isManager && <TeamTab />}
        {activeTab === "mytasks" && <MyTasksTab />}
        {activeTab === "all" && <TodayTab />}
        {activeTab === "approval" && <ApprovalTab />}
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
  )
}
