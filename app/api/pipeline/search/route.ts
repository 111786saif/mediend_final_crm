import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { successResponse, unauthorizedResponse, errorResponse } from '@/lib/api-utils'
import {
  isTypesenseConfigured,
  isTypesenseUnavailableError,
  recordTypesense502Error,
  searchSalesPipeline,
  parseSalesPipelineNaturalQuery,
  type SalesPipelineSearchOptions,
} from '@/lib/typesense/client'
import { getEmployeeByUserId, getSubordinates } from '@/lib/hierarchy'
import {
  buildPipelineFiltersWhere,
  buildPipelineRoleWhere,
  parsePipelineQueryParams,
  pipelineOrderBy,
  pipelineTableSelect,
} from '@/lib/pipeline/server-query'
import {
  getVisibleLatestLeadRemark,
  getVisibleLeadRemarksFallbackContent,
} from '@/lib/lead-remark-visibility'
import { getVisibleLeadFollowUpDate } from '@/lib/lead-follow-up-visibility'
import { mapStatusCode } from '@/lib/mysql-code-mappings'
import { maskPhoneNumber } from '@/lib/phone-utils'
import { normalizeModeOfPaymentLabel } from '@/lib/mode-of-payment'

// Handles search requests with Typesense and automatic PostgreSQL fallback
export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'leads:read')) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || '*'
    const page = Math.max(1, Number(searchParams.get('page')) || 1)
    const perPage = Math.min(250, Math.max(1, Number(searchParams.get('perPage')) || 50))
    const sortBy = searchParams.get('sortBy') || undefined
    const queryBy = searchParams.get('queryBy') || undefined

    // Build role-based filter conditions for Typesense
    const filterClauses: string[] = []

    if (user.role === 'BD') {
      filterClauses.push(`bdId:=${user.id}`)
    } else if (
      user.role === 'TEAM_LEAD' ||
      user.role === 'ASSISTANT_CATEGORY_MANAGER' ||
      user.role === 'CATEGORY_MANAGER' ||
      user.role === 'SALES_HEAD'
    ) {
      const employee = await getEmployeeByUserId(user.id)
      const subordinates = employee ? await getSubordinates(employee.id, true) : []
      const visibleUserIds = [user.id, ...subordinates.map((s) => s.userId)]

      const bdFilter = `bdId:[${visibleUserIds.join(',')}]`
      if (employee?.bdNumber) {
        filterClauses.push(`(${bdFilter} || teamLeadId:=${employee.bdNumber})`)
      } else {
        filterClauses.push(bdFilter)
      }
    }

    // Additional query filters if provided
    const status = searchParams.get('status')
    if (status && status !== 'all') {
      filterClauses.push(`status:=${status}`)
    }
    const circle = searchParams.get('circle')
    if (circle && circle !== 'all') {
      filterClauses.push(`circle:=${circle}`)
    }
    const category = searchParams.get('category')
    if (category && category !== 'all') {
      filterClauses.push(`category:=${category}`)
    }
    const bdId = searchParams.get('bdId')
    if (bdId && bdId !== 'all') {
      filterClauses.push(`bdId:=${bdId}`)
    }

    // Try Typesense search if configured
    if (isTypesenseConfigured()) {
      try {
        const parsedQuery = parseSalesPipelineNaturalQuery(q)
        const allFilters = [...filterClauses, ...parsedQuery.filterClauses]

        const searchOptions: SalesPipelineSearchOptions = {
          page,
          perPage,
          filterBy: allFilters.length > 0 ? allFilters.join(' && ') : undefined,
          sortBy,
          queryBy,
        }

        const searchResult = await searchSalesPipeline(parsedQuery.cleanQuery, searchOptions)

        return successResponse({
          ...searchResult,
          leads: searchResult.hits.map((hit) => hit.document),
          source: 'typesense',
        })
      } catch (tsError) {
        console.warn('[Typesense Search] Server query failed, falling back to PostgreSQL search:', tsError)
        if (isTypesenseUnavailableError(tsError)) {
          recordTypesense502Error(tsError)
        }
      }
    } else {
      console.info('[Typesense Search] Typesense is not configured or unavailable, defaulting to PostgreSQL search')
    }

    // Fallback search via PostgreSQL database
    const params = parsePipelineQueryParams(searchParams)
    const { where: roleWhere } = await buildPipelineRoleWhere(user)
    const listWhere = buildPipelineFiltersWhere(params, roleWhere, { includeStatusBucket: true })
    const skip = (page - 1) * perPage

    const [total, leads] = await Promise.all([
      prisma.lead.count({ where: listWhere }),
      prisma.lead.findMany({
        where: listWhere,
        select: pipelineTableSelect,
        skip,
        take: perPage,
        orderBy: pipelineOrderBy(params.sortBy, params.sortDir),
      }),
    ])

    const canViewPhone = user.role === 'ADMIN'
    const mappedLeads = leads.map((lead) => {
      const latestRemark = getVisibleLatestLeadRemark(lead, lead.leadRemarkEntries, user.role) ?? null
      const base = {
        ...lead,
        latestRemark,
        remarks: getVisibleLeadRemarksFallbackContent(lead, lead.remarks, user.role),
        followUpDate: getVisibleLeadFollowUpDate(lead, user.role),
        status: mapStatusCode(lead.status),
        modeOfPayment: normalizeModeOfPaymentLabel(lead.modeOfPayment),
        phoneNumber: canViewPhone ? lead.phoneNumber : (lead.phoneNumber ? maskPhoneNumber(lead.phoneNumber) : null),
        alternateNumber: canViewPhone ? lead.alternateNumber : (lead.alternateNumber ? maskPhoneNumber(lead.alternateNumber) : null),
        whatsapp: canViewPhone ? lead.whatsapp : (lead.whatsapp ? maskPhoneNumber(lead.whatsapp) : null),
      }
      delete (base as Record<string, unknown>).leadRemarkEntries
      return base
    })

    return successResponse({
      hits: mappedLeads.map((doc) => ({ document: doc })),
      matchedLeadIds: mappedLeads.map((l) => l.id),
      found: total,
      page,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
      searchTimeMs: 0,
      leads: mappedLeads,
      source: 'database-fallback',
    })
  } catch (error: any) {
    console.error('Pipeline search handler error:', error)
    return errorResponse(error?.message || 'Failed to search pipeline data', 500)
  }
}
