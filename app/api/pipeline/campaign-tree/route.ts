import { NextRequest } from 'next/server'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  buildPipelineFiltersWhere,
  buildPipelineRoleWhere,
  parsePipelineQueryParams,
} from '@/lib/pipeline/server-query'

type CampaignGroup = {
  groupValue: string
  total: number
  campaigns: { name: string; count: number }[]
}

function normalizeLabel(value: string | null | undefined, fallback: string): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim().replace(/\s+/g, ' ')
  return trimmed || fallback
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

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'leads:read')) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const params = parsePipelineQueryParams(searchParams)
    const { where: roleWhere } = await buildPipelineRoleWhere(user)

    const facetWhere = buildPipelineFiltersWhere(params, roleWhere, { includeStatusBucket: false })
    const campaignTree = await loadCampaignTree(facetWhere, params.groupBy)

    return successResponse({ campaignTree })
  } catch (error) {
    console.error('Error fetching campaign tree:', error)
    return errorResponse('Failed to fetch campaign tree', 500)
  }
}
