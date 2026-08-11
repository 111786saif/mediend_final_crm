import { CaseStage, Prisma } from '@/generated/prisma/client'
import type { SessionUser } from '@/lib/auth'
import { getCaseStageBadgeConfig } from '@/lib/case-stage-labels'
import { getTeamLeadLeadAccessBdUserIds } from '@/lib/hierarchy'
import { resolveLeadCity, resolveLeadHospitalDoctor, resolveLeadSourceDisplay } from '@/lib/lead-display'
import { hasLeadOpdDone, hasLeadOpdScheduled } from '@/lib/lead-opd-workflow'
import {
  getLeadAgeInfo,
  getLeadPipelineBucket,
  normalizeLeadStatus,
  type LeadAgeFilter,
  type PipelineStatusBucket,
} from '@/lib/pipeline-lead-buckets'
import { parsePhoneSearchQuery } from '@/lib/phone-search'
import { normalizeModeOfPaymentLabel } from '@/lib/mode-of-payment'
import { format } from 'date-fns'

export type PipelineSortField = 'date' | 'patient' | 'status' | 'leadRef' | 'bd' | 'followUpDate'
export type PipelineSortDir = 'asc' | 'desc'

export type PipelineServerColumnFilterField =
  | 'leadRef'
  | 'assignDate'
  | 'leadDate'
  | 'patient'
  | 'month'
  | 'age'
  | 'sex'
  | 'circle'
  | 'city'
  | 'category'
  | 'treatment'
  | 'planningTreatment'
  | 'profession'
  | 'tl'
  | 'hospital'
  | 'doctor'
  | 'status'
  | 'stage'
  | 'mop'
  | 'lastRemarks'
  | 'followUpDate'
  | 'subStatus'
  | 'surgeryDate'
  | 'healthInsurance'
  | 'preferredLocation'
  | 'source'
  | 'leadSource'
  | 'createDate'
  | 'modifyBy'
  | 'modifyDate'
  | 'dupCount'
  | 'recency'
  | 'bd'

type PipelineDateColumnFilterField =
  | 'assignDate'
  | 'leadDate'
  | 'followUpDate'
  | 'surgeryDate'
  | 'createDate'
  | 'modifyDate'

type PipelineMultiColumnFilterField = Exclude<PipelineServerColumnFilterField, PipelineDateColumnFilterField>

export type PipelineServerColumnFilter =
  | {
      field: PipelineDateColumnFilterField
      operator: 'between'
      value: [string, string]
    }
  | {
      field: PipelineMultiColumnFilterField
      operator: 'in'
      value: string[]
    }

const PIPELINE_DATE_COLUMN_FILTER_FIELDS = new Set<PipelineDateColumnFilterField>([
  'assignDate',
  'leadDate',
  'followUpDate',
  'surgeryDate',
  'createDate',
  'modifyDate',
])

const PIPELINE_MULTI_COLUMN_FILTER_FIELDS = new Set<PipelineMultiColumnFilterField>([
  'leadRef',
  'patient',
  'month',
  'age',
  'sex',
  'circle',
  'city',
  'category',
  'treatment',
  'planningTreatment',
  'profession',
  'tl',
  'hospital',
  'doctor',
  'status',
  'stage',
  'mop',
  'lastRemarks',
  'subStatus',
  'healthInsurance',
  'preferredLocation',
  'source',
  'leadSource',
  'modifyBy',
  'dupCount',
  'recency',
  'bd',
])

export interface PipelineQueryParams {
  page: number
  pageSize: number
  search: string
  statusBucket: PipelineStatusBucket
  bdId: string | null
  category: string | null
  circle: string | null
  treatment: string | null
  campaignName: string | null
  groupBy: 'circle' | 'disease'
  leadAge: LeadAgeFilter
  startDate: string | null
  endDate: string | null
  columnFilters: PipelineServerColumnFilter[]
  sortBy: PipelineSortField
  sortDir: PipelineSortDir
}

