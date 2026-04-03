import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { canMutateLead } from '@/lib/lead-access-api'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { postCaseChatSystemMessage } from '@/lib/case-chat'
import { z } from 'zod'
import { CaseStage } from '@/generated/prisma/client'

const initiateSchema = z.object({
  admissionDate: z.string().min(1, 'Admission date is required'),
  admissionTime: z.string().min(1, 'Admission time is required'),
  admittingHospital: z.string().min(1, 'Hospital name is required'),
  hospitalAddress: z.string().optional(),
  googleMapLocation: z.string().optional(),
  surgeryDate: z.string().min(1, 'Surgery date is required'),
  surgeryTime: z.string().min(1, 'Surgery time is required'),
  tpa: z.string().min(1, 'TPA is required'),
  instrument: z.string().optional(),
  implantConsumables: z.string().optional(),
  notes: z.string().optional(),
  // Cab Service - Admission Pickup
  cabAdmissionPickupLocation: z.string().optional(),
  cabAdmissionPickupDateTime: z.string().optional(),
  cabAdmissionFrom: z.string().optional(),
  cabAdmissionTo: z.string().optional(),
  // Cab Service - Discharge Pickup
  cabDischargePickupLocation: z.string().optional(),
  cabDischargePickupDateTime: z.string().optional(),
  cabDischargeFrom: z.string().optional(),
  cabDischargeTo: z.string().optional(),
  // Overrides for Lead details
  quantityGrade: z.string().optional(),
  anesthesia: z.string().optional(),
  surgeonName: z.string().optional(),
  surgeonType: z.string().optional(),
  alternateContactName: z.string().optional(),
  alternateContactNumber: z.string().optional(),
  patientName: z.string().optional(),
  insuranceName: z.string().optional(),
  insuranceType: z.string().optional(),
  copay: z.string().optional(),
  sumInsured: z.string().optional(),
  roomType: z.string().optional(),
  capping: z.string().optional(),
  bdName: z.string().optional(),
  bdManagerName: z.string().optional(),
  age: z.union([z.string(), z.number()]).optional(),
  sex: z.string().optional(),
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

    if (user.role !== 'BD' && user.role !== 'TEAM_LEAD' && user.role !== 'ADMIN') {
      return errorResponse('Forbidden: Only BD / TL can initiate admission', 403)
    }

    const { id: leadId } = await params
    const body = await request.json()
    const data = initiateSchema.parse(body)

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        kypSubmission: {
          include: {
            preAuthData: true,
          },
        },
      },
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    if (!(await canMutateLead(user, lead.bdId))) {
      return errorResponse('Forbidden', 403)
    }

    if (lead.caseStage !== CaseStage.PREAUTH_COMPLETE) {
      return errorResponse(`Cannot initiate admission. Current stage: ${lead.caseStage}. Pre-auth must be complete first.`, 400)
    }

    const existingAdmission = await prisma.admissionRecord.findUnique({
      where: { leadId },
    })

    if (existingAdmission) {
      return errorResponse('Admission already initiated for this case', 400)
    }

    const admission = await prisma.admissionRecord.create({
      data: {
        leadId,
        admissionDate: new Date(data.admissionDate),
        admissionTime: data.admissionTime,
        admittingHospital: data.admittingHospital,
        hospitalAddress: data.hospitalAddress?.trim() || undefined,
        googleMapLocation: data.googleMapLocation?.trim() || undefined,
        surgeryDate: new Date(data.surgeryDate),
        surgeryTime: data.surgeryTime,
        tpa: data.tpa,
        instrument: data.instrument?.trim() || undefined,
        implantConsumables: data.implantConsumables?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
        // Cab service - Admission
        cabAdmissionPickupLocation: data.cabAdmissionPickupLocation?.trim() || undefined,
        cabAdmissionPickupDateTime: data.cabAdmissionPickupDateTime ? new Date(data.cabAdmissionPickupDateTime) : undefined,
        cabAdmissionFrom: data.cabAdmissionFrom?.trim() || undefined,
        cabAdmissionTo: data.cabAdmissionTo?.trim() || undefined,
        // Cab service - Discharge
        cabDischargePickupLocation: data.cabDischargePickupLocation?.trim() || undefined,
        cabDischargePickupDateTime: data.cabDischargePickupDateTime ? new Date(data.cabDischargePickupDateTime) : undefined,
        cabDischargeFrom: data.cabDischargeFrom?.trim() || undefined,
        cabDischargeTo: data.cabDischargeTo?.trim() || undefined,
        initiatedById: user.id,
      },
    })

    const previousStage = lead.caseStage
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        caseStage: CaseStage.INITIATED,
        hospitalName: data.admittingHospital,
        ipdAdmissionDate: new Date(data.admissionDate),
        // Save overrides
        ...(data.quantityGrade ? { quantityGrade: data.quantityGrade } : {}),
        ...(data.anesthesia ? { anesthesia: data.anesthesia } : {}),
        ...(data.surgeonName ? { ipdDrName: data.surgeonName } : {}),
        ...(data.surgeonType ? { surgeonType: data.surgeonType } : {}),
        ...(data.alternateContactName ? { attendantName: data.alternateContactName } : {}),
        ...(data.alternateContactNumber ? { alternateNumber: data.alternateContactNumber } : {}),
        ...(data.patientName ? { patientName: data.patientName } : {}),
        ...(data.insuranceName ? { insuranceName: data.insuranceName } : {}),
        ...(data.age ? { age: Number(data.age) } : {}),
        ...(data.sex ? { sex: data.sex } : {}),
      },
    })

    await prisma.caseStageHistory.create({
      data: {
        leadId,
        fromStage: previousStage,
        toStage: CaseStage.INITIATED,
        changedById: user.id,
        note: `Patient admitted at ${data.admittingHospital}`,
      },
    })

    await postCaseChatSystemMessage(leadId, `BD marked patient admitted at ${data.admittingHospital}.`)

    const insuranceUsers = await prisma.user.findMany({
      where: { role: 'INSURANCE_HEAD' },
    })

    await prisma.notification.createMany({
      data: insuranceUsers.map((insuranceUser) => ({
        userId: insuranceUser.id,
        type: 'INITIATED',
        title: 'Patient Admitted',
        message: `Patient ${lead.patientName} (${lead.leadRef}) has been admitted at ${data.admittingHospital}`,
        link: `/patient/${leadId}`,
        relatedId: admission.id,
      })),
    })

    return successResponse(admission, 'Admission initiated successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data: ' + error.errors.map(e => e.message).join(', '), 400)
    }
    console.error('Error initiating admission:', error)
    return errorResponse('Failed to initiate admission', 500)
  }
}
