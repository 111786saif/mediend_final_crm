import { parse as parseCsv } from 'csv-parse/sync'
import {
  MANUAL_MYSQL_LEAD_FIELDS,
  MANUAL_MYSQL_REQUIRED_FIELD_KEYS,
} from '@/lib/manual-mysql-lead-import'
import {
  getDefaultMySQLSystemUserId,
  MANUAL_MYSQL_INCOMING_SOURCE,
  processMySQLIncomingLead,
  queueMySQLIncomingLead,
} from '@/lib/mysql-incoming-leads'
import { fetchBDUsersMap } from '@/lib/sync/mysql-bd-map'
import { type MySQLLeadRow } from '@/lib/sync/mysql-lead-mapper'
import { loadLookupMaps, type LookupMaps } from '@/lib/sync/mysql-lookup-cache'

type ManualLeadInputRecord = Record<string, unknown>

export type ManualMySQLLeadIngestionItem = {
  rowNumber: number
  incomingLeadId?: string
  leadId?: string
  leadRef?: string
  assignedBdName?: string | null
  status: 'processed' | 'already_processed' | 'duplicate' | 'failed' | 'skipped'
  error?: string
}

export type ManualMySQLLeadIngestionResult = {
  processedCount: number
  duplicateCount: number
  failedCount: number
  skippedCount: number
  results: ManualMySQLLeadIngestionItem[]
}

function normalizeString(value: unknown) {
  if (value == null) return ''
  return String(value).trim()
}

function isBlank(value: unknown) {
  return normalizeString(value).length === 0
}

function parseBooleanish(value: unknown) {
  if (value == null) return null
  if (typeof value === 'boolean') return value
  const normalized = String(value).trim().toLowerCase()
  if (!normalized) return null
  if (['1', 'true', 'yes', 'y'].includes(normalized)) return true
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false
  return null
}

function parseNumberish(value: unknown) {
  const normalized = normalizeString(value)
  if (!normalized) return null
  const parsed = Number.parseInt(normalized, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function parseOptionalSubStatusText(value: unknown) {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return normalized.slice(0, 25)
}

function parseNumberishOrText(value: unknown) {
  const normalized = normalizeString(value)
  if (!normalized) return null
  return /^-?\d+$/.test(normalized) ? Number.parseInt(normalized, 10) : normalized
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0')
}

function formatNormalizedDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number
) {
  return `${year}-${padDatePart(month)}-${padDatePart(day)}T${padDatePart(hour)}:${padDatePart(minute)}:${padDatePart(second)}`
}

function getCurrentNormalizedDateTime() {
  const now = new Date()
  return formatNormalizedDate(
    now.getFullYear(),
    now.getMonth() + 1,
    now.getDate(),
    now.getHours(),
    now.getMinutes(),
    now.getSeconds()
  )
}

function parseManualDateInput(value: unknown): string | null {
  const normalized = normalizeString(value)
  if (!normalized) return null

  const isoLikeMatch = normalized.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/
  )

  if (isoLikeMatch) {
    const [, yearText, monthText, dayText, hourText, minuteText, secondText] = isoLikeMatch
    return formatNormalizedDate(
      Number.parseInt(yearText, 10),
      Number.parseInt(monthText, 10),
      Number.parseInt(dayText, 10),
      Number.parseInt(hourText ?? '0', 10),
      Number.parseInt(minuteText ?? '0', 10),
      Number.parseInt(secondText ?? '0', 10)
    )
  }

  const slashMatch = normalized.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/
  )

  if (slashMatch) {
    const [, firstText, secondText, yearText, hourText, minuteText, secondValueText] = slashMatch
    const first = Number.parseInt(firstText, 10)
    const second = Number.parseInt(secondText, 10)

    // Manual imports may arrive as M/D/YYYY from exported sheets, while larger
    // values in the first segment clearly indicate D/M/YYYY.
    const month = first > 12 ? second : first
    const day = first > 12 ? first : second

    return formatNormalizedDate(
      Number.parseInt(yearText, 10),
      month,
      day,
      Number.parseInt(hourText ?? '0', 10),
      Number.parseInt(minuteText ?? '0', 10),
      Number.parseInt(secondValueText ?? '0', 10)
    )
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null

  return formatNormalizedDate(
    parsed.getFullYear(),
    parsed.getMonth() + 1,
    parsed.getDate(),
    parsed.getHours(),
    parsed.getMinutes(),
    parsed.getSeconds()
  )
}

