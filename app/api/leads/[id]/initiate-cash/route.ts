import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { canMutateLead } from '@/lib/lead-access-api'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { isSalesLeadWorkerRole } from '@/lib/sales-hierarchy-roles'
import { z } from 'zod'
import { CaseStage, FlowType, NotificationType, ATSStatus } from '@/generated/prisma/client'
import {
  assertDoctorAvailableOnDate,
  DoctorAvailabilityError,
  normalizeDoctorName,
} from '@/lib/doctor-availability'
import {
  normalizeModeOfPaymentKey,
  normalizeModeOfPaymentStorageValue,
} from '@/lib/mode-of-payment'

const initiateCashSchema = z.object({
  admissionDate: z.string().min(1, 'Admission date is required'),
  admissionTime: z.string().min(1, 'Admission time is required'),
  admittingHospital: z.string().min(1, 'Hospital name is required'),
  hospitalAddress: z.string().nullish(),
  googleMapLocation: z.string().nullish(),
  surgeryDate: z.string().min(1, 'Surgery date is required'),
  surgeryTime: z.string().min(1, 'Surgery time is required'),
  instrument: z.string().nullish(),
  implantConsumables: z.string().nullish(),
  notes: z.string().nullish(),
  quantityGrade: z.string().nullish(),
  anesthesia: z.string().nullish(),
  surgeonName: z.string().min(1, 'Surgeon name is required'),
  surgeonType: z.string().nullish(),
  alternateContactName: z.string().nullish(),
  alternateContactNumber: z.string().nullish(),
  patientName: z.string().min(1, 'Patient name is required'),
  age: z.number().nullish(),
  sex: z.enum(['Male', 'Female', 'Other'], {
    errorMap: () => ({ message: 'Gender is required' }),
  }),
  circle: z.string().min(1, 'Circle is required'),
  category: z.string().nullish(),

  // Treatment & ATS
  treatmentId: z.string().nullish(),
  treatmentName: z.string().min(1, 'Treatment name is required'),
  atsAmount: z.number().nullish(),

  // Cash specific fields
  modeOfPayment: z.string(),
  approvedAmount: z.number(),
  collectedAmount: z.number().nullish(),
  collectedByMediend: z.number().nullish(),
  collectedByHospital: z.number().nullish(),
  finalBillAmount: z.number(),

  // EMI specific
  emiAmount: z.number().nullish(),
  processingFee: z.number().nullish(),
  gst: z.number().nullish(),
  subventionFee: z.number().nullish(),
  finalEmiAmount: z.number().nullish(),
})

function resolveCashDecision(atsAmount: number | null | undefined, approvedAmount: number) {
  if (atsAmount == null || atsAmount <= 0) {
    return {
      atsStatus: ATSStatus.NO_ATS,
      caseStage: CaseStage.CASH_IPD_SUBMITTED,
      autoApproved: false,
    }
  }

  if (approvedAmount >= atsAmount) {
    return {
      atsStatus: ATSStatus.ABOVE_ATS,
      caseStage: CaseStage.CASH_APPROVED,
      autoApproved: true,
    }
  }

  return {
    atsStatus: ATSStatus.BELOW_ATS,
    caseStage: CaseStage.CASH_IPD_SUBMITTED,
    autoApproved: false,
  }
}

function buildCashRemarks(
  prefix: string,
  data: z.infer<typeof initiateCashSchema>,
  previous: string | null | undefined,
) {
  const emiBlock = normalizeModeOfPaymentKey(data.modeOfPayment) === 'emi'
    ? `EMI Amount: ${data.emiAmount}\n` +
      `Processing Fee: ${data.processingFee}\n` +
      `GST: ${data.gst}\n` +
      `Subvention Fee: ${data.subventionFee}\n` +
      `Final EMI Amount: ${data.finalEmiAmount}`
    : ''

  return `${previous ? previous + '\n' : ''}${prefix}\nCollected: ${data.collectedAmount}\n${emiBlock}`
}

