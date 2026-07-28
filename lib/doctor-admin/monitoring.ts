import { CaseStage, IpdStatus, PipelineStage, Prisma } from '@/generated/prisma/client'
import { hasLeadOpdDone } from '@/lib/lead-opd-workflow'
import { prisma } from '@/lib/prisma'

const monitoringLeadSelect = {
  id: true,
  leadRef: true,
  patientName: true,
  phoneNumber: true,
  whatsapp: true,
  status: true,
  caseStage: true,
  pipelineStage: true,
  circle: true,
  category: true,
  treatment: true,
  surgeonName: true,
  hospitalName: true,
  surgeryDate: true,
  conversionDate: true,
  lostAt: true,
  lostReason: true,
  followUpDate: true,
  opdHospital: true,
  opdDrName: true,
  opdScheduleDate: true,
  ipdAdmissionDate: true,
  ipdHospital: true,
  ipdDrName: true,
  implantType: true,
  modeOfPayment: true,
  bdeName: true,
  createdDate: true,
  updatedDate: true,
  bd: {
    select: {
      id: true,
      name: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
    },
  },
  updatedBy: {
    select: {
      id: true,
      name: true,
    },
  },
  admissionRecord: {
    select: {
      id: true,
      admissionDate: true,
      admissionTime: true,
      admittingHospital: true,
      expectedSurgeryDate: true,
      surgeryDate: true,
      surgeryTime: true,
      instrument: true,
      implantConsumables: true,
      ipdStatus: true,
      ipdStatusReason: true,
      newSurgeryDate: true,
      ipdDischargeDate: true,
      ipdStatusNotes: true,
      initiatedAt: true,
      initiatedById: true,
    },
  },
  dischargeSheet: {
    select: {
      id: true,
      dischargeDate: true,
      isFinalized: true,
      finalizedAt: true,
    },
  },
} satisfies Prisma.LeadSelect

type MonitoringLead = Prisma.LeadGetPayload<{
  select: typeof monitoringLeadSelect
}>

type DateRange = {
  start: Date | null
  end: Date | null
}

export class DoctorAdminMonitoringError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'DoctorAdminMonitoringError'
    this.status = status
  }
}

export interface AppointmentMonitoringSummaryFilters {
  range?: 'all' | 'day'
  date?: string
}

export interface AppointmentMonitoringListFilters {
  mode: 'daily' | 'doctor' | 'overdue'
  date?: string
  doctorId?: string
  startDate?: string
  endDate?: string
  status?: string
  type?: 'all' | 'opd' | 'ipd'
  daysOverdue?: number
}

export interface SurgeryPipelineFilters {
  startDate?: string
  endDate?: string
}

