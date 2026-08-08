import { NextRequest } from 'next/server'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { logCrmActivity } from '@/lib/crm-activity'
import { canUserViewLeadOwner } from '@/lib/lead-ownership'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'

async function authorizeLeadAccess(request: NextRequest, id: string) {
  const user = await getSessionWithFreshUser()
  if (!user) {
    return { user: null, lead: null, response: unauthorizedResponse() }
  }

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      bdId: true,
      patientName: true,
      leadRef: true,
      openedInCrmAt: true,
    },
  })

  if (!lead) {
    return { user, lead: null, response: errorResponse('Lead not found', 404) }
  }

  const canAccess = await canUserViewLeadOwner(user, lead.bdId)
  if (!canAccess) {
    return { user, lead, response: errorResponse('Forbidden', 403) }
  }

  return { user, lead, response: null }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await authorizeLeadAccess(request, id)
    if (auth.response || !auth.user || !auth.lead) {
      return auth.response!
    }

    if (auth.lead.openedInCrmAt) {
      return successResponse({
        marked: false,
        openedInCrmAt: auth.lead.openedInCrmAt,
      })
    }

    const openedAt = new Date()
    const updated = await prisma.lead.updateMany({
      where: {
        id: auth.lead.id,
        openedInCrmAt: null,
      },
      data: {
        openedInCrmAt: openedAt,
      },
    })

    if (updated.count > 0) {
      const leadEntityLabel = `${auth.lead.leadRef || auth.lead.id} · ${auth.lead.patientName || 'Lead'}`
      await logCrmActivity({
        action: 'CRM_LEAD_OPENED',
        entityType: 'CRM_LEAD',
        entityId: auth.lead.id,
        entityLabel: leadEntityLabel,
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        request,
        summary: `Opened lead ${leadEntityLabel} in workspace`,
        metadata: {
          leadId: auth.lead.id,
          leadRef: auth.lead.leadRef,
          patientName: auth.lead.patientName,
          openedInCrmAt: openedAt.toISOString(),
        },
      })
    }

    return successResponse({
      marked: updated.count > 0,
      openedInCrmAt: openedAt,
    })
  } catch (error) {
    console.error('Error marking lead as opened:', error)
    return errorResponse('Failed to mark lead as opened', 500)
  }
}
