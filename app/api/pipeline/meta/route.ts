import { NextRequest } from 'next/server'
import { EmployeeStatus, UserRole } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getEmployeeByUserId, getSubordinates, resolveTeamLeadForLeadOwner } from '@/lib/hierarchy'
import { TEAM_UNIT_ROLES } from '@/lib/sales-hierarchy-roles'
import {
  buildPipelineFiltersWhere,
  buildPipelineRoleWhere,
  bucketsFromStatusGroups,
  parsePipelineQueryParams,
} from '@/lib/pipeline/server-query'
import { canonicalSalesCompletedWhere } from '@/lib/analytics/ipd-filters'

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const MEMORY_CACHE = new Map<string, CacheEntry<unknown>>()

function getCached<T>(key: string): T | null {
  const entry = MEMORY_CACHE.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    MEMORY_CACHE.delete(key)
    return null
  }
  return entry.data as T
}

function setCached<T>(key: string, data: T, ttlMs: number) {
  MEMORY_CACHE.set(key, { data, expiresAt: Date.now() + ttlMs })
}

async function getCachedSources(): Promise<string[]> {
  const cacheKey = 'crm:sources'
  const cached = getCached<string[]>(cacheKey)
  if (cached) return cached

  const rows = await prisma.crmCampaignSource.findMany({
    where: { isActive: true },
    select: { name: true },
    take: 300,
    orderBy: { name: 'asc' },
  })
  const list = rows
    .map((row) => row.name.trim())
    .filter((value) => value.length > 0)
    .sort((left, right) => left.localeCompare(right))

  setCached(cacheKey, list, 120_000)
  return list
}

async function getCachedLeadSources(): Promise<string[]> {
  const cacheKey = 'crm:leadSources'
  const cached = getCached<string[]>(cacheKey)
  if (cached) return cached

  const rows = await prisma.crmCampaignLeadSource.findMany({
    where: { isActive: true },
    select: { name: true },
    take: 300,
    orderBy: { name: 'asc' },
  })
  const list = rows
    .map((row) => row.name.trim())
    .filter((value) => value.length > 0)
    .sort((left, right) => left.localeCompare(right))

  setCached(cacheKey, list, 120_000)
  return list
}

async function loadPipelineApplicableUserFilters(user: {
  id: string
  name: string
  role: UserRole | string
}) {
  const BD_OWNER_FILTERABLE_ROLES = new Set<UserRole>([
    UserRole.BD,
    UserRole.TEAM_LEAD,
    UserRole.CATEGORY_MANAGER,
    UserRole.SALES_HEAD,
    UserRole.EXECUTIVE_ASSISTANT,
  ])

  const addOwnerOption = (
    ownerMap: Map<string, { id: string; name: string }>,
    candidate: { id: string; name: string; role: UserRole | string }
  ) => {
    if (!BD_OWNER_FILTERABLE_ROLES.has(candidate.role as UserRole)) return
    ownerMap.set(candidate.id, {
      id: candidate.id,
      name: candidate.name,
    })
  }

  if (user.role === UserRole.BD) {
    const teamLead = await resolveTeamLeadForLeadOwner(user.id)
    return {
      bds: [{ id: user.id, name: user.name }],
      bdOwners: [user.name],
      teamLeads: teamLead?.name ? [teamLead.name] : [],
    }
  }

  if (
    user.role === UserRole.TEAM_LEAD ||
    user.role === UserRole.ASSISTANT_CATEGORY_MANAGER ||
    user.role === UserRole.CATEGORY_MANAGER ||
    user.role === UserRole.SALES_HEAD
  ) {
    const employee = await getEmployeeByUserId(user.id)
    const subordinates = employee ? await getSubordinates(employee.id, true) : []
    const bdMap = new Map<string, { id: string; name: string }>()
    const ownerMap = new Map<string, { id: string; name: string }>()
    const teamLeadNames = new Set<string>()

    bdMap.set(user.id, {
      id: user.id,
      name: user.name,
    })

    addOwnerOption(ownerMap, {
      id: user.id,
      name: user.name,
      role: user.role,
    })

    if (TEAM_UNIT_ROLES.includes(user.role as UserRole)) {
      teamLeadNames.add(user.name)
    }

    for (const subordinate of subordinates) {
      if (subordinate.status !== EmployeeStatus.ACTIVE) continue

      if (
        subordinate.user.role === UserRole.BD ||
        subordinate.user.role === UserRole.TEAM_LEAD ||
        subordinate.user.role === UserRole.ASSISTANT_CATEGORY_MANAGER
      ) {
        bdMap.set(subordinate.user.id, {
          id: subordinate.user.id,
          name: subordinate.user.name,
        })
      }

      addOwnerOption(ownerMap, {
        id: subordinate.user.id,
        name: subordinate.user.name,
        role: subordinate.user.role,
      })

      if (TEAM_UNIT_ROLES.includes(subordinate.user.role as UserRole)) {
        teamLeadNames.add(subordinate.user.name)
      }
    }

    return {
      bds: [...bdMap.values()].sort((left, right) => left.name.localeCompare(right.name)),
      bdOwners: [...ownerMap.values()]
        .map((item) => item.name)
        .sort((left, right) => left.localeCompare(right)),
      teamLeads: [...teamLeadNames].sort((left, right) => left.localeCompare(right)),
    }
  }

  const [allBds, allTeamLeads, allBdOwners] = await Promise.all([
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
    prisma.user.findMany({
      where: {
        role: { in: [...BD_OWNER_FILTERABLE_ROLES] },
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
    bdOwners: allBdOwners.map((item) => item.name),
    teamLeads: allTeamLeads.map((item) => item.name),
  }
}

async function getCachedPipelineApplicableUserFilters(user: {
  id: string
  name: string
  role: UserRole | string
}) {
  const cacheKey = `crm:user-filters:${user.id}:${user.role}`
  const cached = getCached<{
    bds: { id: string; name: string }[]
    bdOwners: string[]
    teamLeads: string[]
  }>(cacheKey)
  if (cached) return cached

  const res = await loadPipelineApplicableUserFilters(user)
  setCached(cacheKey, res, 120_000)
  return res
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'leads:read')) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const params = parsePipelineQueryParams(searchParams)
    const { where: roleWhere } = await buildPipelineRoleWhere(user)

    // Status card counts ignore the selected status bucket so cards stay stable while drilling in.
    const facetWhere = buildPipelineFiltersWhere(params, roleWhere, { includeStatusBucket: false })

    const [
      statusGroups,
      ipdDoneCount,
      facetTotal,
      categoryRows,
      circleRows,
      sources,
      leadSources,
      userFilters,
    ] = await Promise.all([
      prisma.lead.groupBy({
        by: ['status'],
        where: facetWhere,
        _count: { _all: true },
      }),
      prisma.lead.count({
        where: { AND: [facetWhere, canonicalSalesCompletedWhere({})] },
      }),
      prisma.lead.count({ where: facetWhere }),
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
      getCachedSources(),
      getCachedLeadSources(),
      getCachedPipelineApplicableUserFilters(user),
    ])

    const { bds, bdOwners, teamLeads } = userFilters

    const statusCounts = bucketsFromStatusGroups(statusGroups)
    statusCounts.ipd_done = ipdDoneCount

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

    return successResponse({
      statusCounts,
      facetTotal,
      facets: {
        categories,
        circles,
        bds,
        teamLeads,
        bdOwners,
        columnFacets: {
          tl: teamLeads,
          bd: bdOwners,
          source: sources,
          leadSource: leadSources,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching pipeline meta:', error)
    return errorResponse('Failed to fetch pipeline metadata', 500)
  }
}
