import { IpdStatus, PipelineStage, Prisma } from '@/generated/prisma/client'
import type { SessionUser } from '@/lib/auth'
import { hasLeadOpdDone } from '@/lib/lead-opd-workflow'
import { getLeadVisibilityScopeUserIds } from '@/lib/lead-ownership'
import { prisma } from '@/lib/prisma'

const SALES_OPD_MONITORING_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'MD',
  'EXECUTIVE_ASSISTANT',
  'TESTER',
  'BD',
  'TEAM_LEAD',
  'ASSISTANT_CATEGORY_MANAGER',
  'CATEGORY_MANAGER',
  'SALES_HEAD',
] as const)

const opdMonitoringLeadSelect = {
  id: true,
  leadRef: true,
  patientName: true,
  phoneNumber: true,
  whatsapp: true,
  status: true,
  pipelineStage: true,
  lostAt: true,
  followUpDate: true,
  surgeryDate: true,
  opdHospital: true,
  opdDrName: true,
  opdScheduleDate: true,
  updatedDate: true,
  bdId: true,
  bd: {
    select: {
      id: true,
      name: true,
    },
  },
  admissionRecord: {
    select: {
      id: true,
      ipdStatus: true,
    },
  },
} satisfies Prisma.LeadSelect

type OpdMonitoringLead = Prisma.LeadGetPayload<{
  select: typeof opdMonitoringLeadSelect
}>

type DateRange = {
  start: Date | null
  end: Date | null
}

export type SalesOpdMonitoringFilters =
  | {
      mode: 'summary'
      range?: 'all' | 'day'
      date?: string
    }
  | {
      mode: 'daily'
      date?: string
    }
  | {
      mode: 'doctor'
      doctorName?: string
      startDate?: string
      endDate?: string
      status?: string
    }
  | {
      mode: 'overdue'
      doctorName?: string
      daysOverdue?: number
    }

export class SalesOpdMonitoringError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'SalesOpdMonitoringError'
    this.status = status
  }
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
    throw new SalesOpdMonitoringError('Invalid date supplied', 400)
  }

  return parsed
}