function normalizeText(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function parseDateInput(value?: string | null) {
  if (!value?.trim()) return null

  const trimmed = value.trim()
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00`)
    : new Date(trimmed)

  if (Number.isNaN(parsed.getTime())) {
    throw new DoctorAdminMonitoringError('Invalid date supplied', 400)
  }

  return parsed
}

function buildRange(startDate?: string, endDate?: string): DateRange {
  const start = parseDateInput(startDate)
  const end = parseDateInput(endDate)

  if (start && end && end.getTime() < start.getTime()) {
    throw new DoctorAdminMonitoringError('endDate must be on or after startDate', 400)
  }

  if (start) start.setHours(0, 0, 0, 0)
  if (end) end.setHours(23, 59, 59, 999)

  return { start, end }
}

function isWithinRange(value: Date | null | undefined, range: DateRange) {
  if (!value) return false
  if (!range.start && !range.end) return true

  const time = new Date(value).getTime()
  if (range.start && time < range.start.getTime()) return false
  if (range.end && time > range.end.getTime()) return false
  return true
}

function isSameDay(value: Date | null | undefined, date: Date | null) {
  if (!value || !date) return false
  const a = new Date(value)
  return (
    a.getFullYear() === date.getFullYear() &&
    a.getMonth() === date.getMonth() &&
    a.getDate() === date.getDate()
  )
}

function isLostLead(lead: MonitoringLead) {
  const status = normalizeText(lead.status)
  return (
    lead.pipelineStage === PipelineStage.LOST ||
    Boolean(lead.lostAt) ||
    [
      'lost',
      'ipd lost',
      'junk',
      'invalid number',
      'fund issues',
      'not interested',
      'duplicate lead',
      'language barrier',
    ].includes(status)
  )
}

function isNoShowLead(lead: MonitoringLead) {
  const status = normalizeText(lead.status)
  return ['no show', 'no-show', 'no_show', 'noshow'].includes(status)
}

function isCancelledLead(lead: MonitoringLead) {
  const status = normalizeText(lead.status)
  return lead.admissionRecord?.ipdStatus === IpdStatus.CANCELLED || status.includes('cancel')
}

function isDischargedLead(lead: MonitoringLead) {
  return Boolean(
    lead.admissionRecord?.ipdDischargeDate ||
      lead.dischargeSheet?.dischargeDate ||
      lead.dischargeSheet?.isFinalized ||
      lead.admissionRecord?.ipdStatus === IpdStatus.DISCHARGED ||
      [PipelineStage.COMPLETED].includes(lead.pipelineStage) ||
      ['DISCHARGED', 'IPD_DONE', 'CASH_IPD_DONE', 'CASH_DISCHARGED'].includes(String(lead.caseStage))
  )
}

function isIpdLead(lead: MonitoringLead) {
  return Boolean(
    lead.admissionRecord ||
      lead.ipdAdmissionDate ||
      lead.ipdHospital ||
      lead.ipdDrName ||
      lead.admissionRecord?.expectedSurgeryDate
  )
}

function getDoctorName(lead: MonitoringLead) {
  return lead.ipdDrName || lead.opdDrName || lead.surgeonName || 'Unassigned'
}

function getHospitalName(lead: MonitoringLead) {
  return (
    lead.admissionRecord?.admittingHospital ||
    lead.ipdHospital ||
    lead.opdHospital ||
    lead.hospitalName ||
    'Unassigned'
  )
}

function getAppointmentDate(lead: MonitoringLead) {
  if (isIpdLead(lead)) {
    return (
      lead.admissionRecord?.admissionDate ||
      lead.ipdAdmissionDate ||
      lead.admissionRecord?.expectedSurgeryDate ||
      lead.admissionRecord?.newSurgeryDate ||
      lead.admissionRecord?.surgeryDate ||
      lead.surgeryDate ||
      lead.updatedDate
    )
  }

  return lead.opdScheduleDate || lead.followUpDate || lead.surgeryDate || lead.updatedDate
}

function getAppointmentStatusKey(lead: MonitoringLead) {
  if (isNoShowLead(lead)) return 'no_show'
  if (isCancelledLead(lead) || isLostLead(lead)) return 'cancelled'
  if (hasLeadOpdDone(lead)) return 'done'
  if (isDischargedLead(lead)) return 'done'
  if (lead.admissionRecord?.ipdStatus === IpdStatus.IPD_DONE) return 'done'
  return 'scheduled'
}

function getAppointmentDisplayStatus(lead: MonitoringLead) {
  const key = getAppointmentStatusKey(lead)
  if (key === 'no_show') return 'No Show'
  if (key === 'cancelled') return 'Cancelled'
  if (key === 'done') return 'Done'
  return isIpdLead(lead) && lead.admissionRecord?.ipdStatus === IpdStatus.ADMITTED_DONE
    ? 'Admitted'
    : 'Scheduled'
}

function getPipelineBucketDate(lead: MonitoringLead, bucket: 'advised' | 'followup' | 'ipd' | 'conversion' | 'lost') {
  switch (bucket) {
    case 'followup':
      return lead.followUpDate || lead.opdScheduleDate || lead.updatedDate
    case 'ipd':
      return lead.admissionRecord?.admissionDate || lead.ipdAdmissionDate || lead.surgeryDate || lead.updatedDate
    case 'conversion':
      return (
        lead.conversionDate ||
        lead.admissionRecord?.ipdDischargeDate ||
        lead.dischargeSheet?.dischargeDate ||
        lead.updatedDate
      )
    case 'lost':
      return lead.lostAt || lead.updatedDate
    default:
      return lead.surgeryDate || lead.opdScheduleDate || lead.createdDate
  }
}

function isFollowUpLead(lead: MonitoringLead) {
  return normalizeText(lead.status).startsWith('follow-up')
}

function isConversionLead(lead: MonitoringLead) {
  return Boolean(
    lead.conversionDate ||
      lead.admissionRecord?.ipdStatus === IpdStatus.IPD_DONE ||
      isDischargedLead(lead)
  )
}

function isIpdScheduledLead(lead: MonitoringLead) {
  if (!isIpdLead(lead)) return false
  if (isCancelledLead(lead) || isLostLead(lead) || isDischargedLead(lead)) return false
  return Boolean(
    lead.admissionRecord?.admissionDate ||
      lead.ipdAdmissionDate ||
      lead.admissionRecord?.expectedSurgeryDate ||
      lead.admissionRecord?.newSurgeryDate
  )
}

function isSurgeryAdvisedLead(lead: MonitoringLead) {
  if (isLostLead(lead) || isConversionLead(lead) || isIpdScheduledLead(lead)) return false
  if (isFollowUpLead(lead)) return false
  return Boolean(lead.surgeonName || lead.surgeryDate || lead.opdDrName || lead.opdScheduleDate)
}

function mapMonitoringItem(lead: MonitoringLead) {
  return {
    id: lead.id,
    leadRef: lead.leadRef,
    patientName: lead.patientName,
    phoneNumber: lead.phoneNumber,
    whatsapp: lead.whatsapp,
    appointmentType: isIpdLead(lead) ? 'ipd' : 'opd',
    doctorName: getDoctorName(lead),
    hospitalName: getHospitalName(lead),
    category: lead.category,
    treatment: lead.treatment,
    appointmentDate: getAppointmentDate(lead),
    statusKey: getAppointmentStatusKey(lead),
    statusLabel: getAppointmentDisplayStatus(lead),
    followUpDate: lead.followUpDate,
    surgeryDate: lead.admissionRecord?.surgeryDate || lead.surgeryDate,
    admissionDate: lead.admissionRecord?.admissionDate || lead.ipdAdmissionDate,
  }
}

function mapPipelineCard(
  lead: MonitoringLead,
  bucket: 'advised' | 'followup' | 'ipd' | 'conversion' | 'lost'
) {
  const date = getPipelineBucketDate(lead, bucket)
  const surgeryRemark =
    bucket === 'advised'
      ? normalizeText(lead.status).includes('high')
        ? 'High Intent'
        : normalizeText(lead.status).includes('low')
          ? 'Low Intent'
          : 'Intent Pending'
      : null

  return {
    id: lead.id,
    leadRef: lead.leadRef,
    patientName: lead.patientName,
    doctorName: getDoctorName(lead),
    hospitalName: getHospitalName(lead),
    date,
    paymentType: lead.modeOfPayment,
    followUpDate: lead.followUpDate,
    status: lead.status,
    remarks:
      bucket === 'lost'
        ? lead.lostReason || null
        : bucket === 'conversion'
          ? 'Converted'
          : bucket === 'ipd'
            ? 'IPD Scheduled'
            : null,
    tag:
      bucket === 'followup'
        ? lead.followUpDate && lead.followUpDate.getTime() < Date.now()
          ? 'Overdue'
          : 'Due'
        : bucket === 'ipd'
          ? 'IPD Scheduled'
          : bucket === 'conversion'
            ? 'Converted'
            : bucket === 'lost'
              ? 'Lost'
              : surgeryRemark,
    daysSinceAdvised:
      bucket === 'lost' && lead.surgeryDate
        ? Math.max(
            0,
            Math.floor((Date.now() - new Date(lead.surgeryDate).getTime()) / (1000 * 60 * 60 * 24))
          )
        : null,
  }
}

function mapIpdItem(lead: MonitoringLead) {
  const status =
    lead.admissionRecord?.ipdStatus === IpdStatus.CANCELLED
      ? 'cancelled'
      : isNoShowLead(lead)
        ? 'no_show'
        : isDischargedLead(lead)
          ? 'completed'
          : lead.admissionRecord?.ipdStatus === IpdStatus.IPD_DONE
            ? 'discharge_queue'
            : 'active'

  return {
    id: lead.id,
    leadRef: lead.leadRef,
    patientName: lead.patientName,
    doctorName: getDoctorName(lead),
    hospitalName: getHospitalName(lead),
    admissionDate: lead.admissionRecord?.admissionDate || lead.ipdAdmissionDate,
    otDate:
      lead.admissionRecord?.surgeryDate ||
      lead.admissionRecord?.expectedSurgeryDate ||
      lead.admissionRecord?.newSurgeryDate ||
      lead.surgeryDate,
    coordinatorName: lead.updatedBy?.name || lead.createdBy?.name || null,
    teamMemberName: lead.bd?.name || lead.bdeName || null,
    implant: lead.admissionRecord?.implantConsumables || lead.implantType || lead.admissionRecord?.instrument || null,
    status,
    statusReason: lead.admissionRecord?.ipdStatusReason || null,
    dischargeDate: lead.admissionRecord?.ipdDischargeDate || lead.dischargeSheet?.dischargeDate || null,
  }
}

async function fetchMonitoringLeads() {
  return prisma.lead.findMany({
    select: monitoringLeadSelect,
    orderBy: { updatedDate: 'desc' },
    take: 1000,
  })
}

function matchesDoctorName(lead: MonitoringLead, doctorId: string | undefined, doctorMap: Map<string, string>) {
  if (!doctorId?.trim()) return true
  const doctorName = doctorMap.get(doctorId)
  if (!doctorName) return false
  return normalizeText(getDoctorName(lead)) === normalizeText(doctorName)
}

export async function getDoctorAdminAppointmentMonitoringSummary(
  filters: AppointmentMonitoringSummaryFilters
) {
  const leads = await fetchMonitoringLeads()
  const requestedDate = filters.range === 'day' ? parseDateInput(filters.date || '') : null

  const relevant = requestedDate
    ? leads.filter(lead => isSameDay(getAppointmentDate(lead), requestedDate))
    : leads.filter(lead => Boolean(getAppointmentDate(lead)))

  return {
    scheduled: relevant.filter(lead => getAppointmentStatusKey(lead) === 'scheduled').length,
    done: relevant.filter(lead => getAppointmentStatusKey(lead) === 'done').length,
    noShow: relevant.filter(lead => getAppointmentStatusKey(lead) === 'no_show').length,
    cancelled: relevant.filter(lead => getAppointmentStatusKey(lead) === 'cancelled').length,
  }
}

export async function getDoctorAdminAppointmentMonitoring(
  filters: AppointmentMonitoringListFilters
) {
  const leads = await fetchMonitoringLeads()
  const doctors = await prisma.doctorMaster.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  })
  const doctorMap = new Map(doctors.map(doctor => [doctor.id, doctor.name]))

  if (filters.mode === 'daily') {
    const date = parseDateInput(filters.date || '')
    if (!date) {
      throw new DoctorAdminMonitoringError('date is required for daily monitoring', 400)
    }

    return leads
      .filter(lead => isSameDay(getAppointmentDate(lead), date))
      .map(mapMonitoringItem)
  }

  if (filters.mode === 'overdue') {
    const daysOverdue = Math.max(0, filters.daysOverdue ?? 1)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - daysOverdue)
    cutoff.setHours(23, 59, 59, 999)

    return leads
      .filter(lead => matchesDoctorName(lead, filters.doctorId, doctorMap))
      .filter(lead => getAppointmentStatusKey(lead) === 'scheduled')
      .filter(lead => {
        const date = getAppointmentDate(lead)
        return Boolean(date && new Date(date).getTime() <= cutoff.getTime())
      })
      .map(mapMonitoringItem)
  }

  const range = buildRange(filters.startDate, filters.endDate)
  const requestedType = filters.type || 'all'
  const requestedStatus = normalizeText(filters.status)

  return leads
    .filter(lead => matchesDoctorName(lead, filters.doctorId, doctorMap))
    .filter(lead => (requestedType === 'all' ? true : mapMonitoringItem(lead).appointmentType === requestedType))
    .filter(lead => isWithinRange(getAppointmentDate(lead), range))
    .filter(lead => (requestedStatus && requestedStatus !== 'all' ? mapMonitoringItem(lead).statusKey === requestedStatus : true))
    .map(mapMonitoringItem)
}

export async function getDoctorAdminSurgeryPipeline(filters: SurgeryPipelineFilters) {
  const leads = await fetchMonitoringLeads()
  const range = buildRange(filters.startDate, filters.endDate)

  const advised = leads
    .filter(isSurgeryAdvisedLead)
    .filter(lead => isWithinRange(getPipelineBucketDate(lead, 'advised'), range))
    .map(lead => mapPipelineCard(lead, 'advised'))

  const followUps = leads
    .filter(isFollowUpLead)
    .filter(lead => !isLostLead(lead) && !isConversionLead(lead))
    .filter(lead => isWithinRange(getPipelineBucketDate(lead, 'followup'), range))
    .map(lead => mapPipelineCard(lead, 'followup'))

  const ipdScheduled = leads
    .filter(isIpdScheduledLead)
    .filter(lead => isWithinRange(getPipelineBucketDate(lead, 'ipd'), range))
    .map(lead => mapPipelineCard(lead, 'ipd'))

  const conversions = leads
    .filter(isConversionLead)
    .filter(lead => isWithinRange(getPipelineBucketDate(lead, 'conversion'), range))
    .map(lead => mapPipelineCard(lead, 'conversion'))

  const lostPatients = leads
    .filter(isLostLead)
    .filter(lead => isWithinRange(getPipelineBucketDate(lead, 'lost'), range))
    .map(lead => mapPipelineCard(lead, 'lost'))

  const avgDaysToConvert =
    conversions.length === 0
      ? 0
      : Math.round(
          conversions.reduce((sum, item) => {
            const lead = leads.find(entry => entry.id === item.id)
            if (!lead?.surgeryDate || !item.date) return sum
            const diff = new Date(item.date).getTime() - new Date(lead.surgeryDate).getTime()
            return sum + Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)))
          }, 0) / conversions.length
        )

  return {
    advised,
    followUps,
    ipdScheduled,
    conversions,
    lostPatients,
    summary: {
      conversionRate: advised.length > 0 ? Math.round((conversions.length / advised.length) * 100) : 0,
      avgDaysToConvert,
      totalLost: lostPatients.length,
    },
  }
}

export async function getDoctorAdminIpdMonitoring() {
  const leads = await fetchMonitoringLeads()

  const items = leads
    .filter(isIpdLead)
    .map(mapIpdItem)

  return {
    active: items.filter(item => item.status === 'active'),
    dischargeQueue: items.filter(item => item.status === 'discharge_queue'),
    completed: items.filter(item => item.status === 'completed'),
    noShow: items.filter(item => item.status === 'no_show'),
    cancelled: items.filter(item => item.status === 'cancelled'),
  }
}

export async function markDoctorAdminIpdAdmitted(leadId: string, actorUserId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      ipdAdmissionDate: true,
      ipdHospital: true,
      updatedById: true,
      admissionRecord: {
        select: {
          id: true,
        },
      },
    },
  })

  if (!lead) {
    throw new DoctorAdminMonitoringError('Lead not found', 404)
  }

  const admissionDate = lead.ipdAdmissionDate || new Date()
  const hospitalName = lead.ipdHospital || 'Pending hospital'

  if (lead.admissionRecord?.id) {
    await prisma.admissionRecord.update({
      where: { leadId },
      data: {
        admissionDate,
        admittingHospital: hospitalName,
        ipdStatus: IpdStatus.ADMITTED_DONE,
        ipdStatusUpdatedAt: new Date(),
      },
    })
  } else {
    await prisma.admissionRecord.create({
      data: {
        leadId,
        admissionDate,
        admissionTime: '00:00',
        admittingHospital: hospitalName,
        ipdStatus: IpdStatus.ADMITTED_DONE,
        ipdStatusUpdatedAt: new Date(),
        initiatedById: actorUserId,
      },
    })
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      ipdAdmissionDate: admissionDate,
      updatedById: actorUserId,
      caseStage: CaseStage.ADMITTED,
    },
  })

  return { leadId, status: 'admitted' }
}

export async function transferDoctorAdminIpdCase(
  leadId: string,
  actorUserId: string,
  input: {
    hospitalName: string
    reason?: string | null
  }
) {
  const hospitalName = input.hospitalName.trim()
  if (!hospitalName) {
    throw new DoctorAdminMonitoringError('hospitalName is required', 400)
  }

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      admissionRecord: {
        select: {
          id: true,
          notes: true,
        },
      },
    },
  })

  if (!lead) {
    throw new DoctorAdminMonitoringError('Lead not found', 404)
  }

  const note = input.reason?.trim() ? `Transferred: ${input.reason.trim()}` : 'Transferred from doctor admin'

  if (lead.admissionRecord?.id) {
    await prisma.admissionRecord.update({
      where: { leadId },
      data: {
        admittingHospital: hospitalName,
        notes: [lead.admissionRecord.notes, note].filter(Boolean).join('\n'),
      },
    })
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      ipdHospital: hospitalName,
      updatedById: actorUserId,
    },
  })

  return { leadId, hospitalName }
}

export async function cancelDoctorAdminIpdCase(
  leadId: string,
  actorUserId: string,
  input: {
    reason?: string | null
  }
) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      admissionRecord: {
        select: {
          id: true,
        },
      },
    },
  })

  if (!lead) {
    throw new DoctorAdminMonitoringError('Lead not found', 404)
  }

  if (lead.admissionRecord?.id) {
    await prisma.admissionRecord.update({
      where: { leadId },
      data: {
        ipdStatus: IpdStatus.CANCELLED,
        ipdStatusReason: input.reason?.trim() || 'Cancelled from doctor admin',
        ipdStatusUpdatedAt: new Date(),
      },
    })
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      updatedById: actorUserId,
      remarks: input.reason?.trim() || undefined,
    },
  })

  return { leadId, status: 'cancelled' }
}
