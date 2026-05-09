import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { postCaseChatSystemMessage } from '@/lib/case-chat'
import { hasPermission } from '@/lib/rbac'
import { CaseStage, PreAuthStatus } from '@/generated/prisma/client'
import { z } from 'zod'

const holdSchema = z.object({
  reason: z.string().min(1, 'Hold reason is required'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ kypSubmissionId: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'insurance:write')) {
      return errorResponse('Forbidden: Only Insurance team can hold pre-auth', 403)
    }

    const { kypSubmissionId } = await params
    const body = await request.json()
    const data = holdSchema.parse(body)
    const reason = data.reason.trim()

    const kypSubmission = await prisma.kYPSubmission.findUnique({
      where: { id: kypSubmissionId },
      include: {
        lead: {
          select: {
            id: true,
            leadRef: true,
            patientName: true,
            bdId: true,
            caseStage: true,
          },
        },
        preAuthData: { select: { id: true, approvalStatus: true } },
      },
    })

    if (!kypSubmission) {
      return errorResponse('KYP submission not found', 404)
    }
    if (!kypSubmission.preAuthData) {
      return errorResponse('Pre-authorization data not found', 400)
    }

    if (kypSubmission.lead.caseStage !== CaseStage.PREAUTH_RAISED) {
      return errorResponse(
        `Cannot hold pre-auth. Current stage: ${kypSubmission.lead.caseStage}. Hold is only available while pre-auth is raised.`,
        400
      )
    }

    const currentStatus = kypSubmission.preAuthData.approvalStatus
    if (
      currentStatus === PreAuthStatus.APPROVED ||
      currentStatus === PreAuthStatus.TEMP_APPROVED ||
      currentStatus === PreAuthStatus.REJECTED
    ) {
      return errorResponse(
        `Cannot hold pre-auth. It is already ${currentStatus.toLowerCase()}.`,
        400
      )
    }

    await prisma.preAuthorization.update({
      where: { kypSubmissionId },
      data: {
        approvalStatus: PreAuthStatus.ON_HOLD,
        holdReason: reason,
        heldAt: new Date(),
        heldById: user.id,
      },
    })

    await prisma.caseStageHistory.create({
      data: {
        leadId: kypSubmission.lead.id,
        fromStage: CaseStage.PREAUTH_RAISED,
        toStage: CaseStage.PREAUTH_RAISED,
        changedById: user.id,
        note: `Pre-authorization put on hold by Insurance. Reason: ${reason}`,
      },
    })

    await postCaseChatSystemMessage(
      kypSubmission.lead.id,
      `Insurance put pre-auth on hold — ${reason}`
    )

    if (kypSubmission.lead.bdId) {
      await prisma.notification.create({
        data: {
          userId: kypSubmission.lead.bdId,
          type: 'PREAUTH_RAISED',
          title: 'Pre-Auth On Hold',
          message: `Insurance has put pre-auth on hold for ${kypSubmission.lead.patientName} (${kypSubmission.lead.leadRef}). Reason: ${reason}`,
          link: `/patient/${kypSubmission.lead.id}/pre-auth`,
          relatedId: kypSubmission.preAuthData.id,
        },
      })
    }

    return successResponse({ status: PreAuthStatus.ON_HOLD }, 'Pre-auth put on hold')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(
        'Invalid request data: ' + error.errors.map((e) => e.message).join(', '),
        400
      )
    }
    console.error('Error holding pre-auth:', error)
    return errorResponse('Failed to put pre-auth on hold', 500)
  }
}
