import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { postCaseChatSystemMessage } from '@/lib/case-chat'
import { canResetPatient } from '@/lib/case-permissions'
import { z } from 'zod'
import { CaseStage, PreAuthStatus } from '@/generated/prisma/client'

const CONFIRMATION_PHRASE = 'yes reset this lead'

const resetPatientSchema = z.object({
  confirmation: z.string(),
  reason: z.string().min(1, 'Reason is required'),
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

    const { id: leadId } = await params
    const body = await request.json()
    const data = resetPatientSchema.parse(body)

    if (data.confirmation.trim().toLowerCase() !== CONFIRMATION_PHRASE) {
      return errorResponse(`Confirmation phrase must be "${CONFIRMATION_PHRASE}"`, 400)
    }

    const reason = data.reason.trim()
    if (!reason) {
      return errorResponse('Reason is required', 400)
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        leadRef: true,
        patientName: true,
        bdId: true,
        caseStage: true,
        pipelineStage: true,
        flowType: true,
        kypSubmission: { select: { id: true } },
        insuranceInitiateForm: { select: { id: true } },
      },
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    if (!canResetPatient(user, lead as any)) {
      return errorResponse(
        `Cannot reset patient. Current stage: ${lead.caseStage}. Reset is only allowed at PREAUTH_RAISED, PREAUTH_COMPLETE, or INITIATED for insurance-flow patients, and only by Insurance / Admin.`,
        403
      )
    }

    if (!lead.kypSubmission) {
      return errorResponse('KYP submission not found for this lead', 400)
    }

    const previousStage = lead.caseStage
    const kypSubmissionId = lead.kypSubmission.id

    await prisma.$transaction([
      prisma.lead.update({
        where: { id: leadId },
        data: {
          caseStage: CaseStage.HOSPITALS_SUGGESTED,
          ipdDrName: null,
        },
      }),
      prisma.preAuthorization.update({
        where: { kypSubmissionId },
        data: {
          requestedHospitalName: null,
          requestedRoomType: null,
          expectedAdmissionDate: null,
          expectedSurgeryDate: null,
          diseaseDescription: null,
          diseaseImages: undefined,
          investigationFileUrls: undefined,
          prescriptionFiles: undefined,
          notes: null,
          bdSuggestedHospital: null,
          isNewHospitalRequest: false,
          newHospitalPreAuthRaised: false,
          approvalStatus: PreAuthStatus.PENDING,
          approvedAmount: null,
          approvalNotes: null,
          approvedAt: null,
          rejectionReason: null,
          rejectionLetterUrl: null,
          rejectedAt: null,
          preAuthRaisedAt: null,
          preAuthRaisedById: null,
          handledAt: null,
          handledById: null,
          holdReason: null,
          heldAt: null,
          heldById: null,
        },
      }),
      prisma.kYPSubmission.update({
        where: { id: kypSubmissionId },
        data: {
          prescriptionFileUrl: null,
          diseasePhotos: undefined,
          otherFiles: undefined,
          status: 'KYP_DETAILS_ADDED',
        },
      }),
      prisma.insuranceInitiateForm.deleteMany({ where: { leadId } }),
      prisma.admissionRecord.deleteMany({ where: { leadId } }),
      prisma.caseStageHistory.create({
        data: {
          leadId,
          fromStage: previousStage,
          toStage: CaseStage.HOSPITALS_SUGGESTED,
          changedById: user.id,
          note: `Patient reset by ${user.name} — Reason: ${reason}`,
        },
      }),
    ])

    await postCaseChatSystemMessage(
      leadId,
      `Insurance reset the patient back to Hospitals Suggested. Reason: ${reason}`
    )

    const insuranceHeads = await prisma.user.findMany({
      where: { role: 'INSURANCE_HEAD' },
      select: { id: true },
    })

    const recipients = new Set<string>()
    if (lead.bdId) recipients.add(lead.bdId)
    insuranceHeads.forEach((u) => recipients.add(u.id))
    recipients.delete(user.id)

    if (recipients.size > 0) {
      await prisma.notification.createMany({
        data: Array.from(recipients).map((userId) => ({
          userId,
          type: 'KYP_SUBMITTED' as const,
          title: 'Patient reset',
          message: `${user.name} reset ${lead.patientName} (${lead.leadRef}) back to Hospitals Suggested. Reason: ${reason}`,
          link: `/patient/${leadId}/pre-auth`,
          relatedId: leadId,
        })),
      })
    }

    return successResponse(
      { caseStage: CaseStage.HOSPITALS_SUGGESTED },
      'Patient reset to Hospitals Suggested'
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(
        'Invalid request data: ' + error.errors.map((e) => e.message).join(', '),
        400
      )
    }
    console.error('Error resetting patient:', error)
    return errorResponse('Failed to reset patient', 500)
  }
}