function deriveMonthNameFromLeadDate(value: string) {
  const normalized = parseManualDateInput(value)
  if (!normalized) return null

  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date)
}

function buildManualLeadId(record: ManualLeadInputRecord, rowNumber: number) {
  const explicitId = parseNumberish(record.id)
  if (explicitId != null) return explicitId
  const timeSeed = Number(String(Date.now()).slice(-9))
  return timeSeed + rowNumber
}

function isEmptyManualRow(record: ManualLeadInputRecord) {
  return MANUAL_MYSQL_LEAD_FIELDS.every((field) => isBlank(record[field.key]))
}

function validateManualRow(record: ManualLeadInputRecord) {
  const missingFields = MANUAL_MYSQL_REQUIRED_FIELD_KEYS.filter((key) => isBlank(record[key]))
  return missingFields
}

function toMySQLLeadRow(record: ManualLeadInputRecord, rowNumber: number): MySQLLeadRow {
  // CSV/manual intake should always get a valid lead timestamp even when Lead_Date is blank or malformed.
  const normalizedLeadDate = parseManualDateInput(record.Lead_Date) ?? getCurrentNormalizedDateTime()
  const normalizedLeadEntryDate =
    parseManualDateInput(record.LeadEntryDate) || normalizedLeadDate
  const normalizedCreateDate =
    parseManualDateInput(record.create_date) || normalizedLeadDate
  const normalizedMonth =
    normalizeString(record.month) || deriveMonthNameFromLeadDate(normalizedLeadDate ?? '')

  return {
    id: buildManualLeadId(record, rowNumber),
    month: normalizedMonth,
    Lead_Date: normalizedLeadDate,
    LeadEntryDate: normalizedLeadEntryDate,
    create_date: normalizedCreateDate,
    Patient_Number: normalizeString(record.Patient_Number),
    AlternativePhone: normalizeString(record.AlternativePhone) || null,
    Whatsapp: normalizeString(record.Whatsapp) || null,
    Patient_Name: normalizeString(record.Patient_Name),
    PatientEmail: normalizeString(record.PatientEmail) || null,
    Age: parseNumberish(record.Age),
    Sex: normalizeString(record.Sex) || null,
    Circle: parseNumberishOrText(record.Circle),
    city_option: parseNumberishOrText(record.city_option),
    address: normalizeString(record.address) || null,
    doc_upload: normalizeString(record.doc_upload) || null,
    Category: parseNumberishOrText(record.Category),
    Treatment: parseNumberishOrText(record.Treatment),
    DiseaseDetails: normalizeString(record.DiseaseDetails) || null,
    BDM: normalizeString(record.BDM) || null,
    TL: parseNumberish(record.TL),
    remarks_id: normalizeString(record.remarks_id) || null,
    Remarks: normalizeString(record.Remarks) || null,
    LastRemarks: normalizeString(record.LastRemarks) || null,
    Follow_up_Date: parseManualDateInput(record.Follow_up_Date),
    Status: parseNumberishOrText(record.Status),
    SubStatus: parseOptionalSubStatusText(record.SubStatus),
    Surgery_Date: parseManualDateInput(record.Surgery_Date),
    OPD_Hospital: normalizeString(record.OPD_Hospital) || null,
    OPD_DrName: normalizeString(record.OPD_DrName) || null,
    OPD_ContactNo: normalizeString(record.OPD_ContactNo) || null,
    OPD_Charges: parseNumberish(record.OPD_Charges),
    OPD_ScheduleDate: parseManualDateInput(record.OPD_ScheduleDate),
    OPD_Meeting: parseNumberish(record.OPD_Meeting),
    IPD_AdmisisonDate: parseManualDateInput(record.IPD_AdmisisonDate),
    IPD_Hospital: normalizeString(record.IPD_Hospital) || null,
    IPD_DrName: normalizeString(record.IPD_DrName) || null,
    IPD_ContactNo: normalizeString(record.IPD_ContactNo) || null,
    IPD_TotalPayment: parseNumberish(record.IPD_TotalPayment),
    MOP: normalizeString(record.MOP) || null,
    PaymentDetails: parseNumberish(record.PaymentDetails),
    Attendant: parseBooleanish(record.Attendant),
    AttendantName: normalizeString(record.AttendantName) || null,
    AttendantContactNo: normalizeString(record.AttendantContactNo) || null,
    IPD_Details: normalizeString(record.IPD_Details) || null,
    WA_Format: normalizeString(record.WA_Format) || null,
    Source: parseNumberishOrText(record.Source) as number | string | null,
    Lead_Source: parseNumberishOrText(record.Lead_Source) as number | string | null,
    WA_Message: normalizeString(record.WA_Message) || null,
    Notification: parseBooleanish(record.Notification),
    email: parseBooleanish(record.email),
    sms: parseBooleanish(record.sms),
    whatsapp_msg: parseBooleanish(record.whatsapp_msg),
    create_by: parseNumberish(record.create_by),
    update_by: parseNumberish(record.update_by),
    update_date: parseManualDateInput(record.update_date),
    ip: normalizeString(record.ip) || null,
    website: normalizeString(record.website) || null,
    description: normalizeString(record.description) || null,
    refid: normalizeString(record.refid) || null,
    DuplCount: parseNumberish(record.DuplCount),
    aes: parseBooleanish(record.aes),
    Profession: normalizeString(record.Profession) || null,
    QR: normalizeString(record.QR) || null,
    RemoveRemarks: parseBooleanish(record.RemoveRemarks),
    ad_id: normalizeString(record.ad_id) || null,
    campaign_id: normalizeString(record.campaign_id) || null,
    form_id: normalizeString(record.form_id) || null,
  }
}

