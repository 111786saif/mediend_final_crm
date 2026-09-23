import { optionalLeadId } from '@/lib/lead-id'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { canAccessLead, hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getLeadAccessSubordinateIds } from '@/lib/lead-access-api'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'leads:read')) {
      return errorResponse('Forbidden', 403)
    }

    const leadId = optionalLeadId(request.nextUrl.searchParams.get('leadId'))
    if (!leadId) {
      return errorResponse('leadId is required', 400)
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { bdId: true },
    })
    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    const subordinateUserIds = await getLeadAccessSubordinateIds(user)
    if (!canAccessLead(user, lead.bdId, subordinateUserIds)) {
      return errorResponse('Forbidden', 403)
    }

    const notes = await prisma.callNote.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    })

    return successResponse(notes)
  } catch (e) {
    console.error('GET /api/call-notes', e)
    return errorResponse('Failed to fetch call notes', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'leads:write')) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const leadId = optionalLeadId(body?.leadId)
    const content = typeof body?.content === 'string' ? body.content.trim() : ''
    if (!leadId) {
      return errorResponse('leadId is required', 400)
    }
    if (!content) {
      return errorResponse('content is required', 400)
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { bdId: true },
    })
    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    const subordinateUserIds = await getLeadAccessSubordinateIds(user)
    if (!canAccessLead(user, lead.bdId, subordinateUserIds)) {
      return errorResponse('Forbidden', 403)
    }

    const note = await prisma.callNote.create({
      data: {
        leadId,
        content,
        createdById: user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    })

    return successResponse(note, 'Note added')
  } catch (e) {
    console.error('POST /api/call-notes', e)
    return errorResponse('Failed to create call note', 500)
  }
}

