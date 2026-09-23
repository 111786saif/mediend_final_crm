import { optionalLeadId } from '@/lib/lead-id'
import { leadIdSchema } from '@/lib/lead-id'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { postCaseChatSystemMessage } from '@/lib/case-chat'
import { z } from 'zod'
import { CaseStage } from '@/generated/prisma/client'
import { maskPhoneNumber } from '@/lib/phone-utils'
import {
  LEAD_HYDRATE_INCLUDE,
  buildDischargeSheetDefaults,
  buildPlRecordPayload,
} from '@/lib/pl/hydrate-pl-record'

const createDischargeSheetSchema = z.object({
  leadId: leadIdSchema,
  kypSubmissionId: z.string().optional(),
  // Core Identification
  month: z.string().optional(),
  dischargeDate: z.string().min(1, 'Discharge date is required'),
  surgeryDate: z.string().optional(),
  status: z.string().optional(),
  paymentType: z.string().optional(),
  approvedOrCash: z.string().optional(),
  paymentCollectedAt: z.string().optional(),
  // People & Ownership
  managerRole: z.string().optional(),
  managerName: z.string().optional(),
  bdmName: z.string().optional(),
  patientName: z.string().optional(),
  patientPhone: z.string().optional(),
  doctorName: z.string().optional(),
  hospitalName: z.string().optional(),
  // Case Details
  category: z.string().optional(),
  treatment: z.string().optional(),
  circle: z.string().optional(),
  leadSource: z.string().optional(),
  // A. Patient & Policy additions
  tentativeAmount: z.number().optional(),
  copayPct: z.number().optional(),
  // B. Documents
  dischargeSummaryUrl: z.string().min(1, 'Discharge summary is required'),
  otNotesUrl: z.string().optional(),
  codesCount: z.number().optional(),
  finalBillUrl: z.string().min(1, 'Final bill is required'),
  finalApprovedUrl: z.string().optional(),
  deductionReceiptUrl: z.string().optional(),
  settlementLetterUrl: z.string().optional(),
  // C. Bill Breakup
  roomRentAmount: z.number().min(0, 'Room rent amount is required'),
  pharmacyAmount: z.number().min(0, 'Pharmacy amount is required'),
  investigationAmount: z.number().min(0, 'Investigation amount is required'),
  consumablesAmount: z.number().min(0, 'Consumables amount is required'),
  implantsAmount: z.number().optional(),
  instrumentsAmount: z.number().optional(),
  anesthesiaAmount: z.number().optional(),
  otherChargesAmount: z.number().optional(),
  otherCharges: z.string().optional(),
  packageAmount: z.string().optional(),
  staplerCharges: z.enum(['INCLUDED', 'OPEN']).optional(),
  totalFinalBill: z.number().optional(),
  // D. Approval & Deductions
  finalApprovedAmount: z.number().min(0, 'Final approved amount is required'),
  finalAmount: z.number().optional(),
  copayAmount: z.number().optional(),
  collectedByHospital: z.number().optional(),
  collectedByMediend: z.number().optional(),
  axisTariffDeduction: z.number().optional(),
  axisTariffDeductionPaid: z.number().optional(),
  actualFinalAmount: z.number().optional(),
  deductionAmount: z.number().optional(),
  discountAmount: z.number().optional(),
  waivedOffAmount: z.number().optional(),
  settlementPart: z.number().optional(),
  tdsAmount: z.number().optional(),
  otherDeduction: z.number().optional(),
  netSettlementAmount: z.number().optional(),
  // Financials
  totalAmount: z.number().optional(),
  billAmount: z.number().optional(),
  cashPaidByPatient: z.number().optional(),
  cashOrDedPaid: z.number().optional(),
  referralAmount: z.number().optional(),
  cabCharges: z.number().optional(),
  implantCost: z.number().optional(),
  dcCharges: z.number().optional(),
  doctorCharges: z.number().optional(),
  // Revenue Split
  hospitalSharePct: z.number().optional(),
  hospitalShareAmount: z.number().optional(),
  mediendSharePct: z.number().optional(),
  mediendShareAmount: z.number().optional(),
  mediendNetProfit: z.number().optional(),
  implantPaidBy: z.enum(['MEDIEND', 'HOSPITAL']).optional(),
  instrumentsPaidBy: z.enum(['MEDIEND', 'HOSPITAL']).optional(),
  // Meta
  remarks: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const leadId = optionalLeadId(searchParams.get('leadId'))
    const month = searchParams.get('month')

    const where: any = {}
    if (leadId) {
      where.leadId = leadId
    }
    if (month) {
      where.month = new Date(month)
    }

    const dischargeSheets = await prisma.dischargeSheet.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            leadRef: true,
            patientName: true,
            phoneNumber: true,
            hospitalName: true,
            surgeonName: true,
            ipdDrName: true,
            copay: true,
            kypSubmission: {
              select: {
                preAuthData: {
                  select: {
                    sumInsured: true,
                    roomRent: true,
                    copay: true,
                  },
                },
              },
            },
          },
        },
        kypSubmission: {
          select: {
            id: true,
            status: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        plRecord: {
          select: {
            id: true,
            finalProfit: true,
            mediendNetProfit: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Mask patientPhone if user is not INSURANCE_HEAD or ADMIN
    const canViewPhone = user.role === 'ADMIN'
    const maskedSheets = dischargeSheets.map((sheet) => ({
      ...sheet,
      patientPhone: canViewPhone ? sheet.patientPhone : (sheet.patientPhone ? maskPhoneNumber(sheet.patientPhone) : null),
    }))

    return successResponse(maskedSheets)
  } catch (error) {
    console.error('Error fetching discharge sheets:', error)
    return errorResponse('Failed to fetch discharge sheets', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    // Insurance team can finalize discharge sheets
    if (!['INSURANCE', 'INSURANCE_HEAD', 'ADMIN', 'TESTER'].includes(user.role)) {
      return errorResponse('Forbidden: Only Insurance team can fill discharge sheets', 403)
    }

    const body = await request.json()
    const data = createDischargeSheetSchema.parse(body)

    // Check if lead exists — use the full hydrate include so we can pre-fill
    // every people/case/date field on the DischargeSheet + PLRecord.
    const lead = await prisma.lead.findUnique({
      where: { id: data.leadId },
      include: LEAD_HYDRATE_INCLUDE,
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    // Two-step flow: a minimal DischargeSheet should already exist from the
    // "Mark Discharged" step (POST /api/leads/:id/mark-discharged). This POST
    // now FINALIZES that row — fills the full form, sets isFinalized=true, and
    // runs the side effects (PLRecord, pipeline → PL, compliance upsert).
    // Legacy DISCHARGED leads without any sheet are also accepted to keep old
    // data migrate-able.
    if (lead.caseStage !== CaseStage.DISCHARGED && lead.caseStage !== CaseStage.IPD_DONE) {
      return errorResponse(
        `Cannot fill discharge sheet. Current stage: ${lead.caseStage}.`,
        400
      )
    }

    const existing = await prisma.dischargeSheet.findUnique({
      where: { leadId: data.leadId },
    })

    if (existing?.isFinalized) {
      return errorResponse('Discharge sheet already finalized for this lead', 400)
    }

    // Prepare data — hydrate defaults from Lead/AdmissionRecord first, then
    // overlay whatever the client sent so client values always win.
    const defaults = buildDischargeSheetDefaults(lead)
    const instrumentsCostNum =
      data.instrumentsAmount != null ? Number(data.instrumentsAmount) : 0

    // Recompute derived financials server-side (never trust the client for these).
    const dedTotal = (data.copayAmount ?? 0) + (data.otherDeduction ?? 0)
    const dedPaidTotal = (data.collectedByHospital ?? 0) + (data.collectedByMediend ?? 0)
    const otherChargesAmount =
      (data.finalAmount ?? 0) -
      ((data.roomRentAmount ?? 0) +
        (data.pharmacyAmount ?? 0) +
        (data.investigationAmount ?? 0) +
        (data.consumablesAmount ?? 0) +
        (data.implantsAmount ?? 0) +
        instrumentsCostNum +
        (data.anesthesiaAmount ?? 0))
    const actualFinalAmount =
      (data.finalApprovedAmount ?? 0) + dedPaidTotal + (data.axisTariffDeductionPaid ?? 0)

    const dischargeData: any = {
      leadId: data.leadId,
      createdById: existing?.createdById ?? user.id,
      isFinalized: true,
      finalizedById: user.id,
      finalizedAt: new Date(),
      month: data.month ? new Date(data.month) : defaults.month,
      dischargeDate: data.dischargeDate ? new Date(data.dischargeDate) : null,
      admissionDate: defaults.admissionDate,
      surgeryDate: data.surgeryDate ? new Date(data.surgeryDate) : defaults.surgeryDate,
      status: data.status ?? 'DISCHARGED',
      paymentType: data.paymentType ?? 'INSURANCE',
      approvedOrCash: data.approvedOrCash,
      paymentCollectedAt: data.paymentCollectedAt,
      managerRole: data.managerRole,
      managerName: data.managerName ?? defaults.managerName,
      bdmName: data.bdmName ?? defaults.bdmName,
      patientName: data.patientName ?? defaults.patientName,
      patientPhone: data.patientPhone ?? defaults.patientPhone,
      doctorName: data.doctorName ?? defaults.doctorName,
      hospitalName: data.hospitalName ?? defaults.hospitalName,
      category: data.category ?? defaults.category,
      treatment: data.treatment ?? defaults.treatment,
      circle: data.circle ?? defaults.circle,
      leadSource: data.leadSource ?? defaults.leadSource,
      tentativeAmount: data.tentativeAmount,
      copayPct: data.copayPct,
      dischargeSummaryUrl: data.dischargeSummaryUrl,
      otNotesUrl: data.otNotesUrl,
      codesCount: data.codesCount,
      finalBillUrl: data.finalBillUrl,
      finalApprovedUrl: data.finalApprovedUrl,
      deductionReceiptUrl: data.deductionReceiptUrl,
      settlementLetterUrl: data.settlementLetterUrl,
      roomRentAmount: data.roomRentAmount ?? 0,
      pharmacyAmount: data.pharmacyAmount ?? 0,
      investigationAmount: data.investigationAmount ?? 0,
      consumablesAmount: data.consumablesAmount ?? 0,
      implantsAmount: data.implantsAmount ?? 0,
      instrumentsAmount: data.instrumentsAmount,
      anesthesiaAmount: data.anesthesiaAmount ?? 0,
      otherChargesAmount,
      otherCharges: data.otherCharges,
      packageAmount: data.packageAmount,
      staplerCharges: data.staplerCharges,
      totalFinalBill: data.totalFinalBill ?? 0,
      finalApprovedAmount: data.finalApprovedAmount ?? 0,
      finalAmount: data.finalAmount,
      copayAmount: data.copayAmount ?? 0,
      collectedByHospital: data.collectedByHospital ?? 0,
      collectedByMediend: data.collectedByMediend ?? 0,
      axisTariffDeduction: data.axisTariffDeduction ?? 0,
      axisTariffDeductionPaid: data.axisTariffDeductionPaid ?? 0,
      actualFinalAmount,
      deductionAmount: dedTotal,
      discountAmount: data.discountAmount ?? 0,
      waivedOffAmount: dedTotal - dedPaidTotal,
      settlementPart: data.settlementPart ?? 0,
      tdsAmount: data.tdsAmount ?? 0,
      otherDeduction: data.otherDeduction ?? 0,
      netSettlementAmount: actualFinalAmount,
      totalAmount: data.totalAmount || 0,
      billAmount: data.billAmount || lead.billAmount || 0,
      cashPaidByPatient: data.cashPaidByPatient || 0,
      cashOrDedPaid: dedPaidTotal,
      referralAmount: data.referralAmount || 0,
      cabCharges: data.cabCharges || 0,
      implantCost: data.implantCost || lead.implantAmount || 0,
      instrumentsCost: instrumentsCostNum,
      implantPaidBy: data.implantPaidBy ?? null,
      instrumentsPaidBy: data.instrumentsPaidBy ?? null,
      dcCharges: data.dcCharges || 0,
      doctorCharges: data.doctorCharges || 0,
      hospitalSharePct: data.hospitalSharePct,
      hospitalShareAmount: data.hospitalShareAmount || 0,
      mediendSharePct: data.mediendSharePct,
      mediendShareAmount: data.mediendShareAmount || 0,
      mediendNetProfit: data.mediendNetProfit || 0,
      remarks: data.remarks,
    }

    if (data.kypSubmissionId) {
      dischargeData.kypSubmissionId = data.kypSubmissionId
    }

    // Upsert — if the mark-discharged step ran first, we have a row to update;
    // otherwise (legacy IPD_DONE leads) we create + finalize in one shot.
    const dischargeSheet = await prisma.dischargeSheet.upsert({
      where: { leadId: data.leadId },
      create: {
        ...dischargeData,
        markedById: user.id,
        markedAt: new Date(),
      },
      update: dischargeData,
      include: {
        lead: {
          select: {
            id: true,
            leadRef: true,
            patientName: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Sync surgeryDate to Lead and AdmissionRecord (if it exists)
    await prisma.lead.update({
      where: { id: data.leadId },
      data: { surgeryDate: dischargeSheet.surgeryDate },
    })

    const admission = await prisma.admissionRecord.findUnique({
      where: { leadId: data.leadId },
      select: { id: true },
    })
    if (admission) {
      await prisma.admissionRecord.update({
        where: { leadId: data.leadId },
        data: { surgeryDate: dischargeSheet.surgeryDate },
      })
    }

    // Legacy path: if a lead skipped the mark step, advance the stage now.
    if (lead.caseStage === CaseStage.IPD_DONE) {
      await prisma.lead.update({
        where: { id: data.leadId },
        data: { caseStage: CaseStage.DISCHARGED },
      })
      await prisma.caseStageHistory.create({
        data: {
          leadId: data.leadId,
          fromStage: CaseStage.IPD_DONE,
          toStage: CaseStage.DISCHARGED,
          changedById: user.id,
          note: 'Insurance filled discharge sheet (legacy direct-finalize)',
        },
      })
    }

    // Auto-create PL record from discharge sheet so it shows on PL dashboard
    const existingPL = await prisma.pLRecord.findUnique({
      where: { leadId: data.leadId },
    })
    if (!existingPL) {
      const plRecord = await prisma.pLRecord.create({
        data: buildPlRecordPayload({
          lead,
          dischargeSheet,
          userId: user.id,
        }),
      })
      await prisma.dischargeSheet.update({
        where: { id: dischargeSheet.id },
        data: { plRecordId: plRecord.id },
      })
      await prisma.lead.update({
        where: { id: data.leadId },
        data: { pipelineStage: 'PL' },
      })
    }

    // Auto-create compliance call row (idempotent) for post-discharge feedback
    await prisma.complianceCall.upsert({
      where: { leadId: data.leadId },
      create: { leadId: data.leadId },
      update: {},
    })

    await postCaseChatSystemMessage(
      data.leadId,
      'Insurance filled discharge sheet. Case moved to PL.'
    )

    // Create notification for PL team
    const plUsers = await prisma.user.findMany({
      where: {
        role: {
          in: ['PL_HEAD', 'ADMIN'],
        },
      },
    })

    for (const plUser of plUsers) {
      await prisma.notification.create({
        data: {
          userId: plUser.id,
          type: 'DISCHARGE_SHEET_CREATED',
          title: 'New Discharge Sheet Created',
          message: `Discharge sheet created for ${lead.patientName} (${lead.leadRef})`,
          link: `/patient/${lead.id}/discharge`,
          relatedId: dischargeSheet.id,
        },
      })
    }

    return successResponse(dischargeSheet, 'Discharge sheet created successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error creating discharge sheet:', error)
    return errorResponse('Failed to create discharge sheet', 500)
  }
}
