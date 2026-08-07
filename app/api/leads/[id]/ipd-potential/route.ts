import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { logCrmActivity } from '@/lib/crm-activity'
import { canMutateLead } from '@/lib/lead-access-api'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'

const schema = z.object({
  potentialDate: z.string().min(1, 'Potential IPD date is required'),
})

function parsePotentialDate(input: string) {
  const trimmed = input.trim()
  if (!trimmed) return null

  const date = new Date(`${trimmed}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null

  return date
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (user.role !== 'BD') {
      return errorResponse('Only BD users can mark IPD possibility', 403)
    }

    const { id: leadId } = await params
    const body = schema.parse(await request.json())
    const potentialDate = parsePotentialDate(body.potentialDate)

    if (!potentialDate) {
      return errorResponse('Potential IPD date is invalid', 400)
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (potentialDate < today) {
      return errorResponse('Potential IPD date cannot be in the past', 400)
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        bdId: true,
        patientName: true,
        leadRef: true,
        ipdPotentialDate: true,
      },
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    if (!(await canMutateLead(user, lead.bdId))) {
      return errorResponse('You do not have permission to update this lead', 403)
    }

    if (lead.ipdPotentialDate) {
      return errorResponse('IPD possibility is already marked for this lead and cannot be changed', 409)
    }

    const markedAt = new Date()

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        ipdPotentialDate: potentialDate,
        ipdPotentialMarkedAt: markedAt,
        updatedById: user.id,
        updatedDate: markedAt,
      },
    })

    const leadEntityLabel = `${lead.leadRef || lead.id} · ${lead.patientName || 'Lead'}`
    await logCrmActivity({
      action: 'CRM_LEAD_IPD_POTENTIAL_MARKED',
      entityType: 'CRM_LEAD',
      entityId: lead.id,
      entityLabel: leadEntityLabel,
      actorUserId: user.id,
      actorRole: user.role,
      request,
      summary: `Marked IPD possibility for ${leadEntityLabel} on ${body.potentialDate}`,
      metadata: {
        leadId: lead.id,
        leadRef: lead.leadRef,
        patientName: lead.patientName,
        ipdPotentialDate: potentialDate.toISOString(),
        markedAt: markedAt.toISOString(),
      },
    })

    return successResponse(
      {
        ipdPotentialDate: potentialDate.toISOString(),
        ipdPotentialMarkedAt: markedAt.toISOString(),
      },
      'IPD possibility marked successfully'
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors.map((entry) => entry.message).join(', '), 400)
    }
    console.error('Error marking IPD possibility:', error)
    return errorResponse('Failed to mark IPD possibility', 500)
  }
}
