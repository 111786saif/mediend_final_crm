import { prisma } from '@/lib/prisma'
import type { SessionUser } from '@/lib/auth'
import { getLeadVisibilityScopeUserIds } from '@/lib/lead-ownership'

export type CaseEventType = 'IPD' | 'OPD'
export type CaseEventStatus = 'DONE' | 'SCHEDULED' | 'POSTPONED' | 'CANCELLED'

export type CaseEvent = {
  id: string
  leadId: string
  patientName: string
  bdId: string
  bdName: string
  type: CaseEventType
  status: CaseEventStatus
  date: string // ISO date this event is plotted on
  hospital: string | null
  doctor: string | null
  treatment: string | null
  circle: string | null
}

/**
 * NOTE on status mapping — the schema doesn't have a 1:1 status per requested
 * bucket, so a couple of these are best-effort mappings rather than exact
 * matches:
 *  - OPD "POSTPONED" isn't a distinct LeadOpdStatus value (only SCHEDULED /
 *    DONE / CANCELLED / NO_SHOW exist). NO_SHOW is mapped to POSTPONED here
 *    as the closest fit — flag if that's not the right read.
 *  - IPD "SCHEDULED" isn't an IpdStatus value either — an AdmissionRecord
 *    with no ipdStatus set yet (surgery date booked, outcome not recorded)
 *    is treated as SCHEDULED.
 */
function mapOpdStatus(status: string): CaseEventStatus {
  if (status === 'DONE') return 'DONE'
  if (status === 'CANCELLED') return 'CANCELLED'
  if (status === 'NO_SHOW') return 'POSTPONED'
  return 'SCHEDULED'
}

function mapIpdStatus(status: string | null): CaseEventStatus {
  if (status === 'IPD_DONE' || status === 'ADMITTED_DONE' || status === 'DISCHARGED') return 'DONE'
  if (status === 'POSTPONED') return 'POSTPONED'
  if (status === 'CANCELLED') return 'CANCELLED'
  return 'SCHEDULED'
}

export async function getCaseCalendarEvents(
  user: SessionUser,
  params: {
    startDate: Date
    endDate: Date
    types: CaseEventType[] // which of IPD / OPD to include
    statuses: CaseEventStatus[] // which statuses to include
    bdIds?: string[] // narrow to specific BDs (already validated against scope by caller)
  }
): Promise<CaseEvent[]> {
  const { startDate, endDate, types, statuses } = params

  const scopeUserIds = await getLeadVisibilityScopeUserIds(user)
  let allowedBdIds: string[] | null = scopeUserIds
  if (params.bdIds && params.bdIds.length > 0) {
    allowedBdIds = scopeUserIds ? scopeUserIds.filter((id) => params.bdIds!.includes(id)) : params.bdIds
  }
  // scopeUserIds === null means "no restriction" (full-access role). If a
  // bdId filter was requested, narrow to just those; otherwise leave
  // unrestricted.
  const leadBdWhere = allowedBdIds ? { bdId: { in: allowedBdIds } } : {}

  const events: CaseEvent[] = []

  if (types.includes('OPD')) {
    const appointments = await prisma.leadOpdAppointment.findMany({
      where: {
        scheduleDate: { gte: startDate, lte: endDate },
        lead: { is: leadBdWhere },
      },
      select: {
        id: true,
        leadId: true,
        status: true,
        hospitalName: true,
        doctorName: true,
        scheduleDate: true,
        lead: {
          select: {
            patientName: true,
            bdId: true,
            treatment: true,
            circle: true,
            bd: { select: { name: true } },
          },
        },
      },
    })

    for (const a of appointments) {
      if (!a.scheduleDate) continue
      const status = mapOpdStatus(a.status)
      if (!statuses.includes(status)) continue
      events.push({
        id: `opd:${a.id}`,
        leadId: a.leadId,
        patientName: a.lead.patientName,
        bdId: a.lead.bdId,
        bdName: a.lead.bd.name,
        type: 'OPD',
        status,
        date: a.scheduleDate.toISOString(),
        hospital: a.hospitalName,
        doctor: a.doctorName,
        treatment: a.lead.treatment,
        circle: a.lead.circle,
      })
    }
  }

  if (types.includes('IPD')) {
    const admissions = await prisma.admissionRecord.findMany({
      where: {
        lead: { is: leadBdWhere },
        OR: [
          { newSurgeryDate: { gte: startDate, lte: endDate } },
          { AND: [{ newSurgeryDate: null }, { surgeryDate: { gte: startDate, lte: endDate } }] },
          {
            AND: [
              { newSurgeryDate: null },
              { surgeryDate: null },
              { expectedSurgeryDate: { gte: startDate, lte: endDate } },
            ],
          },
        ],
      },
      select: {
        id: true,
        leadId: true,
        ipdStatus: true,
        surgeryDate: true,
        newSurgeryDate: true,
        expectedSurgeryDate: true,
        admittingHospital: true,
        lead: {
          select: {
            patientName: true,
            bdId: true,
            treatment: true,
            circle: true,
            bd: { select: { name: true } },
          },
        },
      },
    })

    for (const rec of admissions) {
      const displayDate = rec.newSurgeryDate ?? rec.surgeryDate ?? rec.expectedSurgeryDate
      if (!displayDate) continue
      const status = mapIpdStatus(rec.ipdStatus)
      if (!statuses.includes(status)) continue
      events.push({
        id: `ipd:${rec.id}`,
        leadId: rec.leadId,
        patientName: rec.lead.patientName,
        bdId: rec.lead.bdId,
        bdName: rec.lead.bd.name,
        type: 'IPD',
        status,
        date: displayDate.toISOString(),
        hospital: rec.admittingHospital,
        doctor: null,
        treatment: rec.lead.treatment,
        circle: rec.lead.circle,
      })
    }
  }

  return events
}