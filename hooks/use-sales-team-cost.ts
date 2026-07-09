import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import type { SalesTeamCostResponse } from '@/lib/sales-team-cost/types'

export type { SalesTeamCostResponse }

export interface SalesTeamCostFilters {
  month: number
  year: number
}

function buildQuery(filters: SalesTeamCostFilters): string {
  const params = new URLSearchParams({
    month: String(filters.month),
    year: String(filters.year),
  })
  return `/api/finance/sales-team-cost?${params.toString()}`
}

export function useSalesTeamCost(filters: SalesTeamCostFilters) {
  return useQuery({
    queryKey: ['sales-team-cost', filters],
    queryFn: () => apiGet<SalesTeamCostResponse>(buildQuery(filters)),
  })
}
