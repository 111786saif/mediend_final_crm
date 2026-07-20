import { CaseStage, IpdStatus, Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { uploadFileToS3 } from '@/lib/s3-client'
import { DoctorAppSessionUser } from '@/lib/doctor-app/auth'

const DOCTOR_APP_SYSTEM_USER_ID = process.env.DOCTOR_APP_SYSTEM_USER_ID?.trim() || ''

const doctorAppointmentLeadSelect = {
  id: true,
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
  opdHospital: true,
  opdDrName: true,
  opdContactNo: true,
  opdCharges: true,
  opdScheduleDate: true,
  opdMeeting: true,
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
      newSurgeryDate: true,
      ipdDischargeDate: true,
      ipdStatusNotes: true,
      notes: true,
      initiatedById: true,
    },
  },
  kypSubmission: {
    select: {
      id: true,
      prescriptionFileUrl: true,
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
}

export interface CancelDoctorOpdInput {
  remarks?: string | null
  followUpDate?: string | null
}

export interface UpdateDoctorIpdInput {
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
  newSurgeryDate?: string | null
  ipdDischargeDate?: string | null
  notes?: string | null
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

  if (lead.opdScheduleDate) {
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
      dischargeDate: lead.admissionRecord?.ipdDischargeDate || lead.dischargeSheet?.dischargeDate || null,
    },
    prescription: {
      fileUrl: lead.kypSubmission?.prescriptionFileUrl || lead.docUpload || null,
    },
    updatedAt: lead.updatedDate,
  }
}

