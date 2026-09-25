// Natural language and structured filter parser for Typesense Sales Pipeline queries
import { toUnixSeconds } from './schema/sales-pipeline'

export interface ExtractedDateFilter {
  field: string
  operator: '<' | '>' | '<=' | '>=' | '=' | 'range'
  value: number | [number, number]
  raw: string
}

export interface ExtractedNumericFilter {
  field: string
  operator: '<' | '>' | '<=' | '>=' | '=' | 'range'
  value: number | [number, number]
  raw: string
}

export interface ParsedPipelineQuery {
  cleanQuery: string
  filterClauses: string[]
  filterBy?: string
  extractedDates: ExtractedDateFilter[]
  extractedNumerics: ExtractedNumericFilter[]
  extractedStatuses: string[]
}

const MONTH_NAMES: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
}

// Parses human date string like "19 sept", "19 sept 2026", "2026-09-19", "today"
export function parseHumanDate(dateStr: string, isEndOfDay = false): Date | null {
  const trimmed = dateStr.trim().toLowerCase()
  const now = new Date()

  if (trimmed === 'today') {
    return isEndOfDay
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  }

  if (trimmed === 'yesterday') {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    return isEndOfDay
      ? new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999)
      : new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0)
  }

  // ISO format: YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10)
    const m = parseInt(isoMatch[2], 10) - 1
    const d = parseInt(isoMatch[3], 10)
    return isEndOfDay ? new Date(y, m, d, 23, 59, 59, 999) : new Date(y, m, d, 0, 0, 0, 0)
  }

  // Day First format: DD-MM-YYYY or DD/MM/YYYY
  const dayFirstMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (dayFirstMatch) {
    const d = parseInt(dayFirstMatch[1], 10)
    const m = parseInt(dayFirstMatch[2], 10) - 1
    const y = parseInt(dayFirstMatch[3], 10)
    return isEndOfDay ? new Date(y, m, d, 23, 59, 59, 999) : new Date(y, m, d, 0, 0, 0, 0)
  }

  // Textual: "19th sept 2026" or "19 sept"
  const textMatch = trimmed.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?$/)
  if (textMatch) {
    const d = parseInt(textMatch[1], 10)
    const monthKey = textMatch[2].toLowerCase()
    const m = MONTH_NAMES[monthKey]
    if (m !== undefined) {
      const y = textMatch[3] ? parseInt(textMatch[3], 10) : now.getFullYear()
      return isEndOfDay ? new Date(y, m, d, 23, 59, 59, 999) : new Date(y, m, d, 0, 0, 0, 0)
    }
  }

  // Textual reversed: "sept 19 2026" or "sept 19th"
  const reverseTextMatch = trimmed.match(/^([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?$/)
  if (reverseTextMatch) {
    const monthKey = reverseTextMatch[1].toLowerCase()
    const m = MONTH_NAMES[monthKey]
    if (m !== undefined) {
      const d = parseInt(reverseTextMatch[2], 10)
      const y = reverseTextMatch[3] ? parseInt(reverseTextMatch[3], 10) : now.getFullYear()
      return isEndOfDay ? new Date(y, m, d, 23, 59, 59, 999) : new Date(y, m, d, 0, 0, 0, 0)
    }
  }

  return null
}

// Maps column prefixes in user search to corresponding Typesense timestamp fields
function resolveDateField(prefix?: string): string {
  const normalized = (prefix || '').trim().toLowerCase()
  if (normalized.includes('assign')) return 'assignedDate'
  if (normalized.includes('lead') || normalized.includes('entry')) return 'leadEntryDate'
  if (normalized.includes('create')) return 'createdDate'
  if (normalized.includes('follow')) return 'followUpDate'
  if (normalized.includes('surg')) return 'surgeryDate'
  if (normalized.includes('admiss')) return 'admissionDate'
  return 'assignedDate'
}

// Parses natural language and numeric filter clauses out of a raw search string
export function parseSalesPipelineNaturalQuery(rawInput: string): ParsedPipelineQuery {
  let text = (rawInput || '').trim()
  const filterClauses: string[] = []
  const extractedDates: ExtractedDateFilter[] = []
  const extractedNumerics: ExtractedNumericFilter[] = []
  const extractedStatuses: string[] = []

  // 1. Match status phrases: "new lead", "hot lead", "opd done", "ipd done", etc.
  const statusPatterns: Array<{ regex: RegExp; statusValue: string }> = [
    { regex: /\bnew\s+leads?\b/i, statusValue: 'New Lead' },
    { regex: /\bhot\s+leads?\b/i, statusValue: 'Hot Lead' },
    { regex: /\bopd\s+done\b/i, statusValue: 'OPD Done' },
    { regex: /\bopd\s+schedul(?:e|ed)?\b/i, statusValue: 'OPD Schedule' },
    { regex: /\bipd\s+done\b/i, statusValue: 'IPD Done' },
    { regex: /\bipd\s+schedul(?:e|ed)?\b/i, statusValue: 'IPD Schedule' },
    { regex: /\bipd\s+lost\b/i, statusValue: 'IPD Lost' },
    { regex: /\bnot\s+interested\b/i, statusValue: 'Not Interested' },
    { regex: /\bduplicate\s+leads?\b/i, statusValue: 'Duplicate lead' },
  ]
  for (const { regex, statusValue } of statusPatterns) {
    if (regex.test(text)) {
      filterClauses.push(`status:=[${statusValue}]`)
      extractedStatuses.push(statusValue)
      text = text.replace(regex, ' ')
    }
  }

  // 2. Match "between <date1> and <date2>" with optional column prefix or suffix
  const betweenDateRegex = /\b(?:(assigned|lead\s*entry|lead|created|follow\s*up|surgery)(?:\s+date)?\s+)?between\s+([0-9a-zA-Z\s/-]+?)\s+and\s+([0-9a-zA-Z\s/-]+?)(?:\s+(assigned|lead\s*entry|lead|created|follow\s*up|surgery)(?:\s+date)?)?(?=\s+(?:and|or|before|after|age|status)|$)/i
  const betweenMatch = text.match(betweenDateRegex)
  if (betweenMatch) {
    const targetField = resolveDateField(betweenMatch[1] || betweenMatch[4])
    const startDate = parseHumanDate(betweenMatch[2], false)
    const endDate = parseHumanDate(betweenMatch[3], true)
    if (startDate && endDate) {
      const startSec = toUnixSeconds(startDate)
      const endSec = toUnixSeconds(endDate)
      if (startSec !== null && endSec !== null) {
        filterClauses.push(`${targetField}:[${startSec}..${endSec}]`)
        extractedDates.push({ field: targetField, operator: 'range', value: [startSec, endSec], raw: betweenMatch[0] })
        text = text.replace(betweenMatch[0], ' ')
      }
    }
  }

  // 3. Match "before <date>" with optional column prefix or suffix (e.g. "before 12 sept lead entry date")
  const beforeDateRegex = /\b(?:(assigned|lead\s*entry|lead|created|follow\s*up|surgery)(?:\s+date)?\s+)?(?:before|prior\s+to|earlier\s+than|<=?)\s+([0-9]{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]+(?:\s+[0-9]{4})?|[a-zA-Z]+\s+[0-9]{1,2}(?:st|nd|rd|th)?(?:\s+[0-9]{4})?|[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}|[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{4}|today|yesterday)(?:\s+(assigned|lead\s*entry|lead|created|follow\s*up|surgery)(?:\s+date)?)?\b/i
  let beforeMatch: RegExpMatchArray | null
  while ((beforeMatch = text.match(beforeDateRegex)) !== null) {
    const targetField = resolveDateField(beforeMatch[1] || beforeMatch[3])
    const parsedDate = parseHumanDate(beforeMatch[2], false)
    if (parsedDate) {
      const sec = toUnixSeconds(parsedDate)
      if (sec !== null) {
        filterClauses.push(`${targetField}:<${sec}`)
        extractedDates.push({ field: targetField, operator: '<', value: sec, raw: beforeMatch[0] })
      }
    }
    text = text.replace(beforeMatch[0], ' ')
  }

  // 4. Match "after <date>" or "since <date>" with optional column prefix or suffix
  const afterDateRegex = /\b(?:(assigned|lead\s*entry|lead|created|follow\s*up|surgery)(?:\s+date)?\s+)?(?:after|since|later\s+than|>=?)\s+([0-9]{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]+(?:\s+[0-9]{4})?|[a-zA-Z]+\s+[0-9]{1,2}(?:st|nd|rd|th)?(?:\s+[0-9]{4})?|[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}|[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{4}|today|yesterday)(?:\s+(assigned|lead\s*entry|lead|created|follow\s*up|surgery)(?:\s+date)?)?\b/i
  let afterMatch: RegExpMatchArray | null
  while ((afterMatch = text.match(afterDateRegex)) !== null) {
    const targetField = resolveDateField(afterMatch[1] || afterMatch[3])
    const parsedDate = parseHumanDate(afterMatch[2], true)
    if (parsedDate) {
      const sec = toUnixSeconds(parsedDate)
      if (sec !== null) {
        filterClauses.push(`${targetField}:>${sec}`)
        extractedDates.push({ field: targetField, operator: '>', value: sec, raw: afterMatch[0] })
      }
    }
    text = text.replace(afterMatch[0], ' ')
  }

  // 5. Match "on <date>" with optional column prefix or suffix
  const onDateRegex = /\b(?:(assigned|lead\s*entry|lead|created|follow\s*up|surgery)(?:\s+date)?\s+)?on\s+([0-9]{1,2}(?:st|nd|rd|th)?\s+[a-zA-Z]+(?:\s+[0-9]{4})?|[a-zA-Z]+\s+[0-9]{1,2}(?:st|nd|rd|th)?(?:\s+[0-9]{4})?|[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}|[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{4}|today|yesterday)(?:\s+(assigned|lead\s*entry|lead|created|follow\s*up|surgery)(?:\s+date)?)?\b/i
  let onMatch: RegExpMatchArray | null
  while ((onMatch = text.match(onDateRegex)) !== null) {
    const targetField = resolveDateField(onMatch[1] || onMatch[3])
    const startDay = parseHumanDate(onMatch[2], false)
    const endDay = parseHumanDate(onMatch[2], true)
    if (startDay && endDay) {
      const startSec = toUnixSeconds(startDay)
      const endSec = toUnixSeconds(endDay)
      if (startSec !== null && endSec !== null) {
        filterClauses.push(`${targetField}:[${startSec}..${endSec}]`)
        extractedDates.push({ field: targetField, operator: 'range', value: [startSec, endSec], raw: onMatch[0] })
      }
    }
    text = text.replace(onMatch[0], ' ')
  }

  // 6. Match numeric comparisons: age (>|>=|<|<=|=) 30, duplicate > 1, etc.
  const numericRegex = /\b(age|duplicate(?:s)?|dup(?:l)?|duplcount)\s*([><]=?|=)\s*(\d+)\b/i
  let numMatch: RegExpMatchArray | null
  while ((numMatch = text.match(numericRegex)) !== null) {
    const rawField = numMatch[1].toLowerCase()
    const targetField = rawField.startsWith('age') ? 'age' : 'duplCount'
    const op = numMatch[2] === '=' ? ':=' : `:${numMatch[2]}`
    const val = parseInt(numMatch[3], 10)
    filterClauses.push(`${targetField}${op}${val}`)
    extractedNumerics.push({ field: targetField, operator: numMatch[2] as any, value: val, raw: numMatch[0] })
    text = text.replace(numMatch[0], ' ')
  }

  // 7. Match "age between X and Y"
  const ageBetweenRegex = /\bage\s+between\s+(\d+)\s+and\s+(\d+)\b/i
  const ageBetweenMatch = text.match(ageBetweenRegex)
  if (ageBetweenMatch) {
    const min = parseInt(ageBetweenMatch[1], 10)
    const max = parseInt(ageBetweenMatch[2], 10)
    filterClauses.push(`age:[${min}..${max}]`)
    extractedNumerics.push({ field: 'age', operator: 'range', value: [min, max], raw: ageBetweenMatch[0] })
    text = text.replace(ageBetweenMatch[0], ' ')
  }

  // Clean connectors and normalize remaining text for keyword search
  const cleanQuery = text
    .replace(/\b(and|or)\b/gi, ' ')
    .replace(/[,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || '*'

  return {
    cleanQuery,
    filterClauses,
    filterBy: filterClauses.length > 0 ? filterClauses.join(' && ') : undefined,
    extractedDates,
    extractedNumerics,
    extractedStatuses,
  }
}

// Converts structured UI parameters from table headers and date pickers into Typesense filter clauses
export function buildStructuredTypesenseFilters(params: Record<string, any>): string[] {
  const clauses: string[] = []

  // Date Range filter from UI date picker
  if (params.from && params.to) {
    const startDate = parseHumanDate(String(params.from), false)
    const endDate = parseHumanDate(String(params.to), true)
    if (startDate && endDate) {
      const startSec = toUnixSeconds(startDate)
      const endSec = toUnixSeconds(endDate)
      if (startSec !== null && endSec !== null) {
        clauses.push(`createdDate:[${startSec}..${endSec}]`)
      }
    }
  } else if (params.from) {
    const startDate = parseHumanDate(String(params.from), false)
    if (startDate) {
      const startSec = toUnixSeconds(startDate)
      if (startSec !== null) clauses.push(`createdDate:>=${startSec}`)
    }
  } else if (params.to) {
    const endDate = parseHumanDate(String(params.to), true)
    if (endDate) {
      const endSec = toUnixSeconds(endDate)
      if (endSec !== null) clauses.push(`createdDate:<=${endSec}`)
    }
  }

  // Single select / multi select column filters
  if (params.status && params.status !== 'all') {
    const statuses = Array.isArray(params.status) ? params.status : [params.status]
    clauses.push(`status:[${statuses.join(',')}]`)
  }

  if (params.circle && params.circle !== 'all') {
    const circles = Array.isArray(params.circle) ? params.circle : [params.circle]
    clauses.push(`circle:[${circles.join(',')}]`)
  }

  if (params.category && params.category !== 'all') {
    const categories = Array.isArray(params.category) ? params.category : [params.category]
    clauses.push(`category:[${categories.join(',')}]`)
  }

  if (params.bdId && params.bdId !== 'all') {
    clauses.push(`bdId:=${params.bdId}`)
  }

  if (params.treatment && params.treatment !== 'all') {
    clauses.push(`treatment:=${params.treatment}`)
  }

  if (params.hospital && params.hospital !== 'all') {
    clauses.push(`hospitalName:=${params.hospital}`)
  }

  if (params.doctor && params.doctor !== 'all') {
    clauses.push(`doctorName:=${params.doctor}`)
  }

  if (params.mop && params.mop !== 'all') {
    clauses.push(`mop:=${params.mop}`)
  }

  if (params.sex && params.sex !== 'all') {
    clauses.push(`sex:=${params.sex}`)
  }

  if (params.month && params.month !== 'all') {
    clauses.push(`month:=${params.month}`)
  }

  if (params.recency && params.recency !== 'all') {
    clauses.push(`recency:=${params.recency}`)
  }

  if (params.ageMin && params.ageMax) {
    clauses.push(`age:[${Number(params.ageMin)}..${Number(params.ageMax)}]`)
  } else if (params.ageMin) {
    clauses.push(`age:>=${Number(params.ageMin)}`)
  } else if (params.ageMax) {
    clauses.push(`age:<=${Number(params.ageMax)}`)
  }

  return clauses
}

// Translates pipeline table sort parameters into Typesense sort_by expressions
export function mapPipelineSortToTypesense(
  sortBy?: string,
  sortDir?: string,
  hasTextSearch = false
): string | undefined {
  const dir = sortDir === 'asc' ? 'asc' : 'desc'
  if (!sortBy || sortBy === 'date') {
    if (hasTextSearch) return undefined
    return `leadEntryDate:${dir}`
  }
  if (sortBy === 'patient') return `patientName:${dir}`
  if (sortBy === 'leadRef') return `leadRef:${dir}`
  if (sortBy === 'followUpDate') return `followUpDate:${dir}`
  if (sortBy === 'surgeryDate') return `surgeryDate:${dir}`
  if (sortBy === 'createdDate' || sortBy === 'createDate') return `createdDate:${dir}`
  if (sortBy === 'assignedDate' || sortBy === 'assignDate') return `assignedDate:${dir}`
  if (sortBy === 'status') return `status:${dir}`
  if (sortBy === 'bd') return `bdName:${dir}`
  return undefined
}

// Maps pipeline column filter fields to their corresponding Typesense collection field names
const PIPELINE_COLUMN_TO_TYPESENSE_FIELD: Record<string, string> = {
  bd: 'bdName',
  circle: 'circle',
  city: 'city',
  category: 'category',
  treatment: 'treatment',
  planningTreatment: 'planningTreatment',
  hospital: 'hospitalName',
  doctor: 'doctorName',
  status: 'status',
  subStatus: 'subStatus',
  stage: 'caseStage',
  mop: 'mop',
  source: 'source',
  leadSource: 'campaignSourceDisplay',
  healthInsurance: 'insuranceName',
  month: 'month',
  sex: 'sex',
  tl: 'teamLeadName',
  profession: 'profession',
  preferredLocation: 'preferredLocation',
  modifyBy: 'modifyBy',
}

// Maps pipeline date column filter fields to their corresponding Typesense timestamp field names
const PIPELINE_DATE_COLUMN_TO_TYPESENSE_FIELD: Record<string, string> = {
  assignDate: 'assignedDate',
  leadDate: 'leadEntryDate',
  followUpDate: 'followUpDate',
  surgeryDate: 'surgeryDate',
  createDate: 'createdDate',
  modifyDate: 'updatedDate',
}

// Helper to escape values for Typesense filter expressions
function escapeTypesenseFacetValue(val: string): string {
  const clean = val.trim().replace(/[`\\]/g, '')
  return `\`${clean}\``
}

// Translates CRM column filters into Typesense filter clauses for instant direct filtering
export function buildPipelineColumnFilterClauses(
  filters: Array<{ field: string; operator: string; value: any }>
): string[] {
  const clauses: string[] = []

  for (const f of filters) {
    if (f.operator === 'in') {
      const tsField = PIPELINE_COLUMN_TO_TYPESENSE_FIELD[f.field]
      if (tsField && Array.isArray(f.value) && f.value.length > 0) {
        const escaped = f.value
          .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
          .map((v) => escapeTypesenseFacetValue(v))
        if (escaped.length > 0) {
          clauses.push(`${tsField}:[${escaped.join(',')}]`)
        }
      }
    } else if (f.operator === 'between') {
      const tsField = PIPELINE_DATE_COLUMN_TO_TYPESENSE_FIELD[f.field]
      if (tsField && Array.isArray(f.value) && f.value.length === 2) {
        const start = Math.floor(new Date(f.value[0]).getTime() / 1000)
        const end = Math.floor(new Date(f.value[1]).getTime() / 1000) + 86399
        if (!Number.isNaN(start) && !Number.isNaN(end)) {
          clauses.push(`${tsField}:[${start}..${end}]`)
        }
      }
    }
  }

  return clauses
}

// Maps CRM pipeline status buckets to their corresponding status names in Typesense
export function mapStatusBucketToTypesenseStatuses(bucket: string): string[] | null {
  switch (bucket) {
    case 'new_hot':
      return ['New Lead', 'Hot Lead', 'New', 'Interested']
    case 'nurture':
      return ['Nurture', 'Nurture 1', 'Nurture 2', 'Nurture 3', 'Nurture 4', 'Nurture 5']
    case 'follow_up':
      return [
        'Follow-up',
        'Follow-up 1',
        'Follow-up 2',
        'Follow-up 3',
        'Follow-up 4',
        'Follow-up 5',
        'Follow-up (1-3)',
      ]
    case 'callback':
      return ['Call Back (SD)', 'Call Back (T)', 'Call Back Next Week', 'Call Back Next Month']
    case 'opd_done':
      return ['OPD Done']
    case 'ipd_done':
      return ['IPD Done']
    case 'opd_sch':
      return ['OPD Schedule', 'OPD Scheduled']
    case 'ipd_sch':
      return ['IPD Schedule']
    case 'dnp':
      return ['DNP', 'DNP-1', 'DNP-2', 'DNP-3', 'DNP-4', 'DNP-5']
    case 'dnp_exh':
      return ['DNP Exhausted', 'DNP (1-5, Exhausted)']
    case 'junk':
      return ['Junk']
    case 'outstation':
      return ['Out of Station', 'Out of Station follow-up', 'Out of station follow-up']
    case 'duplicate':
      return ['Duplicate lead', 'Duplicate Lead', 'Duplicate']
    case 'ipd_loss':
      return ['IPD Lost']
    case 'fund_issues':
      return ['Fund Issues', 'Fund Issue']
    case 'lost':
      return ['Lost', 'IPD Lost', 'Closed', 'Junk', 'Not Interested', 'Invalid Number']
    case 'closed':
      return ['Closed']
    default:
      return null
  }
}

// Builds complete filter_by expression for all pipeline filters (quick filters, column filters, date ranges, age, buckets)
export function buildPipelineTypesenseFilterBy(
  params: {
    circle?: string | null
    category?: string | null
    treatment?: string | null
    bdId?: string | null
    campaignName?: string | null
    leadAge?: string | null
    startDate?: string | null
    endDate?: string | null
    statusBucket?: string | null
    columnFilters?: Array<{ field: string; operator: string; value: any }>
  },
  options?: { roleFilter?: string }
): string | undefined {
  const clauses: string[] = []

  // Role scoping clause
  if (options?.roleFilter) {
    clauses.push(options.roleFilter)
  }

  // Quick header dropdown filters
  if (params.circle) {
    clauses.push(`circle:[${escapeTypesenseFacetValue(params.circle)}]`)
  }
  if (params.category) {
    clauses.push(`category:[${escapeTypesenseFacetValue(params.category)}]`)
  }
  if (params.treatment) {
    clauses.push(`treatment:[${escapeTypesenseFacetValue(params.treatment)}]`)
  }
  if (params.bdId) {
    clauses.push(`bdId:[${escapeTypesenseFacetValue(params.bdId)}]`)
  }
  if (params.campaignName) {
    clauses.push(`campaignName:[${escapeTypesenseFacetValue(params.campaignName)}]`)
  }

  // Recency / lead age filter
  if (params.leadAge && params.leadAge !== 'all') {
    clauses.push(`recency:[${escapeTypesenseFacetValue(params.leadAge)}]`)
  }

  // Status bucket filter
  if (params.statusBucket && params.statusBucket !== 'all') {
    const statuses = mapStatusBucketToTypesenseStatuses(params.statusBucket)
    if (statuses && statuses.length > 0) {
      const escaped = statuses.map((s) => escapeTypesenseFacetValue(s))
      clauses.push(`status:[${escaped.join(',')}]`)
    }
  }

  // Date range filters for leadEntryDate
  if (params.startDate || params.endDate) {
    const start = params.startDate ? Math.floor(new Date(params.startDate).getTime() / 1000) : null
    const end = params.endDate ? Math.floor(new Date(params.endDate).getTime() / 1000) + 86399 : null
    if (start !== null && end !== null && !Number.isNaN(start) && !Number.isNaN(end)) {
      clauses.push(`leadEntryDate:[${start}..${end}]`)
    } else if (start !== null && !Number.isNaN(start)) {
      clauses.push(`leadEntryDate:>=${start}`)
    } else if (end !== null && !Number.isNaN(end)) {
      clauses.push(`leadEntryDate:<=${end}`)
    }
  }

  // Multi-column table filters
  if (params.columnFilters && params.columnFilters.length > 0) {
    const colClauses = buildPipelineColumnFilterClauses(params.columnFilters)
    clauses.push(...colClauses)
  }

  return clauses.length > 0 ? clauses.join(' && ') : undefined
}

