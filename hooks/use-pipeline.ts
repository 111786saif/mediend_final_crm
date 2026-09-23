'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import type { Lead } from '@/hooks/use-leads'
import type { CampaignSelection, SidebarGroupMode } from '@/components/pipeline/campaign-sidebar'
import type { LeadAgeFilter, PipelineStatusBucket } from '@/lib/pipeline-lead-buckets'
import type {
  PipelineMultiColumnFilterField,
  PipelineSortDir,
  PipelineSortField,
} from '@/lib/pipeline/server-query'

export interface PipelineCampaignGroup {
  groupValue: string
  total: number
  campaigns: { name: string; count: number }[]
}

export interface PipelineTableResponse {
  leads: Lead[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  sortBy: PipelineSortField
  sortDir: PipelineSortDir
}

export interface PipelineFacets {
  categories: string[]
  circles: string[]
  bds: { id: string; name: string }[]
  teamLeads?: string[]
  bdOwners?: string[]
  columnFacets: Partial<Record<PipelineMultiColumnFilterField, string[]>>
}

export interface PipelineMetaResponse {
  statusCounts: Record<Exclude<PipelineStatusBucket, 'all'>, number>
  facetTotal: number
  facets: PipelineFacets
}

export interface PipelineCampaignTreeResponse {
  campaignTree: PipelineCampaignGroup[]
}

export interface PipelinePageResponse {
  leads: Lead[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  statusCounts: Record<Exclude<PipelineStatusBucket, 'all'>, number>
  facetTotal: number
  facets: PipelineFacets
  campaignTree: PipelineCampaignGroup[]
  sortBy: PipelineSortField
  sortDir: PipelineSortDir
}

export interface PipelineUrlState {
  page: number
  pageSize: number
  q: string
  status: PipelineStatusBucket
  bdId: string
  category: string
  circle: string
  age: LeadAgeFilter
  from: string
  to: string
  campaign: string
  groupBy: SidebarGroupMode
  groupValue: string
  sort: PipelineSortField
  dir: PipelineSortDir
}

const DEFAULTS: PipelineUrlState = {
  page: 1,
  pageSize: 20,
  q: '',
  status: 'all',
  bdId: 'all',
  category: 'all',
  circle: 'all',
  age: 'all',
  from: '',
  to: '',
  campaign: '',
  groupBy: 'circle',
  groupValue: '',
  sort: 'date',
  dir: 'desc',
}

function readState(sp: URLSearchParams): PipelineUrlState {
  return {
    page: Math.max(1, Number(sp.get('page') || 1) || 1),
    pageSize: Math.min(500, Math.max(10, Number(sp.get('pageSize') || 20) || 20)),
    q: sp.get('q') || '',
    status: (sp.get('status') as PipelineStatusBucket) || 'all',
    bdId: sp.get('bdId') || 'all',
    category: sp.get('category') || 'all',
    circle: sp.get('circle') || 'all',
    age: (sp.get('age') as LeadAgeFilter) || 'all',
    from: sp.get('from') || '',
    to: sp.get('to') || '',
    campaign: sp.get('campaign') || '',
    groupBy: sp.get('groupBy') === 'disease' ? 'disease' : 'circle',
    groupValue: sp.get('groupValue') || '',
    sort: (sp.get('sort') as PipelineSortField) || 'date',
    dir: sp.get('dir') === 'asc' ? 'asc' : 'desc',
  }
}

function toSearchParams(state: PipelineUrlState): URLSearchParams {
  const p = new URLSearchParams()
  if (state.page !== DEFAULTS.page) p.set('page', String(state.page))
  if (state.pageSize !== DEFAULTS.pageSize) p.set('pageSize', String(state.pageSize))
  if (state.q) p.set('q', state.q)
  if (state.status !== 'all') p.set('status', state.status)
  if (state.bdId !== 'all') p.set('bdId', state.bdId)
  if (state.category !== 'all') p.set('category', state.category)
  if (state.circle !== 'all') p.set('circle', state.circle)
  if (state.age !== 'all') p.set('age', state.age)
  if (state.from) p.set('from', state.from)
  if (state.to) p.set('to', state.to)
  if (state.campaign) {
    p.set('campaign', state.campaign)
    if (state.groupValue) p.set('groupValue', state.groupValue)
  }
  if (state.groupBy !== 'circle') p.set('groupBy', state.groupBy)
  if (state.sort !== 'date') p.set('sort', state.sort)
  if (state.dir !== 'desc') p.set('dir', state.dir)
  return p
}

export function usePipelineUrlState() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const state = useMemo(() => readState(searchParams), [searchParams])
  const currentStateQueryString = useMemo(() => toSearchParams(state).toString(), [state])

