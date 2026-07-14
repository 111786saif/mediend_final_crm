import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-client'
import type {
  SeatingMiscCostHistoryEntry,
  SeatingMiscCostResponse,
} from '@/lib/finance/seating-misc-cost/types'

export type { SeatingMiscCostResponse }

export interface SeatingMiscCostFilters {
  month: number
  year: number
  search?: string | null
  departmentId?: string | null
}

function buildQuery(filters: SeatingMiscCostFilters): string {
  const params = new URLSearchParams({
    month: String(filters.month),
    year: String(filters.year),
  })
  if (filters.search) params.set('search', filters.search)
  if (filters.departmentId && filters.departmentId !== 'all') {
    params.set('departmentId', filters.departmentId)
  }
  return `/api/finance/seating-misc-cost?${params.toString()}`
}

export function useSeatingMiscCost(filters: SeatingMiscCostFilters) {
  return useQuery({
    queryKey: ['seating-misc-cost', filters],
    queryFn: () => apiGet<SeatingMiscCostResponse>(buildQuery(filters)),
  })
}

export interface CreateSeatingMiscCostInput {
  employeeIds: string[]
  month: number
  year: number
  miscCost: number
  status?: 'PENDING' | 'APPROVED' | 'PAID'
  remarks?: string | null
}

export function useCreateSeatingMiscCost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateSeatingMiscCostInput) =>
      apiPost('/api/finance/seating-misc-cost', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seating-misc-cost'] }),
  })
}

export interface UpdateSeatingMiscCostInput {
  id: string
  miscCost?: number
  status?: 'PENDING' | 'APPROVED' | 'PAID'
  remarks?: string | null
  refreshSeatingFromMaster?: boolean
}

export function useUpdateSeatingMiscCost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateSeatingMiscCostInput) =>
      apiPatch(`/api/finance/seating-misc-cost/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seating-misc-cost'] }),
  })
}

export function useDeleteSeatingMiscCost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/finance/seating-misc-cost/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seating-misc-cost'] }),
  })
}

export function useSeatingMiscCostHistory(recordId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['seating-misc-cost-history', recordId],
    queryFn: () =>
      apiGet<{ history: SeatingMiscCostHistoryEntry[] }>(
        `/api/finance/seating-misc-cost/${recordId}/history`,
      ),
    enabled: enabled && !!recordId,
  })
}
