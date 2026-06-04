'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiPatch } from '@/lib/api-client'
import { getCachedLeads, cacheLeads } from '@/lib/indexeddb'
import { useState, useEffect } from 'react'

export interface LeadFilters {
  pipelineStage?: string
  status?: string
  bdId?: string
  teamId?: string
  circle?: string
  city?: string
  hospitalName?: string
  treatment?: string
  source?: string
  startDate?: string
  endDate?: string
  view?: string
  /** Last 10 digits — server-only filter; omit from list responses */
  phoneSearch?: string
}

import { CaseStage } from '@/generated/prisma/enums'

export interface Lead {
  id: string
    patientName?: string
    age?: number
    sex?: string | null
  phoneNumber?: string
  city?: string
  circle?: string | null
  hospitalName?: string
  treatment?: string
  remarks?: string
  status?: string
  pipelineStage?: string
  caseStage?: CaseStage
  leadRef?: string
  insuranceName?: string
  tpa?: string
  sumInsured?: number
  netProfit?: number
  surgeryDate?: string | Date | null
  source?: string
  bdId?: string
  createdDate?: string | Date
  updatedDate?: string | Date
  leadEntryDate?: string | Date | null
  assignedDate?: string | Date | null
  campaignName?: string | null
  bd?: {
    id: string
    name: string
    email: string
  }
  kypSubmission?: {
    id: string
    status?: string
    updatedAt?: string | Date
    preAuthData?: {
      updatedAt?: string | Date
      queries?: { updatedAt?: string | Date }[]
    } | null
  } | null
  insuranceInitiateForm?: { updatedAt?: string | Date } | null
  admissionRecord?: {
    ipdStatusUpdatedAt?: string | Date | null
    initiatedAt?: string | Date
  } | null
  dischargeSheet?: { updatedAt?: string | Date } | null
  caseStageHistory?: { changedAt?: string | Date }[]
  caseChatMessages?: { createdAt?: string | Date }[]
  insuranceCase?: {
    caseStatus: string
    approvalAmount?: number
    tpaRemarks?: string
    submittedAt?: string
    approvedAt?: string | null
  }
  plRecord?: {
    finalProfit?: number
    mediendNetProfit?: number
    hospitalPayoutStatus?: string
    doctorPayoutStatus?: string
    mediendInvoiceStatus?: string
    hospitalAmountPending?: number
    doctorAmountPending?: number
    billAmount?: number
    totalAmount?: number
    month?: string | Date | null
    surgeryDate?: string | Date | null
    managerName?: string
    bdmName?: string
    closedAt?: string | null
    updatedAt?: string | Date
  }
  [key: string]: unknown
}

export function useLeads(filters: LeadFilters = {}) {
  const queryClient = useQueryClient()
  const [cachedData, setCachedData] = useState<Lead[] | null>(null)

  const cacheKey = `leads_${JSON.stringify(filters)}`

  useEffect(() => {
    getCachedLeads<Lead[]>(cacheKey).then((data) => {
      if (data) {
        setCachedData(data)
      }
    })
  }, [cacheKey])

  const query = useQuery({
    queryKey: ['leads', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      const data = await apiGet<Lead[]>(`/api/leads?${params.toString()}`)
      await cacheLeads(cacheKey, data)
      return data
    },
    enabled: true,
    placeholderData: cachedData || undefined,
  })

  const createLeadMutation = useMutation({
    mutationFn: async (leadData: Partial<Lead>) => {
      return apiPost<Lead>('/api/leads', leadData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })

  const updateLeadMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Lead> }) => {
      return apiPatch<Lead>(`/api/leads/${id}`, data)
    },
    onMutate: async ({ id, data }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['leads'] })
      const previousLeads = queryClient.getQueryData(['leads', filters])
      
      queryClient.setQueryData(['leads', filters], (old: Lead[] | undefined) => {
        if (!old) return old
        return old.map((lead) => (lead.id === id ? { ...lead, ...data } : lead))
      })

      return { previousLeads }
    },
    onError: (err, variables, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(['leads', filters], context.previousLeads)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })

  return {
    leads: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    createLead: createLeadMutation.mutate,
    updateLead: updateLeadMutation.mutate,
    isCreating: createLeadMutation.isPending,
    isUpdating: updateLeadMutation.isPending,
  }
}

export function useLead(id: string | null) {
  const queryClient = useQueryClient()

  const query = useQuery<Lead>({
    queryKey: ['lead', id],
    queryFn: () => apiGet<Lead>(`/api/leads/${id}`),
    enabled: !!id && !!id.length,
  })

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Lead>) => {
      return apiPatch(`/api/leads/${id}`, data)
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['lead', id] })
      const previousLead = queryClient.getQueryData(['lead', id])
      
      queryClient.setQueryData(['lead', id], (old: Lead | undefined) => {
        if (!old) return old
        return { ...old, ...data }
      })

      return { previousLead }
    },
    onError: (err, variables, context) => {
      if (context?.previousLead) {
        queryClient.setQueryData(['lead', id], context.previousLead)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', id] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })

  return {
    lead: query.data,
    isLoading: query.isLoading,
    error: query.error,
    updateLead: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  }
}