export function parsePipelineQueryParams(searchParams: URLSearchParams): PipelineQueryParams {
  const page = Math.max(1, Number(searchParams.get('page') || 1) || 1)
  const pageSize = Math.min(500, Math.max(10, Number(searchParams.get('pageSize') || 50) || 50))
  const statusRaw = searchParams.get('status') || 'all'
  const allowedStatus: PipelineStatusBucket[] = [
    'all',
    'new_hot',
    'follow_up',
    'opd_done',
    'ipd_done',
    'dnp',
    'junk',
    'lost',
    'closed',
  ]
  const statusBucket = allowedStatus.includes(statusRaw as PipelineStatusBucket)
    ? (statusRaw as PipelineStatusBucket)
    : 'all'

  const ageRaw = searchParams.get('age') || 'all'
  const allowedAge: LeadAgeFilter[] = ['all', 'new', 'lt1m', '1to2m', '2to3m', '3plus']
  const leadAge = allowedAge.includes(ageRaw as LeadAgeFilter) ? (ageRaw as LeadAgeFilter) : 'all'

  const sortRaw = searchParams.get('sort') || 'date'
  const allowedSort: PipelineSortField[] = ['date', 'patient', 'status', 'leadRef', 'bd', 'followUpDate']
  const sortBy = allowedSort.includes(sortRaw as PipelineSortField)
    ? (sortRaw as PipelineSortField)
    : 'date'

  const sortDir: PipelineSortDir = searchParams.get('dir') === 'asc' ? 'asc' : 'desc'
  const groupBy = searchParams.get('groupBy') === 'disease' ? 'disease' : 'circle'

  return {
    page,
    pageSize,
    search: (searchParams.get('q') || searchParams.get('search') || '').trim(),
    statusBucket,
    bdId: emptyToNull(searchParams.get('bdId')),
    category: emptyToNull(searchParams.get('category')),
    circle: emptyToNull(searchParams.get('circle')),
    treatment: emptyToNull(searchParams.get('treatment')),
    campaignName: emptyToNull(searchParams.get('campaign')),
    groupBy,
    leadAge,
    startDate: emptyToNull(searchParams.get('from')),
    endDate: emptyToNull(searchParams.get('to')),
    columnFilters: parsePipelineColumnFilters(searchParams.get('filters')),
    sortBy,
    sortDir,
  }
}

function parsePipelineColumnFilters(raw: string | null): PipelineServerColumnFilter[] {
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return []

      const field = (item as { field?: unknown }).field
      const operator = (item as { operator?: unknown }).operator
      const value = (item as { value?: unknown }).value

      if (typeof field !== 'string') {
        return []
      }

      if (PIPELINE_DATE_COLUMN_FILTER_FIELDS.has(field as PipelineDateColumnFilterField)) {
        if (
          operator !== 'between' ||
          !Array.isArray(value) ||
          value.length !== 2 ||
          typeof value[0] !== 'string' ||
          typeof value[1] !== 'string'
        ) {
          return []
        }

        return [
          {
            field: field as PipelineDateColumnFilterField,
            operator: 'between' as const,
            value: [value[0], value[1]],
          },
        ]
      }

      if (PIPELINE_MULTI_COLUMN_FILTER_FIELDS.has(field as PipelineMultiColumnFilterField)) {
        if (operator !== 'in' || !Array.isArray(value)) {
          return []
        }

        const cleanedValues = value
          .filter((entry): entry is string => typeof entry === 'string')
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)

        if (cleanedValues.length === 0) {
          return []
        }

        return [
          {
            field: field as PipelineMultiColumnFilterField,
            operator: 'in' as const,
            value: cleanedValues,
          },
        ]
      }

      return []
    })
  } catch {
    return []
  }
}

function emptyToNull(v: string | null): string | null {
  if (!v || v === 'all') return null
  return v
}

export async function buildPipelineRoleWhere(
  user: SessionUser,
): Promise<{ where: Prisma.LeadWhereInput; subordinateUserIds?: string[] }> {
  if (user.role === 'BD') {
    return { where: { bdId: user.id } }
  }
  // TL, ACM (TL-equivalent), and CM: self + recursive subordinates
  if (
    user.role === 'TEAM_LEAD' ||
    user.role === 'ASSISTANT_CATEGORY_MANAGER' ||
    user.role === 'CATEGORY_MANAGER'
  ) {
    const subordinateUserIds = await getTeamLeadLeadAccessBdUserIds(user.id)
    return {
      where: { bdId: { in: [user.id, ...subordinateUserIds] } },
      subordinateUserIds,
    }
  }
  return { where: {} }
}

