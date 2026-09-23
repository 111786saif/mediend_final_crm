import { parseLeadId } from '@/lib/lead-id'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { canAccessLead, hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getLeadAccessSubordinateIds } from '@/lib/lead-access-api'

const MAX_IDS = 2000

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'leads:read')) {
      return errorResponse('Forbidden', 403)
    }

    const raw = request.nextUrl.searchParams.get('leadIds') || ''
    const leadIds = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_IDS)
      .map(parseLeadId)

    if (leadIds.length === 0) {
      return successResponse({} as Record<string, number>)
    }

    const subordinateUserIds = await getLeadAccessSubordinateIds(user)

    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
      select: { id: true, bdId: true },
    })

    const allowedIds = new Set(
      leads
        .filter((l) => canAccessLead(user, l.bdId, subordinateUserIds))
        .map((l) => l.id)
    )

    if (allowedIds.size === 0) {
      return successResponse({} as Record<string, number>)
    }

    const grouped = await prisma.callNote.groupBy({
      by: ['leadId'],
      where: { leadId: { in: [...allowedIds] } },
      _count: { id: true },
    })

    const out: Record<string, number> = {}
    for (const g of grouped) {
      out[g.leadId] = g._count.id
    }

    return successResponse(out)
  } catch (e) {
    console.error('GET /api/call-notes/counts', e)
    return errorResponse('Failed to fetch note counts', 500)
  }
}