  const setState = useCallback(
    (patch: Partial<PipelineUrlState>, options?: { resetPage?: boolean }) => {
      const next: PipelineUrlState = {
        ...state,
        ...patch,
      }
      if (options?.resetPage !== false && patch.page === undefined) {
        const keys = Object.keys(patch)
        if (keys.some((k) => k !== 'page' && k !== 'pageSize')) {
          next.page = 1
        }
      }
      const qs = toSearchParams(next).toString()
      if (qs === currentStateQueryString) {
        return
      }
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [currentStateQueryString, router, pathname, state],
  )

  const campaignSelection: CampaignSelection = useMemo(() => {
    if (!state.campaign || !state.groupValue) return { type: 'all' }
    return {
      type: 'campaign',
      groupBy: state.groupBy,
      groupValue: state.groupValue,
      campaignLabel: state.campaign,
    }
  }, [state.campaign, state.groupBy, state.groupValue])

  const setCampaignSelection = useCallback(
    (sel: CampaignSelection) => {
      if (sel.type === 'all') {
        setState({ campaign: '', groupValue: '', circle: 'all' })
      } else {
        setState({
          campaign: sel.campaignLabel,
          groupValue: sel.groupValue,
          groupBy: sel.groupBy,
          ...(sel.groupBy === 'circle'
            ? { circle: sel.groupValue === 'Unknown' ? 'Unknown' : sel.groupValue }
            : { circle: 'all' }),
        })
      }
    },
    [setState],
  )

  return { state, setState, campaignSelection, setCampaignSelection }
}

const DEFAULT_STATUS_COUNTS: Record<Exclude<PipelineStatusBucket, 'all'>, number> = {
  new_hot: 0,
  nurture: 0,
  follow_up: 0,
  callback: 0,
  opd_done: 0,
  ipd_done: 0,
  opd_sch: 0,
  ipd_sch: 0,
  dnp: 0,
  dnp_exh: 0,
  junk: 0,
  outstation: 0,
  duplicate: 0,
  ipd_loss: 0,
  fund_issues: 0,
  lost: 0,
  closed: 0,
}

export function usePipelinePage(
  options: { enabled?: boolean; filters?: string } = {}
) {
  const { enabled = true, filters = '' } = options
  const { state } = usePipelineUrlState()

  // Table query parameters (includes pagination, sorting, search, and row filters)
  const tableQueryString = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(state.page))
    p.set('pageSize', String(state.pageSize))
    if (state.q) p.set('q', state.q)
    if (state.status !== 'all') p.set('status', state.status)
    if (state.bdId !== 'all') p.set('bdId', state.bdId)
    if (state.category !== 'all') p.set('category', state.category)
    if (state.circle !== 'all') p.set('circle', state.circle)
    if (state.age !== 'all') p.set('age', state.age)
    if (state.from) p.set('from', state.from)
    if (state.to) p.set('to', state.to)
    if (state.campaign) {
      p.set('campaign', state.campaign)
      if (state.groupBy === 'disease' && state.groupValue) {
        p.set('treatment', state.groupValue)
      }
    }
    p.set('groupBy', state.groupBy)
    p.set('sort', state.sort)
    p.set('dir', state.dir)
    if (filters) p.set('filters', filters)
    return p.toString()
  }, [filters, state])

  // Metadata query parameters (ignores pagination and status bucket to keep counts stable)
  const metaQueryString = useMemo(() => {
    const p = new URLSearchParams()
    if (state.q) p.set('q', state.q)
    if (state.bdId !== 'all') p.set('bdId', state.bdId)
    if (state.category !== 'all') p.set('category', state.category)
    if (state.circle !== 'all') p.set('circle', state.circle)
    if (state.age !== 'all') p.set('age', state.age)
    if (state.from) p.set('from', state.from)
    if (state.to) p.set('to', state.to)
    if (state.campaign) {
      p.set('campaign', state.campaign)
      if (state.groupBy === 'disease' && state.groupValue) {
        p.set('treatment', state.groupValue)
      }
    }
    p.set('groupBy', state.groupBy)
    if (filters) p.set('filters', filters)
    return p.toString()
  }, [filters, state])

  // 1. Primary Table Query: Instant 30-60ms response
  const tableQuery = useQuery({
    queryKey: ['pipeline', 'table', tableQueryString],
    queryFn: () => apiGet<PipelineTableResponse>(`/api/pipeline?${tableQueryString}`),
    enabled,
    placeholderData: (prev) => prev,
    staleTime: 10_000,
  })

  // 2. Metadata Query: Background 60s cache
  const metaQuery = useQuery({
    queryKey: ['pipeline', 'meta', metaQueryString],
    queryFn: () => apiGet<PipelineMetaResponse>(`/api/pipeline/meta?${metaQueryString}`),
    enabled,
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  })

  // 3. Campaign Tree Query: Background 120s cache
  const treeQuery = useQuery({
    queryKey: ['pipeline', 'tree', metaQueryString],
    queryFn: () => apiGet<PipelineCampaignTreeResponse>(`/api/pipeline/campaign-tree?${metaQueryString}`),
    enabled,
    placeholderData: (prev) => prev,
    staleTime: 120_000,
  })

  // Combined response data for full backward compatibility
  const combinedData: PipelinePageResponse | undefined = useMemo(() => {
    if (!tableQuery.data && !metaQuery.data) return undefined

    return {
      leads: tableQuery.data?.leads ?? [],
      total: tableQuery.data?.total ?? 0,
      page: tableQuery.data?.page ?? state.page,
      pageSize: tableQuery.data?.pageSize ?? state.pageSize,
      totalPages: tableQuery.data?.totalPages ?? 1,
      sortBy: tableQuery.data?.sortBy ?? state.sort,
      sortDir: tableQuery.data?.sortDir ?? state.dir,
      statusCounts: metaQuery.data?.statusCounts ?? DEFAULT_STATUS_COUNTS,
      facetTotal: metaQuery.data?.facetTotal ?? 0,
      facets: metaQuery.data?.facets ?? {
        categories: [],
        circles: [],
        bds: [],
        columnFacets: {},
      },
      campaignTree: treeQuery.data?.campaignTree ?? [],
    }
  }, [tableQuery.data, metaQuery.data, treeQuery.data, state.page, state.pageSize, state.sort, state.dir])

  const refetch = useCallback(() => {
    tableQuery.refetch()
    metaQuery.refetch()
    treeQuery.refetch()
  }, [tableQuery, metaQuery, treeQuery])

  return {
    ...tableQuery,
    isLoading: tableQuery.isLoading,
    isFetching: tableQuery.isFetching,
    data: combinedData,
    tableData: tableQuery.data,
    metaData: metaQuery.data,
    campaignTree: treeQuery.data?.campaignTree,
    refetch,
    state,
  }
}
