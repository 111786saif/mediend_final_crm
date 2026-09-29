// Unified Typesense service for Sales Pipeline APIs
// Provides plug-and-play abstraction: when Typesense is offline or unconfigured,
// all methods return null, allowing API routes to transparently fall back to PostgreSQL.
import {
  isTypesenseConfigured,
  isTypesenseUnavailableError,
  recordTypesense502Error,
  searchSalesPipeline,
  parseSalesPipelineNaturalQuery,
  mapPipelineSortToTypesense,
  buildTypesenseRoleFilter,
  mapTypesenseDocToPipelineLead,
  buildPipelineTypesenseFilterBy,
} from '@/lib/typesense/client'
import type { PipelineQueryParams } from '@/lib/pipeline/server-query'

export interface PipelineTypesenseLeadsResult {
  leads: any[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  sortBy: string
  sortDir: string
}

export interface PipelineTypesenseMatchedIdsResult {
  matchedLeadIds: string[]
  matchedLeadRefs: string[]
  found: number
}

// Queries sales pipeline leads directly from Typesense with full search, role scoping, and filtering
// Returns null if Typesense is unconfigured or encounters an error (enabling transparent fallback to PostgreSQL)
export async function fetchPipelineLeadsFromTypesense(
  params: PipelineQueryParams,
  user: { id: string; role: string },
  scope?: { subordinateUserIds?: string[]; teamLeadId?: string | number | null }
): Promise<PipelineTypesenseLeadsResult | null> {
  if (!isTypesenseConfigured()) return null

  try {
    const queryText = params.search ? parseSalesPipelineNaturalQuery(params.search).cleanQuery : '*'
    const hasTextSearch = Boolean(params.search && params.search.trim().length > 0)
    const tsSortBy = mapPipelineSortToTypesense(params.sortBy, params.sortDir, hasTextSearch)
    const roleFilter = await buildTypesenseRoleFilter(user, scope)
    const filterBy = buildPipelineTypesenseFilterBy(params, { roleFilter })

    const tsResult = await searchSalesPipeline(queryText, {
      page: params.page,
      perPage: params.pageSize,
      sortBy: tsSortBy,
      filterBy,
    })

    const mappedLeads = tsResult.hits.map((h) =>
      mapTypesenseDocToPipelineLead(h.document, user.role)
    )

    return {
      leads: mappedLeads,
      total: tsResult.found,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.max(1, Math.ceil(tsResult.found / params.pageSize)),
      sortBy: params.sortBy,
      sortDir: params.sortDir,
    }
  } catch (err) {
    console.warn('[Typesense] Search error in fetchPipelineLeadsFromTypesense, falling back to PostgreSQL:', err)
    if (isTypesenseUnavailableError(err)) {
      recordTypesense502Error(err)
    }
    return null
  }
}

// Queries matched lead IDs from Typesense for meta aggregations and campaign trees
// Returns null if Typesense is unconfigured or encounters an error (enabling transparent fallback to PostgreSQL)
export async function fetchPipelineMatchedLeadIdsFromTypesense(
  params: PipelineQueryParams,
  user: { id: string; role: string },
  scope?: { subordinateUserIds?: string[]; teamLeadId?: string | number | null },
  options?: { includeStatusBucket?: boolean; perPage?: number }
): Promise<PipelineTypesenseMatchedIdsResult | null> {
  if (!isTypesenseConfigured()) return null

  try {
    const queryText = params.search ? parseSalesPipelineNaturalQuery(params.search).cleanQuery : '*'
    const roleFilter = await buildTypesenseRoleFilter(user, scope)
    const filterParams = {
      ...params,
      statusBucket: options?.includeStatusBucket === false ? 'all' : params.statusBucket,
    }
    const filterBy = buildPipelineTypesenseFilterBy(filterParams, { roleFilter })

    const tsResult = await searchSalesPipeline(queryText, {
      page: 1,
      perPage: options?.perPage ?? 250,
      filterBy,
    })

    return {
      matchedLeadIds: tsResult.matchedLeadIds,
      matchedLeadRefs: tsResult.matchedLeadRefs,
      found: tsResult.found,
    }
  } catch (err) {
    console.warn('[Typesense] Error in fetchPipelineMatchedLeadIdsFromTypesense, falling back to PostgreSQL:', err)
    if (isTypesenseUnavailableError(err)) {
      recordTypesense502Error(err)
    }
    return null
  }
}

export interface PipelineTypesenseMetaResult {
  statusCounts: Record<string, number>
  facetTotal: number
  categories: string[]
  circles: string[]
}

// Queries metadata facets (status counts, facet total, categories, circles) directly from Typesense
// Returns null if Typesense is unconfigured or encounters an error (enabling transparent fallback to PostgreSQL)
export async function fetchPipelineMetaFromTypesense(
  params: PipelineQueryParams,
  user: { id: string; role: string },
  scope?: { subordinateUserIds?: string[]; teamLeadId?: string | number | null }
): Promise<PipelineTypesenseMetaResult | null> {
  if (!isTypesenseConfigured()) return null

  try {
    const queryText = params.search ? parseSalesPipelineNaturalQuery(params.search).cleanQuery : '*'
    const roleFilter = await buildTypesenseRoleFilter(user, scope)
    const filterParams = {
      ...params,
      statusBucket: 'all' as const, // Status card counts ignore selected status bucket to stay stable
    }
    const filterBy = buildPipelineTypesenseFilterBy(filterParams, { roleFilter })

    const tsResult = await searchSalesPipeline(queryText, {
      page: 1,
      perPage: 0,
      facetBy: 'status,category,circle',
      maxFacetValues: 100,
      filterBy,
    })

    const statusFacet = tsResult.facetCounts?.find((f) => f.field_name === 'status')
    const categoryFacet = tsResult.facetCounts?.find((f) => f.field_name === 'category')
    const circleFacet = tsResult.facetCounts?.find((f) => f.field_name === 'circle')

    const rows = (statusFacet?.counts ?? []).map((c) => ({
      status: c.value,
      _count: { _all: c.count },
    }))

    const { bucketsFromStatusGroups } = await import('@/lib/pipeline/server-query')
    const statusCounts = bucketsFromStatusGroups(rows)

    const categories = (categoryFacet?.counts ?? [])
      .map((c) => c.value?.trim())
      .filter((v): v is string => Boolean(v))
      .sort((a, b) => a.localeCompare(b))

    const circles = (circleFacet?.counts ?? [])
      .map((c) => c.value?.trim())
      .filter((v): v is string => Boolean(v))
      .sort((a, b) => a.localeCompare(b))

    return {
      statusCounts,
      facetTotal: tsResult.found,
      categories,
      circles,
    }
  } catch (err) {
    console.warn('[Typesense] Error in fetchPipelineMetaFromTypesense, falling back to PostgreSQL:', err)
    if (isTypesenseUnavailableError(err)) {
      recordTypesense502Error(err)
    }
    return null
  }
}

