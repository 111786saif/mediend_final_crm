import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'compliance:read')) return errorResponse('Forbidden', 403)

    const [hospitals, circles, treatments, bds] = await Promise.all([
      prisma.lead.findMany({
        distinct: ['hospitalName'],
        select: { hospitalName: true },
        orderBy: { hospitalName: 'asc' },
      }),
      prisma.lead.findMany({
        distinct: ['circle'],
        select: { circle: true },
        orderBy: { circle: 'asc' },
      }),
      prisma.lead.findMany({
        where: { treatment: { not: null } },
        distinct: ['treatment'],
        select: { treatment: true },
        orderBy: { treatment: 'asc' },
      }),
      prisma.lead.findMany({
        distinct: ['bdId'],
        select: { bd: { select: { id: true, name: true } } },
      }),
    ])

    const bdMap = new Map<string, string>()
    for (const row of bds) {
      if (row.bd) bdMap.set(row.bd.id, row.bd.name)
    }

    return successResponse({
      hospitals: hospitals.map((h) => h.hospitalName).filter(Boolean),
      circles: circles.map((c) => c.circle).filter(Boolean),
      treatments: treatments.map((t) => t.treatment).filter((t): t is string => Boolean(t)),
      bds: Array.from(bdMap.entries())
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })
  } catch (error) {
    console.error('Error fetching cumulative report filter options:', error)
    return errorResponse('Failed to fetch filter options', 500)
  }
}
