import { CaseStage, Prisma } from '@/generated/prisma/client'
import type { SessionUser } from '@/lib/auth'
import { CASE_STAGE_CONFIG, getCaseStageBadgeConfig } from '@/lib/case-stage-labels'
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
import {
  normalizePipelineMonthValue,
  normalizePipelineSexValue,
} from '@/lib/pipeline/filter-normalizers'
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

export type PipelineMultiColumnFilterField = Exclude<
  PipelineServerColumnFilterField,
  PipelineDateColumnFilterField
>

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
  'month',
  'age',
  'sex',
  'circle',
  'category',
  'treatment',
  'status',
  'stage',
  'mop',
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

  // Fixed-depth sales hierarchy:
  // Executive Assistant -> Sales Head -> Category Manager -> Team Lead -> BD
  // Build access through the assignee's manager chain instead of expanding a
  // very large bdId IN (...) list, which is safer for the pg driver adapter.
  if (
    user.role === 'TEAM_LEAD' ||
    user.role === 'ASSISTANT_CATEGORY_MANAGER' ||
    user.role === 'CATEGORY_MANAGER' ||
    user.role === 'SALES_HEAD' ||
    user.role === 'EXECUTIVE_ASSISTANT'
  ) {
    return {
      where: buildPipelineHierarchyScopeWhere(user.id),
    }
  }
  return { where: {} }
}

function buildPipelineHierarchyScopeWhere(userId: string): Prisma.LeadWhereInput {
  const or: Prisma.LeadWhereInput[] = [{ bdId: userId }]

  for (let depth = 1; depth <= 4; depth += 1) {
    or.push({
      bd: {
        is: {
          employee: {
            is: buildEmployeeManagerChainWhere(userId, depth),
          },
        },
      },
    })
  }

  return { OR: or }
}

function buildEmployeeManagerChainWhere(
  managerUserId: string,
  depth: number,
): Prisma.EmployeeWhereInput {
  let current: Prisma.EmployeeWhereInput = { userId: managerUserId }

  for (let level = 0; level < depth; level += 1) {
    current = {
      manager: {
        is: current,
      },
    }
  }

  return current
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
      and.push(buildPipelineGlobalSearchWhere(params.search))
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
    if (filter.operator === 'in') {
      const where = buildPipelineMultiSelectWhere(filter.field, filter.value)
      if (where) {
        and.push(where)
      }
      continue
    }

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

function buildExactInsensitiveStringWhere(
  field: keyof Prisma.LeadWhereInput,
  values: string[],
): Prisma.LeadWhereInput | undefined {
  const normalizedValues = [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))]
  if (normalizedValues.length === 0) return undefined

  return {
    OR: normalizedValues.map((value) => ({
      [field]: { equals: value, mode: 'insensitive' },
    })),
  } as Prisma.LeadWhereInput
}

function buildAgeFilterWhere(values: string[]): Prisma.LeadWhereInput | undefined {
  const ages = [...new Set(
    values
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 120),
  )]

  if (ages.length === 0) return undefined
  return { age: { in: ages } }
}

function buildSexFilterWhere(values: string[]): Prisma.LeadWhereInput | undefined {
  const normalizedValues = [...new Set(values.map((value) => normalizePipelineSexValue(value)))]
  const or: Prisma.LeadWhereInput[] = []

  for (const value of normalizedValues) {
    if (value === 'Male') {
      or.push({ OR: [{ sex: { equals: 'Male', mode: 'insensitive' } }, { sex: { equals: 'M', mode: 'insensitive' } }] })
      continue
    }

    if (value === 'Female') {
      or.push({ OR: [{ sex: { equals: 'Female', mode: 'insensitive' } }, { sex: { equals: 'F', mode: 'insensitive' } }] })
      continue
    }

    if (value === 'Not Specified') {
      or.push({
        OR: [
          { sex: { equals: 'Not Specified', mode: 'insensitive' } },
          { sex: { equals: 'Not_Specified', mode: 'insensitive' } },
          { sex: { equals: 'Unknown', mode: 'insensitive' } },
          { sex: { equals: 'Unspecified', mode: 'insensitive' } },
          { sex: { equals: 'N/A', mode: 'insensitive' } },
          { sex: { equals: 'NA', mode: 'insensitive' } },
          { sex: { equals: 'Other', mode: 'insensitive' } },
          { sex: { equals: 'O', mode: 'insensitive' } },
          { sex: '' },
        ],
      })
    }
  }

  if (or.length === 0) return undefined
  return or.length === 1 ? or[0] : { OR: or }
}

