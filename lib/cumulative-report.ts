import { Prisma } from '@/generated/prisma/client'
import { mapStatusCode } from '@/lib/mysql-code-mappings'
import { normalizeLeadStatus } from '@/lib/pipeline-lead-buckets'

export type CumulativeReportStatus =
  | 'Planning'
  | 'IPD Done'
  | 'Pending'
  | 'Cancelled'
  | 'Follow-up'

export const CUMULATIVE_REPORT_STATUSES: CumulativeReportStatus[] = [
  'Planning',
  'IPD Done',
  'Pending',
  'Cancelled',
  'Follow-up',
]

export type CumulativeDatePreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_month'
  | 'custom'
  | 'all'

const IPD_DONE_STAGES = [
  'IPD_DONE',
  'CASH_IPD_DONE',
  'DISCHARGED',
  'CASH_DISCHARGED',
  'PL_PENDING',
  'OUTSTANDING',
] as const

const PLANNING_STAGES = [
  'NEW_LEAD',
  'KYP_BASIC_PENDING',
  'KYP_BASIC_COMPLETE',
  'KYP_DETAILED_PENDING',
  'KYP_DETAILED_COMPLETE',
  'KYP_PENDING',
  'KYP_COMPLETE',
  'HOSPITALS_SUGGESTED',
  'PREAUTH_RAISED',
  'PREAUTH_COMPLETE',
] as const

/** Status codes from MySQL mapping grouped for DB filters */
const STATUS_CODES = {
  followUp: ['1', '2', '3', '19', '20', '21', '22', '35', '42', '16'],
  ipdDone: ['13'],
  planning: ['27', '28', '39', '37', '14', '12'],
  cancelled: ['15', '10', '33', '34', '26', '36', '23', '18', '41', '4', '5', '6', '7', '8', '9'],
} as const

export interface CumulativeReportFilters {
  datePreset?: CumulativeDatePreset | null
  startDate?: string | null
  endDate?: string | null
  hospital?: string | null
  circle?: string | null
  treatment?: string | null
  referralName?: string | null
  bdId?: string | null
  status?: CumulativeReportStatus | null
  search?: string | null
}

export interface CumulativeReportRow {
  id: string
  date: string
  patientName: string
  patientContact: string
  referralName: string
  referralContact: string
  treatment: string
  hospitalName: string
  circle: string
  businessDeveloper: string
  status: CumulativeReportStatus
}

export interface CumulativeReportSummary {
  totalPatients: number
  totalSurgeries: number
  planning: number
  ipdDone: number
  pending: number
  cancelled: number
  followUp: number
}

type LeadForStatus = {
  status: string
  caseStage: string
  pipelineStage: string
  followUpDate?: Date | null
}

export function getCumulativeReportStatus(lead: LeadForStatus): CumulativeReportStatus {
  if (lead.pipelineStage === 'LOST') return 'Cancelled'

  const norm = normalizeLeadStatus(lead.status)
  const lower = norm.toLowerCase()

  if (
    lower === 'ipd done' ||
    IPD_DONE_STAGES.includes(lead.caseStage as (typeof IPD_DONE_STAGES)[number])
  ) {
    return 'IPD Done'
  }

  if (
    ['Lost', 'IPD Lost', 'Fund Issues', 'Not Interested', 'Duplicate lead', 'Junk', 'Invalid Number'].includes(norm) ||
    lower.includes('lost') ||
    lower.includes('junk') ||
    lower.includes('invalid number') ||
    lower.includes('not interested')
  ) {
    return 'Cancelled'
  }

  if (lower.includes('follow') || lower.includes('call back') || lead.followUpDate != null) {
    return 'Follow-up'
  }

  if (
    ['New', 'Hot Lead', 'Interested', 'Nurture', 'IPD Schedule', 'OPD Schedule', 'New Lead'].includes(norm) ||
    PLANNING_STAGES.includes(lead.caseStage as (typeof PLANNING_STAGES)[number])
  ) {
    return 'Planning'
  }

  return 'Pending'
}

