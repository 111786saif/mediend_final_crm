import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { canMutateLead } from '@/lib/lead-access-api'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'
import { CaseStage, FlowType, NotificationType } from '@/generated/prisma/client'

const initiateCashSchema = z.object({
  admissionDate: z.string(),
  admissionTime: z.string(),
  admittingHospital: z.string(),
  hospitalAddress: z.string().optional(),
  googleMapLocation: z.string().optional(),
  surgeryDate: z.string(),
  surgeryTime: z.string(),
  instrument: z.string().optional(),
  implantConsumables: z.string().optional(),
  notes: z.string().optional(),
  quantityGrade: z.string().optional(),
  anesthesia: z.string().optional(),
  surgeonType: z.string().optional(),
  alternateContactName: z.string().optional(),
  alternateContactNumber: z.string().optional(),
  
  // Cash specific fields
  modeOfPayment: z.string(),
  discount: z.number().optional(),
  copay: z.number().optional(),
  deduction: z.number().optional(),
  approvedAmount: z.number(),
  collectedAmount: z.number().optional(),
  collectedByMediend: z.number().optional(),
  collectedByHospital: z.number().optional(),
  finalBillAmount: z.number(),
  
  // EMI specific
  emiAmount: z.number().optional(),
  processingFee: z.number().optional(),
  gst: z.number().optional(),
  subventionFee: z.number().optional(),
  finalEmiAmount: z.number().optional(),
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

    // Only BD, TEAM_LEAD, or ADMIN can initiate cash flow
    if (!['BD', 'TEAM_LEAD', 'ADMIN'].includes(user.role)) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = initiateCashSchema.parse(body)

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        bd: { select: { teamId: true } },
      },
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    if (!(await canMutateLead(user, lead.bdId, lead.bd?.teamId))) {
      return errorResponse('Forbidden', 403)
    }

    // Check if admission record already exists
    const existingAdmission = await prisma.admissionRecord.findUnique({
      where: { leadId: id },
    })

    if (existingAdmission) {
      return errorResponse('Admission record already exists', 400)
    }

    // Create admission record
    const admissionRecord = await prisma.admissionRecord.create({
      data: {
        leadId: id,
        admissionDate: new Date(validatedData.admissionDate),
        admissionTime: validatedData.admissionTime,
        admittingHospital: validatedData.admittingHospital,
        hospitalAddress: validatedData.hospitalAddress,
        googleMapLocation: validatedData.googleMapLocation,
        surgeryDate: new Date(validatedData.surgeryDate),
        surgeryTime: validatedData.surgeryTime,
        instrument: validatedData.instrument,
        implantConsumables: validatedData.implantConsumables,
        notes: validatedData.notes,
        initiatedById: user.id,
      },
    })

    // Update lead with cash details and stage
    await prisma.lead.update({
      where: { id },
      data: {
        caseStage: CaseStage.CASH_IPD_SUBMITTED,
        flowType: FlowType.CASH,
        hospitalName: validatedData.admittingHospital,
        ipdAdmissionDate: new Date(validatedData.admissionDate),
        quantityGrade: validatedData.quantityGrade,
        anesthesia: validatedData.anesthesia,
        surgeonType: validatedData.surgeonType,
        attendantName: validatedData.alternateContactName,
        alternateNumber: validatedData.alternateContactNumber,
        
        // Cash Financials
        modeOfPayment: validatedData.modeOfPayment,
        discount: validatedData.discount,
        copay: validatedData.copay,
        deduction: validatedData.deduction,
        // Mapping "Approved / Cash Package" to billAmount or settledTotal?
        // Let's use billAmount for "Final Bill Amount" and settledTotal for "Approved Amount" as per schema comments?
        // Schema: billAmount (Hospital bill), settledTotal (Settled total)
        billAmount: validatedData.finalBillAmount,
        settledTotal: validatedData.approvedAmount, // "Settled (Sum of Package/Approved)"
        collectedByMediend: validatedData.collectedByMediend ?? 0,
        collectedByHospital: validatedData.collectedByHospital ?? 0,
        
        // We don't have dedicated fields for collectedAmount, emiAmount etc in Lead schema yet.
        // We might need to store them in remarks or add new fields.
        // For now, let's store extra details in remarks or assume schema update covered them (it didn't).
        // I'll append to remarks for now to avoid data loss if fields missing.
        remarks: (lead.remarks ? lead.remarks + '\n' : '') + 
          `[CASH FLOW DETAILS]\n` +
          `Collected: ${validatedData.collectedAmount}\n` +
          (validatedData.modeOfPayment === 'EMI' ? 
            `EMI Amount: ${validatedData.emiAmount}\n` +
            `Processing Fee: ${validatedData.processingFee}\n` +
            `GST: ${validatedData.gst}\n` +
            `Subvention Fee: ${validatedData.subventionFee}\n` +
            `Final EMI Amount: ${validatedData.finalEmiAmount}` : '')
      },
    })

    // Create stage history
    await prisma.caseStageHistory.create({
      data: {
        leadId: id,
        fromStage: lead.caseStage,
        toStage: CaseStage.CASH_IPD_SUBMITTED,
        changedById: user.id,
        note: 'IPD Cash Form Submitted',
      },
    })

    // Post system message
    await prisma.caseChatMessage.create({
      data: {
        leadId: id,
        type: 'SYSTEM',
        content: `IPD Cash Form submitted by ${user.name}. Case is now pending Insurance review.`,
      },
    })

    // Notify Insurance Head(s)
    const insuranceHeads = await prisma.user.findMany({
      where: { role: 'INSURANCE_HEAD' },
    })

    for (const head of insuranceHeads) {
      await prisma.notification.create({
        data: {
          userId: head.id,
          type: NotificationType.INITIATED, // Reusing INITIATED type
          title: 'Cash Case Submitted',
          message: `New Cash IPD form submitted for ${lead.patientName} (${lead.leadRef})`,
          relatedId: id,
          link: `/insurance/cash-cases`, // Link to new cash cases page
        },
      })
    }

    return successResponse(admissionRecord, 'IPD Cash details saved successfully')
  } catch (error) {
    console.error('Error initiating cash flow:', error)
    if (error instanceof z.ZodError) {
      return errorResponse('Validation failed', 400)
    }
    return errorResponse('Failed to save IPD details', 500)
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

    // Only BD, TEAM_LEAD, or ADMIN can update cash flow
    if (!['BD', 'TEAM_LEAD', 'ADMIN'].includes(user.role)) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = initiateCashSchema.parse(body)

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        bd: { select: { teamId: true } },
      },
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    if (!(await canMutateLead(user, lead.bdId, lead.bd?.teamId))) {
      return errorResponse('Forbidden', 403)
    }

    // Can only update if ON_HOLD
    if (lead.caseStage !== CaseStage.CASH_ON_HOLD) {
       // Allow update if just submitted (correction) before review? 
       // Requirement said: "if hold --> BD can edit IPD form again and resubmit"
       // Let's restrict to ON_HOLD for re-submission logic, or SUBMITTED for corrections.
       if (lead.caseStage !== CaseStage.CASH_IPD_SUBMITTED) {
           return errorResponse('Can only edit IPD Cash details when case is Submitted or On Hold', 400)
       }
    }

    // Update admission record
    await prisma.admissionRecord.update({
      where: { leadId: id },
      data: {
        admissionDate: new Date(validatedData.admissionDate),
        admissionTime: validatedData.admissionTime,
        admittingHospital: validatedData.admittingHospital,
        hospitalAddress: validatedData.hospitalAddress,
        googleMapLocation: validatedData.googleMapLocation,
        surgeryDate: new Date(validatedData.surgeryDate),
        surgeryTime: validatedData.surgeryTime,
        instrument: validatedData.instrument,
        implantConsumables: validatedData.implantConsumables,
        notes: validatedData.notes,
      },
    })

    // Update lead
    await prisma.lead.update({
      where: { id },
      data: {
        // Set back to SUBMITTED if it was ON_HOLD
        caseStage: CaseStage.CASH_IPD_SUBMITTED,
        hospitalName: validatedData.admittingHospital,
        ipdAdmissionDate: new Date(validatedData.admissionDate),
        quantityGrade: validatedData.quantityGrade,
        anesthesia: validatedData.anesthesia,
        surgeonType: validatedData.surgeonType,
        attendantName: validatedData.alternateContactName,
        alternateNumber: validatedData.alternateContactNumber,
        
        // Cash Financials
        modeOfPayment: validatedData.modeOfPayment,
        discount: validatedData.discount,
        copay: validatedData.copay,
        deduction: validatedData.deduction,
        billAmount: validatedData.finalBillAmount,
        settledTotal: validatedData.approvedAmount,
        collectedByMediend: validatedData.collectedByMediend ?? 0,
        collectedByHospital: validatedData.collectedByHospital ?? 0,
        
        // Append remarks again? Better to replace the cash section if possible, but regex is risky.
        // Just appending updated info.
        remarks: (lead.remarks || '') + '\n' + 
          `[UPDATED CASH FLOW DETAILS]\n` +
          `Collected: ${validatedData.collectedAmount}\n` +
          (validatedData.modeOfPayment === 'EMI' ? 
            `EMI Amount: ${validatedData.emiAmount}\n` +
            `Processing Fee: ${validatedData.processingFee}\n` +
            `GST: ${validatedData.gst}\n` +
            `Subvention Fee: ${validatedData.subventionFee}\n` +
            `Final EMI Amount: ${validatedData.finalEmiAmount}` : '')
      },
    })

    // Create stage history if changing from HOLD to SUBMITTED
    if (lead.caseStage === CaseStage.CASH_ON_HOLD) {
        await prisma.caseStageHistory.create({
        data: {
            leadId: id,
            fromStage: CaseStage.CASH_ON_HOLD,
            toStage: CaseStage.CASH_IPD_SUBMITTED,
            changedById: user.id,
            note: 'IPD Cash Form Re-submitted',
        },
        })
    }

    // Post system message
    await prisma.caseChatMessage.create({
      data: {
        leadId: id,
        type: 'SYSTEM',
        content: `IPD Cash Form updated/re-submitted by ${user.name}.`,
      },
    })

    return successResponse({ id }, 'IPD Cash details updated successfully')
  } catch (error) {
    console.error('Error updating cash flow:', error)
    if (error instanceof z.ZodError) {
      return errorResponse('Validation failed', 400)
    }
    return errorResponse('Failed to update IPD details', 500)
  }
}
