import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'

const updateDischargeSheetSchema = z.object({
  // Core Identification
  month: z.string().optional(),
  dischargeDate: z.string().optional(),
  admissionDate: z.string().optional(),
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
  tentativeAmount: z.number().optional(),
  copayPct: z.number().optional(),
  dischargeSummaryUrl: z.string().optional(),
  otNotesUrl: z.string().optional(),
  codesCount: z.number().optional(),
  finalBillUrl: z.string().optional(),
  settlementLetterUrl: z.string().optional(),
  roomRentAmount: z.number().optional(),
  pharmacyAmount: z.number().optional(),
  investigationAmount: z.number().optional(),
  consumablesAmount: z.number().optional(),
  implantsAmount: z.number().optional(),
  instrumentsAmount: z.number().optional(),
  totalFinalBill: z.number().optional(),
  finalApprovedAmount: z.number().optional(),
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
  instrumentsCost: z.number().optional(),
  implantPaidBy: z.enum(['MEDIEND', 'HOSPITAL']).optional(),
  instrumentsPaidBy: z.enum(['MEDIEND', 'HOSPITAL']).optional(),
  dcCharges: z.number().optional(),
  doctorCharges: z.number().optional(),
  // Revenue Split
  hospitalSharePct: z.number().optional(),
  hospitalShareAmount: z.number().optional(),
  mediendSharePct: z.number().optional(),
  mediendShareAmount: z.number().optional(),
  mediendNetProfit: z.number().optional(),
  // Meta
  remarks: z.string().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const { id } = await params

    const dischargeSheet = await prisma.dischargeSheet.findUnique({
      where: { id },
      include: {
        lead: {
          select: {
            id: true,
            leadRef: true,
            patientName: true,
            phoneNumber: true,
            hospitalName: true,
            treatment: true,
            category: true,
            circle: true,
            source: true,
            surgeonName: true,
            billAmount: true,
            implantAmount: true,
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
    })

    if (!dischargeSheet) {
      return errorResponse('Discharge sheet not found', 404)
    }

    return successResponse(dischargeSheet)
  } catch (error) {
    console.error('Error fetching discharge sheet:', error)
    return errorResponse('Failed to fetch discharge sheet', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    // Only Insurance team can update discharge sheets
    if (user.role !== 'INSURANCE_HEAD' && user.role !== 'ADMIN') {
      return errorResponse('Forbidden: Only Insurance team can update discharge sheets', 403)
    }

    const { id } = await params
    const body = await request.json()
    const data = updateDischargeSheetSchema.parse(body)

    // Check if discharge sheet exists
    const existing = await prisma.dischargeSheet.findUnique({
      where: { id },
    })

    if (!existing) {
      return errorResponse('Discharge sheet not found', 404)
    }

    // Prepare update data
    const updateData: any = {}
    if (data.month !== undefined) updateData.month = data.month ? new Date(data.month) : null
    if (data.dischargeDate !== undefined) updateData.dischargeDate = data.dischargeDate ? new Date(data.dischargeDate) : null
    if (data.admissionDate !== undefined) updateData.admissionDate = data.admissionDate ? new Date(data.admissionDate) : null
    if (data.surgeryDate !== undefined) updateData.surgeryDate = data.surgeryDate ? new Date(data.surgeryDate) : null
    if (data.status !== undefined) updateData.status = data.status
    if (data.paymentType !== undefined) updateData.paymentType = data.paymentType
    if (data.approvedOrCash !== undefined) updateData.approvedOrCash = data.approvedOrCash
    if (data.paymentCollectedAt !== undefined) updateData.paymentCollectedAt = data.paymentCollectedAt
    if (data.managerRole !== undefined) updateData.managerRole = data.managerRole
    if (data.managerName !== undefined) updateData.managerName = data.managerName
    if (data.bdmName !== undefined) updateData.bdmName = data.bdmName
    if (data.patientName !== undefined) updateData.patientName = data.patientName
    if (data.patientPhone !== undefined) updateData.patientPhone = data.patientPhone
    if (data.doctorName !== undefined) updateData.doctorName = data.doctorName
    if (data.hospitalName !== undefined) updateData.hospitalName = data.hospitalName
    if (data.category !== undefined) updateData.category = data.category
    if (data.treatment !== undefined) updateData.treatment = data.treatment
    if (data.circle !== undefined) updateData.circle = data.circle
    if (data.leadSource !== undefined) updateData.leadSource = data.leadSource
    if (data.totalAmount !== undefined) updateData.totalAmount = data.totalAmount
    if (data.billAmount !== undefined) updateData.billAmount = data.billAmount
    if (data.cashPaidByPatient !== undefined) updateData.cashPaidByPatient = data.cashPaidByPatient
    if (data.cashOrDedPaid !== undefined) updateData.cashOrDedPaid = data.cashOrDedPaid
    if (data.referralAmount !== undefined) updateData.referralAmount = data.referralAmount
    if (data.cabCharges !== undefined) updateData.cabCharges = data.cabCharges
    if (data.implantCost !== undefined) updateData.implantCost = data.implantCost
    if (data.instrumentsCost !== undefined) updateData.instrumentsCost = data.instrumentsCost
    if (data.implantPaidBy !== undefined) updateData.implantPaidBy = data.implantPaidBy
    if (data.instrumentsPaidBy !== undefined) updateData.instrumentsPaidBy = data.instrumentsPaidBy
    if (data.dcCharges !== undefined) updateData.dcCharges = data.dcCharges
    if (data.doctorCharges !== undefined) updateData.doctorCharges = data.doctorCharges
    if (data.hospitalSharePct !== undefined) updateData.hospitalSharePct = data.hospitalSharePct
    if (data.hospitalShareAmount !== undefined) updateData.hospitalShareAmount = data.hospitalShareAmount
    if (data.mediendSharePct !== undefined) updateData.mediendSharePct = data.mediendSharePct
    if (data.mediendShareAmount !== undefined) updateData.mediendShareAmount = data.mediendShareAmount
    if (data.mediendNetProfit !== undefined) updateData.mediendNetProfit = data.mediendNetProfit
    if (data.remarks !== undefined) updateData.remarks = data.remarks
    if (data.tentativeAmount !== undefined) updateData.tentativeAmount = data.tentativeAmount
    if (data.copayPct !== undefined) updateData.copayPct = data.copayPct
    if (data.dischargeSummaryUrl !== undefined) updateData.dischargeSummaryUrl = data.dischargeSummaryUrl
    if (data.otNotesUrl !== undefined) updateData.otNotesUrl = data.otNotesUrl
    if (data.codesCount !== undefined) updateData.codesCount = data.codesCount
    if (data.finalBillUrl !== undefined) updateData.finalBillUrl = data.finalBillUrl
    if (data.settlementLetterUrl !== undefined) updateData.settlementLetterUrl = data.settlementLetterUrl
    if (data.roomRentAmount !== undefined) updateData.roomRentAmount = data.roomRentAmount
    if (data.pharmacyAmount !== undefined) updateData.pharmacyAmount = data.pharmacyAmount
    if (data.investigationAmount !== undefined) updateData.investigationAmount = data.investigationAmount
    if (data.consumablesAmount !== undefined) updateData.consumablesAmount = data.consumablesAmount
    if (data.implantsAmount !== undefined) updateData.implantsAmount = data.implantsAmount
    if (data.instrumentsAmount !== undefined) updateData.instrumentsAmount = data.instrumentsAmount
    if (data.totalFinalBill !== undefined) updateData.totalFinalBill = data.totalFinalBill
    if (data.finalApprovedAmount !== undefined) updateData.finalApprovedAmount = data.finalApprovedAmount
    if (data.deductionAmount !== undefined) updateData.deductionAmount = data.deductionAmount
    if (data.discountAmount !== undefined) updateData.discountAmount = data.discountAmount
    if (data.waivedOffAmount !== undefined) updateData.waivedOffAmount = data.waivedOffAmount
    if (data.settlementPart !== undefined) updateData.settlementPart = data.settlementPart
    if (data.tdsAmount !== undefined) updateData.tdsAmount = data.tdsAmount
    if (data.otherDeduction !== undefined) updateData.otherDeduction = data.otherDeduction
    if (data.netSettlementAmount !== undefined) updateData.netSettlementAmount = data.netSettlementAmount

    // Update discharge sheet
    const updated = await prisma.dischargeSheet.update({
      where: { id },
      data: updateData,
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

    return successResponse(updated, 'Discharge sheet updated successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error updating discharge sheet:', error)
    return errorResponse('Failed to update discharge sheet', 500)
  }
}
