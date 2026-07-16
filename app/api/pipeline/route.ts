import { NextRequest } from 'next/server'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { mapStatusCode } from '@/lib/mysql-code-mappings'
import {
  buildPipelineFiltersWhere,
  buildPipelineRoleWhere,
  bucketsFromStatusGroups,
  parsePipelineQueryParams,
  pipelineOrderBy,
  pipelineTableSelect,
} from '@/lib/pipeline/server-query'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'leads:read')) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const params = parsePipelineQueryParams(searchParams)
    const { where: roleWhere } = await buildPipelineRoleWhere(user)

    const listWhere = buildPipelineFiltersWhere(params, roleWhere, { includeStatusBucket: true })
    // Status card counts ignore the selected status bucket so cards stay stable while drilling in.
    const facetWhere = buildPipelineFiltersWhere(params, roleWhere, { includeStatusBucket: false })

    const skip = (params.page - 1) * params.pageSize
    const orderBy = pipelineOrderBy(params.sortBy, params.sortDir)

    const [total, leads, statusGroups, categoryRows, circleRows, bdRows, campaignAgg] =
      await Promise.all([
        prisma.lead.count({ where: listWhere }),
        prisma.lead.findMany({
          where: listWhere,
          select: pipelineTableSelect,
          orderBy,
          skip,
          take: params.pageSize,
        }),
        prisma.lead.groupBy({
          by: ['status'],
          where: facetWhere,
          _count: { _all: true },
        }),
        prisma.lead.findMany({
          where: facetWhere,
          select: { category: true },
          distinct: ['category'],
          take: 200,
          orderBy: { category: 'asc' },
        }),
        prisma.lead.findMany({
          where: facetWhere,
          select: { circle: true },
          distinct: ['circle'],
          take: 200,
          orderBy: { circle: 'asc' },
        }),
        // bdId is required on Lead — do not use `{ not: null }` (Prisma rejects it).
        prisma.lead.findMany({
          where: facetWhere,
          select: { bdId: true, bd: { select: { id: true, name: true } } },
          distinct: ['bdId'],
          take: 300,
          orderBy: { bdId: 'asc' },
        }),
        loadCampaignTree(facetWhere, params.groupBy),
      ])

    const statusCounts = bucketsFromStatusGroups(statusGroups)
    const facetTotal = Object.values(statusCounts).reduce((s, n) => s + n, 0)

    const categories = categoryRows
      .map((r) => r.category?.trim())
      .filter((v): v is string => !!v)
      .sort((a, b) => a.localeCompare(b))

    const circles = [
      ...new Set(
        circleRows.map((r) => {
          const c = r.circle?.trim()
          return c ? c : 'Unknown'
        }),
      ),
    ].sort((a, b) => a.localeCompare(b))

    const bds = bdRows
      .filter((r) => r.bd?.id && r.bd.name)
      .map((r) => ({ id: r.bd!.id, name: r.bd!.name }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const mappedLeads = leads.map((lead) => {
      const latestRemark = lead.leadRemarkEntries?.[0] ?? null
      const base = {
        ...lead,
        latestRemark,
        status: mapStatusCode(lead.status),
      }
      delete (base as Record<string, unknown>).leadRemarkEntries
      return base
    })

    return successResponse({
      leads: mappedLeads,
      total,
      page: params.page,
      pageSize: params.pageSize,
      totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
      statusCounts,
      facetTotal,
      facets: {
        categories,
        circles,
        bds,
      },
      campaignTree: campaignAgg,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
    })
  } catch (error) {
    console.error('Error fetching pipeline page:', error)
    return errorResponse('Failed to fetch pipeline data', 500)
  }
}

type CampaignGroup = {
  groupValue: string
  total: number
  campaigns: { name: string; count: number }[]
}

async function loadCampaignTree(
  where: Prisma.LeadWhereInput,
  groupBy: 'circle' | 'disease',
): Promise<CampaignGroup[]> {
  const rows =
    groupBy === 'circle'
      ? await prisma.lead.groupBy({
          by: ['circle', 'campaignName'],
          where,
          _count: { _all: true },
        })
      : await prisma.lead.groupBy({
          by: ['treatment', 'campaignName'],
          where,
          _count: { _all: true },
        })

  const map = new Map<string, Map<string, number>>()
  for (const row of rows) {
    const groupValue =
      groupBy === 'circle'
        ? normalizeLabel((row as { circle: string | null }).circle, 'Unknown')
        : normalizeLabel((row as { treatment: string | null }).treatment, 'Unknown disease')
    const campaign = normalizeLabel(row.campaignName, 'No campaign')
    if (!map.has(groupValue)) map.set(groupValue, new Map())
    const inner = map.get(groupValue)!
    inner.set(campaign, (inner.get(campaign) ?? 0) + row._count._all)
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([groupValue, campaigns]) => ({
      groupValue,
      total: [...campaigns.values()].reduce((s, n) => s + n, 0),
      campaigns: [...campaigns.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name)),
    }))
}

function normalizeLabel(value: string | null | undefined, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim().replace(/\s+/g, ' ')
  return trimmed || fallback
}