export function statusBucketWhere(
  bucket: PipelineStatusBucket,
): Prisma.LeadWhereInput | undefined {
  if (bucket === 'all') return undefined

  const contains = (term: string): Prisma.LeadWhereInput => ({
    status: { contains: term, mode: 'insensitive' },
  })

  switch (bucket) {
    case 'new_hot':
      return {
        OR: [contains('new'), contains('hot'), contains('interested'), contains('nurture')],
      }
    case 'follow_up':
      return {
        AND: [
          {
            OR: [
              contains('follow'),
              contains('call back'),
              contains('callback'),
              contains('schedule'),
              contains('out of station'),
            ],
          },
          { NOT: contains('ipd done') },
        ],
      }
    case 'opd_done':
      return contains('opd done')
    case 'ipd_done':
      return contains('ipd done')
    case 'dnp':
      return contains('dnp')
    case 'junk':
      return { OR: [contains('junk'), contains('invalid number')] }
    case 'lost':
      return {
        OR: [
          contains('lost'),
          contains('not interested'),
          contains('duplicate'),
          contains('fund issues'),
          contains('already insured'),
          contains('language barrier'),
          contains('sx not suggested'),
        ],
      }
    case 'closed':
      return {
        AND: [
          {
            OR: [
              contains('closed'),
              contains('call done'),
              contains('c/w done'),
              contains('wa done'),
              contains('scan done'),
              contains('booked'),
              contains('policy'),
            ],
          },
          { NOT: contains('ipd done') },
        ],
      }
    default:
      return undefined
  }
}

export function leadAgeWhere(age: LeadAgeFilter): Prisma.LeadWhereInput | undefined {
  if (age === 'all') return undefined
  const now = new Date()
  const daysAgo = (n: number) => {
    const d = new Date(now)
    d.setDate(d.getDate() - n)
    return d
  }

  const receiptField = (range: Prisma.DateTimeFilter): Prisma.LeadWhereInput => ({
    OR: [{ leadEntryDate: range }, { AND: [{ leadEntryDate: null }, { createdDate: range }] }],
  })

  switch (age) {
    case 'new':
      return receiptField({ gte: daysAgo(7) })
    case 'lt1m':
      return receiptField({ gte: daysAgo(30), lt: daysAgo(7) })
    case '1to2m':
      return receiptField({ gte: daysAgo(60), lt: daysAgo(30) })
    case '2to3m':
      return receiptField({ gte: daysAgo(90), lt: daysAgo(60) })
    case '3plus':
      return receiptField({ lt: daysAgo(90) })
    default:
      return undefined
  }
}

