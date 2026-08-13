import { LeadOpdStatus, Prisma } from '@/generated/prisma/client'
import type { SessionUser } from '@/lib/auth'
import { buildEffectiveOpdEntries, type EffectiveOpdEntry } from '@/lib/lead-opd-appointments'
import { getLeadVisibilityScopeUserIds } from '@/lib/lead-ownership'
import { leadOpdAppointmentSelect } from '@/lib/lead-opd-records'
import { canAccessSalesOpdMonitoring } from '@/lib/opd-monitoring-access'
import { resolvePermission, levelSatisfies } from '@/lib/rbac-new'
import { PermissionLevel } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'

const opdMonitoringLeadSelect = {
  id: true,
  leadRef: true,
  patientName: true,
  phoneNumber: true,
  whatsapp: true,
  status: true,
  hospitalName: true,
  surgeonName: true,
  followUpDate: true,
  surgeryDate: true,
  updatedDate: true,
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
  bdId: true,
  bd: {
    select: {
      id: true,
      name: true,
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

type MonitoringAppointment = {
  id: string
  leadId: string
  leadRef: string
  patientName: string
  phoneNumber: string | null
  whatsapp: string | null
  doctorName: string
  hospitalName: string
  appointmentDate: Date | string | null
  statusKey: 'scheduled' | 'done' | 'cancelled' | 'no_show'
  statusLabel: 'Scheduled' | 'Done' | 'Cancelled' | 'No Show'
  bdName: string | null
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

function isWithinRange(value: Date | string | null | undefined, range: DateRange) {
  if (!value) return false
  if (!range.start && !range.end) return true

  const time = new Date(value).getTime()
  if (range.start && time < range.start.getTime()) return false
  if (range.end && time > range.end.getTime()) return false
  return true
}

function isSameDay(value: Date | string | null | undefined, date: Date | null) {
  if (!value || !date) return false
  const a = new Date(value)
  return (
    a.getFullYear() === date.getFullYear() &&
    a.getMonth() === date.getMonth() &&
    a.getDate() === date.getDate()
  )
}

function getMonitoringStatus(entry: EffectiveOpdEntry): MonitoringAppointment['statusKey'] {
  switch (entry.status) {
    case LeadOpdStatus.DONE:
      return 'done'
    case LeadOpdStatus.CANCELLED:
      return 'cancelled'
    case LeadOpdStatus.NO_SHOW:
      return 'no_show'
    case LeadOpdStatus.SCHEDULED:
    default:
      return 'scheduled'
  }
}

function getMonitoringStatusLabel(statusKey: MonitoringAppointment['statusKey']) {
  switch (statusKey) {
    case 'done':
      return 'Done'
    case 'cancelled':
      return 'Cancelled'
    case 'no_show':
      return 'No Show'
    case 'scheduled':
    default:
      return 'Scheduled'
  }
}

function hasMonitoringSignals(entry: EffectiveOpdEntry) {
  return Boolean(
    entry.scheduleDate ||
      entry.doctorName ||
      entry.hospitalName ||
      entry.contactNumber ||
      typeof entry.charges === 'number' ||
      entry.status !== LeadOpdStatus.SCHEDULED
  )
}

function mapLeadToMonitoringAppointments(lead: OpdMonitoringLead): MonitoringAppointment[] {
  return buildEffectiveOpdEntries(lead, lead.opdAppointments)
    .filter(hasMonitoringSignals)
    .map((entry) => {
      const statusKey = getMonitoringStatus(entry)
      return {
        id: entry.id,
        leadId: lead.id,
        leadRef: lead.leadRef,
        patientName: lead.patientName,
        phoneNumber: lead.phoneNumber,
        whatsapp: lead.whatsapp,
        doctorName: entry.doctorName || 'Unassigned',
        hospitalName: entry.hospitalName || 'Unassigned',
        appointmentDate: entry.scheduleDate || lead.followUpDate || lead.surgeryDate || lead.updatedDate,
        statusKey,
        statusLabel: getMonitoringStatusLabel(statusKey),
        bdName: lead.bd?.name || null,
      }
    })
}

function matchesDoctorName(item: MonitoringAppointment, doctorName?: string) {
  if (!doctorName?.trim()) return true
  return normalizeText(item.doctorName) === normalizeText(doctorName)
}

async function canAccessEffectiveSalesOpdMonitoring(user: { id: string; role: string } | null | undefined): Promise<boolean> {
  if (!user) return false
  const perm = await resolvePermission(user.id, 'sales.opd_monitoring')
  if (levelSatisfies(perm.level, PermissionLevel.READ)) return true
  const parentPerm = await resolvePermission(user.id, 'sales')
  if (levelSatisfies(parentPerm.level, PermissionLevel.READ)) return true
  return canAccessSalesOpdMonitoring(user.role)
}

async function fetchScopedMonitoringAppointments(user: SessionUser) {
  if (!(await canAccessEffectiveSalesOpdMonitoring(user))) {
    throw new SalesOpdMonitoringError('Forbidden', 403)
  }

  const scopeUserIds =
    user.role === 'SUPER_ADMIN' ? null : await getLeadVisibilityScopeUserIds(user)

  if (Array.isArray(scopeUserIds) && scopeUserIds.length === 0) {
    return [] satisfies MonitoringAppointment[]
  }

  const leads = await prisma.lead.findMany({
    where: {
      ...(scopeUserIds === null ? {} : { bdId: { in: scopeUserIds } }),
      OR: [
        { opdScheduleDate: { not: null } },
        { opdDrName: { not: null } },
        { opdHospital: { not: null } },
        { opdAppointments: { some: {} } },
        { status: { contains: 'opd', mode: 'insensitive' } },
      ],
    },
    select: opdMonitoringLeadSelect,
    orderBy: { updatedDate: 'desc' },
    take: 2000,
  })

  return leads.flatMap(mapLeadToMonitoringAppointments)
}

export async function listSalesOpdMonitoringDoctors(user: SessionUser) {
  const appointments = await fetchScopedMonitoringAppointments(user)
  const byName = new Map<string, { id: string; name: string }>()

  for (const appointment of appointments) {
    const name = appointment.doctorName.trim()
    if (!name || normalizeText(name) === 'unassigned') continue
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
  const appointments = await fetchScopedMonitoringAppointments(user)

  if (filters.mode === 'summary') {
    const requestedDate =
      filters.range === 'day' ? parseDateInput(filters.date || '') : null

    const relevant = requestedDate
      ? appointments.filter((appointment) => isSameDay(appointment.appointmentDate, requestedDate))
      : appointments.filter((appointment) => Boolean(appointment.appointmentDate))

    return {
      scheduled: relevant.filter((appointment) => appointment.statusKey === 'scheduled').length,
      done: relevant.filter((appointment) => appointment.statusKey === 'done').length,
      noShow: relevant.filter((appointment) => appointment.statusKey === 'no_show').length,
      cancelled: relevant.filter((appointment) => appointment.statusKey === 'cancelled').length,
    }
  }

  if (filters.mode === 'daily') {
    const date = parseDateInput(filters.date || '')
    if (!date) {
      throw new SalesOpdMonitoringError('date is required for daily monitoring', 400)
    }

    return appointments.filter((appointment) => isSameDay(appointment.appointmentDate, date))
  }

  if (filters.mode === 'overdue') {
    const daysOverdue = Math.max(0, filters.daysOverdue ?? 1)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - daysOverdue)
    cutoff.setHours(23, 59, 59, 999)

    return appointments
      .filter((appointment) => matchesDoctorName(appointment, filters.doctorName))
      .filter((appointment) => appointment.statusKey === 'scheduled')
      .filter((appointment) => {
        const date = appointment.appointmentDate
        return Boolean(date && new Date(date).getTime() <= cutoff.getTime())
      })
  }

  const range = buildRange(filters.startDate, filters.endDate)
  const requestedStatus = normalizeText(filters.status)

  return appointments
    .filter((appointment) => matchesDoctorName(appointment, filters.doctorName))
    .filter((appointment) => isWithinRange(appointment.appointmentDate, range))
    .filter((appointment) =>
      requestedStatus && requestedStatus !== 'all'
        ? appointment.statusKey === requestedStatus
        : true
    )
}
