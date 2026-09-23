import { leadIdSchema } from '@/lib/lead-id'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { canMutateLead } from '@/lib/lead-access-api'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { postCaseChatSystemMessage } from '@/lib/case-chat'
import { isSalesLeadWorkerRole } from '@/lib/sales-hierarchy-roles'
import { z } from 'zod'
import { PipelineStage } from '@/generated/prisma/client'

const LOST_REASONS = ['Patient Declined', 'Ghosted', 'Financial Issue', 'Other'] as const

const markLostSchema = z.object({
  lostReason: z.enum(LOST_REASONS),
  lostReasonDetail: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (
      !isSalesLeadWorkerRole(user.role) &&
      user.role !== 'EXECUTIVE_ASSISTANT' &&
      user.role !== 'ADMIN'
    ) {
      return errorResponse('Forbidden: Only BD / TL / EA or Admin can mark a case as lost', 403)
    }

    const { id: rawLeadId } = await params
    const parsedLeadId = leadIdSchema.safeParse(rawLeadId)
    if (!parsedLeadId.success) return errorResponse('Invalid lead ID', 400)
    const leadId = parsedLeadId.data
    const body = await request.json()
    const data = markLostSchema.parse(body)

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        pipelineStage: true,
        patientName: true,
        leadRef: true,
        bdId: true,
      },
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    if (lead.pipelineStage === PipelineStage.LOST) {
      return errorResponse('Case is already marked as lost', 400)
    }

    if (!(await canMutateLead(user, lead.bdId))) {
      return errorResponse('You do not have permission to mark this case as lost', 403)
    }

    const fullReason = data.lostReasonDetail?.trim()
      ? `${data.lostReason}: ${data.lostReasonDetail}`
      : data.lostReason

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        pipelineStage: PipelineStage.LOST,
        lostReason: fullReason,
        lostAt: new Date(),
      },
    })

    await prisma.leadStageEvent.create({
      data: {
        leadId,
        fromStage: lead.pipelineStage,
        toStage: PipelineStage.LOST,
        changedById: user.id,
        note: fullReason,
      },
    })

    await postCaseChatSystemMessage(leadId, `BD marked case lost — ${fullReason}`)

    return successResponse(
      { pipelineStage: PipelineStage.LOST, lostReason: fullReason },
      'Case marked as lost'
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data: ' + error.errors.map((e) => e.message).join(', '), 400)
    }
    console.error('Error marking lead as lost:', error)
    return errorResponse('Failed to mark as lost', 500)
  }
}