const PIPELINE_STATUS_FILTER_VARIANTS: Record<string, string[]> = {
  'New Lead': ['27', 'New Lead'],
  'Hot Lead': ['28', 'Hot Lead'],
  Interested: ['39', 'Interested'],
  'Follow-up 1': ['1', 'Follow-up 1'],
  'Follow-up 2': ['2', 'Follow-up 2'],
  'Follow-up 3': ['3', 'Follow-up 3'],
  'Follow-up 4': ['Follow-up 4'],
  'Follow-up 5': ['Follow-up 5'],
  'Follow-up': ['35', 'Follow-up'],
  'Call Back (SD)': ['19', 'Call Back (SD)'],
  'Call Back (T)': ['20', 'Call Back (T)'],
  'Call Back Next Week': ['21', 'Call Back Next Week'],
  'Call Back Next Month': ['22', 'Call Back Next Month'],
  'OPD Done': ['11', 'OPD Done', 'opd_done'],
  'OPD Schedule': ['12', 'OPD Schedule', 'OPD Scheduled', 'opd_scheduled'],
  'IPD Done': ['13', 'IPD Done'],
  'IPD Schedule': ['14', 'IPD Schedule'],
  'IPD Lost': ['15', 'IPD Lost'],
  'Fund Issues': ['10', 'Fund Issues'],
  'DNP-1': ['4', 'DNP-1'],
  'DNP-2': ['5', 'DNP-2'],
  'DNP-3': ['6', 'DNP-3'],
  'DNP-4': ['7', 'DNP-4'],
  'DNP-5': ['8', 'DNP-5'],
  'DNP Exhausted': ['9', 'DNP Exhausted'],
  'Call Done': ['30', 'Call Done'],
  Closed: ['25', 'Closed'],
  'Out of Station': ['16', 'Out of Station'],
  'Out of Station follow-up': ['42', 'Out of Station follow-up', 'Out of station follow-up'],
  'Supply Gap': ['17', 'Supply Gap'],
  'SX Not Suggested': ['23', 'SX Not Suggested'],
  'Language Barrier': ['18', 'Language Barrier'],
  Junk: ['26', 'Junk'],
  'Duplicate lead': ['34', 'Duplicate lead'],
  'Not Interested': ['33', 'Not Interested'],
  Nurture: ['37', 'Nurture'],
  'Nurture 1': ['Nurture 1', 'Nuture 1'],
  'Nurture 2': ['Nurture 2', 'Nuture 2'],
  'Nurture 3': ['Nurture 3', 'Nuture 3'],
  'Nurture 4': ['Nurture 4', 'Nuture 4'],
  'Nurture 5': ['Nurture 5', 'Nuture 5'],
  'Nuture 1': ['Nurture 1', 'Nuture 1'],
  'Nuture 2': ['Nurture 2', 'Nuture 2'],
  'Nuture 3': ['Nurture 3', 'Nuture 3'],
  'Nuture 4': ['Nurture 4', 'Nuture 4'],
  'Nuture 5': ['Nurture 5', 'Nuture 5'],
  'Invalid Number': ['36', 'Invalid Number'],
  'Order Booked': ['24', 'Order Booked'],
  'Already Insured': ['41', 'Already Insured'],
  'Policy Booked': ['38', 'Policy Booked'],
  'Policy Issued': ['40', 'Policy Issued'],
  Lost: ['Lost', 'Churned'],
  Churned: ['Lost', 'Churned'],
  'C/W Done': ['32', 'C/W Done'],
  'WA Done': ['31', 'WA Done'],
  'Scan Done': ['29', 'Scan Done'],
}

