import { IpdStatus, LeadOpdStatus, Prisma } from '@/generated/prisma/client'
import { DoctorAppSessionUser } from '@/lib/doctor-app/auth'
import {
  getDoctorAppContext,
  getDoctorScopedLeadWhere,
} from '@/lib/doctor-app/context'
import { buildEffectiveOpdEntries, type EffectiveOpdEntry } from '@/lib/lead-opd-appointments'
import { hasLeadOpdDone } from '@/lib/lead-opd-workflow'
import { leadOpdAppointmentSelect } from '@/lib/lead-opd-records'
import { prisma } from '@/lib/prisma'

const dashboardLeadSelect = {
  id: true,
  leadRef: true,
  patientName: true,
  phoneNumber: true,
  circle: true,
  category: true,
  treatment: true,
  hospitalName: true,
  status: true,
  caseStage: true,
  flowType: true,
  remarks: true,
  followUpDate: true,
  opdScheduleDate: true,
  opdDrName: true,
  surgeryDate: true,
  ipdAdmissionDate: true,
  opdHospital: true,
  ipdHospital: true,
  updatedDate: true,
  opdAppointments: {
    select: leadOpdAppointmentSelect,
  },
  admissionRecord: {
    select: {
      id: true,
      admissionDate: true,
      admittingHospital: true,
      expectedSurgeryDate: true,
      surgeryDate: true,
      ipdStatus: true,
      ipdStatusReason: true,
      newSurgeryDate: true,
      ipdDischargeDate: true,
      ipdStatusNotes: true,
    },
  },
  dischargeSheet: {
    select: {
      id: true,
      dischargeDate: true,
      status: true,
      isFinalized: true,
    },
  },
  plRecord: {
    select: {
      id: true,
      doctorAmountPending: true,
      outstandingStatus: true,
    },
  },
} satisfies Prisma.LeadSelect

type DashboardLead = Prisma.LeadGetPayload<{
  select: typeof dashboardLeadSelect
}>

type PendingScheduledOpd = {
  lead: DashboardLead
  entry: EffectiveOpdEntry
}

type DateFilters = {
  day?: number
  month?: number
  year?: number
}

export class DoctorAppDashboardError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'DoctorAppDashboardError'
    this.status = status
  }
}

function getRange(filters: DateFilters) {
  const now = new Date()
  const month = filters.month
  const year = filters.year
  const day = filters.day

  if (day !== undefined) {
    const resolvedMonth = month ?? now.getMonth() + 1
    const resolvedYear = year ?? now.getFullYear()
    const start = new Date(resolvedYear, resolvedMonth - 1, day, 0, 0, 0, 0)
    if (
      start.getFullYear() !== resolvedYear ||
      start.getMonth() !== resolvedMonth - 1 ||
      start.getDate() !== day
    ) {
      throw new DoctorAppDashboardError('Invalid day for the selected month/year', 400)
    }

    return {
      start,
      end: new Date(resolvedYear, resolvedMonth - 1, day, 23, 59, 59, 999),
      scope: { day, month: resolvedMonth, year: resolvedYear },
    }
  }

  if (month !== undefined) {
    const resolvedYear = year ?? now.getFullYear()
    return {
      start: new Date(resolvedYear, month - 1, 1, 0, 0, 0, 0),
      end: new Date(resolvedYear, month, 0, 23, 59, 59, 999),
      scope: { month, year: resolvedYear },
    }
  }

  if (year !== undefined) {
    return {
      start: new Date(year, 0, 1, 0, 0, 0, 0),
      end: new Date(year, 11, 31, 23, 59, 59, 999),
      scope: { year },
    }
  }

  return {
    start: null,
    end: null,
    scope: { month: now.getMonth() + 1, year: now.getFullYear() },
  }
}

function inRange(value: Date | null | undefined, start: Date | null, end: Date | null) {
  if (!value) return false
  if (!start || !end) return true
  const ts = new Date(value).getTime()
  return ts >= start.getTime() && ts <= end.getTime()
}

function getAdmissionDate(lead: DashboardLead) {
  return lead.admissionRecord?.admissionDate || lead.ipdAdmissionDate || null
}

function getDischargeDate(lead: DashboardLead) {
  return lead.admissionRecord?.ipdDischargeDate || lead.dischargeSheet?.dischargeDate || null
}

function isDischarged(lead: DashboardLead) {
  return Boolean(
    getDischargeDate(lead) ||
      lead.admissionRecord?.ipdStatus === IpdStatus.DISCHARGED ||
      ['DISCHARGED', 'PL_PENDING', 'OUTSTANDING', 'CASH_DISCHARGED'].includes(String(lead.caseStage))
  )
}

