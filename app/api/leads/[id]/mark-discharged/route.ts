import { leadIdSchema } from '@/lib/lead-id'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { postCaseChatSystemMessage } from '@/lib/case-chat'
import { z } from 'zod'
import { CaseStage } from '@/generated/prisma/client'

const markDischargedSchema = z.object({
  dischargeDate: z.string().min(1, 'Discharge date is required'),
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

    if (!['INSURANCE', 'INSURANCE_HEAD', 'ADMIN', 'TESTER'].includes(user.role)) {
      return errorResponse('Forbidden: Only Insurance can mark discharged', 403)
    }

    const { id: rawLeadId } = await params
    const parsedLeadId = leadIdSchema.safeParse(rawLeadId)
    if (!parsedLeadId.success) return errorResponse('Invalid lead ID', 400)
    const leadId = parsedLeadId.data
    const body = await request.json()
    const data = markDischargedSchema.parse(body)

    const dischargeDate = new Date(data.dischargeDate)
    if (Number.isNaN(dischargeDate.getTime())) {
      return errorResponse('Invalid discharge date', 400)
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        leadRef: true,
        patientName: true,
        bdId: true,
        caseStage: true,
        insuranceInitiateForm: { select: { id: true } },
        dischargeSheet: { select: { id: true } },
      },
    })

    if (!lead) return errorResponse('Lead not found', 404)

    if (lead.caseStage !== CaseStage.IPD_DONE) {
      return errorResponse(
        `Cannot mark discharged. Current stage: ${lead.caseStage}. BD must mark IPD Done first.`,
        400
      )
    }
    if (!lead.insuranceInitiateForm?.id) {
      return errorResponse(
        'Initiate form must be filled before marking discharged.',
        400
      )
    }
    if (lead.dischargeSheet?.id) {
      return errorResponse('Discharge already marked for this lead.', 400)
    }

    const sheet = await prisma.dischargeSheet.create({
      data: {
        leadId,
        createdById: user.id,
        markedById: user.id,
        markedAt: new Date(),
        dischargeDate,
        isFinalized: false,
        status: 'DISCHARGED',
        paymentType: 'INSURANCE',
      },
    })

    await prisma.lead.update({
      where: { id: leadId },
      data: { caseStage: CaseStage.DISCHARGED },
    })

    await prisma.caseStageHistory.create({
      data: {
        leadId,
        fromStage: CaseStage.IPD_DONE,
        toStage: CaseStage.DISCHARGED,
        changedById: user.id,
        note: `Insurance marked patient discharged (${dischargeDate.toISOString().slice(0, 10)})`,
      },
    })

    await postCaseChatSystemMessage(
      leadId,
      `Insurance marked patient discharged on ${dischargeDate.toISOString().slice(0, 10)}. Discharge sheet needs to be filled next.`
    )

    // Notify BD that their patient is officially out and that a discharge sheet
    // is now expected. Pipeline stays on INSURANCE — PL is only triggered when
    // the sheet is finalized.
    if (lead.bdId && lead.bdId !== user.id) {
      await prisma.notification.create({
        data: {
          userId: lead.bdId,
          type: 'KYP_SUBMITTED',
          title: 'Patient marked discharged',
          message: `${lead.patientName} (${lead.leadRef}) was marked discharged by Insurance.`,
          link: `/patient/${leadId}/discharge`,
          relatedId: String(leadId),
        },
      })
    }

    return successResponse({ dischargeSheetId: sheet.id, caseStage: CaseStage.DISCHARGED }, 'Patient marked discharged')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data: ' + error.errors.map((e) => e.message).join(', '), 400)
    }
    console.error('Error marking discharged:', error)
    return errorResponse('Failed to mark discharged', 500)
  }
}