export function resolveCumulativeDateRange(
  preset: CumulativeDatePreset | string | null | undefined,
  startDate?: string | null,
  endDate?: string | null,
): Prisma.DateTimeFilter | undefined {
  if (!preset || preset === 'all') return undefined

  const now = new Date()

  if (preset === 'custom') {
    if (!startDate && !endDate) return undefined
    const filter: Prisma.DateTimeFilter = {}
    if (startDate) filter.gte = new Date(startDate)
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      filter.lte = end
    }
    return filter
  }

  let gte: Date
  let lt: Date

  switch (preset) {
    case 'today':
      gte = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      lt = new Date(gte)
      lt.setDate(lt.getDate() + 1)
      break
    case 'this_week': {
      const day = now.getDay()
      const mondayOffset = day === 0 ? 6 : day - 1
      gte = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset)
      lt = new Date(gte)
      lt.setDate(lt.getDate() + 7)
      break
    }
    case 'this_month':
      gte = new Date(now.getFullYear(), now.getMonth(), 1)
      lt = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      break
    case 'last_month':
      gte = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      lt = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    default:
      return undefined
  }

  return { gte, lt }
}

function statusTextOr(terms: string[]): Prisma.LeadWhereInput[] {
  return terms.map((term) => ({
    status: { contains: term, mode: 'insensitive' as const },
  }))
}

function buildFollowUpWhere(): Prisma.LeadWhereInput {
  return {
    OR: [
      { status: { in: [...STATUS_CODES.followUp] } },
      { followUpDate: { not: null } },
      ...statusTextOr(['follow', 'call back', 'out of station']),
    ],
  }
}

function buildIpdDoneWhere(): Prisma.LeadWhereInput {
  return {
    OR: [
      { status: { in: [...STATUS_CODES.ipdDone] } },
      { caseStage: { in: [...IPD_DONE_STAGES] } },
      { surgeryDate: { not: null } },
      ...statusTextOr(['ipd done']),
    ],
  }
}

function buildPlanningWhere(): Prisma.LeadWhereInput {
  return {
    OR: [
      { status: { in: [...STATUS_CODES.planning] } },
      { caseStage: { in: [...PLANNING_STAGES] } },
      ...statusTextOr(['new lead', 'hot lead', 'interested', 'nurture', 'ipd schedule', 'opd schedule']),
    ],
  }
}

function buildCancelledWhere(): Prisma.LeadWhereInput {
  return {
    OR: [
      { pipelineStage: 'LOST' },
      { status: { in: [...STATUS_CODES.cancelled] } },
      ...statusTextOr(['lost', 'junk', 'invalid', 'not interested', 'duplicate', 'fund issues', 'dnp']),
    ],
  }
}

export function buildCumulativeStatusWhere(
  status: CumulativeReportStatus,
): Prisma.LeadWhereInput {
  switch (status) {
    case 'Follow-up':
      return buildFollowUpWhere()
    case 'IPD Done':
      return buildIpdDoneWhere()
    case 'Planning':
      return buildPlanningWhere()
    case 'Cancelled':
      return buildCancelledWhere()
    case 'Pending':
      return {
        AND: [
          { pipelineStage: { not: 'LOST' } },
          { NOT: buildFollowUpWhere() },
          { NOT: buildIpdDoneWhere() },
          { NOT: buildPlanningWhere() },
          { NOT: buildCancelledWhere() },
        ],
      }
  }
}

