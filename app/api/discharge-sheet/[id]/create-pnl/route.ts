import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    // Only PL team or Insurance team can create PNL from discharge sheet
    if (user.role !== 'PL_HEAD' && user.role !== 'INSURANCE_HEAD' && user.role !== 'ADMIN') {
      return errorResponse('Forbidden: Only PL or Insurance team can create PNL records', 403)
    }

    const { id } = await params

    // Find discharge sheet
    const dischargeSheet = await prisma.dischargeSheet.findUnique({
      where: { id },
      include: {
        lead: {
          select: {
            id: true,
            leadRef: true,
            patientName: true,
          },
        },
      },
    })

    if (!dischargeSheet) {
      return errorResponse('Discharge sheet not found', 404)
    }

    // Check if PNL record already exists
    const existingPL = await prisma.pLRecord.findUnique({
      where: { leadId: dischargeSheet.leadId },
    })

    if (existingPL) {
      return errorResponse('PNL record already exists for this lead', 400)
    }

    // Create PNL record from discharge sheet data
    const plRecord = await prisma.pLRecord.create({
      data: {
        leadId: dischargeSheet.leadId,
        month: dischargeSheet.month,
        admissionDate: dischargeSheet.admissionDate,
        surgeryDate: dischargeSheet.surgeryDate,
        status: dischargeSheet.status,
        paymentType: dischargeSheet.paymentType,
        approvedOrCash: dischargeSheet.approvedOrCash,
        paymentCollectedAt: dischargeSheet.paymentCollectedAt,
        managerRole: dischargeSheet.managerRole,
        managerName: dischargeSheet.managerName,
        bdmName: dischargeSheet.bdmName,
        patientName: dischargeSheet.patientName,
        patientPhone: dischargeSheet.patientPhone,
        doctorName: dischargeSheet.doctorName,
        hospitalName: dischargeSheet.hospitalName,
        category: dischargeSheet.category,
        treatment: dischargeSheet.treatment,
        circle: dischargeSheet.circle,
        leadSource: dischargeSheet.leadSource,
        totalAmount: dischargeSheet.totalAmount,
        billAmount: dischargeSheet.billAmount,
        cashPaidByPatient: dischargeSheet.cashPaidByPatient,
        cashOrDedPaid: dischargeSheet.cashOrDedPaid,
        referralAmount: dischargeSheet.referralAmount,
        cabCharges: dischargeSheet.cabCharges,
        implantCost: dischargeSheet.implantCost,
        instrumentsCost: dischargeSheet.instrumentsCost,
        implantPaidBy: dischargeSheet.implantPaidBy,
        instrumentsPaidBy: dischargeSheet.instrumentsPaidBy,
        dcCharges: dischargeSheet.dcCharges,
        doctorCharges: dischargeSheet.doctorCharges,
        hospitalSharePct: dischargeSheet.hospitalSharePct,
        hospitalShareAmount: dischargeSheet.hospitalShareAmount,
        mediendSharePct: dischargeSheet.mediendSharePct,
        mediendShareAmount: dischargeSheet.mediendShareAmount,
        mediendNetProfit: dischargeSheet.mediendNetProfit,
        finalProfit: dischargeSheet.mediendNetProfit, // Alias
        remarks: dischargeSheet.remarks,
        handledById: user.id,
        hospitalPayoutStatus: 'PENDING',
        doctorPayoutStatus: 'PENDING',
        mediendInvoiceStatus: 'PENDING',
      },
      include: {
        lead: {
          select: {
            id: true,
            leadRef: true,
            patientName: true,
          },
        },
        handledBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    // Link discharge sheet to PNL record
    await prisma.dischargeSheet.update({
      where: { id },
      data: {
        plRecord: {
          connect: { id: plRecord.id },
        },
      },
    })

    // Update lead pipeline stage to PL
    await prisma.lead.update({
      where: { id: dischargeSheet.leadId },
      data: {
        pipelineStage: 'PL',
      },
    })

    return successResponse(plRecord, 'PNL record created successfully from discharge sheet')
  } catch (error) {
    console.error('Error creating PNL from discharge sheet:', error)
    return errorResponse('Failed to create PNL record', 500)
  }
}