export function buildPipelineFiltersWhere(
  params: PipelineQueryParams,
  roleWhere: Prisma.LeadWhereInput,
  options?: { includeStatusBucket?: boolean },
): Prisma.LeadWhereInput {
  const includeStatus = options?.includeStatusBucket !== false
  const and: Prisma.LeadWhereInput[] = [roleWhere]

  if (includeStatus) {
    const statusWhere = statusBucketWhere(params.statusBucket)
    if (statusWhere) and.push(statusWhere)
  }

  if (params.bdId) and.push({ bdId: params.bdId })
  if (params.category) and.push({ category: params.category })
  if (params.circle) {
    if (params.circle === 'Unknown') {
      and.push({
        OR: [{ circle: null }, { circle: '' }, { circle: { equals: 'Unknown', mode: 'insensitive' } }],
      })
    } else {
      and.push({ circle: { equals: params.circle, mode: 'insensitive' } })
    }
  }
  if (params.treatment) {
    if (params.treatment === 'Unknown disease') {
      and.push({ OR: [{ treatment: null }, { treatment: '' }] })
    } else {
      and.push({ treatment: { equals: params.treatment, mode: 'insensitive' } })
    }
  }
  if (params.campaignName) {
    if (params.campaignName === 'No campaign') {
      and.push({ OR: [{ campaignName: null }, { campaignName: '' }] })
    } else {
      and.push({ campaignName: { equals: params.campaignName, mode: 'insensitive' } })
    }
  }

  const ageWhere = leadAgeWhere(params.leadAge)
  if (ageWhere) and.push(ageWhere)

  if (params.startDate || params.endDate) {
    const range: Prisma.DateTimeFilter = {}
    if (params.startDate) {
      const from = new Date(params.startDate)
      from.setHours(0, 0, 0, 0)
      range.gte = from
    }
    if (params.endDate) {
      const to = new Date(params.endDate)
      to.setHours(23, 59, 59, 999)
      range.lte = to
    }
    and.push({
      OR: [{ leadEntryDate: range }, { AND: [{ leadEntryDate: null }, { createdDate: range }] }],
    })
  }

  if (params.search) {
    const phone = parsePhoneSearchQuery(params.search)
    if (phone) {
      and.push({
        OR: [
          { phoneNumber: { contains: phone.last10 } },
          { alternateNumber: { contains: phone.last10 } },
        ],
      })
    } else {
      const q = params.search
      and.push({
        OR: [
          { patientName: { contains: q, mode: 'insensitive' } },
          { leadRef: { contains: q, mode: 'insensitive' } },
          { circle: { contains: q, mode: 'insensitive' } },
          { hospitalName: { contains: q, mode: 'insensitive' } },
          { treatment: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
          { campaignName: { contains: q, mode: 'insensitive' } },
          { bd: { name: { contains: q, mode: 'insensitive' } } },
          { status: { contains: q, mode: 'insensitive' } },
        ],
      })
    }
  }

  const columnFilterWhere = buildPipelineColumnFiltersWhere(params.columnFilters)
  if (columnFilterWhere) and.push(columnFilterWhere)

  return and.length === 1 ? and[0]! : { AND: and }
}

function parseDateOnlyBoundary(value: string, endOfDay: boolean): Date | null {
  const trimmed = value.trim()
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)

  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1])
    const month = Number(dateOnlyMatch[2]) - 1
    const day = Number(dateOnlyMatch[3])

    return endOfDay
      ? new Date(year, month, day, 23, 59, 59, 999)
      : new Date(year, month, day, 0, 0, 0, 0)
  }

  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  if (endOfDay) {
    parsed.setHours(23, 59, 59, 999)
  } else {
    parsed.setHours(0, 0, 0, 0)
  }

  return parsed
}

function buildPipelineColumnFiltersWhere(
  filters: PipelineServerColumnFilter[],
): Prisma.LeadWhereInput | undefined {
  if (filters.length === 0) return undefined

  const and: Prisma.LeadWhereInput[] = []

  for (const filter of filters) {
    if (filter.operator !== 'between') {
      continue
    }

    const from = parseDateOnlyBoundary(filter.value[0], false)
    const to = parseDateOnlyBoundary(filter.value[1] || filter.value[0], true)

    if (!from || !to) {
      continue
    }

    switch (filter.field) {
      case 'assignDate':
        and.push({ assignedDate: { gte: from, lte: to } })
        break
      case 'leadDate':
        and.push({
          OR: [
            { leadEntryDate: { gte: from, lte: to } },
            {
              AND: [
                { leadEntryDate: null },
                { createdDate: { gte: from, lte: to } },
              ],
            },
          ],
        })
        break
      case 'followUpDate':
        and.push({ followUpDate: { gte: from, lte: to } })
        break
      case 'surgeryDate':
        and.push({ surgeryDate: { gte: from, lte: to } })
        break
      case 'createDate':
        and.push({ createdDate: { gte: from, lte: to } })
        break
      case 'modifyDate':
        and.push({ updatedDate: { gte: from, lte: to } })
        break
    }
  }

  if (and.length === 0) return undefined
  return and.length === 1 ? and[0] : { AND: and }
}

export function hasPostQueryPipelineColumnFilters(filters: PipelineServerColumnFilter[]) {
  return filters.some((filter) => filter.operator === 'in')
}