function buildStatusFilterWhere(values: string[]): Prisma.LeadWhereInput | undefined {
  const or: Prisma.LeadWhereInput[] = []

  for (const rawValue of values) {
    const normalizedValue = normalizeLeadStatus(rawValue)
    const variants = PIPELINE_STATUS_FILTER_VARIANTS[normalizedValue] ?? [normalizedValue]

    or.push({
      OR: variants.map((variant) => {
        if (/^\d+$/.test(variant)) {
          return { status: variant }
        }

        return { status: { equals: variant, mode: 'insensitive' } }
      }),
    })
  }

  if (or.length === 0) return undefined
  return or.length === 1 ? or[0] : { OR: or }
}

const PIPELINE_STAGE_FILTER_CASE_STAGES: Record<string, CaseStage[]> = Object.entries(CASE_STAGE_CONFIG).reduce(
  (acc, [stage, config]) => {
    const label = config.label.trim()
    if (!acc[label]) {
      acc[label] = []
    }
    acc[label].push(stage as CaseStage)
    return acc
  },
  {} as Record<string, CaseStage[]>,
)

PIPELINE_STAGE_FILTER_CASE_STAGES['OPD Schedule'] = [CaseStage.OPD_SCHEDULED]
PIPELINE_STAGE_FILTER_CASE_STAGES['OPD Done'] = [CaseStage.OPD_DONE]

function buildStageFilterWhere(values: string[]): Prisma.LeadWhereInput | undefined {
  const stages = [...new Set(values.flatMap((value) => PIPELINE_STAGE_FILTER_CASE_STAGES[value.trim()] ?? []))]
  if (stages.length === 0) return undefined
  return { caseStage: { in: stages } }
}

const MODE_OF_PAYMENT_FILTER_VARIANTS: Record<string, string[]> = {
  Cash: ['1', 'Cash'],
  Cashless: ['2', 'Cashless'],
  EMI: ['3', 'EMI'],
  Reimbursement: ['4', 'Reimbursement'],
}

function buildModeOfPaymentFilterWhere(values: string[]): Prisma.LeadWhereInput | undefined {
  const or: Prisma.LeadWhereInput[] = []

  for (const rawValue of values) {
    const normalizedValue = normalizeModeOfPaymentLabel(rawValue)
    if (!normalizedValue) {
      continue
    }

    const variants = MODE_OF_PAYMENT_FILTER_VARIANTS[normalizedValue] ?? [normalizedValue]
    or.push({
      OR: variants.map((variant) => {
        if (/^\d+$/.test(variant)) {
          return { modeOfPayment: variant }
        }

        return { modeOfPayment: { equals: variant, mode: 'insensitive' } }
      }),
    })
  }

  if (or.length === 0) return undefined
  return or.length === 1 ? or[0] : { OR: or }
}

function buildLeadStatusSearchWhere(query: string): Prisma.LeadWhereInput | undefined {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return undefined

  const matchingLabels = [...new Set(
    Object.keys(PIPELINE_STATUS_FILTER_VARIANTS).filter((label) =>
      label.toLowerCase().includes(normalizedQuery),
    ),
  )]

  if (matchingLabels.length === 0) return undefined
  return buildStatusFilterWhere(matchingLabels)
}

function buildCaseStageSearchWhere(query: string): Prisma.LeadWhereInput | undefined {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return undefined

  const stages = [...new Set(
    Object.entries(PIPELINE_STAGE_FILTER_CASE_STAGES)
      .filter(([label]) => label.toLowerCase().includes(normalizedQuery))
      .flatMap(([, values]) => values),
  )]

  if (stages.length === 0) return undefined
  return { caseStage: { in: stages } }
}

