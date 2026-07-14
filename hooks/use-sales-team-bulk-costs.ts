'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import type { EmployeeOption } from '@/components/incentives/employee-multi-select'

export type BulkCostType = 'MISC' | 'OTHER'

export interface BulkCostEntryInput {
  employeeId: string
  amount: number
}

export interface BulkCostSaveInput {
  costType: BulkCostType
  month: number
  year: number
  entries: BulkCostEntryInput[]
}

export function useBulkCostEmployees(enabled: boolean) {
  return useQuery({
    queryKey: ['sales-team-cost-bulk-employees'],
    queryFn: () => apiGet<{ employees: EmployeeOption[] }>('/api/finance/sales-team-cost/bulk-costs'),
    enabled,
    staleTime: 60_000,
  })
}

export function useSaveBulkCosts() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: BulkCostSaveInput) =>
      apiPost('/api/finance/sales-team-cost/bulk-costs', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-team-cost'] })
      queryClient.invalidateQueries({ queryKey: ['seating-misc-cost'] })
    },
  })
}
