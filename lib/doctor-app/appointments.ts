import { CaseStage, IpdStatus, PipelineStage, Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { uploadFileToS3 } from '@/lib/s3-client'
import { DoctorAppSessionUser } from '@/lib/doctor-app/auth'
import {
  getNextStageAfterOpdDone,
  hasLeadOpdDone,
  isOpdDoneStatus,
  isOpdScheduledStatus,
  OPD_DONE_STATUS,
} from '@/lib/lead-opd-workflow'

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
  opdDrName?: string
  opdContactNo?: string
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
  ipdDrName?: string
  ipdContactNo?: string
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

function getAppointmentType(lead: DoctorAppointmentLead) {
  return isIpdLead(lead) ? 'ipd' : 'opd'
}

function getAppointmentDoctorName(lead: DoctorAppointmentLead) {
  return lead.ipdDrName || lead.opdDrName || lead.surgeonName || null
}

function getAppointmentHospitalName(lead: DoctorAppointmentLead) {
  return lead.ipdHospital || lead.opdHospital || lead.hospitalName || null
}

function getAppointmentDate(lead: DoctorAppointmentLead) {
  if (isIpdLead(lead)) {
    return (
      lead.admissionRecord?.admissionDate ||
      lead.ipdAdmissionDate ||
      lead.admissionRecord?.surgeryDate ||
      lead.surgeryDate ||
      lead.followUpDate ||
      lead.updatedDate
    )
  }

  return lead.opdScheduleDate || lead.followUpDate || lead.updatedDate
}

function getAppointmentStatus(lead: DoctorAppointmentLead) {
  if (isIpdLead(lead)) {
    return lead.admissionRecord?.ipdStatus || lead.caseStage
  }

  if (lead.followUpDate) {
    return 'FOLLOW_UP'
  }

  if (hasLeadOpdDone(lead) || isOpdDoneStatus(lead.status)) {
    return 'DONE'
  }

  if (lead.opdScheduleDate) {
    return 'SCHEDULED'
  }

  if (isOpdScheduledStatus(lead.status)) {
    return 'SCHEDULED'
  }

  return lead.status
}

function matchesTypeFilter(lead: DoctorAppointmentLead, type: 'all' | 'opd' | 'ipd') {
  if (type === 'all') {
    return true
  }

  return getAppointmentType(lead) === type
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

function matchesDateFilter(lead: DoctorAppointmentLead, input: ListDoctorAppointmentsInput) {
  const requested = buildRequestedDate(input)
  if (!requested) {
    return true
  }

  const value = getAppointmentDate(lead)
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

function matchesStatusFilter(lead: DoctorAppointmentLead, status?: string) {
  if (!status) {
    return true
  }

  const normalized = status.trim().toLowerCase()
  const appointmentStatus = String(getAppointmentStatus(lead) || '').trim().toLowerCase()
  const leadStatus = String(lead.status || '').trim().toLowerCase()
  const caseStage = String(lead.caseStage || '').trim().toLowerCase()

  return (
    appointmentStatus === normalized ||
    leadStatus === normalized ||
    caseStage === normalized
  )
}

function mapAppointmentSummary(lead: DoctorAppointmentLead) {
  const type = getAppointmentType(lead)
  const ipdPrescriptionFileUrl = lead.admissionRecord?.prescriptionImages[0]?.fileUrl || null
  const opdPrescriptionFileUrl = lead.opdPrescriptionImages[0]?.fileUrl || null
  const primaryPrescriptionFileUrl =
    (type === 'ipd' ? ipdPrescriptionFileUrl || opdPrescriptionFileUrl : opdPrescriptionFileUrl || ipdPrescriptionFileUrl) ||
    lead.kypSubmission?.prescriptionFileUrl ||
    lead.docUpload ||
    null

  return {
    id: lead.id,
    leadId: lead.id,
    leadRef: lead.leadRef,
    appointmentType: type,
    appointmentDate: getAppointmentDate(lead),
    appointmentStatus: getAppointmentStatus(lead),
    patient: {
      name: lead.patientName,
      age: lead.age,
      sex: lead.sex,
      phoneNumber: lead.phoneNumber,
      alternateNumber: lead.alternateNumber,
      whatsapp: lead.whatsapp,
    },
    doctor: {
      name: getAppointmentDoctorName(lead),
    },
    hospital: {
      name: getAppointmentHospitalName(lead),
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
      hospital: lead.opdHospital,
      doctorName: lead.opdDrName,
      contactNumber: lead.opdContactNo,
      charges: lead.opdCharges,
      scheduledDate: lead.opdScheduleDate,
      meetingCount: lead.opdMeeting,
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

function mapAppointmentDetail(lead: DoctorAppointmentLead) {
  const opdPrescriptionFiles = lead.opdPrescriptionImages.map((image) => ({
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
    getAppointmentType(lead) === 'ipd' && ipdPrescriptionFiles.length > 0
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
    ...mapAppointmentSummary(lead),
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
    prescription: {
      fileUrl: primaryPrescriptionFileUrl,
      files: primaryPrescriptionFiles,
    },
    opdRecording: {
      surgeryAdvised: lead.opdSurgeryAdvised ?? null,
      surgeryRemarksType: lead.opdSurgeryRemarkCode ?? null,
      surgeryRemark: lead.opdSurgeryRemark ?? null,
      reasonNoSurgery: lead.opdReasonNoSurgery ?? null,
      followUpReason: lead.opdFollowUpReason ?? null,
      implantRequired: lead.opdImplantRequired ?? null,
      diagnosis: lead.opdDiagnosis ?? lead.diseaseDetails ?? null,
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

  const filtered = leads
    .filter(lead => matchesTypeFilter(lead, input.type))
    .filter(lead => matchesStatusFilter(lead, input.status))
    .filter(lead => matchesDateFilter(lead, input))
    .sort((a, b) => {
      const aDate = getAppointmentDate(a)?.getTime() || 0
      const bDate = getAppointmentDate(b)?.getTime() || 0
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

  const filtered = leads
    .filter(lead => matchesTypeFilter(lead, input.type))
    .filter(lead => matchesStatusFilter(lead, input.status))
    .filter(lead => matchesDateFilter(lead, input))
    .sort((a, b) => {
      const aDate = getAppointmentDate(a)?.getTime() || 0
      const bDate = getAppointmentDate(b)?.getTime() || 0
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

export async function getDoctorAppointmentById(user: DoctorAppSessionUser, leadId: string) {
  const { lead } = await findDoctorScopedLead(user, leadId)
  return mapAppointmentDetail(lead)
}

export async function updateDoctorOpdAppointment(
  user: DoctorAppSessionUser,
  leadId: string,
  input: UpdateDoctorOpdInput
) {
  const { lead } = await findDoctorScopedLead(user, leadId)

  let targetCaseStage = input.caseStage
  let targetStatus = input.status?.trim()
  const shouldMarkOpdDone = input.markOpdDone || isOpdDoneStatus(targetStatus)

  if (shouldMarkOpdDone) {
    if (hasLeadOpdDone(lead)) {
      throw new DoctorAppApiError('OPD is already marked done', 400)
    }

    targetCaseStage = getNextStageAfterOpdDone(lead) ?? undefined
    if (!targetCaseStage) {
      throw new DoctorAppApiError('Appointment is not ready to mark as OPD done', 400)
    }

    targetStatus = OPD_DONE_STATUS
  }

  const nextStage = targetCaseStage ?? lead.caseStage
  const stageChanged = nextStage !== lead.caseStage
  const changedById = stageChanged ? lead.bdId : null
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

  const updatedLead = await prisma.$transaction(async (tx) => {
    const resolvedSurgeryRemark = await resolveMasterOptionByCode(
      tx,
      'surgeryRemark',
      input.surgeryRemarksType
    )
    const resolvedReasonNoSurgery = await resolveMasterOptionByCode(
      tx,
      'reasonNoSurgery',
      input.reasonNoSurgery
    )
    const resolvedFollowUpReason = await resolveMasterOptionByCode(
      tx,
      'followUpReason',
      input.followUpReason
    )

    const surgeryAdvised =
      input.surgeryAdvised !== undefined
        ? normalizeSurgeryAdvised(input.surgeryAdvised)
        : lead.opdSurgeryAdvised ?? null

    const nextSurgeryRemark =
      resolvedSurgeryRemark !== undefined
        ? resolvedSurgeryRemark
        : lead.opdSurgeryRemark
    const nextReasonNoSurgery =
      resolvedReasonNoSurgery !== undefined
        ? resolvedReasonNoSurgery
        : lead.opdReasonNoSurgery
    const nextFollowUpReason =
      resolvedFollowUpReason !== undefined
        ? resolvedFollowUpReason
        : lead.opdFollowUpReason

    const nextSurgeryRemarkCode =
      surgeryAdvised === 'no' || surgeryAdvised === 'follow_up'
        ? null
        : nextSurgeryRemark?.code ?? lead.opdSurgeryRemarkCode ?? null
    const nextReasonNoSurgeryCode =
      surgeryAdvised === 'yes' || surgeryAdvised === 'follow_up'
        ? null
        : nextReasonNoSurgery?.code ?? lead.opdReasonNoSurgeryCode ?? null
    const nextFollowUpReasonCode =
      surgeryAdvised === 'yes' || surgeryAdvised === 'no'
        ? null
        : nextFollowUpReason?.code ?? lead.opdFollowUpReasonCode ?? null
    const nextDiagnosis =
      input.diagnosis !== undefined
        ? normalizeText(input.diagnosis)
        : lead.opdDiagnosis ?? lead.diseaseDetails ?? null
    const nextImplantRequired =
      input.implantRequired !== undefined
        ? input.implantRequired
        : lead.opdImplantRequired ?? null

    await tx.lead.update({
      where: { id: leadId },
      data: {
        ...(input.opdHospital !== undefined ? { opdHospital: input.opdHospital.trim() } : {}),
        ...(input.opdDrName !== undefined ? { opdDrName: input.opdDrName.trim() } : {}),
        ...(input.opdContactNo !== undefined ? { opdContactNo: input.opdContactNo.trim() } : {}),
        ...(input.opdCharges !== undefined ? { opdCharges: input.opdCharges } : {}),
        ...(input.opdScheduleDate !== undefined
          ? { opdScheduleDate: parseOptionalDate(input.opdScheduleDate, 'opdScheduleDate') }
          : {}),
        ...(input.followUpDate !== undefined
          ? { followUpDate: parseOptionalDate(input.followUpDate, 'followUpDate') }
          : {}),
        ...(input.remarks !== undefined ? { remarks: normalizeText(input.remarks) } : {}),
        opdSurgeryAdvised: surgeryAdvised,
        opdSurgeryRemarkCode: nextSurgeryRemarkCode,
        opdReasonNoSurgeryCode: nextReasonNoSurgeryCode,
        opdFollowUpReasonCode: nextFollowUpReasonCode,
        opdImplantRequired: nextImplantRequired,
        opdDiagnosis: nextDiagnosis,
        diseaseDetails: nextDiagnosis,
        ...(uploadedPrescriptionImages.length > 0
          ? { docUpload: uploadedPrescriptionImages[0]?.url ?? lead.docUpload }
          : {}),
        ...(targetStatus !== undefined ? { status: targetStatus } : {}),
        ...(targetCaseStage !== undefined ? { caseStage: targetCaseStage } : {}),
      },
      select: doctorAppointmentLeadSelect,
    })

    if (uploadedPrescriptionImages.length > 0) {
      if (lead.kypSubmission?.id) {
        await tx.kYPSubmission.update({
          where: { leadId },
          data: {
            prescriptionFileUrl: uploadedPrescriptionImages[0]?.url ?? null,
          },
        })
      }

      await tx.leadOpdPrescriptionImage.deleteMany({
        where: { leadId },
      })

      await tx.leadOpdPrescriptionImage.createMany({
        data: uploadedPrescriptionImages.map((image, index) => ({
          leadId,
          fileName: image.name,
          fileUrl: image.url,
          storageKey: image.key ?? null,
          sortOrder: index,
        })),
      })
    }

    if (stageChanged) {
      await tx.caseStageHistory.create({
        data: {
          leadId,
          fromStage: lead.caseStage,
          toStage: nextStage,
          changedById: changedById!,
          note: shouldMarkOpdDone
            ? 'OPD marked done by doctor app'
            : 'Doctor app updated OPD stage',
        },
      })
    }

    return tx.lead.findUniqueOrThrow({
      where: { id: leadId },
      select: doctorAppointmentLeadSelect,
    })
  })

  return mapAppointmentDetail(updatedLead)
}

export async function cancelDoctorOpdAppointment(
  user: DoctorAppSessionUser,
  leadId: string,
  input: CancelDoctorOpdInput
) {
  await findDoctorScopedLead(user, leadId)

  const updatedLead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      opdScheduleDate: null,
      followUpDate:
        input.followUpDate !== undefined
          ? parseOptionalDate(input.followUpDate, 'followUpDate')
          : null,
      remarks:
        input.remarks !== undefined
          ? normalizeText(input.remarks)
          : 'OPD cancelled by doctor app',
    },
    select: doctorAppointmentLeadSelect,
  })

  return mapAppointmentDetail(updatedLead)
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
  const normalizedIpdDoctor =
    input.ipdDrName !== undefined ? input.ipdDrName.trim() : undefined
  const normalizedIpdContact =
    input.ipdContactNo !== undefined ? input.ipdContactNo.trim() : undefined
  const normalizedOperationTime = normalizeText(input.operationTime)
  const normalizedAdmissionTime = normalizeText(input.admissionTime)
  const normalizedStatusNotes =
    normalizedProcedureNotes !== undefined ? normalizedProcedureNotes : undefined
  const isCashFlow = lead.flowType === 'CASH'
  const targetCaseStage =
    getCaseStageForDoctorMobileIpdStatus(normalizedDoctorStatus, isCashFlow) ??
    getCaseStageForIpdEnumStatus(effectiveIpdStatus, isCashFlow)
  const stageChanged = Boolean(targetCaseStage && targetCaseStage !== lead.caseStage)
  const stageChangedById = stageChanged ? lead.admissionRecord.initiatedById : null

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

  const updatedLead = await prisma.$transaction(async (tx) => {
    const resolvedImplantUsages = await resolveImplantUsages(
      tx,
      normalizedDoctorStatus === 'no_show'
        ? []
        : normalizedDoctorStatus === 'surgery_done' && input.implantUsed === false
          ? []
          : input.implantsUsed
    )

    const admissionRecordId = lead.admissionRecord.id

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
      ...(normalizedIpdDoctor !== undefined ? { ipdDrName: normalizedIpdDoctor } : {}),
      ...(normalizedIpdContact !== undefined ? { ipdContactNo: normalizedIpdContact } : {}),
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

    return tx.lead.findUniqueOrThrow({
      where: { id: leadId },
      select: doctorAppointmentLeadSelect,
    })
  })

  return mapAppointmentDetail(updatedLead)
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
