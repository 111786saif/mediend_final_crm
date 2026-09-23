import { leadIdSchema } from '@/lib/lead-id'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'
import { CaseStage, FlowType, NotificationType, ATSStatus } from '@/generated/prisma/client'

const reviewSchema = z.object({
  action: z.enum(['APPROVE', 'HOLD']),
  reason: z.string().optional(),
})

function resolveLeadAtsStatus(atsAmount: number | null | undefined, approvedAmount: number | null | undefined) {
  if (atsAmount == null || atsAmount <= 0) return ATSStatus.NO_ATS
  if ((approvedAmount ?? 0) >= atsAmount) return ATSStatus.ABOVE_ATS
  return ATSStatus.BELOW_ATS
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

    // Only INSURANCE, INSURANCE_HEAD, or ADMIN can review cash cases
    if (!['INSURANCE', 'INSURANCE_HEAD', 'ADMIN'].includes(user.role)) {
      return errorResponse('Forbidden', 403)
    }

    const { id: rawLeadId } = await params
    const parsedLeadId = leadIdSchema.safeParse(rawLeadId)
    if (!parsedLeadId.success) return errorResponse('Invalid lead ID', 400)
    const id = parsedLeadId.data
    const body = await request.json()
    const { action, reason } = reviewSchema.parse(body)

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        treatmentMaster: {
          select: {
            id: true,
            name: true,
            category: true,
            atsNewDelhi: true,
            atsMumbai: true,
            atsPune: true,
            atsHyderabad: true,
            atsBangalore: true,
          },
        },
      },
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    if (lead.flowType !== FlowType.CASH) {
      return errorResponse('Not a cash flow case', 400)
    }

    if (lead.caseStage !== CaseStage.CASH_IPD_SUBMITTED && lead.caseStage !== CaseStage.CASH_ON_HOLD) {
      return errorResponse('Case is not pending review', 400)
    }

    const newStage = action === 'APPROVE' ? CaseStage.CASH_APPROVED : CaseStage.CASH_ON_HOLD
    const newAtsStatus = resolveLeadAtsStatus(lead.atsAmount, lead.settledTotal)
    const note = reason || (action === 'APPROVE' ? 'Cash case approved' : 'Cash case put on hold')

    await prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id },
        data: {
          caseStage: newStage,
          atsStatus: newAtsStatus,
        },
      })

      await tx.caseStageHistory.create({
        data: {
          leadId: id,
          fromStage: lead.caseStage,
          toStage: newStage,
          changedById: user.id,
          note,
        },
      })

      await tx.caseChatMessage.create({
        data: {
          leadId: id,
          type: 'SYSTEM',
          content: `Cash Review: ${action} by ${user.name}. ${reason ? `Reason: ${reason}` : ''}`,
        },
      })
    })

    try {
      await prisma.notification.create({
        data: {
          userId: lead.bdId,
          type: NotificationType.CASE_CHAT_MESSAGE,
          title: `Cash Case ${action === 'APPROVE' ? 'Approved' : 'On Hold'}`,
          message: `Your cash case for ${lead.patientName} has been ${action === 'APPROVE' ? 'approved' : 'put on hold'}.`,
          relatedId: String(id),
          link: `/patient/${id}`,
        },
      })
    } catch (notificationError) {
      console.error('Cash review succeeded but BD notification failed:', notificationError)
    }

    // Return ATS context in response
    return successResponse({
      stage: newStage,
      atsStatus: newAtsStatus,
      requiresApproval: newAtsStatus === ATSStatus.BELOW_ATS,
    }, 'Review submitted successfully')
  } catch (error) {
    console.error('Error reviewing cash case:', error)
    if (error instanceof z.ZodError) {
      return errorResponse('Validation failed', 400)
    }
    return errorResponse('Failed to submit review', 500)
  }
}