export function buildCumulativeLeadWhere(
  filters: CumulativeReportFilters,
): Prisma.LeadWhereInput {
  const and: Prisma.LeadWhereInput[] = []

  const dateFilter = resolveCumulativeDateRange(
    filters.datePreset ?? 'all',
    filters.startDate,
    filters.endDate,
  )
  if (dateFilter) {
    and.push({
      OR: [
        { leadEntryDate: dateFilter },
        { assignedDate: dateFilter },
        { createdDate: dateFilter },
      ],
    })
  }

  const hospital = filters.hospital?.trim()
  if (hospital) {
    and.push({ hospitalName: { contains: hospital, mode: 'insensitive' } })
  }

  const circle = filters.circle?.trim()
  if (circle) {
    and.push({ circle: { equals: circle, mode: 'insensitive' } })
  }

  const treatment = filters.treatment?.trim()
  if (treatment) {
    and.push({ treatment: { contains: treatment, mode: 'insensitive' } })
  }

  const bdId = filters.bdId?.trim()
  if (bdId) and.push({ bdId })

  const referral = filters.referralName?.trim()
  if (referral) {
    and.push({
      OR: [
        { complianceCall: { referralName: { contains: referral, mode: 'insensitive' } } },
        { refId: { contains: referral, mode: 'insensitive' } },
        { source: { contains: referral, mode: 'insensitive' } },
      ],
    })
  }

  if (filters.status) {
    and.push(buildCumulativeStatusWhere(filters.status))
  }

  const search = filters.search?.trim()
  if (search) {
    and.push({
      OR: [
        { patientName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
        { alternateNumber: { contains: search } },
      ],
    })
  }

  if (and.length === 0) return {}
  return { AND: and }
}

export function buildSurgeryWhere(): Prisma.LeadWhereInput {
  return buildIpdDoneWhere()
}

const LEAD_SELECT = {
  id: true,
  leadEntryDate: true,
  assignedDate: true,
  createdDate: true,
  patientName: true,
  phoneNumber: true,
  treatment: true,
  hospitalName: true,
  circle: true,
  status: true,
  caseStage: true,
  pipelineStage: true,
  followUpDate: true,
  refId: true,
  source: true,
  bd: { select: { id: true, name: true } },
  complianceCall: { select: { referralName: true, referralContact: true } },
} satisfies Prisma.LeadSelect

export type CumulativeLeadRecord = Prisma.LeadGetPayload<{ select: typeof LEAD_SELECT }>

export { LEAD_SELECT }

export function mapLeadToCumulativeRow(lead: CumulativeLeadRecord): CumulativeReportRow {
  const dateRaw = lead.leadEntryDate ?? lead.assignedDate ?? lead.createdDate
  return {
    id: lead.id,
    date: dateRaw ? dateRaw.toISOString().slice(0, 10) : '',
    patientName: lead.patientName,
    patientContact: lead.phoneNumber,
    referralName:
      lead.complianceCall?.referralName?.trim() ||
      lead.refId?.trim() ||
      lead.source?.trim() ||
      '',
    referralContact: lead.complianceCall?.referralContact?.trim() || '',
    treatment: lead.treatment ?? '',
    hospitalName: lead.hospitalName,
    circle: lead.circle,
    businessDeveloper: lead.bd?.name ?? '',
    status: getCumulativeReportStatus(lead),
  }
}

export function buildCumulativeOrderBy(
  sort?: string | null,
  dir?: string | null,
): Prisma.LeadOrderByWithRelationInput[] {
  const direction = dir === 'asc' ? 'asc' : 'desc'
  switch (sort) {
    case 'patientName':
      return [{ patientName: direction }]
    case 'hospitalName':
      return [{ hospitalName: direction }]
    case 'circle':
      return [{ circle: direction }]
    case 'treatment':
      return [{ treatment: direction }]
    case 'status':
      return [{ status: direction }]
    case 'bd':
      return [{ bd: { name: direction } }]
    case 'date':
    default:
      return [{ leadEntryDate: direction }, { assignedDate: direction }, { createdDate: direction }]
  }
}

/** Display label for raw lead.status in exports */
export function formatLeadStatusDisplay(status: string): string {
  return mapStatusCode(status)
}
