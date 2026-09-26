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
