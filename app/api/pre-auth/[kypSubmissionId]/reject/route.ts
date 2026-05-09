import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { postCaseChatSystemMessage } from '@/lib/case-chat'
import { hasPermission } from '@/lib/rbac'
import { CaseStage, PreAuthStatus } from '@/generated/prisma/client'
import { z } from 'zod'

const rejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
  rejectionLetterUrl: z.string().url().optional(),
  rejectionLetterName: z.string().optional(),
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
      return errorResponse('Forbidden: Only Insurance team can reject pre-auth', 403)
    }

    const { kypSubmissionId } = await params
    const body = await request.json()
    const data = rejectSchema.parse(body)

    // Get KYP submission with lead and pre-auth data
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
        preAuthData: true,
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
        `Cannot reject pre-auth. Current stage: ${kypSubmission.lead.caseStage}. Pre-auth must be raised first.`,
        400
      )
    }

    if (kypSubmission.preAuthData.approvalStatus === PreAuthStatus.APPROVED) {
      return errorResponse('Pre-authorization has already been approved', 400)
    }

    if (kypSubmission.preAuthData.approvalStatus === PreAuthStatus.TEMP_APPROVED) {
      return errorResponse('Pre-authorization has already been temp approved', 400)
    }

    if (kypSubmission.preAuthData.approvalStatus === PreAuthStatus.REJECTED) {
      return errorResponse('Pre-authorization has already been rejected', 400)
    }

    // Update pre-auth status
    await prisma.preAuthorization.update({
      where: { kypSubmissionId },
      data: {
        approvalStatus: PreAuthStatus.REJECTED,
        rejectionReason: data.reason,
        rejectionLetterUrl: data.rejectionLetterUrl ?? undefined,
        handledById: user.id,
        handledAt: new Date(),
        rejectedAt: new Date(),
        // Auto-release any active hold when rejection is recorded
        holdReason: null,
        heldAt: null,
        heldById: null,
      },
    })

    // Create stage history entry (keep at PREAUTH_RAISED but mark as rejected)
    await prisma.caseStageHistory.create({
      data: {
        leadId: kypSubmission.lead.id,
        fromStage: CaseStage.PREAUTH_RAISED,
        toStage: CaseStage.PREAUTH_RAISED, // Stay in same stage
        changedById: user.id,
        note: `Pre-authorization rejected by Insurance. Reason: ${data.reason}`,
      },
    })

    await postCaseChatSystemMessage(kypSubmission.lead.id, `Insurance rejected pre-auth — ${data.reason}`)

    // Notify BD
    await prisma.notification.create({
      data: {
        userId: kypSubmission.lead.bdId,
        type: 'PREAUTH_RAISED', // Using existing type, but message will indicate rejection
        title: 'Pre-Authorization Rejected',
        message: `Pre-authorization has been rejected for ${kypSubmission.lead.patientName} (${kypSubmission.lead.leadRef}). Reason: ${data.reason}`,
        link: `/patient/${kypSubmission.lead.id}/pre-auth`,
        relatedId: kypSubmission.preAuthData.id,
      },
    })

    return successResponse(
      { message: 'Pre-authorization rejected successfully' },
      'Pre-authorization rejected successfully'
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data: ' + error.errors.map(e => e.message).join(', '), 400)
    }
    console.error('Error rejecting pre-auth:', error)
    return errorResponse('Failed to reject pre-authorization', 500)
  }
}
