"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { apiGet } from "@/lib/api-client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CreditCard,
  FileText,
  CheckCircle,
  Building2,
  Stethoscope,
  Users,
  Globe,
  DollarSign,
  TrendingUp,
  IndianRupee,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { FilterBar } from "./filter-bar"
import { FilterDrawer, countActiveFilters, type FilterDrawerValues } from "./filter-drawer"

interface LeaderboardEntry {
  name: string
  count: number
  pendingAmount: number
}

interface BdLeaderboardEntry {
  id: string
  name: string
  count: number
  pendingAmount: number
}

interface OutstandingAnalytics {
  totalCases: number
  totalPendingAmount: number
  pendingCases: number
  fullyPaidCases: number
  paymentReceivedCases: number
  averagePendingPerCase: number
  hospitalLeaderboard: LeaderboardEntry[]
  doctorLeaderboard: LeaderboardEntry[]
  bdLeaderboard: BdLeaderboardEntry[]
  circleLeaderboard: LeaderboardEntry[]
}

interface FilterOptions {
  hospitals: string[]
  doctors: string[]
  circles: string[]
  treatments: string[]
  bds: { id: string; name: string }[]
}

const EMPTY_FILTERS: FilterDrawerValues = {
  hospitalName: null,
  surgeonName: null,
  circle: null,
  bdId: null,
  treatment: null,
}

function formatRupee(n: number): string {
  if (n >= 1_00_00_000) {
    return `₹${(n / 1_00_00_000).toFixed(2)} Cr`
  }
  if (n >= 1_00_000) {
    return `₹${(n / 1_00_000).toFixed(2)} L`
  }
  return `₹${n.toLocaleString("en-IN")}`
}

