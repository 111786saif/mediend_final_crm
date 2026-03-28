import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'
import { CaseStage, FlowType, NotificationType } from '@/generated/prisma/client'

const dischargeCashSchema = z.object({
  leadId: z.string(),
  dischargeDate: z.string(),
  finalAmount: z.number(),
  remarks: z.string().optional(),
  
  // Documents
  finalBillUrl: z.string(),
  settlementLetterUrl: z.string(),
  
  // Bill Breakup
  roomRentAmount: z.number(),
  pharmacyAmount: z.number(),
  investigationAmount: z.number(),
  consumablesAmount: z.number(),
  implantsAmount: z.number().optional().default(0),
  instrumentsAmount: z.number().optional().default(0),
  totalFinalBill: z.number(),
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
      include: {
        bd: {
          include: {
            employee: {
              include: {
                team: {
                  include: {
                    teamLead: { include: { user: { select: { name: true } } } },
                    department: { include: { head: { select: { name: true } } } },
                  },
                },
              },
            },
          },
        },
        admissionRecord: { select: { admissionDate: true } },
      },
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    if (lead.flowType !== FlowType.CASH) {
      return errorResponse('Not a cash flow case', 400)
    }

    // Create discharge sheet
    const admissionDate = lead.admissionRecord?.admissionDate ?? null
    const instrumentsCostNum = validatedData.instrumentsAmount ?? 0

    const dischargeSheet = await prisma.dischargeSheet.create({
      data: {
        leadId: validatedData.leadId,
        dischargeDate: new Date(validatedData.dischargeDate),
        admissionDate,
        surgeryDate: lead.surgeryDate,
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
      data: {
        leadId: validatedData.leadId,
        month: new Date(),
        admissionDate,
        surgeryDate: lead.surgeryDate,
        status: 'DISCHARGED',
        paymentType: 'CASH',
        approvedOrCash: 'CASH',
        patientName: lead.patientName,
        patientPhone: lead.phoneNumber,
        hospitalName: lead.hospitalName,
        category: lead.category,
        treatment: lead.treatment,
        circle: lead.circle,
        totalAmount: validatedData.totalFinalBill,
        billAmount: validatedData.finalAmount,
        cashPaidByPatient: validatedData.finalAmount,
        instrumentsCost: instrumentsCostNum,
        bdmName: lead.bd.name,
        managerName:
          lead.bd.employee?.team?.teamLead?.user?.name
          ?? lead.bd.employee?.team?.department?.head?.name
          ?? null,
        doctorName: lead.surgeonName || lead.ipdDrName,
        hospitalSharePct: 0,
        hospitalShareAmount: 0,
        mediendSharePct: 0,
        mediendShareAmount: 0,
        mediendNetProfit: 0,
        finalProfit: 0,
        hospitalPayoutStatus: 'PENDING',
        doctorPayoutStatus: 'PENDING',
        mediendInvoiceStatus: 'PENDING',
        handledById: user.id,
      },
    })

    await prisma.dischargeSheet.update({
      where: { id: dischargeSheet.id },
      data: { plRecordId: plRecord.id },
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
