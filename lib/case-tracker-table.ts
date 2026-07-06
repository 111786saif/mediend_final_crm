import { format } from 'date-fns'
import type { Lead } from '@/hooks/use-leads'
import { formatLeadAgeSex, resolveLeadCity, resolveLeadHospitalDoctor } from '@/lib/lead-display'
import { getPhoneDisplay } from '@/lib/phone-utils'
import type { CaseStage } from '@/generated/prisma/enums'

export type CaseTrackerColumnKey =
  | 'leadRef'
  | 'date'
  | 'surgeryDate'
  | 'patientName'
  | 'phoneNumber'
  | 'age'
  | 'sex'
  | 'circle'
  | 'treatment'
  | 'bd'
  | 'hospital'
  | 'doctor'
  | 'insurance'
  | 'type'
  | 'tpa'
  | 'city'
  | 'stage'

export interface CaseTrackerColumnDef {
  key: CaseTrackerColumnKey
  label: string
  /** Columns visible in table by default */
  defaultVisible: boolean
  sortable: boolean
}

export const CASE_TRACKER_COLUMNS: CaseTrackerColumnDef[] = [
  { key: 'leadRef', label: 'Lead ref', defaultVisible: true, sortable: true },
  { key: 'date', label: 'Date', defaultVisible: true, sortable: true },
  { key: 'surgeryDate', label: 'Surgery date', defaultVisible: true, sortable: true },
  { key: 'patientName', label: 'Patient', defaultVisible: true, sortable: true },
  { key: 'phoneNumber', label: 'Phone number', defaultVisible: true, sortable: false },
  { key: 'age', label: 'Age', defaultVisible: true, sortable: true },
  { key: 'sex', label: 'Sex', defaultVisible: true, sortable: true },
  { key: 'circle', label: 'Circle', defaultVisible: true, sortable: true },
  { key: 'treatment', label: 'Treatment', defaultVisible: true, sortable: true },
  { key: 'bd', label: 'Business developer', defaultVisible: true, sortable: true },
  { key: 'hospital', label: 'Hospital', defaultVisible: true, sortable: true },
  { key: 'doctor', label: 'Doctor', defaultVisible: true, sortable: true },
  { key: 'insurance', label: 'Insurance', defaultVisible: true, sortable: true },
  { key: 'type', label: 'Type', defaultVisible: true, sortable: true },
  { key: 'tpa', label: 'TPA', defaultVisible: true, sortable: true },
  { key: 'city', label: 'City', defaultVisible: true, sortable: true },
  { key: 'stage', label: 'Case status', defaultVisible: true, sortable: true },
]

export type Bucket =
  | 'KYP'
  | 'HOSPITALS_SUGGESTED'
  | 'PREAUTH_RAISED'
  | 'PREAUTH_COMPLETE'
  | 'IPD_SCHEDULED'
  | 'IPD_DONE'

export interface DecoratedCaseRow {
  lead: Lead
  bucket: Bucket
  hospital: string
  doctor: string
  stageLabel: string
}

function resolveInsuranceType(lead: Lead): string {
  const kyp = lead.kypSubmission as { insuranceType?: string | null } | null | undefined
  if (kyp?.insuranceType?.trim()) return kyp.insuranceType.trim()
  if (lead.flowType === 'CASH') return 'Cash'
  if (lead.flowType === 'INSURANCE') return 'Insurance'
  return ''
}

function resolveInsuranceName(lead: Lead): string {
  const preAuth = (lead.kypSubmission as { preAuthData?: { insurance?: string | null } } | null)?.preAuthData
  return (
    (typeof lead.insuranceName === 'string' ? lead.insuranceName.trim() : '') ||
    (preAuth?.insurance?.trim() ?? '')
  )
}

function resolveTpa(lead: Lead): string {
  const preAuth = (lead.kypSubmission as { preAuthData?: { tpa?: string | null } } | null)?.preAuthData
  return (
    (typeof lead.tpa === 'string' ? lead.tpa.trim() : '') ||
    (preAuth?.tpa?.trim() ?? '')
  )
}

function resolveBdName(lead: Lead): string {
  return (lead.plRecord?.bdmName ?? lead.bd?.name ?? '').trim()
}

function resolveSurgeryDate(lead: Lead): Date | null {
  const sd = lead.surgeryDate ?? (lead as { admissionRecord?: { surgeryDate?: string | Date } }).admissionRecord?.surgeryDate
  if (!sd) return null
  const d = new Date(sd as string)
  return Number.isNaN(d.getTime()) ? null : d
}

