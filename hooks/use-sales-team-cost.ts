import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import type { SalesTeamCostResponse } from '@/lib/sales-team-cost/types'

export type { SalesTeamCostResponse }

export function useSalesTeamCost() {
  return useQuery({
    queryKey: ['sales-team-cost'],
    queryFn: () => apiGet<SalesTeamCostResponse>('/api/finance/sales-team-cost'),
  })
}

export interface AddCostEntryInput {
  employeeId: string
  entryType: 'INCENTIVE' | 'SEATING' | 'MISC'
  amount: number
  entryDate: string
  note?: string | null
}

export function useAddSalesTeamCostEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: AddCostEntryInput) =>
      apiPost('/api/finance/sales-team-cost/entries', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-team-cost'] })
    },
  })
}