function normalizeComparableText(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function matchesDoctorAssignment(value: string | null | undefined, doctorName: string) {
  return normalizeComparableText(value) === normalizeComparableText(doctorName)
}

function getEffectiveOpdEntriesForLead(lead: DashboardLead) {
  return buildEffectiveOpdEntries(lead, lead.opdAppointments)
}

function mapLeadItem(lead: DashboardLead) {
  return {
    id: lead.id,
    leadRef: lead.leadRef,
    patientName: lead.patientName,
    phoneNumber: lead.phoneNumber,
    circle: lead.circle,
    category: lead.category,
    treatment: lead.treatment,
    hospitalName: lead.ipdHospital || lead.opdHospital || lead.hospitalName,
    status: lead.status,
    caseStage: lead.caseStage,
    flowType: lead.flowType,
    opdScheduleDate: lead.opdScheduleDate,
    followUpDate: lead.followUpDate,
    admissionDate: getAdmissionDate(lead),
    surgeryDate: lead.admissionRecord?.surgeryDate || lead.surgeryDate || lead.admissionRecord?.expectedSurgeryDate,
    dischargeDate: getDischargeDate(lead),
    remarks: lead.remarks,
  }
}

function resolveMetric(metric: string) {
  const normalized = metric.trim().toLowerCase()
  const aliases: Record<string, string> = {
    opd: 'pre_op_opd',
    'pre-op': 'pre_op_opd',
    pre_op: 'pre_op_opd',
    post_op: 'post_op_opd',
    'post-op': 'post_op_opd',
    follow_up_pending: 'post_op_opd',
    surgeryadvised: 'surgery_due',
    'surgery-advised': 'surgery_due',
    surgery_advised: 'surgery_due',
    ipd: 'ipd_discharged',
    ipd_done: 'ipd_discharged',
  }

  return aliases[normalized] || normalized
}

function getPendingTasksCutoff() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  d.setHours(22, 0, 0, 0)
  return d
}

function getPendingIpdScheduledDate(lead: DashboardLead) {
  return (
    lead.admissionRecord?.newSurgeryDate ||
    lead.admissionRecord?.expectedSurgeryDate ||
    lead.admissionRecord?.surgeryDate ||
    lead.surgeryDate ||
    getAdmissionDate(lead)
  )
}

function isPendingScheduledIpd(lead: DashboardLead, cutoff: Date) {
  const scheduledDate = getPendingIpdScheduledDate(lead)
  if (!scheduledDate || isDischarged(lead)) {
    return false
  }

  if (new Date(scheduledDate).getTime() > cutoff.getTime()) {
    return false
  }

  return lead.admissionRecord?.ipdStatus == null
}

function getPendingDoctorScheduledOpds(
  lead: DashboardLead,
  doctorName: string,
  cutoff: Date
) {
  return getEffectiveOpdEntriesForLead(lead).filter((entry) => {
    if (!matchesDoctorAssignment(entry.doctorName, doctorName)) {
      return false
    }

    if (entry.status !== LeadOpdStatus.SCHEDULED || !entry.scheduleDate) {
      return false
    }

    if (new Date(entry.scheduleDate).getTime() > cutoff.getTime()) {
      return false
    }

    return !isDischarged(lead)
  })
}

function getPendingTaskBuckets(leads: DashboardLead[], doctorName: string) {
  const cutoff = getPendingTasksCutoff()
  const overdueOpds = leads.flatMap((lead) =>
    getPendingDoctorScheduledOpds(lead, doctorName, cutoff).map((entry) => ({
      lead,
      entry,
    }))
  )
  const overdueIpds = leads.filter(lead => isPendingScheduledIpd(lead, cutoff))

  return { overdueOpds, overdueIpds }
}

async function getDoctorDashboardLeads(user: DoctorAppSessionUser) {
  const context = await getDoctorAppContext(user)
  const leads = await prisma.lead.findMany({
    where: {
      AND: [getDoctorScopedLeadWhere(context.doctorName)],
    },
    select: dashboardLeadSelect,
    orderBy: { updatedDate: 'desc' },
  })

  return { context, leads }
}

