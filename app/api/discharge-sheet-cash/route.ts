import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'
import { CaseStage, FlowType, NotificationType } from '@/generated/prisma/client'
import {
  LEAD_HYDRATE_INCLUDE,
  buildDischargeSheetDefaults,
  buildPlRecordPayload,
} from '@/lib/pl/hydrate-pl-record'

const dischargeCashSchema = z.object({
  leadId: z.string(),
  dischargeDate: z.string(),
  finalAmount: z.number(),
  remarks: z.string().optional(),
  
  // Documents
  finalBillUrl: z.string(),
  settlementLetterUrl: z.string().optional().default(''),
  
  // Bill Breakup (optional for cash flow)
  roomRentAmount: z.number().optional().default(0),
  pharmacyAmount: z.number().optional().default(0),
  investigationAmount: z.number().optional().default(0),
  consumablesAmount: z.number().optional().default(0),
  implantsAmount: z.number().optional().default(0),
  instrumentsAmount: z.number().optional().default(0),
  totalFinalBill: z.number(),

  // Cash extras
  packageText: z.string().optional(),
  othersText: z.string().optional(),

  // Bill extras shared with the insurance flow
  otherCharges: z.string().optional(),
  packageAmount: z.string().optional(),
  staplerCharges: z.enum(['INCLUDED', 'OPEN']).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    // Only INSURANCE, INSURANCE_HEAD, or ADMIN can create discharge sheets
    if (!['INSURANCE', 'INSURANCE_HEAD', 'ADMIN'].includes(user.role)) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const validatedData = dischargeCashSchema.parse(body)

    const lead = await prisma.lead.findUnique({
      where: { id: validatedData.leadId },
      include: LEAD_HYDRATE_INCLUDE,
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    if (lead.flowType !== FlowType.CASH) {
      return errorResponse('Not a cash flow case', 400)
    }

    // Create discharge sheet — hydrate all people/case/date fields from the
    // lead so the DischargeSheet row is a complete audit record and the
    // downstream PLRecord can copy straight from it.
    const defaults = buildDischargeSheetDefaults(lead)
    const instrumentsCostNum = validatedData.instrumentsAmount ?? 0

    const dischargeSheet = await prisma.dischargeSheet.create({
      data: {
        ...defaults,
        leadId: validatedData.leadId,
        dischargeDate: new Date(validatedData.dischargeDate),
        finalAmount: validatedData.finalAmount,
        remarks: validatedData.remarks,

        // Documents
        finalBillUrl: validatedData.finalBillUrl,
        settlementLetterUrl: validatedData.settlementLetterUrl,

        // Bill Breakup
        roomRentAmount: validatedData.roomRentAmount,
        pharmacyAmount: validatedData.pharmacyAmount,
        investigationAmount: validatedData.investigationAmount,
        consumablesAmount: validatedData.consumablesAmount,
        implantsAmount: validatedData.implantsAmount,
        instrumentsAmount: validatedData.instrumentsAmount,
        instrumentsCost: instrumentsCostNum,
        totalFinalBill: validatedData.totalFinalBill,
        billAmount: validatedData.finalAmount,
        totalAmount: validatedData.totalFinalBill,
        cashPaidByPatient: validatedData.finalAmount,
        packageText: validatedData.packageText,
        othersText: validatedData.othersText,
        otherCharges: validatedData.otherCharges,
        packageAmount: validatedData.packageAmount,
        staplerCharges: validatedData.staplerCharges,

        paymentType: 'CASH',
        approvedOrCash: 'CASH',
        createdById: user.id,
        status: 'DISCHARGED',
      },
    })

    // Update lead stage
    await prisma.lead.update({
      where: { id: validatedData.leadId },
      data: {
        caseStage: CaseStage.CASH_DISCHARGED,
        pipelineStage: 'PL', // Move to PL stage
      },
    })

    // Create stage history
    await prisma.caseStageHistory.create({
      data: {
        leadId: validatedData.leadId,
        fromStage: lead.caseStage,
        toStage: CaseStage.CASH_DISCHARGED,
        changedById: user.id,
        note: 'Cash Discharge Sheet Created',
      },
    })

    // Post system message
    await prisma.caseChatMessage.create({
      data: {
        leadId: validatedData.leadId,
        type: 'SYSTEM',
        content: `Discharge Sheet (Cash) created by ${user.name}. Case moved to PL stage.`,
      },
    })

    // Create PL Record (Auto-create)
    const plRecord = await prisma.pLRecord.create({
      data: buildPlRecordPayload({
        lead,
        dischargeSheet,
        userId: user.id,
        overrides: {
          paymentType: 'CASH',
          approvedOrCash: 'CASH',
          cashPaidByPatient: validatedData.finalAmount,
          billAmount: validatedData.finalAmount,
          totalAmount: validatedData.totalFinalBill,
          instrumentsCost: instrumentsCostNum,
        },
      }),
    })

    await prisma.dischargeSheet.update({
      where: { id: dischargeSheet.id },
      data: { plRecordId: plRecord.id },
    })

    // Auto-create compliance call row for post-discharge patient feedback
    await prisma.complianceCall.upsert({
      where: { leadId: validatedData.leadId },
      create: { leadId: validatedData.leadId },
      update: {},
    })

    // Notify BD
    await prisma.notification.create({
      data: {
        userId: lead.bdId,
        type: NotificationType.DISCHARGE_SHEET_CREATED,
        title: 'Discharge Sheet Created',
        message: `Discharge sheet created for ${lead.patientName}. Case moved to PL.`,
        relatedId: validatedData.leadId,
        link: `/patient/${validatedData.leadId}/discharge-cash`,
      },
    })

    return successResponse(dischargeSheet, 'Discharge sheet created successfully')
  } catch (error) {
    console.error('Error creating discharge sheet:', error)
    if (error instanceof z.ZodError) {
      return errorResponse('Validation failed', 400)
    }
    return errorResponse('Failed to create discharge sheet', 500)
  }
}
