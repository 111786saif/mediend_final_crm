import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-client'
import type { MasterSeatingCostResponse } from '@/lib/finance/master-seating-cost/types'

export type { MasterSeatingCostResponse }

export interface MasterSeatingCostFilters {
  search?: string | null
  departmentId?: string | null
}

function buildQuery(filters: MasterSeatingCostFilters): string {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.departmentId && filters.departmentId !== 'all') {
    params.set('departmentId', filters.departmentId)
  }
  const qs = params.toString()
  return qs ? `/api/finance/master-seating-cost?${qs}` : '/api/finance/master-seating-cost'
}

export function useMasterSeatingCost(filters: MasterSeatingCostFilters) {
  return useQuery({
    queryKey: ['master-seating-cost', filters],
    queryFn: () => apiGet<MasterSeatingCostResponse>(buildQuery(filters)),
    refetchOnMount: 'always',
  })
}

export function useCreateMasterSeatingCost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { employeeId: string; amount: number; note?: string | null }) =>
      apiPost('/api/finance/master-seating-cost', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['master-seating-cost'] }),
  })
}

export function useUpdateMasterSeatingCost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; amount: number; note?: string | null }) =>
      apiPatch(`/api/finance/master-seating-cost/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['master-seating-cost'] }),
  })
}

export function useDeleteMasterSeatingCost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/finance/master-seating-cost/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['master-seating-cost'] }),
  })
}