export function pipelineOrderBy(
  sortBy: PipelineSortField,
  sortDir: PipelineSortDir,
): Prisma.LeadOrderByWithRelationInput[] {
  const dir = sortDir
  switch (sortBy) {
    case 'patient':
      return [{ patientName: dir }, { id: dir }]
    case 'status':
      return [{ status: dir }, { id: dir }]
    case 'leadRef':
      return [{ leadRef: dir }, { id: dir }]
    case 'bd':
      return [{ bd: { name: dir } }, { id: dir }]
    case 'followUpDate':
      return [{ followUpDate: { sort: dir, nulls: 'last' } }, { id: dir }]
    case 'date':
    default:
      return [{ leadEntryDate: { sort: dir, nulls: 'last' } }, { createdDate: dir }, { id: dir }]
  }
}

export function bucketsFromStatusGroups(
  rows: { status: string | null; _count: { _all: number } }[],
): Record<Exclude<PipelineStatusBucket, 'all'>, number> {
  const counts: Record<Exclude<PipelineStatusBucket, 'all'>, number> = {
    new_hot: 0,
    follow_up: 0,
    opd_done: 0,
    ipd_done: 0,
    dnp: 0,
    junk: 0,
    lost: 0,
    closed: 0,
  }
  for (const row of rows) {
    counts[getLeadPipelineBucket(row.status)] += row._count._all
  }
  return counts
}

export const pipelineTableSelect = {
  id: true,
  leadRef: true,
  openedInCrmAt: true,
  patientName: true,
  age: true,
  sex: true,
  treatment: true,
  diseaseDetails: true,
  category: true,
  status: true,
  caseStage: true,
  bdId: true,
  circle: true,
  campaignName: true,
  month: true,
  assignedDate: true,
  leadEntryDate: true,
  createdDate: true,
  updatedDate: true,
  followUpDate: true,
  subStatus: true,
  surgeryDate: true,
  removeRemarks: true,
  remarksClearedAt: true,
  profession: true,
  teamLeadId: true,
  duplCount: true,
  source: true,
  leadSource: true,
  insuranceName: true,
  modeOfPayment: true,
  hospitalName: true,
  remarks: true,
  ipdPotentialDate: true,
  leadRemarkEntries: {
    select: {
      id: true,
      content: true,
      createdAt: true,
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 1,
  },
  ipdDrName: true,
  surgeonName: true,
  updatedBy: {
    select: {
      id: true,
      name: true,
    },
  },
  bd: { select: { id: true, name: true } },
  plRecord: { select: { bdmName: true, managerName: true, doctorName: true, hospitalName: true } },
  dischargeSheet: { select: { doctorName: true, hospitalName: true } },
  kypSubmission: {
    select: {
      location: true,
      preAuthData: {
        select: {
          requestedHospitalName: true,
          hospitalNameSuggestion: true,
        },
      },
    },
  },
} satisfies Prisma.LeadSelect

type PipelineSelectedLead = Prisma.LeadGetPayload<{ select: typeof pipelineTableSelect }>

function formatPipelineTableDate(value: unknown) {
  if (!value) return '—'
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? String(value) : format(parsed, 'dd MMM yyyy')
}

function formatPipelineMonthCell(value: unknown) {
  if (!value) return '—'
  if (typeof value === 'string') return value.trim() || '—'
  return formatPipelineTableDate(value)
}

function normalizePipelineText(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  return (trimmed || fallback).replace(/\s+/g, ' ')
}

function stripRemarkMetadataPrefix(value: string) {
  return value.replace(
    /^\s*.+?\s+on\s+\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}:\s*/i,
    '',
  )
}

function getPipelineLeadLastRemarksText(lead: PipelineSelectedLead) {
  const latestRemarkContent =
    typeof lead.leadRemarkEntries?.[0]?.content === 'string' && lead.leadRemarkEntries[0].content.trim().length > 0
      ? lead.leadRemarkEntries[0].content
      : typeof lead.remarks === 'string'
        ? lead.remarks
        : null

  if (latestRemarkContent == null) return '—'
  const trimmed = stripRemarkMetadataPrefix(latestRemarkContent.trim()).trim()
  return trimmed.length > 0 ? trimmed : '—'
}