function buildRange(startDate?: string, endDate?: string): DateRange {
  const start = parseDateInput(startDate)
  const end = parseDateInput(endDate)

  if (start && end && end.getTime() < start.getTime()) {
    throw new SalesOpdMonitoringError('endDate must be on or after startDate', 400)
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

function isNoShowLead(lead: OpdMonitoringLead) {
  const status = normalizeText(lead.status)
  return ['no show', 'no-show', 'no_show', 'noshow'].includes(status)
}

function isCancelledLead(lead: OpdMonitoringLead) {
  const status = normalizeText(lead.status)
  return lead.admissionRecord?.ipdStatus === IpdStatus.CANCELLED || status.includes('cancel')
}

function isLostLead(lead: OpdMonitoringLead) {
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

function getAppointmentDate(lead: OpdMonitoringLead) {
  return lead.opdScheduleDate || lead.followUpDate || lead.surgeryDate || lead.updatedDate
}

function getAppointmentStatusKey(lead: OpdMonitoringLead) {
  if (isNoShowLead(lead)) return 'no_show'
  if (isCancelledLead(lead) || isLostLead(lead)) return 'cancelled'
  if (hasLeadOpdDone(lead)) return 'done'
  return 'scheduled'
}

function getAppointmentDisplayStatus(lead: OpdMonitoringLead) {
  const key = getAppointmentStatusKey(lead)
  if (key === 'no_show') return 'No Show'
  if (key === 'cancelled') return 'Cancelled'
  if (key === 'done') return 'Done'
  return 'Scheduled'
}

function matchesDoctorName(lead: OpdMonitoringLead, doctorName?: string) {
  if (!doctorName?.trim()) return true
  return normalizeText(lead.opdDrName) === normalizeText(doctorName)
}

function mapMonitoringItem(lead: OpdMonitoringLead) {
  return {
    id: lead.id,
    leadRef: lead.leadRef,
    patientName: lead.patientName,
    phoneNumber: lead.phoneNumber,
    whatsapp: lead.whatsapp,
    doctorName: lead.opdDrName || 'Unassigned',
    hospitalName: lead.opdHospital || 'Unassigned',
    appointmentDate: getAppointmentDate(lead),
    statusKey: getAppointmentStatusKey(lead),
    statusLabel: getAppointmentDisplayStatus(lead),
    bdName: lead.bd?.name || null,
  }
}

async function fetchScopedOpdLeads(user: SessionUser) {
  if (!SALES_OPD_MONITORING_ROLES.has(user.role)) {
    throw new SalesOpdMonitoringError('Forbidden', 403)
  }

  const scopeUserIds =
    user.role === 'SUPER_ADMIN' ? null : await getLeadVisibilityScopeUserIds(user)

  if (Array.isArray(scopeUserIds) && scopeUserIds.length === 0) {
    return [] satisfies OpdMonitoringLead[]
  }

  return prisma.lead.findMany({
    where: {
      ...(scopeUserIds === null ? {} : { bdId: { in: scopeUserIds } }),
      OR: [
        { opdScheduleDate: { not: null } },
        { opdDrName: { not: null } },
        { opdHospital: { not: null } },
        { status: { contains: 'opd', mode: 'insensitive' } },
      ],
    },
    select: opdMonitoringLeadSelect,
    orderBy: { updatedDate: 'desc' },
    take: 2000,
  })
}

export async function listSalesOpdMonitoringDoctors(user: SessionUser) {
  const leads = await fetchScopedOpdLeads(user)
  const byName = new Map<string, { id: string; name: string }>()

  for (const lead of leads) {
    const name = lead.opdDrName?.trim()
    if (!name) continue
    const key = normalizeText(name)
    if (!byName.has(key)) {
      byName.set(key, { id: name, name })
    }
  }

  return Array.from(byName.values()).sort((left, right) =>
    left.name.localeCompare(right.name)
  )
}

export async function getSalesOpdMonitoring(
  user: SessionUser,
  filters: SalesOpdMonitoringFilters
) {
  const leads = await fetchScopedOpdLeads(user)

  if (filters.mode === 'summary') {
    const requestedDate =
      filters.range === 'day' ? parseDateInput(filters.date || '') : null

    const relevant = requestedDate
      ? leads.filter((lead) => isSameDay(getAppointmentDate(lead), requestedDate))
      : leads.filter((lead) => Boolean(getAppointmentDate(lead)))

    return {
      scheduled: relevant.filter((lead) => getAppointmentStatusKey(lead) === 'scheduled').length,
      done: relevant.filter((lead) => getAppointmentStatusKey(lead) === 'done').length,
      noShow: relevant.filter((lead) => getAppointmentStatusKey(lead) === 'no_show').length,
      cancelled: relevant.filter((lead) => getAppointmentStatusKey(lead) === 'cancelled').length,
    }
  }

  if (filters.mode === 'daily') {
    const date = parseDateInput(filters.date || '')
    if (!date) {
      throw new SalesOpdMonitoringError('date is required for daily monitoring', 400)
    }

    return leads
      .filter((lead) => isSameDay(getAppointmentDate(lead), date))
      .map(mapMonitoringItem)
  }

  if (filters.mode === 'overdue') {
    const daysOverdue = Math.max(0, filters.daysOverdue ?? 1)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - daysOverdue)
    cutoff.setHours(23, 59, 59, 999)

    return leads
      .filter((lead) => matchesDoctorName(lead, filters.doctorName))
      .filter((lead) => getAppointmentStatusKey(lead) === 'scheduled')
      .filter((lead) => {
        const date = getAppointmentDate(lead)
        return Boolean(date && new Date(date).getTime() <= cutoff.getTime())
      })
      .map(mapMonitoringItem)
  }

  const range = buildRange(filters.startDate, filters.endDate)
  const requestedStatus = normalizeText(filters.status)

  return leads
    .filter((lead) => matchesDoctorName(lead, filters.doctorName))
    .filter((lead) => isWithinRange(getAppointmentDate(lead), range))
    .filter((lead) =>
      requestedStatus && requestedStatus !== 'all'
        ? getAppointmentStatusKey(lead) === requestedStatus
        : true
    )
    .map(mapMonitoringItem)
}
