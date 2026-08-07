import { CaseStage, IpdStatus, LeadOpdPhase, LeadOpdStatus, PipelineStage, Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { uploadFileToS3 } from '@/lib/s3-client'
import { DoctorAppSessionUser } from '@/lib/doctor-app/auth'
import { assertDoctorAvailableOnDate, normalizeDoctorName } from '@/lib/doctor-availability'
import {
  buildEffectiveOpdEntries,
  getEffectiveOpdCounts,
  getLeadIdFromLegacyLeadOpdId,
  isLegacyLeadOpdId,
  type EffectiveOpdEntry,
} from '@/lib/lead-opd-appointments'
import { mutateLeadOpd } from '@/lib/lead-opd-mutations'
import {
  isOpdDoneStatus,
} from '@/lib/lead-opd-workflow'
import { leadOpdAppointmentSelect } from '@/lib/lead-opd-records'

const doctorAppointmentLeadSelect = {
  id: true,
  bdId: true,
  leadRef: true,
  patientName: true,
  age: true,
  sex: true,
  phoneNumber: true,
  alternateNumber: true,
  whatsapp: true,
  status: true,
  caseStage: true,
  flowType: true,
  circle: true,
  category: true,
  treatment: true,
  quantityGrade: true,
  surgeonName: true,
  surgeonType: true,
  hospitalName: true,
  surgeryDate: true,
  operationTime: true,
  remarks: true,
  followUpDate: true,
  docUpload: true,
  diseaseDetails: true,
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
  ipdAdmissionDate: true,
  ipdHospital: true,
  ipdDrName: true,
  ipdContactNo: true,
  ipdDetails: true,
  updatedDate: true,
  createdDate: true,
  admissionRecord: {
    select: {
      id: true,
      admissionDate: true,
      admissionTime: true,
      admittingHospital: true,
      expectedSurgeryDate: true,
      surgeryDate: true,
      surgeryTime: true,
      hospitalAddress: true,
      googleMapLocation: true,
      tpa: true,
      instrument: true,
      implantConsumables: true,
      ipdStatus: true,
      ipdStatusReason: true,
      ipdImplantUsed: true,
      ipdNoShowReason: true,
      newSurgeryDate: true,
      ipdDischargeDate: true,
      ipdStatusNotes: true,
      notes: true,
      initiatedById: true,
      implantUsages: {
        orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
        select: {
          id: true,
          implantId: true,
          quantity: true,
          notes: true,
          sortOrder: true,
          implant: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
      prescriptionImages: {
        orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
        select: {
          id: true,
          fileName: true,
          fileUrl: true,
          storageKey: true,
          sortOrder: true,
        },
      },
    },
  },
  kypSubmission: {
    select: {
      id: true,
      prescriptionFileUrl: true,
    },
  },
  opdSurgeryRemark: {
    select: {
      code: true,
      label: true,
    },
  },
  opdReasonNoSurgery: {
    select: {
      code: true,
      label: true,
    },
  },
  opdFollowUpReason: {
    select: {
      code: true,
      label: true,
    },
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
  opdAppointments: {
    orderBy: [{ phase: 'asc' as const }, { slot: 'asc' as const }, { scheduleDate: 'asc' as const }],
    select: leadOpdAppointmentSelect,
  },
  dischargeSheet: {
    select: {
      id: true,
      dischargeDate: true,
      doctorName: true,
      hospitalName: true,
      patientName: true,
      patientPhone: true,
      doctorRemarks: true,
      createdById: true,
      markedById: true,
      finalizedById: true,
      markedAt: true,
      finalizedAt: true,
      isFinalized: true,
    },
  },
  caseStageHistory: {
    orderBy: { changedAt: 'desc' as const },
    take: 10,
    select: {
      id: true,
      fromStage: true,
      toStage: true,
      changedAt: true,
      note: true,
    },
  },
} satisfies Prisma.LeadSelect

type DoctorAppointmentLead = Prisma.LeadGetPayload<{
  select: typeof doctorAppointmentLeadSelect
}>

export class DoctorAppApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'DoctorAppApiError'
    this.status = status
  }
}

export interface ListDoctorAppointmentsInput {
  type: 'all' | 'opd' | 'ipd'
  status?: string
  date?: string
  day?: number
  month?: number
  year?: number
  page: number
  limit: number
}

export interface SearchDoctorAppointmentsInput extends ListDoctorAppointmentsInput {
  q: string
}

export interface UpdateDoctorOpdInput {
  opdHospital?: string
  opdCharges?: number
  opdScheduleDate?: string | null
  followUpDate?: string | null
  remarks?: string | null
  status?: string
  caseStage?: CaseStage
  markOpdDone?: boolean
  surgeryAdvised?: string | null
  surgeryRemarksType?: string | null
  reasonNoSurgery?: string | null
  followUpReason?: string | null
  implantRequired?: boolean | null
  diagnosis?: string | null
  prescriptionImages?: File[] | null
}

export interface CancelDoctorOpdInput {
  remarks?: string | null
  followUpDate?: string | null
}

export interface UpdateDoctorIpdInput {
  status?: string
  ipdAdmissionDate?: string | null
  admissionTime?: string | null
  ipdHospital?: string
  surgeryDate?: string | null
  operationTime?: string | null
  hospitalAddress?: string | null
  googleMapLocation?: string | null
  tpa?: string | null
  instrument?: string | null
  implantConsumables?: string | null
  ipdStatus?: IpdStatus | null
  ipdStatusReason?: string | null
  implantUsed?: boolean | null
  implantsUsed?: Array<{
    implantId: string
    quantity?: number | null
    notes?: string | null
  }> | null
  noShowReason?: string | null
  newSurgeryDate?: string | null
  ipdDischargeDate?: string | null
  dischargeDate?: string | null
  procedureNotes?: string | null
  notes?: string | null
  prescriptionImageUrl?: string | null
  prescriptionImageUrls?: string[] | null
  prescriptionImages?: File[] | null
}

export interface DischargeDoctorAppointmentInput {
  dischargeDate?: string | null
  doctorRemarks?: string | null
}

async function getDoctorAccount(user: DoctorAppSessionUser) {
  const account = await prisma.doctorAppAccount.findUnique({
    where: { id: user.accountId },
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
    },
  })

  if (!account || !account.isActive || !account.doctor.isActive) {
    throw new DoctorAppApiError('Doctor session is no longer active', 401)
  }

  return account
}

function getDoctorScopedLeadWhere(doctorName: string): Prisma.LeadWhereInput {
  return {
    OR: [
      { opdDrName: { equals: doctorName, mode: 'insensitive' } },
      { opdAppointments: { some: { doctorName: { equals: doctorName, mode: 'insensitive' } } } },
      { ipdDrName: { equals: doctorName, mode: 'insensitive' } },
      { surgeonName: { equals: doctorName, mode: 'insensitive' } },
    ],
  }
}

function getDoctorSearchWhere(searchText: string): Prisma.LeadWhereInput {
  return {
    OR: [
      { leadRef: { contains: searchText, mode: 'insensitive' } },
      { patientName: { contains: searchText, mode: 'insensitive' } },
      { phoneNumber: { contains: searchText, mode: 'insensitive' } },
      { whatsapp: { contains: searchText, mode: 'insensitive' } },
      { hospitalName: { contains: searchText, mode: 'insensitive' } },
      { opdHospital: { contains: searchText, mode: 'insensitive' } },
      { ipdHospital: { contains: searchText, mode: 'insensitive' } },
      {
        opdAppointments: {
          some: {
            OR: [
              { hospitalName: { contains: searchText, mode: 'insensitive' } },
              { doctorName: { contains: searchText, mode: 'insensitive' } },
              { contactNumber: { contains: searchText, mode: 'insensitive' } },
            ],
          },
        },
      },
      { treatment: { contains: searchText, mode: 'insensitive' } },
      { category: { contains: searchText, mode: 'insensitive' } },
      { circle: { contains: searchText, mode: 'insensitive' } },
    ],
  }
}

function parseOptionalDate(value: string | null | undefined, fieldName: string) {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00`)
    : new Date(trimmed)

  if (Number.isNaN(parsed.getTime())) {
    throw new DoctorAppApiError(`${fieldName} must be a valid date`, 400)
  }

  return parsed
}

function normalizeText(value: string | null | undefined) {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}

function normalizeMasterCode(value: string | null | undefined) {
  const normalized = normalizeText(value)
  return normalized ? normalized.replace(/\s+/g, '_') : normalized
}

function normalizeSurgeryAdvised(value: string | null | undefined) {
  const normalized = normalizeText(value)
  if (!normalized) {
    return normalized
  }

  const key = normalized.toLowerCase().replace(/[\s-]+/g, '_')

  if (['yes', 'y', 'surgery_advised', 'advised'].includes(key)) {
    return 'yes'
  }

  if (['no', 'n', 'no_surgery', 'not_advised'].includes(key)) {
    return 'no'
  }

  if (['follow_up', 'followup', 'follow'].includes(key)) {
    return 'follow_up'
  }

  return normalized
}

function normalizeDoctorMobileIpdStatus(value: string | null | undefined) {
  const normalized = normalizeText(value)
  if (!normalized) {
    return normalized
  }

  const key = normalized.toLowerCase().replace(/[\s-]+/g, '_')

  if (['scheduled', 'schedule'].includes(key)) {
    return 'scheduled'
  }

  if (['admitted', 'admission_done', 'admitted_done'].includes(key)) {
    return 'admitted'
  }

  if (['surgery_done', 'ipd_done', 'done'].includes(key)) {
    return 'surgery_done'
  }

  if (['discharged', 'discharge_done'].includes(key)) {
    return 'discharged'
  }

  if (['closed', 'complete', 'completed'].includes(key)) {
    return 'closed'
  }

  if (['no_show', 'noshow', 'cancelled', 'canceled'].includes(key)) {
    return 'no_show'
  }

  return normalized
}

function normalizeIpdNoShowReason(value: string | null | undefined) {
  const normalized = normalizeText(value)
  if (!normalized) {
    return normalized
  }

  return normalized.toLowerCase().replace(/[\s-]+/g, '_')
}

function mapDoctorMobileIpdStatusToEnum(
  status: DoctorMobileIpdStatus | string | null | undefined
): IpdStatus | null | undefined {
  switch (status) {
    case 'admitted':
      return IpdStatus.ADMITTED_DONE
    case 'surgery_done':
      return IpdStatus.IPD_DONE
    case 'no_show':
      return IpdStatus.CANCELLED
    case 'discharged':
    case 'closed':
      return IpdStatus.DISCHARGED
    case 'scheduled':
      return null
    default:
      return undefined
  }
}

function getCaseStageForDoctorMobileIpdStatus(
  status: DoctorMobileIpdStatus | string | null | undefined,
  isCashFlow: boolean
) {
  if (status === 'surgery_done') {
    return isCashFlow ? CaseStage.CASH_IPD_DONE : CaseStage.IPD_DONE
  }

  if (status === 'admitted' && !isCashFlow) {
    return CaseStage.ADMITTED
  }

  return undefined
}

function getCaseStageForIpdEnumStatus(
  status: IpdStatus | null | undefined,
  isCashFlow: boolean
) {
  if (status === IpdStatus.IPD_DONE) {
    return isCashFlow ? CaseStage.CASH_IPD_DONE : CaseStage.IPD_DONE
  }

  if (status === IpdStatus.ADMITTED_DONE && !isCashFlow) {
    return CaseStage.ADMITTED
  }

  return undefined
}

function deriveFileNameFromUrl(url: string) {
  const trimmed = url.trim()
  if (!trimmed) {
    return 'Prescription'
  }

  const pathValue = trimmed.split('?')[0]?.split('#')[0] || trimmed
  const segments = pathValue.split('/').filter(Boolean)
  return segments[segments.length - 1] || 'Prescription'
}

function mergeStoredPrescriptionImages(
  existing: StoredPrescriptionImage[],
  incoming: StoredPrescriptionImage[]
) {
  const seen = new Set(existing.map((file) => file.url))
  const merged = [...existing]

  for (const file of incoming) {
    if (!file.url || seen.has(file.url)) {
      continue
    }

    seen.add(file.url)
    merged.push(file)
  }

  return merged
}

type StoredPrescriptionImage = {
  name: string
  url: string
  key?: string | null
}

type MasterOptionSummary = {
  code: string
  label: string
}

type ResolvedImplantUsage = {
  implantId: string
  quantity: number
  notes: string | null
}

type DoctorMobileIpdStatus =
  | 'scheduled'
  | 'admitted'
  | 'surgery_done'
  | 'discharged'
  | 'closed'
  | 'no_show'

async function resolveMasterOptionByCode(
  tx: Prisma.TransactionClient,
  type: 'surgeryRemark' | 'reasonNoSurgery' | 'followUpReason',
  value: string | null | undefined
): Promise<MasterOptionSummary | null | undefined> {
  const code = normalizeMasterCode(value)
  if (code === undefined) {
    return undefined
  }

  if (code === null) {
    return null
  }

  if (type === 'surgeryRemark') {
    const item = await tx.surgeryRemarkMaster.findFirst({
      where: {
        code: { equals: code, mode: 'insensitive' },
        isActive: true,
      },
      select: { code: true, label: true },
    })

    if (!item) {
      throw new DoctorAppApiError('Invalid surgery remark selected', 400)
    }

    return item
  }

  if (type === 'reasonNoSurgery') {
    const item = await tx.reasonNoSurgeryMaster.findFirst({
      where: {
        code: { equals: code, mode: 'insensitive' },
        isActive: true,
      },
      select: { code: true, label: true },
    })

    if (!item) {
      throw new DoctorAppApiError('Invalid reason for no surgery selected', 400)
    }

    return item
  }

  const item = await tx.followUpReasonMaster.findFirst({
    where: {
      code: { equals: code, mode: 'insensitive' },
      isActive: true,
    },
    select: { code: true, label: true },
  })

  if (!item) {
    throw new DoctorAppApiError('Invalid follow-up reason selected', 400)
  }

  return item
}

async function resolveImplantUsages(
  tx: Prisma.TransactionClient,
  items: UpdateDoctorIpdInput['implantsUsed']
): Promise<ResolvedImplantUsage[] | undefined> {
  if (items === undefined) {
    return undefined
  }

  if (!items || items.length === 0) {
    return []
  }

  const implantIds = items.map((item) => item.implantId.trim()).filter(Boolean)
  if (implantIds.length !== items.length) {
    throw new DoctorAppApiError('Each implant row must have a valid implantId', 400)
  }

  const implants = await tx.implantMaster.findMany({
    where: {
      id: { in: Array.from(new Set(implantIds)) },
      isActive: true,
    },
    select: {
      id: true,
    },
  })

  if (implants.length !== new Set(implantIds).size) {
    throw new DoctorAppApiError('One or more selected implants are invalid or inactive', 400)
  }

  return items.map((item) => {
    const implantId = item.implantId.trim()
    const quantity =
      item.quantity === undefined || item.quantity === null
        ? 1
        : Math.max(1, Math.trunc(item.quantity))

    return {
      implantId,
      quantity,
      notes: normalizeText(item.notes) ?? null,
    }
  })
}

function isIpdLead(lead: DoctorAppointmentLead) {
  return Boolean(
    lead.admissionRecord ||
      lead.ipdAdmissionDate ||
      lead.ipdHospital ||
      lead.ipdDrName ||
      lead.surgeryDate
  )
}

type DoctorFlatAppointment = {
  id: string
  leadId: string
  appointmentType: 'opd' | 'ipd'
  lead: DoctorAppointmentLead
  opdEntry: EffectiveOpdEntry | null
  opdCounts: { pre: number; post: number }
}

function normalizeComparableText(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function getAppointmentDoctorName(lead: DoctorAppointmentLead) {
  return lead.ipdDrName || lead.opdDrName || lead.surgeonName || null
}

function getAppointmentHospitalName(lead: DoctorAppointmentLead) {
  return lead.ipdHospital || lead.opdHospital || lead.hospitalName || null
}

function getEffectiveOpdEntriesForLead(lead: DoctorAppointmentLead) {
  return buildEffectiveOpdEntries(lead, lead.opdAppointments)
}

function matchesDoctorAssignment(value: string | null | undefined, doctorName: string) {
  return normalizeComparableText(value) === normalizeComparableText(doctorName)
}

function getDoctorScopedOpdEntries(lead: DoctorAppointmentLead, doctorName: string) {
  return getEffectiveOpdEntriesForLead(lead).filter((entry) =>
    matchesDoctorAssignment(entry.doctorName, doctorName)
  )
}

function isDoctorFollowUpOpd(appointment: DoctorFlatAppointment) {
  return (
    appointment.appointmentType === 'opd' &&
    normalizeSurgeryAdvised(appointment.opdEntry?.surgeryAdvised) === 'follow_up'
  )
}

function shouldIncludeIpdForDoctor(lead: DoctorAppointmentLead, doctorName: string) {
  if (!isIpdLead(lead)) {
    return false
  }

  return matchesDoctorAssignment(getAppointmentDoctorName(lead), doctorName)
}

function mapLeadToDoctorAppointments(lead: DoctorAppointmentLead, doctorName: string) {
  const opdCounts = getEffectiveOpdCounts(getEffectiveOpdEntriesForLead(lead))
  const appointments: DoctorFlatAppointment[] = getDoctorScopedOpdEntries(lead, doctorName).map(
    (entry) => ({
      id: entry.id,
      leadId: lead.id,
      appointmentType: 'opd',
      lead,
      opdEntry: entry,
      opdCounts,
    })
  )

  if (shouldIncludeIpdForDoctor(lead, doctorName)) {
    appointments.push({
      id: lead.id,
      leadId: lead.id,
      appointmentType: 'ipd',
      lead,
      opdEntry: null,
      opdCounts,
    })
  }

  return appointments
}

function getAppointmentDateForRow(appointment: DoctorFlatAppointment) {
  if (appointment.appointmentType === 'ipd') {
    return (
      appointment.lead.admissionRecord?.admissionDate ||
      appointment.lead.ipdAdmissionDate ||
      appointment.lead.admissionRecord?.surgeryDate ||
      appointment.lead.surgeryDate ||
      appointment.lead.followUpDate ||
      appointment.lead.updatedDate
    )
  }

  if (isDoctorFollowUpOpd(appointment) && appointment.lead.followUpDate) {
    return appointment.lead.followUpDate
  }

  return (
    appointment.opdEntry?.scheduleDate ||
    appointment.lead.followUpDate ||
    appointment.lead.updatedDate
  )
}

function getAppointmentStatusForRow(appointment: DoctorFlatAppointment) {
  if (appointment.appointmentType === 'ipd') {
    return appointment.lead.admissionRecord?.ipdStatus || appointment.lead.caseStage
  }

  switch (appointment.opdEntry?.status) {
    case LeadOpdStatus.DONE:
      return 'DONE'
    case LeadOpdStatus.CANCELLED:
      return 'CANCELLED'
    case LeadOpdStatus.NO_SHOW:
      return 'NO_SHOW'
    case LeadOpdStatus.SCHEDULED:
    default:
      return 'SCHEDULED'
  }
}

function buildRequestedDate(input: ListDoctorAppointmentsInput) {
  const hasDay = input.day !== undefined
  const hasMonth = input.month !== undefined
  const hasYear = input.year !== undefined

  if (hasDay) {
    const now = new Date()
    const year = input.year ?? now.getFullYear()
    const month = input.month ?? now.getMonth() + 1
    const date = new Date(year, month - 1, input.day!, 0, 0, 0, 0)

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== input.day
    ) {
      throw new DoctorAppApiError('Invalid day/month/year combination', 400)
    }

    return { mode: 'day' as const, date }
  }

  if (hasMonth) {
    const year = input.year ?? new Date().getFullYear()
    return { mode: 'month' as const, month: input.month!, year }
  }

  if (hasYear) {
    return { mode: 'year' as const, year: input.year! }
  }

  if (input.date) {
    const date = parseOptionalDate(input.date, 'date')
    if (!date) {
      return null
    }
    return { mode: 'day' as const, date }
  }

  return null
}

function matchesDateFilter(appointment: DoctorFlatAppointment, input: ListDoctorAppointmentsInput) {
  const requested = buildRequestedDate(input)
  if (!requested) {
    return true
  }

  const value = getAppointmentDateForRow(appointment)
  if (!value) {
    return false
  }

  const date = new Date(value)

  if (requested.mode === 'day') {
    return (
      date.getFullYear() === requested.date.getFullYear() &&
      date.getMonth() === requested.date.getMonth() &&
      date.getDate() === requested.date.getDate()
    )
  }

  if (requested.mode === 'month') {
    return date.getFullYear() === requested.year && date.getMonth() + 1 === requested.month
  }

  return date.getFullYear() === requested.year
}

function matchesTypeFilter(appointment: DoctorFlatAppointment, type: 'all' | 'opd' | 'ipd') {
  if (type === 'all') {
    return true
  }

  return appointment.appointmentType === type
}

function matchesStatusFilter(appointment: DoctorFlatAppointment, status?: string) {
  if (!status) {
    return true
  }

  const normalized = status.trim().toLowerCase()
  const doctorFollowUpRequired = isDoctorFollowUpOpd(appointment)
  const appointmentStatus = String(getAppointmentStatusForRow(appointment) || '').trim().toLowerCase()
  const leadStatus = String(appointment.lead.status || '').trim().toLowerCase()
  const caseStage = String(appointment.lead.caseStage || '').trim().toLowerCase()

  if (
    doctorFollowUpRequired &&
    [
      'follow_up_required',
      'follow-up-required',
      'follow_up_pending',
      'follow-up-pending',
      'doctor_follow_up_required',
      'doctor-follow-up-required',
      'follow_up',
      'follow-up',
      'followup',
    ].includes(normalized)
  ) {
    return true
  }

  return (
    appointmentStatus === normalized ||
    leadStatus === normalized ||
    caseStage === normalized
  )
}

function mapAppointmentSummary(appointment: DoctorFlatAppointment) {
  const { lead, appointmentType, opdEntry, opdCounts } = appointment
  const doctorFollowUpRequired = isDoctorFollowUpOpd(appointment)
  const ipdPrescriptionFileUrl = lead.admissionRecord?.prescriptionImages[0]?.fileUrl || null
  const opdPrescriptionFileUrl =
    appointmentType === 'opd'
      ? opdEntry?.prescriptionImages[0]?.fileUrl || null
      : lead.opdPrescriptionImages[0]?.fileUrl || null
  const primaryPrescriptionFileUrl =
    (appointmentType === 'ipd'
      ? ipdPrescriptionFileUrl || opdPrescriptionFileUrl
      : opdPrescriptionFileUrl || ipdPrescriptionFileUrl) ||
    lead.kypSubmission?.prescriptionFileUrl ||
    lead.docUpload ||
    null

  return {
    id: appointment.id,
    leadId: appointment.leadId,
    leadRef: lead.leadRef,
    appointmentType,
    appointmentDate: getAppointmentDateForRow(appointment),
    appointmentStatus: getAppointmentStatusForRow(appointment),
    doctorFollowUpRequired,
    opdCounts,
    patient: {
      name: lead.patientName,
      age: lead.age,
      sex: lead.sex,
      phoneNumber: lead.phoneNumber,
      alternateNumber: lead.alternateNumber,
      whatsapp: lead.whatsapp,
    },
    doctor: {
      name:
        appointmentType === 'opd'
          ? opdEntry?.doctorName || lead.surgeonName || null
          : getAppointmentDoctorName(lead),
    },
    hospital: {
      name:
        appointmentType === 'opd'
          ? opdEntry?.hospitalName || lead.hospitalName || null
          : getAppointmentHospitalName(lead),
      circle: lead.circle,
    },
    lead: {
      status: lead.status,
      caseStage: lead.caseStage,
      flowType: lead.flowType,
      category: lead.category,
      treatment: lead.treatment,
      followUpDate: lead.followUpDate,
      remarks: lead.remarks,
    },
    opd: {
      appointmentId: appointmentType === 'opd' ? appointment.id : null,
      phase: appointmentType === 'opd' ? opdEntry?.phase ?? null : null,
      slot: appointmentType === 'opd' ? opdEntry?.slot ?? null : null,
      isLegacy: appointmentType === 'opd' ? opdEntry?.source === 'legacy' : false,
      hospital: appointmentType === 'opd' ? opdEntry?.hospitalName ?? null : lead.opdHospital,
      doctorName: appointmentType === 'opd' ? opdEntry?.doctorName ?? null : lead.opdDrName,
      contactNumber:
        appointmentType === 'opd' ? opdEntry?.contactNumber ?? null : lead.opdContactNo,
      charges: appointmentType === 'opd' ? opdEntry?.charges ?? null : lead.opdCharges,
      scheduledDate:
        appointmentType === 'opd' ? opdEntry?.scheduleDate ?? null : lead.opdScheduleDate,
      meetingCount:
        appointmentType === 'opd' ? opdEntry?.meetingType ?? null : lead.opdMeeting,
      status: appointmentType === 'opd' ? opdEntry?.status ?? null : null,
    },
    ipd: {
      admissionDate: lead.admissionRecord?.admissionDate || lead.ipdAdmissionDate,
      admissionTime: lead.admissionRecord?.admissionTime || null,
      hospital: lead.admissionRecord?.admittingHospital || lead.ipdHospital,
      doctorName: lead.ipdDrName,
      contactNumber: lead.ipdContactNo,
      surgeryDate: lead.admissionRecord?.surgeryDate || lead.surgeryDate,
      surgeryTime: lead.admissionRecord?.surgeryTime || lead.operationTime,
      status: lead.admissionRecord?.ipdStatus || null,
      statusReason: lead.admissionRecord?.ipdStatusReason || null,
      implantUsed: lead.admissionRecord?.ipdImplantUsed ?? null,
      noShowReason: lead.admissionRecord?.ipdNoShowReason || null,
      procedureNotes: lead.admissionRecord?.ipdStatusNotes || null,
      dischargeDate: lead.admissionRecord?.ipdDischargeDate || lead.dischargeSheet?.dischargeDate || null,
    },
    prescription: {
      fileUrl: primaryPrescriptionFileUrl,
    },
    updatedAt: lead.updatedDate,
  }
}

function mapAppointmentDetail(appointment: DoctorFlatAppointment) {
  const { lead, appointmentType, opdEntry, opdCounts } = appointment
  const effectiveOpds = getEffectiveOpdEntriesForLead(lead)
  const currentOpdEntry =
    appointmentType === 'opd'
      ? opdEntry
      : effectiveOpds.find((entry) => entry.isFirstEffectivePreOpd) ?? effectiveOpds[0] ?? null
  const opdPrescriptionFiles = (currentOpdEntry?.prescriptionImages ?? []).map((image) => ({
    name: image.fileName,
    url: image.fileUrl,
    key: image.storageKey,
  }))
  const ipdPrescriptionFiles =
    lead.admissionRecord?.prescriptionImages.map((image) => ({
      name: image.fileName,
      url: image.fileUrl,
      key: image.storageKey,
    })) || []
  const primaryPrescriptionFiles =
    appointmentType === 'ipd' && ipdPrescriptionFiles.length > 0
      ? ipdPrescriptionFiles
      : opdPrescriptionFiles.length > 0
        ? opdPrescriptionFiles
        : ipdPrescriptionFiles
  const primaryPrescriptionFileUrl =
    primaryPrescriptionFiles[0]?.url ||
    lead.kypSubmission?.prescriptionFileUrl ||
    lead.docUpload ||
    null

  return {
    ...mapAppointmentSummary(appointment),
    lead: {
      id: lead.id,
      leadRef: lead.leadRef,
      status: lead.status,
      caseStage: lead.caseStage,
      flowType: lead.flowType,
      category: lead.category,
      treatment: lead.treatment,
      quantityGrade: lead.quantityGrade,
      surgeonName: lead.surgeonName,
      surgeonType: lead.surgeonType,
      hospitalName: lead.hospitalName,
      remarks: lead.remarks,
      followUpDate: lead.followUpDate,
      diseaseDetails: lead.diseaseDetails,
      createdAt: lead.createdDate,
      updatedAt: lead.updatedDate,
    },
    effectiveOpds: {
      pre: effectiveOpds.filter((entry) => entry.phase === LeadOpdPhase.PRE),
      post: effectiveOpds.filter((entry) => entry.phase === LeadOpdPhase.POST),
      all: effectiveOpds,
    },
    currentOpd:
      currentOpdEntry && appointmentType === 'opd'
        ? {
            id: currentOpdEntry.id,
            phase: currentOpdEntry.phase,
            slot: currentOpdEntry.slot,
            source: currentOpdEntry.source,
            status: currentOpdEntry.status,
          }
        : null,
    prescription: {
      fileUrl: primaryPrescriptionFileUrl,
      files: primaryPrescriptionFiles,
    },
    opdCounts,
    opdRecording: {
      surgeryAdvised: currentOpdEntry?.surgeryAdvised ?? null,
      surgeryRemarksType: currentOpdEntry?.surgeryRemarkCode ?? null,
      surgeryRemark: currentOpdEntry?.surgeryRemark ?? null,
      reasonNoSurgery: currentOpdEntry?.reasonNoSurgery ?? null,
      followUpReason: currentOpdEntry?.followUpReason ?? null,
      implantRequired: currentOpdEntry?.implantRequired ?? null,
      diagnosis: currentOpdEntry?.diagnosis ?? lead.diseaseDetails ?? null,
      remarks: currentOpdEntry?.remarks ?? null,
      prescriptionImages: opdPrescriptionFiles,
    },
    ipdRecording: {
      status: lead.admissionRecord?.ipdStatus ?? null,
      statusReason: lead.admissionRecord?.ipdStatusReason ?? null,
      procedureNotes: lead.admissionRecord?.ipdStatusNotes ?? null,
      implantUsed: lead.admissionRecord?.ipdImplantUsed ?? null,
      noShowReason: lead.admissionRecord?.ipdNoShowReason ?? null,
      prescriptionImages: ipdPrescriptionFiles,
      implantsUsed:
        lead.admissionRecord?.implantUsages.map((usage) => ({
          id: usage.id,
          implantId: usage.implantId,
          quantity: usage.quantity,
          notes: usage.notes,
          sortOrder: usage.sortOrder,
          implant: usage.implant,
        })) || [],
    },
    admissionRecord: lead.admissionRecord,
    dischargeSheet: lead.dischargeSheet,
    caseStageHistory: lead.caseStageHistory,
  }
}

function paginate<T>(items: T[], page: number, limit: number) {
  const total = items.length
  const pages = Math.max(1, Math.ceil(total / limit))
  const currentPage = Math.min(page, pages)
  const start = (currentPage - 1) * limit
  const data = items.slice(start, start + limit)

  return {
    data,
    pagination: {
      page: currentPage,
      limit,
      total,
      pages,
    },
  }
}

async function findDoctorScopedLead(user: DoctorAppSessionUser, leadId: string) {
  const account = await getDoctorAccount(user)

  const lead = await prisma.lead.findFirst({
    where: {
      id: leadId,
      AND: [getDoctorScopedLeadWhere(account.doctor.name)],
    },
    select: doctorAppointmentLeadSelect,
  })

  if (!lead) {
    throw new DoctorAppApiError('Appointment not found', 404)
  }

  return { account, lead }
}

async function findDoctorScopedAppointment(user: DoctorAppSessionUser, appointmentId: string) {
  const account = await getDoctorAccount(user)

  const loadLead = async (leadId: string) =>
    prisma.lead.findFirst({
      where: {
        id: leadId,
        AND: [getDoctorScopedLeadWhere(account.doctor.name)],
      },
      select: doctorAppointmentLeadSelect,
    })

  let lead: DoctorAppointmentLead | null = null

  if (isLegacyLeadOpdId(appointmentId)) {
    const leadId = getLeadIdFromLegacyLeadOpdId(appointmentId)
    if (!leadId) {
      throw new DoctorAppApiError('Appointment not found', 404)
    }
    lead = await loadLead(leadId)
  } else {
    lead = await loadLead(appointmentId)

    if (!lead) {
      const opdAppointment = await prisma.leadOpdAppointment.findUnique({
        where: { id: appointmentId },
        select: { leadId: true },
      })

      if (opdAppointment) {
        lead = await loadLead(opdAppointment.leadId)
      }
    }
  }

  if (!lead) {
    throw new DoctorAppApiError('Appointment not found', 404)
  }

  const appointments = mapLeadToDoctorAppointments(lead, account.doctor.name)
  const appointment =
    appointments.find((item) => item.id === appointmentId) ||
    appointments.find((item) => item.appointmentType === 'ipd' && item.id === lead.id) ||
    appointments[0] ||
    null

  if (!appointment) {
    throw new DoctorAppApiError('Appointment not found', 404)
  }

  return { account, lead, appointment }
}

export async function listDoctorAppointments(
  user: DoctorAppSessionUser,
  input: ListDoctorAppointmentsInput
) {
  const account = await getDoctorAccount(user)

  const leads = await prisma.lead.findMany({
    where: {
      AND: [getDoctorScopedLeadWhere(account.doctor.name)],
    },
    select: doctorAppointmentLeadSelect,
    orderBy: { updatedDate: 'desc' },
  })

  const appointments = leads.flatMap((lead) => mapLeadToDoctorAppointments(lead, account.doctor.name))
  const filtered = appointments
    .filter((appointment) => matchesTypeFilter(appointment, input.type))
    .filter((appointment) => matchesStatusFilter(appointment, input.status))
    .filter((appointment) => matchesDateFilter(appointment, input))
    .sort((a, b) => {
      const aDateValue = getAppointmentDateForRow(a)
      const bDateValue = getAppointmentDateForRow(b)
      const aDate = aDateValue ? new Date(aDateValue).getTime() : 0
      const bDate = bDateValue ? new Date(bDateValue).getTime() : 0
      return bDate - aDate
    })

  const paginated = paginate(filtered.map(mapAppointmentSummary), input.page, input.limit)

  return {
    doctor: {
      id: account.doctor.id,
      name: account.doctor.name,
    },
    appointments: paginated.data,
    pagination: paginated.pagination,
  }
}

export async function searchDoctorAppointments(
  user: DoctorAppSessionUser,
  input: SearchDoctorAppointmentsInput
) {
  const account = await getDoctorAccount(user)
  const query = input.q.trim()

  const leads = await prisma.lead.findMany({
    where: {
      AND: [getDoctorScopedLeadWhere(account.doctor.name), getDoctorSearchWhere(query)],
    },
    select: doctorAppointmentLeadSelect,
    orderBy: { updatedDate: 'desc' },
  })

  const appointments = leads.flatMap((lead) => mapLeadToDoctorAppointments(lead, account.doctor.name))
  const filtered = appointments
    .filter((appointment) => matchesTypeFilter(appointment, input.type))
    .filter((appointment) => matchesStatusFilter(appointment, input.status))
    .filter((appointment) => matchesDateFilter(appointment, input))
    .sort((a, b) => {
      const aDateValue = getAppointmentDateForRow(a)
      const bDateValue = getAppointmentDateForRow(b)
      const aDate = aDateValue ? new Date(aDateValue).getTime() : 0
      const bDate = bDateValue ? new Date(bDateValue).getTime() : 0
      return bDate - aDate
    })

  const paginated = paginate(filtered.map(mapAppointmentSummary), input.page, input.limit)

  return {
    doctor: {
      id: account.doctor.id,
      name: account.doctor.name,
    },
    query,
    appointments: paginated.data,
    pagination: paginated.pagination,
  }
}

export async function getDoctorAppointmentById(user: DoctorAppSessionUser, appointmentId: string) {
  const { appointment } = await findDoctorScopedAppointment(user, appointmentId)
  return mapAppointmentDetail(appointment)
}

export async function updateDoctorOpdAppointment(
  user: DoctorAppSessionUser,
  appointmentId: string,
  input: UpdateDoctorOpdInput
) {
  const { lead, appointment } = await findDoctorScopedAppointment(user, appointmentId)
  if (appointment.appointmentType !== 'opd' || !appointment.opdEntry) {
    throw new DoctorAppApiError('OPD appointment not found', 404)
  }

  const nextOpdDoctorName = normalizeDoctorName(
    appointment.opdEntry.doctorName || lead.opdDrName || lead.surgeonName
  )
  const nextOpdScheduleDate =
    input.opdScheduleDate !== undefined
      ? input.opdScheduleDate
      : appointment.opdEntry.scheduleDate
        ? new Date(appointment.opdEntry.scheduleDate).toISOString()
        : null

  await assertDoctorAvailableOnDate(
    prisma,
    nextOpdDoctorName,
    nextOpdScheduleDate,
    'Selected doctor is on approved leave for this date.'
  )

  const shouldMarkOpdDone = input.markOpdDone || isOpdDoneStatus(input.status?.trim())

  if (shouldMarkOpdDone) {
    if (appointment.opdEntry.status === LeadOpdStatus.DONE) {
      throw new DoctorAppApiError('OPD is already marked done', 400)
    }
  }

  const uploadedPrescriptionImages: StoredPrescriptionImage[] = []

  if (input.prescriptionImages?.length) {
    for (const file of input.prescriptionImages) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const upload = await uploadFileToS3(buffer, file.name, 'doctor-app/prescriptions')
      uploadedPrescriptionImages.push({
        name: file.name,
        url: upload.url,
        key: upload.key,
      })
    }
  }

  await mutateLeadOpd({
    leadId: lead.id,
    actorName: user.name,
    actorRole: user.role,
    appointmentId: appointment.id,
    hospitalName: input.opdHospital,
    charges: input.opdCharges,
    scheduleDate: input.opdScheduleDate,
    surgeryAdvised: input.surgeryAdvised,
    surgeryRemarkCode: input.surgeryRemarksType,
    reasonNoSurgeryCode: input.reasonNoSurgery,
    followUpReasonCode: input.followUpReason,
    implantRequired: input.implantRequired,
    diagnosis: input.diagnosis,
    remarks: input.remarks !== undefined ? normalizeText(input.remarks) : undefined,
    followUpDate: input.followUpDate,
    prescriptionImages: uploadedPrescriptionImages,
    markDone: shouldMarkOpdDone,
  })

  return getDoctorAppointmentById(user, appointment.id)
}

export async function cancelDoctorOpdAppointment(
  user: DoctorAppSessionUser,
  appointmentId: string,
  input: CancelDoctorOpdInput
) {
  const { lead, appointment } = await findDoctorScopedAppointment(user, appointmentId)
  if (appointment.appointmentType !== 'opd') {
    throw new DoctorAppApiError('OPD appointment not found', 404)
  }

  await mutateLeadOpd({
    leadId: lead.id,
    actorName: user.name,
    actorRole: user.role,
    appointmentId: appointment.id,
    followUpDate: input.followUpDate,
    remarks: input.remarks !== undefined ? normalizeText(input.remarks) : undefined,
    cancel: true,
  })

  return getDoctorAppointmentById(user, appointment.id)
}

export async function updateDoctorIpdAppointment(
  user: DoctorAppSessionUser,
  leadId: string,
  input: UpdateDoctorIpdInput
) {
  const { lead } = await findDoctorScopedLead(user, leadId)

  if (!lead.admissionRecord) {
    throw new DoctorAppApiError(
      'IPD admission record not found. Doctors can only update existing IPD cases.',
      400
    )
  }

  const admissionRecord = lead.admissionRecord

  const normalizedDoctorStatus = normalizeDoctorMobileIpdStatus(
    input.status
  ) as DoctorMobileIpdStatus | string | null | undefined
  const admissionDate = parseOptionalDate(input.ipdAdmissionDate, 'ipdAdmissionDate')
  const surgeryDate = parseOptionalDate(input.surgeryDate, 'surgeryDate')
  const newSurgeryDate = parseOptionalDate(input.newSurgeryDate, 'newSurgeryDate')
  const dischargeDate = parseOptionalDate(
    input.ipdDischargeDate !== undefined ? input.ipdDischargeDate : input.dischargeDate,
    'ipdDischargeDate'
  )
  const effectiveIpdStatus =
    input.ipdStatus !== undefined
      ? input.ipdStatus
      : mapDoctorMobileIpdStatusToEnum(normalizedDoctorStatus)
  const normalizedNoShowReason = normalizeIpdNoShowReason(input.noShowReason)
  const normalizedProcedureNotes = normalizeText(input.procedureNotes)
  const normalizedStatusReason = normalizeText(input.ipdStatusReason)
  const normalizedIpdHospital =
    input.ipdHospital !== undefined ? input.ipdHospital.trim() : undefined
  const normalizedOperationTime = normalizeText(input.operationTime)
  const normalizedAdmissionTime = normalizeText(input.admissionTime)
  const normalizedStatusNotes =
    normalizedProcedureNotes !== undefined ? normalizedProcedureNotes : undefined
  const isCashFlow = lead.flowType === 'CASH'
  const nextIpdDoctorName = normalizeDoctorName(
    lead.ipdDrName ?? lead.surgeonName
  )
  const nextAdmissionDate =
    input.ipdAdmissionDate !== undefined
      ? input.ipdAdmissionDate
      : lead.admissionRecord?.admissionDate || lead.ipdAdmissionDate
  const nextSurgeryDate =
    input.surgeryDate !== undefined
      ? input.surgeryDate
      : lead.admissionRecord?.surgeryDate || lead.surgeryDate

  await assertDoctorAvailableOnDate(
    prisma,
    nextIpdDoctorName,
    nextAdmissionDate,
    'Selected doctor is on approved leave for this date.'
  )
  await assertDoctorAvailableOnDate(
    prisma,
    nextIpdDoctorName,
    nextSurgeryDate,
    'Selected doctor is on approved leave for this date.'
  )

  const targetCaseStage =
    getCaseStageForDoctorMobileIpdStatus(normalizedDoctorStatus, isCashFlow) ??
    getCaseStageForIpdEnumStatus(effectiveIpdStatus, isCashFlow)
  const stageChanged = Boolean(targetCaseStage && targetCaseStage !== lead.caseStage)
  const stageChangedById = stageChanged ? admissionRecord.initiatedById : null

  if (normalizedDoctorStatus === 'surgery_done') {
    if (input.implantUsed === undefined || input.implantUsed === null) {
      throw new DoctorAppApiError(
        'implantUsed (true/false) is required when status is surgery_done',
        400
      )
    }

    if (input.implantUsed && (!input.implantsUsed || input.implantsUsed.length === 0)) {
      throw new DoctorAppApiError(
        'At least one implant is required when implantUsed is true',
        400
      )
    }
  }

  if (normalizedDoctorStatus === 'no_show' && !normalizedNoShowReason) {
    throw new DoctorAppApiError('noShowReason is required when status is no_show', 400)
  }

  const uploadedPrescriptionImages: StoredPrescriptionImage[] = []
  if (input.prescriptionImages?.length) {
    for (const file of input.prescriptionImages) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const upload = await uploadFileToS3(buffer, file.name, 'doctor-app/prescriptions')
      uploadedPrescriptionImages.push({
        name: file.name,
        url: upload.url,
        key: upload.key,
      })
    }
  }

  const inputPrescriptionImages = [
    ...(input.prescriptionImageUrl ? [input.prescriptionImageUrl] : []),
    ...(input.prescriptionImageUrls || []),
  ]
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url): StoredPrescriptionImage => ({
      name: deriveFileNameFromUrl(url),
      url,
      key: null,
    }))

  await prisma.$transaction(async (tx) => {
    const resolvedImplantUsages = await resolveImplantUsages(
      tx,
      normalizedDoctorStatus === 'no_show'
        ? []
        : normalizedDoctorStatus === 'surgery_done' && input.implantUsed === false
          ? []
          : input.implantsUsed
    )

    const admissionRecordId = admissionRecord.id

    await tx.admissionRecord.update({
      where: { leadId },
      data: {
        ...(input.ipdAdmissionDate !== undefined && admissionDate ? { admissionDate } : {}),
        ...(input.admissionTime !== undefined
          ? { admissionTime: normalizedAdmissionTime || '' }
          : {}),
        ...(normalizedIpdHospital !== undefined
          ? { admittingHospital: normalizedIpdHospital }
          : {}),
        ...(input.surgeryDate !== undefined ? { surgeryDate } : {}),
        ...(input.operationTime !== undefined ? { surgeryTime: normalizedOperationTime } : {}),
        ...(input.hospitalAddress !== undefined
          ? { hospitalAddress: normalizeText(input.hospitalAddress) }
          : {}),
        ...(input.googleMapLocation !== undefined
          ? { googleMapLocation: normalizeText(input.googleMapLocation) }
          : {}),
        ...(input.tpa !== undefined ? { tpa: normalizeText(input.tpa) } : {}),
        ...(input.instrument !== undefined ? { instrument: normalizeText(input.instrument) } : {}),
        ...(input.implantConsumables !== undefined
          ? { implantConsumables: normalizeText(input.implantConsumables) }
          : {}),
        ...(effectiveIpdStatus !== undefined ? { ipdStatus: effectiveIpdStatus } : {}),
        ...(normalizedStatusReason !== undefined
          ? { ipdStatusReason: normalizedStatusReason }
          : normalizedDoctorStatus === 'no_show'
            ? { ipdStatusReason: normalizedNoShowReason ?? null }
            : {}),
        ...(input.implantUsed !== undefined || normalizedDoctorStatus === 'no_show'
          ? {
              ipdImplantUsed:
                normalizedDoctorStatus === 'no_show' ? null : input.implantUsed ?? null,
            }
          : {}),
        ...(input.noShowReason !== undefined || normalizedDoctorStatus === 'surgery_done'
          ? {
              ipdNoShowReason:
                normalizedDoctorStatus === 'surgery_done'
                  ? null
                  : normalizedNoShowReason ?? null,
            }
          : {}),
        ...(input.newSurgeryDate !== undefined ? { newSurgeryDate } : {}),
        ...(input.ipdDischargeDate !== undefined || input.dischargeDate !== undefined
          ? { ipdDischargeDate: dischargeDate }
          : {}),
        ...(normalizedStatusNotes !== undefined ? { ipdStatusNotes: normalizedStatusNotes } : {}),
        ...(input.notes !== undefined ? { notes: normalizeText(input.notes) } : {}),
        ...(effectiveIpdStatus !== undefined || normalizedStatusNotes !== undefined
          ? { ipdStatusUpdatedAt: new Date() }
          : {}),
      },
    })

    const leadUpdateData: Prisma.LeadUpdateInput = {
      ...(input.ipdAdmissionDate !== undefined ? { ipdAdmissionDate: admissionDate } : {}),
      ...(normalizedIpdHospital !== undefined ? { ipdHospital: normalizedIpdHospital } : {}),
      ...(input.surgeryDate !== undefined ? { surgeryDate } : {}),
      ...(input.operationTime !== undefined ? { operationTime: normalizedOperationTime } : {}),
    }

    if (targetCaseStage) {
      leadUpdateData.caseStage = targetCaseStage
    }

    if (normalizedDoctorStatus === 'surgery_done') {
      const resolvedSurgeryDate =
        surgeryDate ||
        lead.surgeryDate ||
        lead.admissionRecord?.surgeryDate ||
        new Date()
      leadUpdateData.surgeryDate = resolvedSurgeryDate
      leadUpdateData.pipelineStage = PipelineStage.PL
      leadUpdateData.conversionDate = resolvedSurgeryDate
    }

    await tx.lead.update({
      where: { id: leadId },
      data: leadUpdateData,
    })

    if (admissionRecordId && resolvedImplantUsages !== undefined) {
      await tx.admissionRecordImplantUsage.deleteMany({
        where: { admissionRecordId },
      })

      if (resolvedImplantUsages.length > 0) {
        await tx.admissionRecordImplantUsage.createMany({
          data: resolvedImplantUsages.map((usage, index) => ({
            admissionRecordId,
            implantId: usage.implantId,
            quantity: usage.quantity,
            notes: usage.notes,
            sortOrder: index,
          })),
        })
      }
    }

    const existingPrescriptionImages =
      lead.admissionRecord?.prescriptionImages.map((image) => ({
        name: image.fileName,
        url: image.fileUrl,
        key: image.storageKey,
      })) || []
    const mergedPrescriptionImages = mergeStoredPrescriptionImages(
      existingPrescriptionImages,
      [...inputPrescriptionImages, ...uploadedPrescriptionImages]
    )

    if (
      admissionRecordId &&
      (inputPrescriptionImages.length > 0 || uploadedPrescriptionImages.length > 0)
    ) {
      const existingUrls = new Set(existingPrescriptionImages.map((file) => file.url))
      const newImages = mergedPrescriptionImages.filter((file) => !existingUrls.has(file.url))

      if (newImages.length > 0) {
        await tx.admissionRecordPrescriptionImage.createMany({
          data: newImages.map((image, index) => ({
            admissionRecordId,
            fileName: image.name,
            fileUrl: image.url,
            storageKey: image.key ?? null,
            sortOrder: existingPrescriptionImages.length + index,
          })),
        })
      }
    }

    if (stageChanged) {
      await tx.caseStageHistory.create({
        data: {
          leadId,
          fromStage: lead.caseStage,
          toStage: targetCaseStage!,
          changedById: stageChangedById!,
          note: `Doctor app updated IPD status${normalizedDoctorStatus ? `: ${normalizedDoctorStatus}` : ''}`,
        },
      })
    }

  })

  return getDoctorAppointmentById(user, leadId)
}

export async function dischargeDoctorAppointment(
  user: DoctorAppSessionUser,
  leadId: string,
  input: DischargeDoctorAppointmentInput
) {
  const { lead } = await findDoctorScopedLead(user, leadId)
  const dischargeDate = parseOptionalDate(input.dischargeDate, 'dischargeDate') || new Date()

  if (!lead.admissionRecord) {
    throw new DoctorAppApiError(
      'IPD admission record not found. Doctors can only discharge existing IPD cases.',
      400
    )
  }

  await prisma.admissionRecord.update({
    where: { leadId },
    data: {
      ipdStatus: IpdStatus.DISCHARGED,
      ipdDischargeDate: dischargeDate,
      ipdStatusUpdatedAt: new Date(),
    },
  })

  const dischargeCreatorId =
    lead.dischargeSheet?.createdById ||
    lead.admissionRecord?.initiatedById ||
    lead.bdId

  await prisma.dischargeSheet.upsert({
    where: { leadId },
    update: {
      dischargeDate,
      doctorName: getAppointmentDoctorName(lead),
      hospitalName: getAppointmentHospitalName(lead),
      patientName: lead.patientName,
      patientPhone: lead.phoneNumber,
      doctorRemarks: normalizeText(input.doctorRemarks),
      markedAt: new Date(),
      markedById: dischargeCreatorId,
      status: 'DISCHARGED',
    },
    create: {
      leadId,
      dischargeDate,
      admissionDate: lead.admissionRecord?.admissionDate || lead.ipdAdmissionDate,
      surgeryDate: lead.admissionRecord?.surgeryDate || lead.surgeryDate,
      status: 'DISCHARGED',
      patientName: lead.patientName,
      patientPhone: lead.phoneNumber,
      doctorName: getAppointmentDoctorName(lead),
      hospitalName: getAppointmentHospitalName(lead),
      category: lead.category,
      treatment: lead.treatment,
      circle: lead.circle,
      doctorRemarks: normalizeText(input.doctorRemarks),
      createdById: dischargeCreatorId,
      markedById: dischargeCreatorId,
      markedAt: new Date(),
    },
  })

  return getDoctorAppointmentById(user, leadId)
}

export async function uploadDoctorAppointmentPrescription(
  user: DoctorAppSessionUser,
  leadId: string,
  file: File
) {
  const { lead } = await findDoctorScopedLead(user, leadId)

  if (!file) {
    throw new DoctorAppApiError('No file provided', 400)
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const upload = await uploadFileToS3(buffer, file.name, 'doctor-app/prescriptions')

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      docUpload: upload.url,
    },
  })

  if (lead.kypSubmission?.id) {
    await prisma.kYPSubmission.update({
      where: { leadId },
      data: {
        prescriptionFileUrl: upload.url,
      },
    })
  }

  return {
    leadId,
    fileUrl: upload.url,
    key: upload.key,
  }
}