export async function getDoctorDashboardSummary(user: DoctorAppSessionUser, filters: DateFilters) {
  const { context, leads } = await getDoctorDashboardLeads(user)
  const { start, end, scope } = getRange(filters)

  const opdScheduled = leads.filter(lead => !hasLeadOpdDone(lead) && inRange(lead.opdScheduleDate, start, end)).length
  const opdsDone = leads.filter(
    lead =>
      hasLeadOpdDone(lead) &&
      (inRange(lead.opdScheduleDate, start, end) || inRange(lead.updatedDate, start, end))
  ).length
  const followUpPending = leads.filter(lead => inRange(lead.followUpDate, start, end)).length
  const admitted = leads.filter(lead => inRange(getAdmissionDate(lead), start, end)).length
  const surgeryDue = leads.filter(
    lead =>
      inRange(lead.surgeryDate, start, end) ||
      inRange(lead.admissionRecord?.expectedSurgeryDate, start, end) ||
      inRange(lead.admissionRecord?.newSurgeryDate, start, end)
  ).length
  const ipdDischarged = leads.filter(lead => inRange(getDischargeDate(lead), start, end)).length
  const payoutPending = leads.filter(lead => (lead.plRecord?.doctorAmountPending || 0) > 0).length

  return {
    ...scope,
    doctor: {
      id: context.doctorId,
      name: context.doctorName,
    },
    opdScheduled,
    followUpPending,
    admitted,
    surgeryDue,
    ipdDischarged,
    payoutPending,
    opdVisits: opdScheduled + followUpPending,
    ipdCases: admitted,
    opdsDone,
    preOp: opdScheduled,
    postOp: followUpPending,
    surgeryAdvised: surgeryDue,
    ipdsDone: ipdDischarged,
  }
}

export async function getDoctorDashboardDrilldown(
  user: DoctorAppSessionUser,
  metric: string,
  filters: DateFilters
) {
  const { leads } = await getDoctorDashboardLeads(user)
  const { start, end, scope } = getRange(filters)
  const resolvedMetric = resolveMetric(metric || 'pre_op_opd')

  let items: DashboardLead[] = []

  if (resolvedMetric === 'pre_op_opd' || resolvedMetric === 'opd_scheduled') {
    items = leads.filter(lead => !hasLeadOpdDone(lead) && inRange(lead.opdScheduleDate, start, end))
  } else if (resolvedMetric === 'post_op_opd') {
    items = leads.filter(lead => inRange(lead.followUpDate, start, end))
  } else if (resolvedMetric === 'surgery_due') {
    items = leads.filter(
      lead =>
        inRange(lead.surgeryDate, start, end) ||
        inRange(lead.admissionRecord?.expectedSurgeryDate, start, end) ||
        inRange(lead.admissionRecord?.newSurgeryDate, start, end)
    )
  } else if (resolvedMetric === 'ipd_discharged') {
    items = leads.filter(lead => inRange(getDischargeDate(lead), start, end))
  } else if (resolvedMetric === 'admitted') {
    items = leads.filter(lead => inRange(getAdmissionDate(lead), start, end))
  } else if (resolvedMetric === 'payout_pending') {
    items = leads.filter(lead => (lead.plRecord?.doctorAmountPending || 0) > 0)
  }

  return {
    ...scope,
    metric: resolvedMetric,
    items: items.map(mapLeadItem),
    supportedMetrics: [
      'pre_op_opd',
      'post_op_opd',
      'surgery_due',
      'ipd_discharged',
      'admitted',
      'payout_pending',
    ],
  }
}

export async function getDoctorPendingTasksSummary(user: DoctorAppSessionUser) {
  const { context, leads } = await getDoctorDashboardLeads(user)
  const buckets = getPendingTaskBuckets(leads, context.doctorName)
  const total = buckets.overdueOpds.length + buckets.overdueIpds.length

  return {
    hasPendingTasks: total > 0,
    total,
    overdueOpds: buckets.overdueOpds.length,
    overdueIpds: buckets.overdueIpds.length,
    surgeryNotConfirmed: 0,
    ipdNotDischarged: 0,
  }
}

export async function getDoctorPendingTasksList(user: DoctorAppSessionUser) {
  const { context, leads } = await getDoctorDashboardLeads(user)
  const buckets = getPendingTaskBuckets(leads, context.doctorName)

  const items = [
    ...buckets.overdueOpds.map(({ lead, entry }: PendingScheduledOpd) => ({
      ...mapLeadItem(lead),
      id: entry.id,
      leadId: lead.id,
      appointmentId: entry.id,
      taskType: 'overdue_opd',
      appointmentType: 'opd',
      opdPhase: entry.phase,
      opdSlot: entry.slot,
      opdStatus: entry.status,
      hospitalName: entry.hospitalName || lead.opdHospital || lead.hospitalName,
      opdScheduleDate: entry.scheduleDate,
      reason: 'Scheduled OPD is still pending',
    })),
    ...buckets.overdueIpds.map(lead => ({
      ...mapLeadItem(lead),
      leadId: lead.id,
      appointmentId: lead.id,
      taskType: 'overdue_ipd',
      appointmentType: 'ipd',
      reason: 'Scheduled IPD is still pending',
    })),
  ].sort((a, b) => {
    const aTime =
      new Date(a.opdScheduleDate || a.surgeryDate || a.admissionDate || a.dischargeDate || 0).getTime()
    const bTime =
      new Date(b.opdScheduleDate || b.surgeryDate || b.admissionDate || b.dischargeDate || 0).getTime()
    return aTime - bTime
  })

  return {
    items,
    total: items.length,
  }
}
