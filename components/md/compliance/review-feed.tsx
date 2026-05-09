"use client"

import { useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useComplianceCalls,
  type ComplianceCall,
  type ComplianceCallsFilters,
} from "@/hooks/use-compliance-calls"
import { ReviewCard } from "./review-card"

interface Props {
  filters: ComplianceCallsFilters
  onClear: () => void
  onOpen?: (call: ComplianceCall) => void
}

export function ReviewFeed({ filters, onClear, onOpen }: Props) {
  const query = useComplianceCalls(filters)
  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = query

  const sentinel = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { rootMargin: "400px 0px" },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <p className="text-sm text-destructive">Failed to load reviews.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  const calls = data?.pages.flatMap((p) => p.calls) ?? []

  if (calls.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">No reviews match your filters.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onClear}>
          Clear filters
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {calls.map((c) => (
        <ReviewCard key={c.id} call={c} onOpen={onOpen} />
      ))}
      <div ref={sentinel} />
      {isFetchingNextPage && <Skeleton className="h-28 w-full rounded-xl" />}
      {!hasNextPage && calls.length > 5 && (
        <p className="py-4 text-center text-xs text-muted-foreground">
          You&apos;ve reached the end · {calls.length} review{calls.length === 1 ? "" : "s"}
        </p>
      )}
    </div>
  )
}
