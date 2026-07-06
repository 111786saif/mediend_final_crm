'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { getCachedLeads, cacheLeads } from '@/lib/indexeddb'
import type { Lead } from '@/hooks/use-leads'
import { useEffect, useState } from 'react'

export interface CaseTrackerFilters {
  fromDate?: string
  toDate?: string
  bdId?: string
  caseStage?: string
  phoneSearch?: string
}

export function useCaseTracker(filters: CaseTrackerFilters = {}) {
  const [cachedData, setCachedData] = useState<Lead[] | null>(null)
  const cacheKey = `case-tracker_${JSON.stringify(filters)}`

  useEffect(() => {
    getCachedLeads<Lead[]>(cacheKey).then((data) => {
      if (data) setCachedData(data)
    })
  }, [cacheKey])

  const query = useQuery({
    queryKey: ['case-tracker', filters],
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value)
      })
      const data = await apiGet<Lead[]>(`/api/case-tracker?${params.toString()}`)
      await cacheLeads(cacheKey, data)
      return data
    },
    placeholderData: cachedData || undefined,
  })

  return {
    leads: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
  }
}