async function notifyInsuranceHeads(leadId: string, patientName: string, leadRef: string) {
  try {
    const insuranceHeads = await prisma.user.findMany({
      where: { role: 'INSURANCE_HEAD' },
      select: { id: true },
    })

    for (const head of insuranceHeads) {
      await prisma.notification.create({
        data: {
          userId: head.id,
          type: NotificationType.INITIATED,
          title: 'Cash Case Submitted',
          message: `New Cash IPD form submitted for ${patientName} (${leadRef})`,
          relatedId: leadId,
          link: '/insurance/cash-cases',
        },
      })
    }
  } catch (error) {
    console.error('Cash IPD saved but insurance notifications failed:', error)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    if (!isSalesLeadWorkerRole(user.role) && user.role !== 'ADMIN') {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = initiateCashSchema.parse(body)

    const lead = await prisma.lead.findUnique({ where: { id } })
    if (!lead) return errorResponse('Lead not found', 404)

    if (!(await canMutateLead(user, lead.bdId))) {
      return errorResponse('Forbidden', 403)
    }

    const existingAdmission = await prisma.admissionRecord.findUnique({
      where: { leadId: id },
      select: { id: true },
    })

    const nextDoctorName = normalizeDoctorName(
      validatedData.surgeonName || lead.ipdDrName || lead.surgeonName
    )
    await assertDoctorAvailableOnDate(
      prisma,
      nextDoctorName,
      validatedData.admissionDate,
      'Selected doctor is on approved leave for this date.'
    )
    await assertDoctorAvailableOnDate(
      prisma,
      nextDoctorName,
      validatedData.surgeryDate,
      'Selected doctor is on approved leave for this date.'
    )

    const { atsStatus, caseStage, autoApproved } = resolveCashDecision(
      validatedData.atsAmount,
      validatedData.approvedAmount,
    )

    const admissionRecord = await prisma.$transaction(async (tx) => {
      const admission = await tx.admissionRecord.upsert({
        where: { leadId: id },
        create: {
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
        update: {
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

      await tx.lead.update({
        where: { id },
        data: {
          patientName: validatedData.patientName,
          ...(validatedData.age != null ? { age: validatedData.age } : {}),
          sex: validatedData.sex,
          circle: validatedData.circle,
          category: validatedData.category || null,
          treatmentMasterId: validatedData.treatmentId || null,
          treatment: validatedData.treatmentName || null,
          atsAmount: validatedData.atsAmount || null,
          atsStatus,
          caseStage,
          flowType: FlowType.CASH,
          status: 'IPD Schedule',
          hospitalName: validatedData.admittingHospital,
          ipdAdmissionDate: new Date(validatedData.admissionDate),
          // Keep the legacy lead field in sync with the IPD source of truth.
          surgeryDate: new Date(validatedData.surgeryDate),
          quantityGrade: validatedData.quantityGrade,
          anesthesia: validatedData.anesthesia,
          surgeonName: validatedData.surgeonName,
          ipdDrName: validatedData.surgeonName,
          surgeonType: validatedData.surgeonType,
          attendantName: validatedData.alternateContactName,
          alternateNumber: validatedData.alternateContactNumber,
          modeOfPayment: normalizeModeOfPaymentStorageValue(validatedData.modeOfPayment),
          billAmount: validatedData.finalBillAmount,
          settledTotal: validatedData.approvedAmount,
          collectedByMediend: validatedData.collectedByMediend ?? 0,
          collectedByHospital: validatedData.collectedByHospital ?? 0,
          remarks: buildCashRemarks('[CASH FLOW DETAILS]', validatedData, lead.remarks),
        },
      })

      if (!existingAdmission || lead.caseStage !== caseStage) {
        await tx.caseStageHistory.create({
          data: {
            leadId: id,
            fromStage: lead.caseStage,
            toStage: caseStage,
            changedById: user.id,
            note: autoApproved
              ? existingAdmission
                ? 'IPD Cash Form Re-submitted - Auto-approved (above ATS)'
                : 'IPD Cash Form Submitted - Auto-approved (above ATS)'
              : existingAdmission
                ? 'IPD Cash Form Re-submitted'
                : 'IPD Cash Form Submitted',
          },
        })
      }

      await tx.caseChatMessage.create({
        data: {
          leadId: id,
          type: 'SYSTEM',
          content: autoApproved
            ? `IPD Cash Form submitted by ${user.name}. Auto-approved (approved amount ₹${validatedData.approvedAmount.toLocaleString('en-IN')} ≥ ATS ₹${validatedData.atsAmount?.toLocaleString('en-IN')}).`
            : existingAdmission
              ? `IPD Cash Form re-submitted by ${user.name}. Case is now pending Insurance review.`
              : `IPD Cash Form submitted by ${user.name}. Case is now pending Insurance review.`,
        },
      })

      return admission
    })

    if (!autoApproved) {
      await notifyInsuranceHeads(id, lead.patientName, lead.leadRef)
    }

    return successResponse(
      admissionRecord,
      autoApproved
        ? 'IPD Cash details saved successfully - Auto-approved (above ATS limit)'
        : existingAdmission
          ? 'IPD Cash details re-saved successfully - Pending manual approval'
          : 'IPD Cash details saved successfully - Pending manual approval'
    )
  } catch (error) {
    if (error instanceof DoctorAvailabilityError) {
      return errorResponse(error.message, error.status)
    }
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
    const user = await getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    if (!isSalesLeadWorkerRole(user.role) && user.role !== 'ADMIN') {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = initiateCashSchema.parse(body)

    const lead = await prisma.lead.findUnique({ where: { id } })
    if (!lead) return errorResponse('Lead not found', 404)

    if (!(await canMutateLead(user, lead.bdId))) {
      return errorResponse('Forbidden', 403)
    }

    if (
      lead.caseStage !== CaseStage.CASH_IPD_PENDING &&
      lead.caseStage !== CaseStage.CASH_OPD_SCHEDULED &&
      lead.caseStage !== CaseStage.CASH_ON_HOLD &&
      lead.caseStage !== CaseStage.CASH_IPD_SUBMITTED &&
      lead.caseStage !== CaseStage.CASH_APPROVED
    ) {
      return errorResponse('Can only edit IPD Cash details before the case moves past approval', 400)
    }

    const nextDoctorName = normalizeDoctorName(
      validatedData.surgeonName || lead.ipdDrName || lead.surgeonName
    )
    await assertDoctorAvailableOnDate(
      prisma,
      nextDoctorName,
      validatedData.admissionDate,
      'Selected doctor is on approved leave for this date.'
    )
    await assertDoctorAvailableOnDate(
      prisma,
      nextDoctorName,
      validatedData.surgeryDate,
      'Selected doctor is on approved leave for this date.'
    )

    const { atsStatus, caseStage, autoApproved } = resolveCashDecision(
      validatedData.atsAmount,
      validatedData.approvedAmount,
    )

    await prisma.$transaction(async (tx) => {
      await tx.admissionRecord.upsert({
        where: { leadId: id },
        create: {
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
        update: {
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

      await tx.lead.update({
        where: { id },
        data: {
          patientName: validatedData.patientName,
          ...(validatedData.age != null ? { age: validatedData.age } : {}),
          sex: validatedData.sex,
          circle: validatedData.circle,
          category: validatedData.category || null,
          treatmentMasterId: validatedData.treatmentId || null,
          treatment: validatedData.treatmentName || null,
          atsAmount: validatedData.atsAmount || null,
          atsStatus,
          caseStage,
          status: 'IPD Schedule',
          hospitalName: validatedData.admittingHospital,
          ipdAdmissionDate: new Date(validatedData.admissionDate),
          // Keep the legacy lead field in sync with the IPD source of truth.
          surgeryDate: new Date(validatedData.surgeryDate),
          quantityGrade: validatedData.quantityGrade,
          anesthesia: validatedData.anesthesia,
          surgeonName: validatedData.surgeonName,
          ipdDrName: validatedData.surgeonName,
          surgeonType: validatedData.surgeonType,
          attendantName: validatedData.alternateContactName,
          alternateNumber: validatedData.alternateContactNumber,
          modeOfPayment: normalizeModeOfPaymentStorageValue(validatedData.modeOfPayment),
          billAmount: validatedData.finalBillAmount,
          settledTotal: validatedData.approvedAmount,
          collectedByMediend: validatedData.collectedByMediend ?? 0,
          collectedByHospital: validatedData.collectedByHospital ?? 0,
          remarks: buildCashRemarks('[UPDATED CASH FLOW DETAILS]', validatedData, lead.remarks),
        },
      })

      if (lead.caseStage === CaseStage.CASH_ON_HOLD && lead.caseStage !== caseStage) {
        await tx.caseStageHistory.create({
          data: {
            leadId: id,
            fromStage: CaseStage.CASH_ON_HOLD,
            toStage: caseStage,
            changedById: user.id,
            note: autoApproved
              ? 'IPD Cash Form Re-submitted - Auto-approved (above ATS)'
              : 'IPD Cash Form Re-submitted',
          },
        })
      }

      await tx.caseChatMessage.create({
        data: {
          leadId: id,
          type: 'SYSTEM',
          content: autoApproved
            ? `IPD Cash Form updated by ${user.name}. Auto-approved (approved amount ₹${validatedData.approvedAmount.toLocaleString('en-IN')} ≥ ATS ₹${validatedData.atsAmount?.toLocaleString('en-IN')}).`
            : `IPD Cash Form updated/re-submitted by ${user.name}.`,
        },
      })
    })

    return successResponse(
      { id },
      autoApproved
        ? 'IPD Cash details updated successfully - Auto-approved (above ATS limit)'
        : 'IPD Cash details updated successfully'
    )
  } catch (error) {
    if (error instanceof DoctorAvailabilityError) {
      return errorResponse(error.message, error.status)
    }
    console.error('Error updating cash flow:', error)
    if (error instanceof z.ZodError) {
      return errorResponse('Validation failed', 400)
    }
    return errorResponse('Failed to update IPD details', 500)
  }
}
