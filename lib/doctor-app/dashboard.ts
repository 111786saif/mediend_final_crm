import { IpdStatus, Prisma } from '@/generated/prisma/client'
import { DoctorAppSessionUser } from '@/lib/doctor-app/auth'
import {
  getDoctorAppContext,
  getDoctorScopedLeadWhere,
} from '@/lib/doctor-app/context'
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
  surgeryDate: true,
  ipdAdmissionDate: true,
  opdHospital: true,
  ipdHospital: true,
  updatedDate: true,
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

function getPendingTaskBuckets(leads: DashboardLead[]) {
  const cutoff = getPendingTasksCutoff()
  const overdueOpds = leads.filter(
    lead => lead.opdScheduleDate && lead.opdScheduleDate <= cutoff && !isDischarged(lead) && !getAdmissionDate(lead)
  )
  const surgeryNotConfirmed = leads.filter(
    lead =>
      Boolean(lead.surgeryDate) &&
      new Date(lead.surgeryDate as Date).getTime() <= cutoff.getTime() &&
      lead.admissionRecord?.ipdStatus !== IpdStatus.IPD_DONE &&
      lead.admissionRecord?.ipdStatus !== IpdStatus.DISCHARGED &&
      lead.admissionRecord?.ipdStatus !== IpdStatus.CANCELLED &&
      !isDischarged(lead)
  )
  const ipdNotDischarged = leads.filter(
    lead =>
      Boolean(getAdmissionDate(lead)) &&
      !isDischarged(lead) &&
      (lead.admissionRecord?.ipdStatus === IpdStatus.IPD_DONE ||
        Boolean(lead.surgeryDate && new Date(lead.surgeryDate).getTime() <= cutoff.getTime()))
  )

  return { overdueOpds, surgeryNotConfirmed, ipdNotDischarged }
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

  const opdScheduled = leads.filter(lead => inRange(lead.opdScheduleDate, start, end)).length
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
    opdsDone: followUpPending,
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
    items = leads.filter(lead => inRange(lead.opdScheduleDate, start, end))
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
  const { leads } = await getDoctorDashboardLeads(user)
  const buckets = getPendingTaskBuckets(leads)
  const total =
    buckets.overdueOpds.length +
    buckets.surgeryNotConfirmed.length +
    buckets.ipdNotDischarged.length

  return {
    hasPendingTasks: total > 0,
    total,
    overdueOpds: buckets.overdueOpds.length,
    surgeryNotConfirmed: buckets.surgeryNotConfirmed.length,
    ipdNotDischarged: buckets.ipdNotDischarged.length,
  }
}

export async function getDoctorPendingTasksList(user: DoctorAppSessionUser) {
  const { leads } = await getDoctorDashboardLeads(user)
  const buckets = getPendingTaskBuckets(leads)

  const items = [
    ...buckets.overdueOpds.map(lead => ({
      ...mapLeadItem(lead),
      taskType: 'overdue_opd',
      appointmentType: 'opd',
      reason: 'Scheduled OPD is still pending',
    })),
    ...buckets.surgeryNotConfirmed.map(lead => ({
      ...mapLeadItem(lead),
      taskType: 'surgery_not_confirmed',
      appointmentType: 'ipd',
      reason: 'Surgery date passed but surgery completion is not confirmed',
    })),
    ...buckets.ipdNotDischarged.map(lead => ({
      ...mapLeadItem(lead),
      taskType: 'ipd_not_discharged',
      appointmentType: 'ipd',
      reason: 'IPD case needs discharge update',
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
