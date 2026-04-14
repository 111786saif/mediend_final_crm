"use client"

import { useState, useMemo } from "react"
import { usePerformanceData, type PerformanceData } from "@/hooks/use-tasks"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Star, Trophy, Medal, ChevronRight } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { formatRating } from "@/lib/format-rating"

function monthToLabel(month: number): string {
  const y = Math.floor(month / 100)
  const m = month % 100
  return format(new Date(y, m - 1, 1), "MMM yyyy")
}

function getRecentMonths(count: number): number[] {
  const now = new Date()
  const months: number[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(d.getFullYear() * 100 + (d.getMonth() + 1))
  }
  return months
}

export function PerformanceTab() {
  const now = new Date()
  const currentMonth = now.getFullYear() * 100 + (now.getMonth() + 1)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [detailEmployee, setDetailEmployee] = useState<
    PerformanceData["employees"][0] | null
  >(null)

  const { data, isLoading, isError, error } = usePerformanceData(selectedMonth)
  const recentMonths = useMemo(() => getRecentMonths(12), [])

  if (isError) {
    return (
      <div className="py-8 text-center text-sm text-destructive">
        Failed to load performance. {error instanceof Error ? error.message : "Please try again."}
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Month Picker */}
      <section>
        <p className="text-sm font-medium text-muted-foreground mb-2">Select month</p>
        <Select
          value={String(selectedMonth)}
          onValueChange={(v) => setSelectedMonth(Number(v))}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select month" />
          </SelectTrigger>
          <SelectContent>
            {recentMonths.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {monthToLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading performance data...
        </div>
      ) : !data ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          No data available
        </div>
      ) : (
        <>
          {/* Employee Leaderboard */}
          <section>
            <h2 className="text-base font-semibold mb-3">Leaderboard</h2>
            {data.employees.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No ratings this month
              </p>
            ) : (
              <div className="space-y-2">
                {data.employees.map((emp, idx) => {
                  const rank = idx + 1
                  return (
                    <button
                      key={emp.employeeId}
                      type="button"
                      onClick={() => setDetailEmployee(emp)}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted/50",
                        rank === 1 && "border-l-4 border-l-amber-500",
                        rank === 2 && "border-l-4 border-l-slate-400",
                        rank === 3 && "border-l-4 border-l-amber-700"
                      )}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
                        {rank <= 3 ? (
                          rank === 1 ? (
                            <Trophy className="h-6 w-6 text-amber-500" />
                          ) : rank === 2 ? (
                            <Medal className="h-6 w-6 text-slate-400" />
                          ) : (
                            <Medal className="h-6 w-6 text-amber-700" />
                          )
                        ) : (
                          rank
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{emp.employeeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {emp.completedCount} approved · {emp.rejectedCount} rejected
                        </p>
                      </div>
                      {emp.avgRating != null ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
                          <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                            {formatRating(emp.avgRating)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* Employee Detail Drawer */}
      <Sheet open={!!detailEmployee} onOpenChange={(open) => !open && setDetailEmployee(null)}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl flex flex-col max-h-[90dvh] p-4 sm:p-6 overflow-hidden"
        >
          {detailEmployee && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle>{detailEmployee.employeeName}</SheetTitle>
                <p className="text-sm text-muted-foreground">
                  {monthToLabel(selectedMonth)} · {detailEmployee.totalRatings} ratings
                </p>
              </SheetHeader>
              <div className="flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden">
                <div className="space-y-6 py-4">
                  {/* Rating distribution */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Rating distribution</h3>
                    <div className="grid grid-cols-5 gap-1.5 w-full">
                      {([1, 2, 3, 4, 5] as const).map((g) => {
                        const count = detailEmployee.ratingDistribution[g]
                        const max = Math.max(
                          ...Object.values(detailEmployee.ratingDistribution)
                        )
                        const pct = max > 0 ? (count / max) * 100 : 0
                        return (
                          <div key={g} className="min-w-0 flex flex-col items-center gap-1">
                            <div className="w-full h-20 bg-muted rounded-md overflow-hidden flex flex-col justify-end">
                              <div
                                className="bg-amber-500 rounded-t transition-all"
                                style={{ height: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium">{g}★</span>
                            <span className="text-xs text-muted-foreground">{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Individual ratings */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Rated tasks</h3>
                    <div className="space-y-2">
                      {detailEmployee.ratings.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No ratings</p>
                      ) : (
                        detailEmployee.ratings.map((r, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-border p-3 flex items-start gap-3"
                          >
                            <span
                              className={cn(
                                "shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                                r.action === "APPROVED"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400"
                              )}
                            >
                              {r.grade}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{r.taskTitle}</p>
                              <p className="text-xs text-muted-foreground">
                                {r.action} · {format(new Date(r.createdAt), "MMM d, HH:mm")}
                              </p>
                              {r.comments && (
                                <p className="text-sm text-muted-foreground mt-1 italic">
                                  {r.comments}
                                </p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