function mapAppointmentDetail(lead: DoctorAppointmentLead) {
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
      createdAt: lead.createdDate,
      updatedAt: lead.updatedDate,
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

async function requireSystemUserId() {
  if (!DOCTOR_APP_SYSTEM_USER_ID) {
    throw new DoctorAppApiError(
      'DOCTOR_APP_SYSTEM_USER_ID is required to create doctor-managed admission or discharge records',
      500
    )
  }

  const systemUser = await prisma.user.findUnique({
    where: { id: DOCTOR_APP_SYSTEM_USER_ID },
    select: { id: true },
  })

  if (!systemUser) {
    throw new DoctorAppApiError('Configured doctor app system user was not found', 500)
  }

  return systemUser.id
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
  await findDoctorScopedLead(user, leadId)

  const updatedLead = await prisma.lead.update({
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
      ...(input.status !== undefined ? { status: input.status.trim() } : {}),
      ...(input.caseStage !== undefined ? { caseStage: input.caseStage } : {}),
    },
    select: doctorAppointmentLeadSelect,
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

  const admissionDate = parseOptionalDate(input.ipdAdmissionDate, 'ipdAdmissionDate')
  const surgeryDate = parseOptionalDate(input.surgeryDate, 'surgeryDate')
  const newSurgeryDate = parseOptionalDate(input.newSurgeryDate, 'newSurgeryDate')
  const dischargeDate = parseOptionalDate(input.ipdDischargeDate, 'ipdDischargeDate')

  const updatedLead = await prisma.lead.update({
    where: { id: leadId },
    data: {
      ...(input.ipdAdmissionDate !== undefined ? { ipdAdmissionDate: admissionDate } : {}),
      ...(input.ipdHospital !== undefined ? { ipdHospital: input.ipdHospital.trim() } : {}),
      ...(input.ipdDrName !== undefined ? { ipdDrName: input.ipdDrName.trim() } : {}),
      ...(input.ipdContactNo !== undefined ? { ipdContactNo: input.ipdContactNo.trim() } : {}),
      ...(input.surgeryDate !== undefined ? { surgeryDate } : {}),
      ...(input.operationTime !== undefined ? { operationTime: normalizeText(input.operationTime) } : {}),
    },
    select: doctorAppointmentLeadSelect,
  })

  if (lead.admissionRecord) {
    await prisma.admissionRecord.update({
      where: { leadId },
      data: {
        ...(input.ipdAdmissionDate !== undefined && admissionDate ? { admissionDate } : {}),
        ...(input.admissionTime !== undefined ? { admissionTime: normalizeText(input.admissionTime) || '' } : {}),
        ...(input.ipdHospital !== undefined ? { admittingHospital: input.ipdHospital.trim() } : {}),
        ...(input.surgeryDate !== undefined ? { surgeryDate } : {}),
        ...(input.operationTime !== undefined ? { surgeryTime: normalizeText(input.operationTime) } : {}),
        ...(input.hospitalAddress !== undefined ? { hospitalAddress: normalizeText(input.hospitalAddress) } : {}),
        ...(input.googleMapLocation !== undefined ? { googleMapLocation: normalizeText(input.googleMapLocation) } : {}),
        ...(input.tpa !== undefined ? { tpa: normalizeText(input.tpa) } : {}),
        ...(input.instrument !== undefined ? { instrument: normalizeText(input.instrument) } : {}),
        ...(input.implantConsumables !== undefined
          ? { implantConsumables: normalizeText(input.implantConsumables) }
          : {}),
        ...(input.ipdStatus !== undefined ? { ipdStatus: input.ipdStatus } : {}),
        ...(input.ipdStatusReason !== undefined
          ? { ipdStatusReason: normalizeText(input.ipdStatusReason) }
          : {}),
        ...(input.newSurgeryDate !== undefined ? { newSurgeryDate } : {}),
        ...(input.ipdDischargeDate !== undefined ? { ipdDischargeDate: dischargeDate } : {}),
        ...(input.notes !== undefined ? { notes: normalizeText(input.notes) } : {}),
        ipdStatusUpdatedAt: new Date(),
      },
    })
  } else {
    const initiatedById = await requireSystemUserId()

    await prisma.admissionRecord.create({
      data: {
        leadId,
        admissionDate: admissionDate || new Date(),
        admissionTime: normalizeText(input.admissionTime) || '',
        admittingHospital:
          input.ipdHospital?.trim() || updatedLead.ipdHospital || updatedLead.hospitalName,
        surgeryDate,
        surgeryTime: normalizeText(input.operationTime) || null,
        hospitalAddress: normalizeText(input.hospitalAddress),
        googleMapLocation: normalizeText(input.googleMapLocation),
        tpa: normalizeText(input.tpa),
        instrument: normalizeText(input.instrument),
        implantConsumables: normalizeText(input.implantConsumables),
        ipdStatus: input.ipdStatus ?? null,
        ipdStatusReason: normalizeText(input.ipdStatusReason),
        newSurgeryDate,
        ipdDischargeDate: dischargeDate,
        notes: normalizeText(input.notes),
        initiatedById,
      },
    })
  }

  return getDoctorAppointmentById(user, leadId)
}

export async function dischargeDoctorAppointment(
  user: DoctorAppSessionUser,
  leadId: string,
  input: DischargeDoctorAppointmentInput
) {
  const { lead } = await findDoctorScopedLead(user, leadId)
  const dischargeDate = parseOptionalDate(input.dischargeDate, 'dischargeDate') || new Date()

  if (lead.admissionRecord) {
    await prisma.admissionRecord.update({
      where: { leadId },
      data: {
        ipdStatus: IpdStatus.DISCHARGED,
        ipdDischargeDate: dischargeDate,
        ipdStatusUpdatedAt: new Date(),
      },
    })
  } else {
    const initiatedById = await requireSystemUserId()

    await prisma.admissionRecord.create({
      data: {
        leadId,
        admissionDate: lead.ipdAdmissionDate || new Date(),
        admissionTime: '',
        admittingHospital: lead.ipdHospital || lead.hospitalName,
        surgeryDate: lead.surgeryDate,
        surgeryTime: lead.operationTime,
        ipdStatus: IpdStatus.DISCHARGED,
        ipdDischargeDate: dischargeDate,
        initiatedById,
      },
    })
  }

  const dischargeCreatorId =
    lead.dischargeSheet?.createdById ||
    lead.admissionRecord?.initiatedById ||
    (await requireSystemUserId())

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
