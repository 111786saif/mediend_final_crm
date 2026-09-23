'use client'

import { apiGet, apiPatch, apiPost } from '@/lib/api-client'
import { cacheLeads, getCachedLeads } from '@/lib/indexeddb'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'

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
  dateField?: string
  modeOfPayment?: string
  caseStage?: string
  view?: string
  phoneSearch?: string
}

import { CaseStage } from '@/generated/prisma/enums'

export interface Lead {
  id: number
  legacyId?: string | null
  patientName?: string
  age?: number
  sex?: string | null
  phoneNumber?: string
  alternateNumber?: string | null
  city?: string
  circle?: string | null
  hospitalName?: string
  treatment?: string
  diseaseDetails?: string | null
  remarks?: string
  status?: string
  pipelineStage?: string
  caseStage?: CaseStage
  leadRef?: string
  openedInCrmAt?: string | Date | null
  insuranceName?: string
  modeOfPayment?: string | null
  tpa?: string
  sumInsured?: number
  flowType?: 'INSURANCE' | 'CASH'
  netProfit?: number
  surgeryDate?: string | Date | null
  source?: string
  leadSource?: number | string | null
  bdId?: string
  createdDate?: string | Date
  updatedDate?: string | Date
  leadEntryDate?: string | Date | null
  assignedDate?: string | Date | null
  followUpDate?: string | Date | null
  opdScheduleDate?: string | Date | null
  campaignName?: string | null
  month?: string | Date | null
  profession?: string | null
  subStatus?: string | null
  teamLeadId?: number | null
  duplCount?: number | null
  latestRemark?: {
    id: string
    content: string
    createdAt: string | Date
    createdBy?: {
      id: string
      name: string | null
    } | null
  } | null
  bd?: {
    id: string
    name: string
    email: string
    role?: string
    employee?: {
      department?: { id?: string; name?: string | null } | null
      team?: { id?: string; name?: string | null; department?: { id?: string; name?: string | null } | null } | null
      manager?: {
        user?: {
          name?: string | null
        } | null
      } | null
    } | null
  }
  updatedBy?: {
    id: string
    name: string | null
  } | null
  kypSubmission?: {
    id: string
    location?: string | null
    status?: string
    updatedAt?: string | Date
    preAuthData?: {
      preAuthRaisedAt?: string | Date | null
      preAuthRaisedBy?: { id: string; name: string | null } | null
      updatedAt?: string | Date
      queries?: { updatedAt?: string | Date }[]
    } | null
  } | null
  ipdPotentialDate?: string | Date | null
  ipdAdmissionDate?: string | Date | null
  ipdPotentialMarkedAt?: string | Date | null
  insuranceInitiateForm?: { updatedAt?: string | Date } | null
  admissionRecord?: {
    ipdStatus?: string | null
    ipdStatusReason?: string | null
    ipdStatusUpdatedAt?: string | Date | null
    initiatedAt?: string | Date
    surgeryDate?: string | Date | null
    surgeryTime?: string | null
    newSurgeryDate?: string | Date | null
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
    outstandingStatus?: string
  }
  [key: string]: unknown
}

export function useLeads(filters: LeadFilters = {}, options: { enabled?: boolean } = {}) {
  const { enabled = true } = options
  const queryClient = useQueryClient()
  const [cachedData, setCachedData] = useState<Lead[] | null>(null)

  const cacheKey = `leads_integer_ids_v1_${JSON.stringify(filters)}`

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
    enabled,
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
    mutationFn: async ({ id, data }: { id: number; data: Partial<Lead> }) => {
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

export function useLead(id: string | number | null) {
  const queryClient = useQueryClient()

  const query = useQuery<Lead>({
    queryKey: ['lead', id],
    queryFn: () => apiGet<Lead>(`/api/leads/${id}`),
    enabled: id !== null && String(id).length > 0,
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