function LeaderboardCard({
  title,
  icon: Icon,
  colorClass,
  entries,
  loading,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  colorClass: string
  entries: LeaderboardEntry[]
  loading: boolean
}) {
  return (
    <Card className={cn("overflow-hidden border-0 shadow-md", colorClass)}>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/50">
          <Icon className="h-4 w-4" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No data</p>
        ) : (
          <div className="space-y-1">
            {entries.slice(0, 5).map((entry, i) => (
              <div
                key={entry.name}
                className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-background/30 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background/40 text-xs font-semibold tabular-nums">
                    {i + 1}
                  </span>
                  <span className="truncate font-medium" title={entry.name}>
                    {entry.name}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {entry.count} cases
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatRupee(entry.pendingAmount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function MDOutstandingDashboard() {
  const [filterValues, setFilterValues] = useState<FilterDrawerValues>(EMPTY_FILTERS)
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false)

  const filterParams = useMemo(() => {
    const p = new URLSearchParams()
    if (filterValues.hospitalName) p.set("hospitalName", filterValues.hospitalName)
    if (filterValues.surgeonName) p.set("doctorName", filterValues.surgeonName)
    if (filterValues.circle) p.set("circle", filterValues.circle)
    if (filterValues.bdId) p.set("bdId", filterValues.bdId)
    if (filterValues.treatment) p.set("treatment", filterValues.treatment)
    return p.toString()
  }, [filterValues])

  const { data: analytics, isLoading } = useQuery<OutstandingAnalytics>({
    queryKey: ["md", "outstanding", filterParams],
    queryFn: () =>
      apiGet<OutstandingAnalytics>(
        `/api/analytics/md/outstanding${filterParams ? `?${filterParams}` : ""}`,
      ),
  })

  const { data: filterOptions } = useQuery<FilterOptions>({
    queryKey: ["md", "outstanding", "filter-options"],
    queryFn: () => apiGet<FilterOptions>("/api/analytics/md/outstanding/filter-options"),
    staleTime: 5 * 60 * 1000,
  })

  const activeFilterCount = countActiveFilters(filterValues)

  return (
    <div className="space-y-4 pb-12 px-1">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          <CreditCard className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">MD Outstanding</h1>
          <p className="text-xs text-muted-foreground">
            Payout statuses and pending amounts across the P&L pipeline
          </p>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <Card className="overflow-hidden border-0 shadow-sm border-l-4 border-l-red-500 bg-gradient-to-br from-red-50/60 to-card dark:from-red-950/25 dark:to-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 px-3 pt-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Pending
            </CardTitle>
            <IndianRupee className="h-3.5 w-3.5 text-red-500" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold tabular-nums text-red-700 dark:text-red-400">
              {isLoading ? (
                <Skeleton className="h-6 w-24" />
              ) : (
                formatRupee(analytics?.totalPendingAmount ?? 0)
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-sm border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50/60 to-card dark:from-orange-950/25 dark:to-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 px-3 pt-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Pending Cases
            </CardTitle>
            <FileText className="h-3.5 w-3.5 text-orange-500" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold tabular-nums text-orange-700 dark:text-orange-400">
              {isLoading ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                analytics?.pendingCases ?? 0
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-sm border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50/60 to-card dark:from-emerald-950/25 dark:to-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 px-3 pt-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Fully Paid
            </CardTitle>
            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {isLoading ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                analytics?.fullyPaidCases ?? 0
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-sm border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50/60 to-card dark:from-purple-950/25 dark:to-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 px-3 pt-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Avg / Case
            </CardTitle>
            <TrendingUp className="h-3.5 w-3.5 text-purple-500" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold tabular-nums text-purple-700 dark:text-purple-400">
              {isLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                formatRupee(analytics?.averagePendingPerCase ?? 0)
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-0 shadow-sm border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50/60 to-card dark:from-blue-950/25 dark:to-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 px-3 pt-3">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Cases
            </CardTitle>
            <DollarSign className="h-3.5 w-3.5 text-blue-500" />
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="text-lg font-bold tabular-nums text-blue-700 dark:text-blue-400">
              {isLoading ? (
                <Skeleton className="h-6 w-16" />
              ) : (
                analytics?.totalCases ?? 0
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <FilterBar
        filterCount={activeFilterCount}
        onOpenFilters={() => setFilterDrawerOpen(true)}
      />

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filterValues.hospitalName && (
            <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-xs">
              Hosp: {filterValues.hospitalName}
              <button
                type="button"
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                onClick={() =>
                  setFilterValues((p) => ({ ...p, hospitalName: null }))
                }
              >
                &times;
              </button>
            </Badge>
          )}
          {filterValues.surgeonName && (
            <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-xs">
              Doc: {filterValues.surgeonName}
              <button
                type="button"
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                onClick={() =>
                  setFilterValues((p) => ({ ...p, surgeonName: null }))
                }
              >
                &times;
              </button>
            </Badge>
          )}
          {filterValues.circle && (
            <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-xs">
              Circle: {filterValues.circle}
              <button
                type="button"
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                onClick={() =>
                  setFilterValues((p) => ({ ...p, circle: null }))
                }
              >
                &times;
              </button>
            </Badge>
          )}
          {filterValues.bdId && (
            <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-xs">
              BD: {filterOptions?.bds.find((b) => b.id === filterValues.bdId)?.name ?? filterValues.bdId}
              <button
                type="button"
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                onClick={() =>
                  setFilterValues((p) => ({ ...p, bdId: null }))
                }
              >
                &times;
              </button>
            </Badge>
          )}
          {filterValues.treatment && (
            <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-xs">
              Rx: {filterValues.treatment}
              <button
                type="button"
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                onClick={() =>
                  setFilterValues((p) => ({ ...p, treatment: null }))
                }
              >
                &times;
              </button>
            </Badge>
          )}
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground transition"
            onClick={() => setFilterValues(EMPTY_FILTERS)}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Leaderboards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <LeaderboardCard
          title="Top Hospitals"
          icon={Building2}
          colorClass="border-l-4 border-l-sky-500 bg-gradient-to-br from-sky-50/60 to-card dark:from-sky-950/25 dark:to-card"
          entries={analytics?.hospitalLeaderboard ?? []}
          loading={isLoading}
        />
        <LeaderboardCard
          title="Top Doctors"
          icon={Stethoscope}
          colorClass="border-l-4 border-l-violet-500 bg-gradient-to-br from-violet-50/60 to-card dark:from-violet-950/25 dark:to-card"
          entries={analytics?.doctorLeaderboard ?? []}
          loading={isLoading}
        />
        <LeaderboardCard
          title="Top BDs"
          icon={Users}
          colorClass="border-l-4 border-l-amber-500 bg-gradient-to-br from-amber-50/60 to-card dark:from-amber-950/25 dark:to-card"
          entries={analytics?.bdLeaderboard ?? []}
          loading={isLoading}
        />
        <LeaderboardCard
          title="Circles"
          icon={Globe}
          colorClass="border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50/60 to-card dark:from-emerald-950/25 dark:to-card"
          entries={analytics?.circleLeaderboard ?? []}
          loading={isLoading}
        />
      </div>

      {/* Filter Drawer */}
      <FilterDrawer
        open={filterDrawerOpen}
        onOpenChange={setFilterDrawerOpen}
        value={filterValues}
        onChange={setFilterValues}
        options={filterOptions}
      />
    </div>
  )
}
