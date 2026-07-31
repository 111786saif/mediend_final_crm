import {
  CaseStage,
  LeadOpdPhase,
  LeadOpdStatus,
  Prisma,
} from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import {
  buildEffectiveOpdEntries,
  getFirstEffectivePreOpd,
  getLeadIdFromLegacyLeadOpdId,
  getNextAvailableOpdSlot,
  isLegacyLeadOpdId,
  makeLegacyLeadOpdId,
} from '@/lib/lead-opd-appointments'
import { leadOpdAppointmentSelect } from '@/lib/lead-opd-records'
import {
  getNextStageAfterOpdDone,
  getNextStageAfterOpdSchedule,
  hasLeadOpdDone,
  isOpdDoneStatus,
  OPD_DONE_STATUS,
  OPD_SCHEDULED_STATUS,
} from '@/lib/lead-opd-workflow'

export class LeadOpdMutationError extends Error {
  status: number

  constructor(message: string, status = 400) {
    super(message)
    this.name = 'LeadOpdMutationError'
    this.status = status
  }
}

const leadOpdMutationLeadSelect = {
  id: true,
  bdId: true,
  leadRef: true,
  patientName: true,
  caseStage: true,
  flowType: true,
  status: true,
  hospitalName: true,
  surgeonName: true,
  diseaseDetails: true,
  remarks: true,
  followUpDate: true,
  docUpload: true,
  opdHospital: true,
  opdDrName: true,
  opdContactNo: true,
  opdCharges: true,
  opdScheduleDate: true,
  opdMeeting: true,
  opdSurgeryAdvised: true,
  opdSurgeryRemarkCode: true,
  opdReasonNoSurgeryCode: true,
  opdFollowUpReasonCode: true,
  opdImplantRequired: true,
  opdDiagnosis: true,
  opdSurgeryRemark: {
    select: { code: true, label: true },
  },
  opdReasonNoSurgery: {
    select: { code: true, label: true },
  },
  opdFollowUpReason: {
    select: { code: true, label: true },
  },
  opdPrescriptionImages: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
    select: {
      id: true,
      fileName: true,
      fileUrl: true,
      storageKey: true,
      sortOrder: true,
    },
  },
} satisfies Prisma.LeadSelect

type LeadOpdMutationLead = Prisma.LeadGetPayload<{
  select: typeof leadOpdMutationLeadSelect
}>

type StoredPrescriptionImage = {
  name: string
  url: string
  key?: string | null
}

export type MutateLeadOpdInput = {
  leadId: string
  actorUserId?: string | null
  actorName: string
  appointmentId?: string | null
  phase?: LeadOpdPhase
  hospitalName?: string | null
  doctorName?: string | null
  contactNumber?: string | null
  charges?: number | null
  scheduleDate?: string | Date | null
  meetingType?: number | null
  surgeryAdvised?: string | null
  surgeryRemarkCode?: string | null
  reasonNoSurgeryCode?: string | null
  followUpReasonCode?: string | null
  implantRequired?: boolean | null
  diagnosis?: string | null
  remarks?: string | null
  followUpDate?: string | Date | null
  prescriptionImages?: StoredPrescriptionImage[] | null
  markDone?: boolean
  cancel?: boolean
}

function normalizeText(value: string | null | undefined) {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed || null
}

function normalizeMasterCode(value: string | null | undefined) {
  const normalized = normalizeText(value)
  return normalized ? normalized.replace(/\s+/g, '_') : normalized
}

function normalizeSurgeryAdvised(value: string | null | undefined) {
  const normalized = normalizeText(value)
  if (!normalized) return normalized

  const key = normalized.toLowerCase().replace(/[\s-]+/g, '_')
  if (['yes', 'y', 'surgery_advised', 'advised'].includes(key)) return 'yes'
  if (['no', 'n', 'no_surgery', 'not_advised'].includes(key)) return 'no'
  if (['follow_up', 'followup', 'follow'].includes(key)) return 'follow_up'
  return normalized
}