function buildModeOfPaymentSearchWhere(query: string): Prisma.LeadWhereInput | undefined {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return undefined

  const matchingLabels = Object.keys(MODE_OF_PAYMENT_FILTER_VARIANTS).filter((label) =>
    label.toLowerCase().includes(normalizedQuery),
  )

  if (matchingLabels.length === 0) return undefined
  return buildModeOfPaymentFilterWhere(matchingLabels)
}

function buildFlowTypeSearchWhere(query: string): Prisma.LeadWhereInput | undefined {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return undefined

  const flows: string[] = []
  if ('cash'.includes(normalizedQuery) || normalizedQuery.includes('cash')) {
    flows.push('CASH')
  }
  if (
    'insurance'.includes(normalizedQuery) ||
    normalizedQuery.includes('insurance') ||
    normalizedQuery.includes('medi')
  ) {
    flows.push('INSURANCE')
  }

  if (flows.length === 0) return undefined
  return { flowType: { in: flows as Array<'CASH' | 'INSURANCE'> } }
}

function buildNumericGlobalSearchWhere(query: string): Prisma.LeadWhereInput | undefined {
  if (!/^\d+$/.test(query)) return undefined

  const parsed = Number.parseInt(query, 10)
  if (!Number.isFinite(parsed)) return undefined

  const or: Prisma.LeadWhereInput[] = []

  if (parsed >= 0 && parsed <= 120) {
    or.push({ age: parsed })
  }

  or.push({ duplCount: parsed })

  return or.length === 1 ? or[0] : { OR: or }
}

function buildPipelineGlobalSearchWhere(query: string): Prisma.LeadWhereInput {
  const q = query.trim()
  const numericWhere = buildNumericGlobalSearchWhere(q)
  const statusWhere = buildLeadStatusSearchWhere(q)
  const stageWhere = buildCaseStageSearchWhere(q)
  const modeOfPaymentWhere = buildModeOfPaymentSearchWhere(q)
  const flowTypeWhere = buildFlowTypeSearchWhere(q)

  const or: Prisma.LeadWhereInput[] = [
    { patientName: { contains: q, mode: 'insensitive' } },
    { leadRef: { contains: q, mode: 'insensitive' } },
    { sex: { contains: q, mode: 'insensitive' } },
    { circle: { contains: q, mode: 'insensitive' } },
    { category: { contains: q, mode: 'insensitive' } },
    { treatment: { contains: q, mode: 'insensitive' } },
    { diseaseDetails: { contains: q, mode: 'insensitive' } },
    { profession: { contains: q, mode: 'insensitive' } },
    { hospitalName: { contains: q, mode: 'insensitive' } },
    { opdHospital: { contains: q, mode: 'insensitive' } },
    { ipdHospital: { contains: q, mode: 'insensitive' } },
    { surgeonName: { contains: q, mode: 'insensitive' } },
    { ipdDrName: { contains: q, mode: 'insensitive' } },
    { opdDrName: { contains: q, mode: 'insensitive' } },
    { insuranceName: { contains: q, mode: 'insensitive' } },
    { subStatus: { contains: q, mode: 'insensitive' } },
    { source: { contains: q, mode: 'insensitive' } },
    { campaignName: { contains: q, mode: 'insensitive' } },
    { remarks: { contains: q, mode: 'insensitive' } },
    { month: { contains: q, mode: 'insensitive' } },
    { bd: { name: { contains: q, mode: 'insensitive' } } },
    { updatedBy: { name: { contains: q, mode: 'insensitive' } } },
    { leadRemarkEntries: { some: { content: { contains: q, mode: 'insensitive' } } } },
    { plRecord: { is: { bdmName: { contains: q, mode: 'insensitive' } } } },
    { plRecord: { is: { managerName: { contains: q, mode: 'insensitive' } } } },
    { plRecord: { is: { doctorName: { contains: q, mode: 'insensitive' } } } },
    { plRecord: { is: { hospitalName: { contains: q, mode: 'insensitive' } } } },
    { dischargeSheet: { is: { doctorName: { contains: q, mode: 'insensitive' } } } },
    { dischargeSheet: { is: { hospitalName: { contains: q, mode: 'insensitive' } } } },
    { kypSubmission: { is: { location: { contains: q, mode: 'insensitive' } } } },
    { kypSubmission: { is: { preAuthData: { is: { requestedHospitalName: { contains: q, mode: 'insensitive' } } } } } },
    { kypSubmission: { is: { preAuthData: { is: { hospitalNameSuggestion: { contains: q, mode: 'insensitive' } } } } } },
    { status: { contains: q, mode: 'insensitive' } },
  ]

  if (numericWhere) {
    or.push(numericWhere)
  }
  if (statusWhere) {
    or.push(statusWhere)
  }
  if (stageWhere) {
    or.push(stageWhere)
  }
  if (modeOfPaymentWhere) {
    or.push(modeOfPaymentWhere)
  }
  if (flowTypeWhere) {
    or.push(flowTypeWhere)
  }

  return { OR: or }
}

