import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { postCaseChatSystemMessage } from '@/lib/case-chat'
import { hasPermission } from '@/lib/rbac'
import { CaseStage, PreAuthStatus } from '@/generated/prisma/client'
import { z } from 'zod'

const approveSchema = z.object({
  approvalStatus: z.enum(['APPROVED', 'TEMP_APPROVED']),
  approvedAmount: z.number().min(0, 'Approved amount must be positive'),
  approvalNotes: z.string().optional(),
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
      return errorResponse('Forbidden: Only Insurance team can approve pre-auth', 403)
    }

    const { kypSubmissionId } = await params
    const body = await request.json()
    const data = approveSchema.parse(body)

    // Get KYP submission with lead and pre-auth data (including suggested hospitals for ipdDrName)
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
        preAuthData: { include: { suggestedHospitals: true } },
      },
    })

    if (!kypSubmission) {
      return errorResponse('KYP submission not found', 404)
    }

    if (!kypSubmission.preAuthData) {
      return errorResponse('Pre-authorization data not found', 400)
    }

    const currentStage = kypSubmission.lead.caseStage
    const currentStatus = kypSubmission.preAuthData.approvalStatus

    // ── Path A: upgrade TEMP_APPROVED → APPROVED ────────────────────────────────
    const isUpgrade =
      currentStage === CaseStage.PREAUTH_COMPLETE &&
      currentStatus === PreAuthStatus.TEMP_APPROVED &&
      data.approvalStatus === 'APPROVED'

    // ── Path B: initial approval (PREAUTH_RAISED, PENDING → APPROVED/TEMP) ──────
    const isInitial = currentStage === CaseStage.PREAUTH_RAISED

    if (!isUpgrade && !isInitial) {
      return errorResponse(
        `Cannot approve pre-auth. Current stage: ${currentStage}, status: ${currentStatus}.`,
        400
      )
    }

    if (currentStatus === PreAuthStatus.APPROVED) {
      return errorResponse('Pre-authorization has already been fully approved', 400)
    }

    if (currentStatus === PreAuthStatus.REJECTED) {
      return errorResponse('Pre-authorization has already been rejected', 400)
    }

    // Prevent re-temp-approving an already temp-approved case
    if (currentStatus === PreAuthStatus.TEMP_APPROVED && data.approvalStatus === 'TEMP_APPROVED') {
      return errorResponse('Pre-authorization is already temporarily approved', 400)
    }

    const statusMap = {
      APPROVED: PreAuthStatus.APPROVED,
      TEMP_APPROVED: PreAuthStatus.TEMP_APPROVED,
    }

    await prisma.preAuthorization.update({
      where: { kypSubmissionId },
      data: {
        approvalStatus: statusMap[data.approvalStatus],
        approvedAmount: data.approvedAmount,
        approvalNotes: data.approvalNotes?.trim() || undefined,
        handledById: user.id,
        handledAt: new Date(),
        approvedAt: new Date(),
        // Auto-release any active hold when a decision is made
        holdReason: null,
        heldAt: null,
        heldById: null,
      },
    })

    if (isInitial) {
      // First-time approval — advance stage
      await prisma.kYPSubmission.update({
        where: { id: kypSubmissionId },
        data: { status: 'PRE_AUTH_COMPLETE' },
      })

      // Set lead.ipdDrName from selected hospital's suggestedDoctor (BD's requested hospital)
      const requestedName = kypSubmission.preAuthData.requestedHospitalName?.trim()
      const selectedHospital = requestedName && kypSubmission.preAuthData.suggestedHospitals
        ? kypSubmission.preAuthData.suggestedHospitals.find(
            (h) => h.hospitalName.trim().toLowerCase() === requestedName.toLowerCase()
          )
        : null
      const ipdDrNameFromPreAuth = selectedHospital?.suggestedDoctor?.trim() || null
      // Write the approved hospital back onto the lead so every dashboard shows
      // the post-approval hospital (mirrors how ipdDrName is persisted here).
      const approvedHospitalName = selectedHospital?.hospitalName?.trim() || requestedName || null

      await prisma.lead.update({
        where: { id: kypSubmission.lead.id },
        data: {
          caseStage: CaseStage.PREAUTH_COMPLETE,
          ...(ipdDrNameFromPreAuth ? { ipdDrName: ipdDrNameFromPreAuth } : {}),
          ...(approvedHospitalName ? { hospitalName: approvedHospitalName } : {}),
        },
      })

      await prisma.caseStageHistory.create({
        data: {
          leadId: kypSubmission.lead.id,
          fromStage: CaseStage.PREAUTH_RAISED,
          toStage: CaseStage.PREAUTH_COMPLETE,
          changedById: user.id,
          note: `Pre-authorization ${data.approvalStatus === 'TEMP_APPROVED' ? 'temp ' : ''}approved by Insurance`,
        },
      })
    } else {
      // Upgrade — stage already at PREAUTH_COMPLETE, just record history
      await prisma.caseStageHistory.create({
        data: {
          leadId: kypSubmission.lead.id,
          fromStage: CaseStage.PREAUTH_COMPLETE,
          toStage: CaseStage.PREAUTH_COMPLETE,
          changedById: user.id,
          note: 'Pre-authorization upgraded from temporary to full approval by Insurance',
        },
      })
    }

    const statusMsg = data.approvalStatus === 'TEMP_APPROVED' ? 'temp approved' : 'approved'
    const chatMsg = isUpgrade
      ? 'Insurance upgraded pre-auth from temporary to full approval.'
      : `Insurance ${statusMsg} pre-auth.`
    await postCaseChatSystemMessage(kypSubmission.lead.id, chatMsg)

    // Notify BD
    await prisma.notification.create({
      data: {
        userId: kypSubmission.lead.bdId,
        type: 'PRE_AUTH_COMPLETE',
        title: isUpgrade
          ? 'Pre-Authorization Fully Approved'
          : `Pre-Authorization ${data.approvalStatus === 'TEMP_APPROVED' ? 'Temp ' : ''}Approved`,
        message: isUpgrade
          ? `Pre-authorization for ${kypSubmission.lead.patientName} (${kypSubmission.lead.leadRef}) has been upgraded to full approval.`
          : `Pre-authorization has been ${statusMsg} for ${kypSubmission.lead.patientName} (${kypSubmission.lead.leadRef}). You can now proceed with admission.`,
        link: `/patient/${kypSubmission.lead.id}/pre-auth`,
        relatedId: kypSubmission.preAuthData.id,
      },
    })

    return successResponse(
      { message: `Pre-authorization ${statusMsg} successfully` },
      `Pre-authorization ${statusMsg} successfully`
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error approving pre-auth:', error)
    return errorResponse('Failed to approve pre-authorization', 500)
  }
}
