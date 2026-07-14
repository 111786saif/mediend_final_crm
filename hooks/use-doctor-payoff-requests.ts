import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import type {
  DoctorPayoffAttachment,
  DoctorPayoffListResponse,
  DoctorPayoffRequestRecord,
  DoctorPayoffRequestStatus,
  RequestActivityItem,
} from '@/lib/finance/doctor-payoff/types'

export interface DoctorPayoffFilters {
  status?: DoctorPayoffRequestStatus | 'ALL'
  search?: string | null
  doctorName?: string | null
  latestPerLead?: boolean
}

function buildQuery(filters: DoctorPayoffFilters): string {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.search) params.set('search', filters.search)
  if (filters.doctorName) params.set('doctorName', filters.doctorName)
  if (filters.latestPerLead) params.set('latestPerLead', 'true')
  const qs = params.toString()
  return `/api/finance/doctor-payoff-requests${qs ? `?${qs}` : ''}`
}

export function useDoctorPayoffRequests(filters: DoctorPayoffFilters, enabled = true) {
  return useQuery({
    queryKey: ['doctor-payoff-requests', filters],
    queryFn: () => apiGet<DoctorPayoffListResponse>(buildQuery(filters)),
    enabled,
  })
}

export interface CreateDoctorPayoffInput {
  doctorName: string
  hospitalName?: string | null
  leadId?: string | null
  leadIds?: string[]
  requestAmount: number
  requestRemarks?: string | null
  attachments?: DoctorPayoffAttachment[]
}

export function useCreateDoctorPayoffRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDoctorPayoffInput) =>
      apiPost<DoctorPayoffRequestRecord>('/api/finance/doctor-payoff-requests', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-payoff-requests'] })
      queryClient.invalidateQueries({ queryKey: ['doctor-payoff-activity'] })
    },
  })
}

export function useApproveDoctorPayoffRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      verificationDocUrl,
      verificationDocName,
      financeRemarks,
    }: {
      id: string
      verificationDocUrl: string
      verificationDocName?: string
      financeRemarks?: string
    }) =>
      apiPost<DoctorPayoffRequestRecord>(`/api/finance/doctor-payoff-requests/${id}/approve`, {
        verificationDocUrl,
        verificationDocName,
        financeRemarks,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-payoff-requests'] })
      queryClient.invalidateQueries({ queryKey: ['doctor-payoff-activity'] })
    },
  })
}

export function useRejectDoctorPayoffRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, rejectionRemarks }: { id: string; rejectionRemarks: string }) =>
      apiPost<DoctorPayoffRequestRecord>(`/api/finance/doctor-payoff-requests/${id}/reject`, {
        rejectionRemarks,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-payoff-requests'] })
      queryClient.invalidateQueries({ queryKey: ['doctor-payoff-activity'] })
    },
  })
}

export function useDoctorPayoffActivity(params: {
  doctorName?: string | null
  requestId?: string | null
  limit?: number
  enabled?: boolean
}) {
  const qs = new URLSearchParams()
  if (params.doctorName) qs.set('doctorName', params.doctorName)
  if (params.requestId) qs.set('requestId', params.requestId)
  if (params.limit) qs.set('limit', String(params.limit))
  return useQuery({
    queryKey: ['doctor-payoff-activity', params],
    queryFn: () =>
      apiGet<{ items: RequestActivityItem[] }>(
        `/api/finance/doctor-payoff-requests/activity?${qs.toString()}`
      ),
    enabled: params.enabled !== false,
  })
}

export function useInvoiceRequestActivity(params: {
  hospitalName?: string | null
  requestId?: string | null
  limit?: number
  enabled?: boolean
}) {
  const qs = new URLSearchParams()
  if (params.hospitalName) qs.set('hospitalName', params.hospitalName)
  if (params.requestId) qs.set('requestId', params.requestId)
  if (params.limit) qs.set('limit', String(params.limit))
  return useQuery({
    queryKey: ['invoice-request-activity', params],
    queryFn: () =>
      apiGet<{ items: RequestActivityItem[] }>(
        `/api/finance/invoice-requests/activity?${qs.toString()}`
      ),
    enabled: params.enabled !== false,
  })
}