function buildPipelineMultiSelectWhere(
  field: PipelineMultiColumnFilterField,
  values: string[],
): Prisma.LeadWhereInput | undefined {
  switch (field) {
    case 'month':
      return buildExactInsensitiveStringWhere('month', values)
    case 'age':
      return buildAgeFilterWhere(values)
    case 'sex':
      return buildSexFilterWhere(values)
    case 'circle':
      return buildExactInsensitiveStringWhere('circle', values)
    case 'category':
      return buildExactInsensitiveStringWhere('category', values)
    case 'treatment':
      return buildExactInsensitiveStringWhere('treatment', values)
    case 'status':
      return buildStatusFilterWhere(values)
    case 'stage':
      return buildStageFilterWhere(values)
    case 'mop':
      return buildModeOfPaymentFilterWhere(values)
    default:
      return undefined
  }
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
  phoneNumber: true,
  alternateNumber: true,
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

export type PipelineSelectedLead = Prisma.LeadGetPayload<{ select: typeof pipelineTableSelect }>

function sortPipelineFacetValues(
  field: PipelineMultiColumnFilterField,
  values: Iterable<string>,
) {
  const items = [...values]

  if (field === 'age' || field === 'dupCount') {
    return items.sort((left, right) => {
      const leftNumber = Number.parseInt(left, 10)
      const rightNumber = Number.parseInt(right, 10)
      const leftIsNumber = !Number.isNaN(leftNumber)
      const rightIsNumber = !Number.isNaN(rightNumber)

      if (leftIsNumber && rightIsNumber) {
        return leftNumber - rightNumber
      }

      if (leftIsNumber) return -1
      if (rightIsNumber) return 1

      return left.localeCompare(right, undefined, { sensitivity: 'base' })
    })
  }

  return items.sort((left, right) =>
    left.localeCompare(right, undefined, { sensitivity: 'base' }),
  )
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
      return normalizePipelineMonthValue(lead.month)
    case 'age':
      return lead.age != null ? String(lead.age) : '—'
    case 'sex':
      return normalizePipelineSexValue(lead.sex)
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

export function buildPipelineColumnFacets(leads: PipelineSelectedLead[]) {
  const facets = {} as Record<PipelineMultiColumnFilterField, string[]>

  for (const field of PIPELINE_MULTI_COLUMN_FILTER_FIELDS) {
    const values = new Set<string>()

    for (const lead of leads) {
      const value = getPipelineLeadColumnFilterValue(lead, field)
      const normalized = value.trim()
      if (normalized.length > 0) {
        values.add(normalized)
      }
    }

    facets[field] = sortPipelineFacetValues(field, values)
  }

  return facets
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
