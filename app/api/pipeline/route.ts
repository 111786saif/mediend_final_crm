import { NextRequest } from 'next/server'
import { EmployeeStatus, Prisma, UserRole } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getEmployeeByUserId, getSubordinates, resolveTeamLeadForLeadOwner } from '@/lib/hierarchy'
import {
  getVisibleLatestLeadRemark,
  getVisibleLeadRemarksFallbackContent,
} from '@/lib/lead-remark-visibility'
import { mapStatusCode } from '@/lib/mysql-code-mappings'
import { maskPhoneNumber } from '@/lib/phone-utils'
import { normalizeModeOfPaymentLabel } from '@/lib/mode-of-payment'
import { TEAM_UNIT_ROLES } from '@/lib/sales-hierarchy-roles'
import {
  buildPipelineFiltersWhere,
  buildPipelineRoleWhere,
  bucketsFromStatusGroups,
  parsePipelineQueryParams,
  pipelineOrderBy,
  type PipelineSelectedLead,
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

    // With the pg driver adapter we keep the Prisma pool deliberately small.
    // Running a burst of parallel pipeline queries on the same adapter/client
    // can produce malformed bind messages on some environments, so keep this
    // endpoint's reads serial.
    const statusGroups = await prisma.lead.groupBy({
      by: ['status'],
      where: facetWhere,
      _count: { _all: true },
    })
    const categoryRows = await prisma.lead.findMany({
      where: facetWhere,
      select: { category: true },
      distinct: ['category'],
      take: 200,
      orderBy: { category: 'asc' },
    })
    const circleRows = await prisma.lead.findMany({
      where: facetWhere,
      select: { circle: true },
      distinct: ['circle'],
      take: 200,
      orderBy: { circle: 'asc' },
    })
    const sourceRows = await prisma.crmCampaignSource.findMany({
      where: { isActive: true },
      select: { name: true },
      take: 300,
      orderBy: { name: 'asc' },
    })
    const leadSourceRows = await prisma.crmCampaignLeadSource.findMany({
      where: { isActive: true },
      select: { name: true },
      take: 300,
      orderBy: { name: 'asc' },
    })
    const { bds, teamLeads } = await loadPipelineApplicableUserFilters(user)
    const campaignAgg = await loadCampaignTree(facetWhere, params.groupBy)
    const total = await prisma.lead.count({ where: listWhere })
    const leads: PipelineSelectedLead[] = await prisma.lead.findMany({
      where: listWhere,
      select: pipelineTableSelect,
      orderBy,
      skip,
      take: params.pageSize,
    })

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

    const sources = sourceRows
      .map((row) => row.name.trim())
      .filter((value) => value.length > 0)
      .sort((left, right) => left.localeCompare(right))

    const leadSources = leadSourceRows
      .map((row) => row.name.trim())
      .filter((value) => value.length > 0)
      .sort((left, right) => left.localeCompare(right))

    const mappedLeads = leads.map((lead) => {
      const latestRemark = getVisibleLatestLeadRemark(lead, lead.leadRemarkEntries, user.role) ?? null
      const canViewPhone = user.role === 'ADMIN'
      const base = {
        ...lead,
        latestRemark,
        remarks: getVisibleLeadRemarksFallbackContent(lead, lead.remarks, user.role),
        status: mapStatusCode(lead.status),
        modeOfPayment: normalizeModeOfPaymentLabel(lead.modeOfPayment),
        phoneNumber: canViewPhone
          ? lead.phoneNumber
          : (lead.phoneNumber ? maskPhoneNumber(lead.phoneNumber) : null),
        alternateNumber: canViewPhone
          ? lead.alternateNumber
          : (lead.alternateNumber ? maskPhoneNumber(lead.alternateNumber) : null),
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
        columnFacets: {
          tl: teamLeads,
          bd: bds.map((item) => item.name),
          source: sources,
          leadSource: leadSources,
        },
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

async function loadPipelineApplicableUserFilters(user: {
  id: string
  name: string
  role: UserRole | string
}) {
  if (user.role === UserRole.BD) {
    const teamLead = await resolveTeamLeadForLeadOwner(user.id)
    return {
      bds: [{ id: user.id, name: user.name }],
      teamLeads: teamLead?.name ? [teamLead.name] : [],
    }
  }

  if (
    user.role === UserRole.TEAM_LEAD ||
    user.role === UserRole.ASSISTANT_CATEGORY_MANAGER ||
    user.role === UserRole.CATEGORY_MANAGER ||
    user.role === UserRole.SALES_HEAD ||
    user.role === UserRole.EXECUTIVE_ASSISTANT
  ) {
    const employee = await getEmployeeByUserId(user.id)
    const subordinates = employee ? await getSubordinates(employee.id, true) : []
    const bdMap = new Map<string, { id: string; name: string }>()
    const teamLeadNames = new Set<string>()

    if (TEAM_UNIT_ROLES.includes(user.role as UserRole)) {
      teamLeadNames.add(user.name)
    }

    for (const subordinate of subordinates) {
      if (subordinate.status !== EmployeeStatus.ACTIVE) continue

      if (subordinate.user.role === UserRole.BD) {
        bdMap.set(subordinate.user.id, {
          id: subordinate.user.id,
          name: subordinate.user.name,
        })
      }

      if (TEAM_UNIT_ROLES.includes(subordinate.user.role as UserRole)) {
        teamLeadNames.add(subordinate.user.name)
      }
    }

    return {
      bds: [...bdMap.values()].sort((left, right) => left.name.localeCompare(right.name)),
      teamLeads: [...teamLeadNames].sort((left, right) => left.localeCompare(right)),
    }
  }

  const [allBds, allTeamLeads] = await Promise.all([
    prisma.user.findMany({
      where: {
        role: UserRole.BD,
        employee: {
          is: {
            status: EmployeeStatus.ACTIVE,
          },
        },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: {
        role: { in: TEAM_UNIT_ROLES },
        employee: {
          is: {
            status: EmployeeStatus.ACTIVE,
          },
        },
      },
      select: {
        name: true,
      },
      orderBy: { name: 'asc' },
    }),
  ])

  return {
    bds: allBds,
    teamLeads: allTeamLeads.map((item) => item.name),
  }
}
