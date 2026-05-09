import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { postCaseChatSystemMessage } from '@/lib/case-chat'
import { hasPermission } from '@/lib/rbac'
import { CaseStage, PreAuthStatus } from '@/generated/prisma/client'

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
      return errorResponse('Forbidden: Only Insurance team can release a hold', 403)
    }

    const { kypSubmissionId } = await params

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

    if (kypSubmission.preAuthData.approvalStatus !== PreAuthStatus.ON_HOLD) {
      return errorResponse('Pre-auth is not currently on hold', 400)
    }

    await prisma.preAuthorization.update({
      where: { kypSubmissionId },
      data: {
        approvalStatus: PreAuthStatus.PENDING,
        holdReason: null,
        heldAt: null,
        heldById: null,
      },
    })

    await prisma.caseStageHistory.create({
      data: {
        leadId: kypSubmission.lead.id,
        fromStage: CaseStage.PREAUTH_RAISED,
        toStage: CaseStage.PREAUTH_RAISED,
        changedById: user.id,
        note: 'Pre-authorization hold released by Insurance',
      },
    })

    await postCaseChatSystemMessage(
      kypSubmission.lead.id,
      'Insurance released the hold on pre-auth.'
    )

    if (kypSubmission.lead.bdId) {
      await prisma.notification.create({
        data: {
          userId: kypSubmission.lead.bdId,
          type: 'PREAUTH_RAISED',
          title: 'Pre-Auth Hold Released',
          message: `Insurance released the hold on pre-auth for ${kypSubmission.lead.patientName} (${kypSubmission.lead.leadRef}).`,
          link: `/patient/${kypSubmission.lead.id}/pre-auth`,
          relatedId: kypSubmission.preAuthData.id,
        },
      })
    }

    return successResponse({ status: PreAuthStatus.PENDING }, 'Hold released')
  } catch (error) {
    console.error('Error releasing pre-auth hold:', error)
    return errorResponse('Failed to release hold', 500)
  }
}
