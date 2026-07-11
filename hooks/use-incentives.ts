import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api-client'
import type { IncentiveEmployeeOption, IncentiveRecord } from '@/lib/incentives/types'

export type { IncentiveRecord, IncentiveEmployeeOption }

export interface IncentiveFilters {
  month?: number | null
  year?: number | null
  status?: string | null
  search?: string | null
}

export interface IncentivesResponse {
  records: IncentiveRecord[]
  employees: IncentiveEmployeeOption[]
}

function buildQuery(filters: IncentiveFilters): string {
  const params = new URLSearchParams()
  if (filters.month) params.set('month', String(filters.month))
  if (filters.year) params.set('year', String(filters.year))
  if (filters.status) params.set('status', filters.status)
  if (filters.search) params.set('search', filters.search)
  const qs = params.toString()
  return qs ? `/api/incentives?${qs}` : '/api/incentives'
}

export function useIncentives(filters: IncentiveFilters) {
  return useQuery({
    queryKey: ['incentives', filters],
    queryFn: () => apiGet<IncentivesResponse>(buildQuery(filters)),
  })
}

export interface CreateIncentiveInput {
  employeeIds?: string[]
  entries?: { employeeId: string; amount: number }[]
  month: number
  year: number
  amount?: number
  status?: 'PENDING' | 'APPROVED' | 'PAID'
  note?: string | null
}

export function useCreateIncentives() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateIncentiveInput) => apiPost('/api/incentives', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incentives'] }),
  })
}

export interface UpdateIncentiveInput {
  id: string
  amount?: number
  status?: 'PENDING' | 'APPROVED' | 'PAID'
  month?: number
  year?: number
  note?: string | null
}

export function useUpdateIncentive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateIncentiveInput) => apiPatch(`/api/incentives/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incentives'] }),
  })
}

export function useDeleteIncentive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/api/incentives/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['incentives'] }),
  })
}
