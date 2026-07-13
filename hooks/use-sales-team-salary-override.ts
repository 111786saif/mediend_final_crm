'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import type { SalaryOverrideHistoryEntry } from '@/lib/sales-team-cost/types'

export interface SalaryOverrideDetail {
  employeeId: string
  employeeName: string
  payrollSalary: number
  overrideAmount: number | null
  displaySalary: number
  salaryIsOverride: boolean
  history: SalaryOverrideHistoryEntry[]
}

export interface SaveSalaryOverrideInput {
  employeeId: string
  month: number
  year: number
  amount: number
  reason: string
}

export function useSalaryOverrideHistory(
  employeeId: string | null,
  month: number,
  year: number,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['sales-team-salary-override', employeeId, month, year],
    queryFn: () => {
      const params = new URLSearchParams({
        employeeId: employeeId!,
        month: String(month),
        year: String(year),
      })
      return apiGet<SalaryOverrideDetail>(
        `/api/finance/sales-team-cost/salary-override?${params.toString()}`,
      )
    },
    enabled: enabled && !!employeeId,
  })
}

export function useSaveSalaryOverride() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveSalaryOverrideInput) =>
      apiPost('/api/finance/sales-team-cost/salary-override', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-team-cost'] })
      queryClient.invalidateQueries({ queryKey: ['sales-team-salary-override'] })
    },
  })
}