function resolveEntryDate(lead: Lead): Date | null {
  const d = lead.leadEntryDate || lead.createdDate
  if (!d) return null
  const parsed = new Date(d as string)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function getCaseRowCellValue(
  row: DecoratedCaseRow,
  key: CaseTrackerColumnKey,
  canViewPhone: boolean
): string {
  const { lead, hospital, doctor, stageLabel } = row
  switch (key) {
    case 'leadRef':
      return String(lead.leadRef ?? '')
    case 'date': {
      const d = resolveEntryDate(lead)
      return d ? format(d, 'yyyy-MM-dd') : ''
    }
    case 'surgeryDate': {
      const d = resolveSurgeryDate(lead)
      return d ? format(d, 'yyyy-MM-dd') : ''
    }
    case 'patientName':
      return String(lead.patientName ?? '')
    case 'phoneNumber':
      return getPhoneDisplay(lead.phoneNumber, canViewPhone)
    case 'age':
      return lead.age != null && !Number.isNaN(Number(lead.age)) ? String(lead.age) : ''
    case 'sex':
      return typeof lead.sex === 'string' ? lead.sex.trim() : ''
    case 'circle':
      return typeof lead.circle === 'string' ? lead.circle : ''
    case 'treatment':
      return String(lead.treatment ?? '')
    case 'bd':
      return resolveBdName(lead)
    case 'hospital':
      return hospital
    case 'doctor':
      return doctor
    case 'insurance':
      return resolveInsuranceName(lead)
    case 'type':
      return resolveInsuranceType(lead)
    case 'tpa':
      return resolveTpa(lead)
    case 'city':
      return resolveLeadCity(lead) ?? ''
    case 'stage':
      return stageLabel || String(lead.caseStage ?? '').replace(/_/g, ' ')
    default:
      return ''
  }
}

export function getCaseRowSearchBlob(
  row: DecoratedCaseRow,
  keys: CaseTrackerColumnKey[],
  canViewPhone: boolean
): string {
  return keys.map((k) => getCaseRowCellValue(row, k, canViewPhone)).join(' ').toLowerCase()
}

export function compareCaseRows(
  a: DecoratedCaseRow,
  b: DecoratedCaseRow,
  key: CaseTrackerColumnKey,
  dir: 'asc' | 'desc',
  canViewPhone: boolean
): number {
  const av = getCaseRowCellValue(a, key, canViewPhone)
  const bv = getCaseRowCellValue(b, key, canViewPhone)

  if (key === 'age') {
    const an = av === '' ? -1 : Number(av)
    const bn = bv === '' ? -1 : Number(bv)
    const cmp = an - bn
    return dir === 'asc' ? cmp : -cmp
  }

  if (key === 'date' || key === 'surgeryDate') {
    const ad = av ? new Date(av).getTime() : 0
    const bd = bv ? new Date(bv).getTime() : 0
    const cmp = ad - bd
    return dir === 'asc' ? cmp : -cmp
  }

  const cmp = av.localeCompare(bv, undefined, { sensitivity: 'base', numeric: true })
  return dir === 'asc' ? cmp : -cmp
}

export function formatCaseCellDisplay(
  row: DecoratedCaseRow,
  key: CaseTrackerColumnKey,
  canViewPhone: boolean
): string {
  const { lead } = row
  switch (key) {
    case 'date': {
      const d = resolveEntryDate(lead)
      return d ? format(d, 'MMM d, yyyy') : '—'
    }
    case 'surgeryDate': {
      const d = resolveSurgeryDate(lead)
      return d ? format(d, 'MMM d, yyyy') : '—'
    }
    case 'age':
      return lead.age != null && !Number.isNaN(Number(lead.age)) ? String(lead.age) : '—'
    case 'sex':
      return typeof lead.sex === 'string' && lead.sex.trim() ? lead.sex.trim() : '—'
    case 'phoneNumber':
      return getPhoneDisplay(lead.phoneNumber, canViewPhone)
    case 'circle':
      return typeof lead.circle === 'string' ? lead.circle : '—'
    case 'city':
      return resolveLeadCity(lead) ?? '—'
    default: {
      const v = getCaseRowCellValue(row, key, canViewPhone)
      return v || '—'
    }
  }
}

export function exportCaseRowsCsv(
  rows: DecoratedCaseRow[],
  columns: CaseTrackerColumnDef[],
  canViewPhone: boolean
): void {
  const header = columns.map((c) => c.label)
  const escape = (v: string) => {
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
    return v
  }
  const lines = [
    header.map(escape).join(','),
    ...rows.map((row) =>
      columns.map((col) => escape(getCaseRowCellValue(row, col.key, canViewPhone))).join(',')
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `case-tracker-${format(new Date(), 'yyyy-MM-dd')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
