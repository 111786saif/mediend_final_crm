"use client"

import { useMemo, useState } from "react"
import { Star } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  useComplianceStats,
  type ComplianceCall,
  type ComplianceCallSort,
  type ComplianceCallStatus,
} from "@/hooks/use-compliance-calls"
import { RatingHero } from "./rating-hero"
import { FilterBar } from "./filter-bar"
import { RatingChips } from "./rating-chips"
import { ReviewFeed } from "./review-feed"
import { MonthlyReportSection } from "./monthly-report-section"
import { FeedbackDetailDialog } from "./feedback-detail-dialog"
import type { DateRange } from "./date-range-sheet"

export function MDComplianceDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({})
  const [rating, setRating] = useState<number | null>(null)
  const [sort, setSort] = useState<ComplianceCallSort>("recent")
  const [activeCall, setActiveCall] = useState<ComplianceCall | null>(null)

  const dateParams = useMemo(
    () => ({
      startDate: dateRange.from ? dateRange.from.toISOString() : undefined,
      endDate: dateRange.to ? dateRange.to.toISOString() : undefined,
    }),
    [dateRange],
  )

  const { data: stats } = useComplianceStats(dateParams)

  const status: ComplianceCallStatus | null = "COMPLETED"
  const feedFilters = useMemo(
    () => ({
      status,
      rating,
      startDate: dateParams.startDate ?? null,
      endDate: dateParams.endDate ?? null,
      sort,
    }),
    [status, rating, dateParams, sort],
  )

  const clearFilters = () => {
    setDateRange({})
    setRating(null)
    setSort("recent")
  }

  return (
    <div className="space-y-4 pb-12">
      <header className="flex items-center gap-3 px-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          <Star className="h-5 w-5 fill-current" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Patient Feedback</h1>
          <p className="text-xs text-muted-foreground">
            Post-discharge reviews from the compliance team
          </p>
        </div>
      </header>

      <Tabs defaultValue="reviews" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-flex">
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
          <TabsTrigger value="report">Monthly report</TabsTrigger>
        </TabsList>

        <TabsContent value="reviews" className="space-y-4">
          <RatingHero
            stats={stats}
            activeRating={rating}
            onRatingClick={(r) => setRating(rating === r ? null : r)}
          />

          <FilterBar
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
            sort={sort}
            onSortChange={setSort}
          />

          <RatingChips stats={stats} activeRating={rating} onChange={setRating} />

          <ReviewFeed
            filters={feedFilters}
            onClear={clearFilters}
            onOpen={(c) => setActiveCall(c)}
          />
        </TabsContent>

        <TabsContent value="report">
          <MonthlyReportSection />
        </TabsContent>
      </Tabs>

      <FeedbackDetailDialog
        callId={activeCall?.id ?? null}
        open={!!activeCall}
        onOpenChange={(o) => !o && setActiveCall(null)}
      />
    </div>
  )
}
