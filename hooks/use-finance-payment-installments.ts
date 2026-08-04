import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import type {
  FinancePaymentInstallmentRecord,
  InstallmentVerificationStatus,
} from '@/lib/finance/payment-installments/types'

export interface FinancePaymentInstallmentFilters {
  status?: InstallmentVerificationStatus | 'ALL'
  search?: string | null
  recipient?: 'MEDIEND' | 'HOSPITAL' | 'DOCTOR'
}

function buildQuery(filters: FinancePaymentInstallmentFilters): string {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.search) params.set('search', filters.search)
  if (filters.recipient) params.set('recipient', filters.recipient)
  const qs = params.toString()
  return `/api/finance/payment-installments${qs ? `?${qs}` : ''}`
}

export function useFinancePaymentInstallments(filters: FinancePaymentInstallmentFilters) {
  return useQuery({
    queryKey: ['finance-payment-installments', filters],
    queryFn: () =>
      apiGet<{ installments: FinancePaymentInstallmentRecord[]; total: number }>(
        buildQuery(filters),
      ),
  })
}

export function useVerifyPaymentInstallment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiPost<FinancePaymentInstallmentRecord>(
        `/api/finance/payment-installments/${id}/verify`,
        {},
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-payment-installments'] })
      queryClient.invalidateQueries({ queryKey: ['installments'] })
      queryClient.invalidateQueries({ queryKey: ['outstanding'] })
      queryClient.invalidateQueries({ queryKey: ['hospitals'] })
    },
  })
}

export function useRejectPaymentInstallment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, rejectionRemarks }: { id: string; rejectionRemarks: string }) =>
      apiPost<FinancePaymentInstallmentRecord>(
        `/api/finance/payment-installments/${id}/reject`,
        { rejectionRemarks },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-payment-installments'] })
      queryClient.invalidateQueries({ queryKey: ['installments'] })
      queryClient.invalidateQueries({ queryKey: ['outstanding'] })
      queryClient.invalidateQueries({ queryKey: ['hospitals'] })
    },
  })
}
