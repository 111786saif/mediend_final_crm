'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import type { EmployeeOption } from '@/components/incentives/employee-multi-select'
import type {
  BulkCostActivityDto,
  BulkCostEntryDto,
} from '@/lib/sales-team-cost/bulk-cost-entries'

export type BulkCostType = 'MISC' | 'OTHER'

export interface BulkCostEntryInput {
  id?: string
  amount: number
  remark: string
  employeeId?: string | null
}

export interface BulkCostSaveInput {
  costType: BulkCostType
  month: number
  year: number
  entries: BulkCostEntryInput[]
  deletedIds?: string[]
}

export function useBulkCostEmployees(enabled: boolean) {
  return useQuery({
    queryKey: ['sales-team-cost-bulk-employees'],
    queryFn: () => apiGet<{ employees: EmployeeOption[] }>('/api/finance/sales-team-cost/bulk-costs'),
    enabled,
    staleTime: 60_000,
  })
}

export function useBulkCostEntries(
  open: boolean,
  costType: BulkCostType,
  month: number,
  year: number,
) {
  return useQuery({
    queryKey: ['sales-team-cost-bulk-entries', costType, month, year],
    queryFn: () =>
      apiGet<{ entries: BulkCostEntryDto[] }>(
        `/api/finance/sales-team-cost/bulk-costs?costType=${costType}&month=${month}&year=${year}`,
      ),
    enabled: open && month >= 1 && year >= 2000,
  })
}

export function useBulkCostActivity(
  open: boolean,
  costType: BulkCostType,
  month?: number,
  year?: number,
) {
  const qs = new URLSearchParams({ costType })
  if (month != null) qs.set('month', String(month))
  if (year != null) qs.set('year', String(year))

  return useQuery({
    queryKey: ['sales-team-cost-bulk-activity', costType, month ?? 'all', year ?? 'all'],
    queryFn: () =>
      apiGet<{ activity: BulkCostActivityDto[] }>(
        `/api/finance/sales-team-cost/bulk-costs/activity?${qs.toString()}`,
      ),
    enabled: open,
  })
}

export function useSaveBulkCosts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: BulkCostSaveInput) =>
      apiPost('/api/finance/sales-team-cost/bulk-costs', input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sales-team-cost'] })
      queryClient.invalidateQueries({ queryKey: ['seating-misc-cost'] })
      queryClient.invalidateQueries({
        queryKey: ['sales-team-cost-bulk-entries', variables.costType],
      })
      queryClient.invalidateQueries({
        queryKey: ['sales-team-cost-bulk-activity', variables.costType],
      })
    },
  })
}
