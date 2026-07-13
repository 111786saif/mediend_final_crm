import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import type {
  InvoiceRequestListResponse,
  InvoiceRequestRecord,
  InvoiceRequestStatus,
} from '@/lib/finance/invoice-request/types'

export interface InvoiceRequestFilters {
  status?: InvoiceRequestStatus
  search?: string | null
}

function buildQuery(filters: InvoiceRequestFilters): string {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.search) params.set('search', filters.search)
  const qs = params.toString()
  return `/api/finance/invoice-requests${qs ? `?${qs}` : ''}`
}

export function useInvoiceRequests(filters: InvoiceRequestFilters) {
  return useQuery({
    queryKey: ['finance-invoice-requests', filters],
    queryFn: () => apiGet<InvoiceRequestListResponse>(buildQuery(filters)),
  })
}

export interface PlInvoiceRequestFilters {
  status?: InvoiceRequestStatus | 'ALL'
  leadId?: string | null
  hospitalName?: string | null
  search?: string | null
  latestPerLead?: boolean
}

function buildPlQuery(filters: PlInvoiceRequestFilters): string {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.leadId) params.set('leadId', filters.leadId)
  if (filters.hospitalName) params.set('hospitalName', filters.hospitalName)
  if (filters.search) params.set('search', filters.search)
  if (filters.latestPerLead) params.set('latestPerLead', 'true')
  const qs = params.toString()
  return `/api/pl/invoice-requests${qs ? `?${qs}` : ''}`
}

export function usePlInvoiceRequests(filters: PlInvoiceRequestFilters, enabled = true) {
  return useQuery({
    queryKey: ['pl-invoice-requests', filters],
    queryFn: () => apiGet<InvoiceRequestListResponse>(buildPlQuery(filters)),
    enabled,
  })
}

export interface CreatePlInvoiceRequestInput {
  leadId: string
  requestRemarks?: string
  invoiceNumber?: string
  invoiceAmount?: number
}

export function useCreatePlInvoiceRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreatePlInvoiceRequestInput) =>
      apiPost<InvoiceRequestRecord>('/api/pl/invoice-requests', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pl-invoice-requests'] })
      queryClient.invalidateQueries({ queryKey: ['finance-invoice-requests'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-request-activity'] })
    },
  })
}

export function useInvoiceRequest(id: string | null, enabled = true) {
  return useQuery({
    queryKey: ['finance-invoice-request', id],
    queryFn: () => apiGet<InvoiceRequestRecord>(`/api/finance/invoice-requests/${id}`),
    enabled: !!id && enabled,
  })
}

export interface ApproveInvoiceRequestInput {
  id: string
  invoicePdfUrl: string
  invoicePdfName?: string
  financeRemarks?: string
}

export function useApproveInvoiceRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: ApproveInvoiceRequestInput) =>
      apiPost<InvoiceRequestRecord>(`/api/finance/invoice-requests/${id}/approve`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-invoice-requests'] })
      queryClient.invalidateQueries({ queryKey: ['finance-invoice-request'] })
      queryClient.invalidateQueries({ queryKey: ['pl-invoice-requests'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-request-activity'] })
    },
  })
}

export interface RejectInvoiceRequestInput {
  id: string
  rejectionRemarks: string
}

export function useRejectInvoiceRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: RejectInvoiceRequestInput) =>
      apiPost<InvoiceRequestRecord>(`/api/finance/invoice-requests/${id}/reject`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-invoice-requests'] })
      queryClient.invalidateQueries({ queryKey: ['finance-invoice-request'] })
      queryClient.invalidateQueries({ queryKey: ['pl-invoice-requests'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-request-activity'] })
    },
  })
}