export function parseManualMySQLLeadCsv(csvText: string): ManualLeadInputRecord[] {
  return parseCsv(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as ManualLeadInputRecord[]
}

async function loadLookupMapsForManualImport(): Promise<LookupMaps> {
  try {
    return await loadLookupMaps()
  } catch (error) {
    console.warn(
      '[manual-lead-import] Falling back to empty MySQL lookups:',
      error instanceof Error ? error.message : error
    )
    return {
      source: new Map(),
      campaign: new Map(),
      category: new Map(),
      treatment: new Map(),
      circle: new Map(),
      status: new Map(),
    }
  }
}

export async function ingestManualMySQLLeadRecords(
  rawRecords: ManualLeadInputRecord[]
): Promise<ManualMySQLLeadIngestionResult> {
  const records = rawRecords.filter((record) => !isEmptyManualRow(record))

  if (records.length === 0) {
    throw new Error('Please provide at least one non-empty lead row')
  }

  const [systemUserId, lookups, bdMap] = await Promise.all([
    getDefaultMySQLSystemUserId(),
    loadLookupMapsForManualImport(),
    fetchBDUsersMap(),
  ])

  let processedCount = 0
  let duplicateCount = 0
  let failedCount = 0
  let skippedCount = 0
  const results: ManualMySQLLeadIngestionItem[] = []

  for (const [index, record] of records.entries()) {
    const rowNumber = index + 1
    const missingFields = validateManualRow(record)

    if (missingFields.length > 0) {
      skippedCount += 1
      results.push({
        rowNumber,
        status: 'skipped',
        error: `Missing required fields: ${missingFields.join(', ')}`,
      })
      continue
    }

    try {
      const mysqlLead = toMySQLLeadRow(record, rowNumber)
      const queued = await queueMySQLIncomingLead(mysqlLead, {
        source: MANUAL_MYSQL_INCOMING_SOURCE,
      })
      const processResult = await processMySQLIncomingLead(queued.id, {
        systemUserId,
        lookups,
        bdMap,
      })

      if (processResult.status === 'failed') {
        failedCount += 1
        results.push({
          rowNumber,
          incomingLeadId: queued.id,
          status: 'failed',
          error: processResult.error,
        })
        continue
      }

      if (processResult.status === 'duplicate') {
        duplicateCount += 1
      } else {
        processedCount += 1
      }
      results.push({
        rowNumber,
        incomingLeadId: queued.id,
        leadId: processResult.leadId,
        leadRef: processResult.leadRef,
        assignedBdName: processResult.assignedBdName ?? null,
        status: processResult.status,
      })
    } catch (error) {
      failedCount += 1
      results.push({
        rowNumber,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Failed to import lead row',
      })
    }
  }

  return {
    processedCount,
    duplicateCount,
    failedCount,
    skippedCount,
    results,
  }
}
