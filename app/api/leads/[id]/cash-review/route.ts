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

    const { id } = await params
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
    const newAtsStatus = action === 'APPROVE' ? ATSStatus.APPROVED : ATSStatus.ON_HOLD
    const note = reason || (action === 'APPROVE' ? 'Cash case approved' : 'Cash case put on hold')

    // Update lead stage and ATS status
    await prisma.lead.update({
      where: { id },
      data: {
        caseStage: newStage,
        atsStatus: newAtsStatus,
      },
    })

    // Create stage history
    await prisma.caseStageHistory.create({
      data: {
        leadId: id,
        fromStage: lead.caseStage,
        toStage: newStage,
        changedById: user.id,
        note,
      },
    })

    // Create audit log with ATS context
    await prisma.leadAudit.create({
      data: {
        leadId: id,
        action: 'cash_review',
        userId: user.id,
        details: {
          action,
          reason: reason || null,
          treatmentName: lead.treatment,
          treatmentId: lead.treatmentMasterId,
          atsAmount: lead.atsAmount,
          approvedAmount: lead.settledTotal,
          atsStatus: newAtsStatus,
          caseStage: newStage,
        },
      },
    })

    // Post system message
    await prisma.caseChatMessage.create({
      data: {
        leadId: id,
        type: 'SYSTEM',
        content: `Cash Review: ${action} by ${user.name}. ${reason ? `Reason: ${reason}` : ''}`,
      },
    })

    // Notify BD
    await prisma.notification.create({
      data: {
        userId: lead.bdId,
        type: NotificationType.CASE_CHAT_MESSAGE,
        title: `Cash Case ${action === 'APPROVE' ? 'Approved' : 'On Hold'}`,
        message: `Your cash case for ${lead.patientName} has been ${action === 'APPROVE' ? 'approved' : 'put on hold'}.`,
        relatedId: id,
        link: `/patient/${id}`,
      },
    })

    // Return ATS context in response
    return successResponse({
      stage: newStage,
      atsStatus: newAtsStatus,
      requiresApproval: lead.atsStatus === 'BELOW_ATS' || (lead.atsAmount && lead.settledTotal < lead.atsAmount),
    }, 'Review submitted successfully')
  } catch (error) {
    console.error('Error reviewing cash case:', error)
    if (error instanceof z.ZodError) {
      return errorResponse('Validation failed', 400)
    }
    return errorResponse('Failed to submit review', 500)
  }
}