function getPipelineLeadPlanningTreatmentText(lead: PipelineSelectedLead) {
  if (!lead.ipdPotentialDate) return '—'
  const parsed = new Date(String(lead.ipdPotentialDate))
  return Number.isNaN(parsed.getTime()) ? String(lead.ipdPotentialDate) : format(parsed, 'dd MMM yyyy')
}

function getPipelineLeadTeamLeadText(lead: PipelineSelectedLead) {
  return (
    (typeof lead.plRecord?.managerName === 'string' && lead.plRecord.managerName.trim()) ||
    (lead.teamLeadId != null ? String(lead.teamLeadId) : '—')
  )
}

function getPipelineLeadStageLabel(lead: PipelineSelectedLead) {
  if (!lead.caseStage) return '—'

  if (lead.caseStage === CaseStage.CASH_IPD_PENDING) {
    if (hasLeadOpdDone(lead)) {
      return 'OPD Done'
    }

    return hasLeadOpdScheduled(lead) ? 'OPD Schedule' : 'OPD Schedule'
  }

  return getCaseStageBadgeConfig(String(lead.caseStage)).label
}

function getPipelineLeadColumnFilterValue(
  lead: PipelineSelectedLead,
  columnId: PipelineMultiColumnFilterField,
): string {
  const { hospital, doctor } = resolveLeadHospitalDoctor(lead)
  const preferredLocation = resolveLeadCity(lead) ?? normalizePipelineText(lead.circle, '—')

  switch (columnId) {
    case 'leadRef':
      return typeof lead.leadRef === 'string' || typeof lead.leadRef === 'number' ? String(lead.leadRef) : '—'
    case 'patient':
      return typeof lead.patientName === 'string' ? lead.patientName : '—'
    case 'month':
      return formatPipelineMonthCell(lead.month)
    case 'age':
      return lead.age != null ? String(lead.age) : '—'
    case 'sex':
      return normalizePipelineText(lead.sex, '—')
    case 'circle':
      return normalizePipelineText(lead.circle, 'Unknown')
    case 'city':
      return resolveLeadCity(lead) ?? '—'
    case 'category':
      return normalizePipelineText(lead.category, '—')
    case 'treatment':
      return normalizePipelineText(lead.treatment, '—')
    case 'planningTreatment':
      return getPipelineLeadPlanningTreatmentText(lead)
    case 'profession':
      return normalizePipelineText(lead.profession, '—')
    case 'tl':
      return getPipelineLeadTeamLeadText(lead)
    case 'hospital':
      return hospital || '—'
    case 'doctor':
      return doctor || '—'
    case 'status':
      return normalizeLeadStatus(lead.status)
    case 'stage':
      return getPipelineLeadStageLabel(lead)
    case 'mop':
      return normalizePipelineText(normalizeModeOfPaymentLabel(lead.modeOfPayment), '—')
    case 'lastRemarks':
      return getPipelineLeadLastRemarksText(lead)
    case 'subStatus':
      return lead.subStatus != null ? String(lead.subStatus) : '—'
    case 'healthInsurance':
      return normalizePipelineText(lead.insuranceName, '—')
    case 'preferredLocation':
      return preferredLocation
    case 'source':
      return normalizePipelineText(lead.source, '—')
    case 'leadSource':
      return resolveLeadSourceDisplay(lead)
    case 'modifyBy':
      return lead.updatedBy?.name ?? '—'
    case 'dupCount':
      return lead.duplCount != null ? String(lead.duplCount) : '0'
    case 'recency':
      return getLeadAgeInfo(lead).label
    case 'bd':
      return lead.bd?.name ?? '—'
    default:
      return '—'
  }
}

export function applyPipelineColumnFilters(
  leads: PipelineSelectedLead[],
  filters: PipelineServerColumnFilter[],
) {
  const multiFilters = filters.filter(
    (filter): filter is Extract<PipelineServerColumnFilter, { operator: 'in' }> =>
      filter.operator === 'in',
  )

  if (multiFilters.length === 0) {
    return leads
  }

  return leads.filter((lead) =>
    multiFilters.every((filter) =>
      filter.value.includes(getPipelineLeadColumnFilterValue(lead, filter.field)),
    ),
  )
}