function parseOptionalDate(value: string | Date | null | undefined, fieldName: string) {
  if (value === undefined) return undefined
  if (value === null) return null
  if (value instanceof Date) return value
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00`)
    : new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    throw new LeadOpdMutationError(`${fieldName} must be a valid date`, 400)
  }
  return parsed
}

function assertPostOpdAllowed(lead: LeadOpdMutationLead) {
  const allowedStages = new Set<CaseStage>([
    CaseStage.IPD_DONE,
    CaseStage.CASH_IPD_DONE,
    CaseStage.DISCHARGED,
    CaseStage.CASH_DISCHARGED,
    CaseStage.PL_PENDING,
    CaseStage.OUTSTANDING,
  ])

  if (!allowedStages.has(lead.caseStage)) {
    throw new LeadOpdMutationError('Post OPD can be created only after IPD Done', 400)
  }
}

async function resolveMasterCode(
  tx: Prisma.TransactionClient,
  type: 'surgeryRemark' | 'reasonNoSurgery' | 'followUpReason',
  value: string | null | undefined
) {
  const code = normalizeMasterCode(value)
  if (code === undefined) return undefined
  if (code === null) return null

  if (type === 'surgeryRemark') {
    const item = await tx.surgeryRemarkMaster.findFirst({
      where: { code: { equals: code, mode: 'insensitive' }, isActive: true },
      select: { code: true },
    })
    if (!item) throw new LeadOpdMutationError('Invalid surgery remark selected', 400)
    return item.code
  }

  if (type === 'reasonNoSurgery') {
    const item = await tx.reasonNoSurgeryMaster.findFirst({
      where: { code: { equals: code, mode: 'insensitive' }, isActive: true },
      select: { code: true },
    })
    if (!item) throw new LeadOpdMutationError('Invalid reason for no surgery selected', 400)
    return item.code
  }

  const item = await tx.followUpReasonMaster.findFirst({
    where: { code: { equals: code, mode: 'insensitive' }, isActive: true },
    select: { code: true },
  })
  if (!item) throw new LeadOpdMutationError('Invalid follow-up reason selected', 400)
  return item.code
}

function getEffectiveContext(
  lead: LeadOpdMutationLead,
  appointments: Prisma.LeadOpdAppointmentGetPayload<{ select: typeof leadOpdAppointmentSelect }>[]
) {
  return buildEffectiveOpdEntries(lead, appointments)
}

export async function mutateLeadOpd(input: MutateLeadOpdInput) {
  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: input.leadId },
      select: leadOpdMutationLeadSelect,
    })

    if (!lead) {
      throw new LeadOpdMutationError('Lead not found', 404)
    }

    const appointments = await tx.leadOpdAppointment.findMany({
      where: { leadId: input.leadId },
      orderBy: [{ phase: 'asc' }, { slot: 'asc' }, { scheduleDate: 'asc' }],
      select: leadOpdAppointmentSelect,
    })

    const effectiveBefore = getEffectiveContext(lead, appointments)
    const firstPreBefore = getFirstEffectivePreOpd(effectiveBefore)
    const normalizedActorName = normalizeText(input.actorName)
    const resolvedActor =
      !normalizedActorName && input.actorUserId
        ? await tx.user.findUnique({
            where: { id: input.actorUserId },
            select: { name: true },
          })
        : null
    const actorDisplayName = normalizedActorName ?? resolvedActor?.name?.trim() ?? 'Unknown user'
    const changedById = input.actorUserId ?? lead.bdId

    const requestedPhase = input.phase
    let targetMode: 'legacy' | 'record'
    let targetId = input.appointmentId ?? null
    let targetRecord = null as (typeof appointments)[number] | null

    if (targetId) {
      if (targetId === 'legacy') {
        targetId = makeLegacyLeadOpdId(input.leadId)
      }

      if (isLegacyLeadOpdId(targetId)) {
        const legacyLeadId = getLeadIdFromLegacyLeadOpdId(targetId)
        if (legacyLeadId !== input.leadId) {
          throw new LeadOpdMutationError('Legacy OPD does not belong to this lead', 400)
        }
        targetMode = 'legacy'
      } else {
        targetMode = 'record'
        targetRecord = appointments.find((appointment) => appointment.id === targetId) ?? null
        if (!targetRecord) {
          throw new LeadOpdMutationError('OPD appointment not found', 404)
        }
      }
    } else {
      if (!requestedPhase) {
        throw new LeadOpdMutationError('Phase is required when creating an OPD', 400)
      }

      if (requestedPhase === LeadOpdPhase.POST) {
        assertPostOpdAllowed(lead)
      }

      const nextSlot = getNextAvailableOpdSlot(effectiveBefore, requestedPhase)
      if (!nextSlot) {
        throw new LeadOpdMutationError(
          requestedPhase === LeadOpdPhase.PRE
            ? 'Maximum 2 pre OPDs are allowed'
            : 'Maximum 2 post OPDs are allowed',
          400
        )
      }

      const created = await tx.leadOpdAppointment.create({
        data: {
          leadId: input.leadId,
          phase: requestedPhase,
          slot: nextSlot,
          createdById: input.actorUserId ?? null,
          updatedById: input.actorUserId ?? null,
        },
        select: leadOpdAppointmentSelect,
      })
      targetMode = 'record'
      targetId = created.id
      targetRecord = created
      appointments.push(created)
    }

    if (targetMode === 'record' && targetRecord?.phase === LeadOpdPhase.POST) {
      assertPostOpdAllowed(lead)
    }

    const isFirstEffectivePreTarget =
      firstPreBefore?.id === targetId ||
      (!firstPreBefore &&
        targetMode === 'record' &&
        (targetRecord?.phase ?? requestedPhase) === LeadOpdPhase.PRE)

    const shouldMarkDone = input.markDone === true
    const shouldCancel = input.cancel === true

    if (shouldMarkDone && targetMode === 'legacy' && hasLeadOpdDone(lead)) {
      throw new LeadOpdMutationError('OPD is already marked done', 400)
    }

    const surgeryRemarkCode = await resolveMasterCode(tx, 'surgeryRemark', input.surgeryRemarkCode)
    const reasonNoSurgeryCode = await resolveMasterCode(tx, 'reasonNoSurgery', input.reasonNoSurgeryCode)
    const followUpReasonCode = await resolveMasterCode(tx, 'followUpReason', input.followUpReasonCode)
    const normalizedSurgeryAdvised = normalizeSurgeryAdvised(input.surgeryAdvised)
    const shouldTagDoctorFollowUp = normalizedSurgeryAdvised === 'follow_up'
    const nextScheduleDate = parseOptionalDate(input.scheduleDate, 'scheduleDate')
    const nextFollowUpDate = parseOptionalDate(input.followUpDate, 'followUpDate')
    const normalizedRemarks =
      input.remarks !== undefined
        ? normalizeText(input.remarks)
        : undefined

    if (targetMode === 'legacy') {
      const leadUpdateData: Prisma.LeadUpdateInput = {
        updatedDate: new Date(),
        ...(input.actorUserId ? { updatedBy: { connect: { id: input.actorUserId } } } : {}),
        ...(input.hospitalName !== undefined ? { opdHospital: normalizeText(input.hospitalName) } : {}),
        ...(input.doctorName !== undefined ? { opdDrName: normalizeText(input.doctorName) } : {}),
        ...(input.contactNumber !== undefined ? { opdContactNo: normalizeText(input.contactNumber) } : {}),
        ...(input.charges !== undefined ? { opdCharges: input.charges ?? 0 } : {}),
        ...(input.scheduleDate !== undefined ? { opdScheduleDate: nextScheduleDate } : {}),
        ...(input.meetingType !== undefined ? { opdMeeting: input.meetingType } : {}),
        ...(input.surgeryAdvised !== undefined ? { opdSurgeryAdvised: normalizedSurgeryAdvised } : {}),
        ...(surgeryRemarkCode !== undefined ? { opdSurgeryRemarkCode: surgeryRemarkCode } : {}),
        ...(reasonNoSurgeryCode !== undefined ? { opdReasonNoSurgeryCode: reasonNoSurgeryCode } : {}),
        ...(followUpReasonCode !== undefined ? { opdFollowUpReasonCode: followUpReasonCode } : {}),
        ...(input.implantRequired !== undefined ? { opdImplantRequired: input.implantRequired } : {}),
        ...(input.diagnosis !== undefined
          ? {
              opdDiagnosis: normalizeText(input.diagnosis),
              diseaseDetails: normalizeText(input.diagnosis),
            }
          : {}),
        ...(normalizedRemarks !== undefined ? { remarks: normalizedRemarks } : {}),
        ...(input.followUpDate !== undefined ? { followUpDate: nextFollowUpDate } : {}),
      }

      if (shouldCancel) {
        leadUpdateData.opdScheduleDate = null
      }

      if (shouldMarkDone || (shouldTagDoctorFollowUp && isFirstEffectivePreTarget)) {
        leadUpdateData.status = OPD_DONE_STATUS
        const nextStage = getNextStageAfterOpdDone(lead)
        if (nextStage) {
          leadUpdateData.caseStage = nextStage
          await tx.caseStageHistory.create({
            data: {
              leadId: input.leadId,
              fromStage: lead.caseStage,
              toStage: nextStage,
              changedById,
              note: shouldTagDoctorFollowUp
                ? `Doctor follow-up required marked by ${actorDisplayName}`
                : `OPD marked done by ${actorDisplayName}`,
            },
          })
        }
      } else if (!isOpdDoneStatus(lead.status) && nextScheduleDate) {
        const nextStage = getNextStageAfterOpdSchedule(lead)
        if (nextStage) {
          leadUpdateData.status = OPD_SCHEDULED_STATUS
          leadUpdateData.caseStage = nextStage
          await tx.caseStageHistory.create({
            data: {
              leadId: input.leadId,
              fromStage: lead.caseStage,
              toStage: nextStage,
              changedById,
              note: `OPD scheduled by ${actorDisplayName}`,
            },
          })
        }
      }

      await tx.lead.update({
        where: { id: input.leadId },
        data: leadUpdateData,
      })

      if (input.prescriptionImages) {
        await tx.leadOpdPrescriptionImage.deleteMany({ where: { leadId: input.leadId } })
        if (input.prescriptionImages.length > 0) {
          await tx.leadOpdPrescriptionImage.createMany({
            data: input.prescriptionImages.map((image, index) => ({
              leadId: input.leadId,
              fileName: image.name,
              fileUrl: image.url,
              storageKey: image.key ?? null,
              sortOrder: index,
            })),
          })
        }
      }
    } else if (targetRecord) {
      const nextStatus = shouldCancel
        ? LeadOpdStatus.CANCELLED
        : shouldMarkDone || shouldTagDoctorFollowUp
          ? LeadOpdStatus.DONE
          : targetRecord.status

      await tx.leadOpdAppointment.update({
        where: { id: targetRecord.id },
        data: {
          updatedById: input.actorUserId ?? null,
          ...(input.hospitalName !== undefined ? { hospitalName: normalizeText(input.hospitalName) } : {}),
          ...(input.doctorName !== undefined ? { doctorName: normalizeText(input.doctorName) } : {}),
          ...(input.contactNumber !== undefined ? { contactNumber: normalizeText(input.contactNumber) } : {}),
          ...(input.charges !== undefined ? { charges: input.charges ?? 0 } : {}),
          ...(input.scheduleDate !== undefined ? { scheduleDate: nextScheduleDate } : {}),
          ...(input.meetingType !== undefined ? { meetingType: input.meetingType } : {}),
          ...(input.surgeryAdvised !== undefined ? { surgeryAdvised: normalizedSurgeryAdvised } : {}),
          ...(surgeryRemarkCode !== undefined ? { surgeryRemarkCode } : {}),
          ...(reasonNoSurgeryCode !== undefined ? { reasonNoSurgeryCode } : {}),
          ...(followUpReasonCode !== undefined ? { followUpReasonCode } : {}),
          ...(input.implantRequired !== undefined ? { implantRequired: input.implantRequired } : {}),
          ...(input.diagnosis !== undefined ? { diagnosis: normalizeText(input.diagnosis) } : {}),
          ...(normalizedRemarks !== undefined ? { remarks: normalizedRemarks } : {}),
          status: nextStatus,
        },
      })

      if (input.prescriptionImages) {
        await tx.leadOpdAppointmentPrescriptionImage.deleteMany({
          where: { opdAppointmentId: targetRecord.id },
        })
        if (input.prescriptionImages.length > 0) {
          await tx.leadOpdAppointmentPrescriptionImage.createMany({
            data: input.prescriptionImages.map((image, index) => ({
              opdAppointmentId: targetRecord.id,
              fileName: image.name,
              fileUrl: image.url,
              storageKey: image.key ?? null,
              sortOrder: index,
            })),
          })
        }
      }

      if (input.followUpDate !== undefined) {
        await tx.lead.update({
          where: { id: input.leadId },
          data: {
            updatedDate: new Date(),
            ...(input.actorUserId ? { updatedBy: { connect: { id: input.actorUserId } } } : {}),
            followUpDate: nextFollowUpDate,
          },
        })
      }

      if ((shouldMarkDone || shouldTagDoctorFollowUp) && isFirstEffectivePreTarget) {
        const nextStage = getNextStageAfterOpdDone(lead)
        await tx.lead.update({
          where: { id: input.leadId },
          data: {
            updatedDate: new Date(),
            ...(input.actorUserId ? { updatedBy: { connect: { id: input.actorUserId } } } : {}),
            status: OPD_DONE_STATUS,
            ...(nextStage ? { caseStage: nextStage } : {}),
          },
        })
        if (nextStage) {
          await tx.caseStageHistory.create({
            data: {
              leadId: input.leadId,
              fromStage: lead.caseStage,
              toStage: nextStage,
              changedById,
              note: shouldTagDoctorFollowUp
                ? `Doctor follow-up required marked by ${actorDisplayName}`
                : `OPD marked done by ${actorDisplayName}`,
            },
          })
        }
      } else if (
        targetRecord.phase === LeadOpdPhase.PRE &&
        !isOpdDoneStatus(lead.status) &&
        nextScheduleDate
      ) {
        const nextStage = getNextStageAfterOpdSchedule(lead)
        if (nextStage) {
          await tx.lead.update({
            where: { id: input.leadId },
            data: {
              updatedDate: new Date(),
              ...(input.actorUserId ? { updatedBy: { connect: { id: input.actorUserId } } } : {}),
              status: OPD_SCHEDULED_STATUS,
              caseStage: nextStage,
            },
          })
          await tx.caseStageHistory.create({
            data: {
              leadId: input.leadId,
              fromStage: lead.caseStage,
              toStage: nextStage,
              changedById,
              note: `OPD scheduled by ${actorDisplayName}`,
            },
          })
        }
      }
    }

    const updatedLead = await tx.lead.findUniqueOrThrow({
      where: { id: input.leadId },
      select: leadOpdMutationLeadSelect,
    })
    const updatedAppointments = await tx.leadOpdAppointment.findMany({
      where: { leadId: input.leadId },
      orderBy: [{ phase: 'asc' }, { slot: 'asc' }, { scheduleDate: 'asc' }],
      select: leadOpdAppointmentSelect,
    })

    return {
      lead: updatedLead,
      opdAppointments: updatedAppointments,
      effectiveOpdAppointments: buildEffectiveOpdEntries(updatedLead, updatedAppointments),
    }
  })
}
