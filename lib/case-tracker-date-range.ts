import { CaseStage } from '@/generated/prisma/enums'
import { endOfDay, format, startOfDay, startOfMonth, subMonths } from 'date-fns'
import { getLatestActivityTime } from '@/lib/lead-activity'

export type DateRangePreset = 'current_month' | 'last_3_months' | 'last_6_months' | 'custom'

export interface CaseTrackerDateRange {
  preset: DateRangePreset | null
  fromDate: string | null
  toDate: string | null
}

export const CASE_TRACKER_DATE_RANGE_STORAGE_KEY = 'case-tracker-date-range'

const IPD_DONE_STAGES = new Set<CaseStage>([
  CaseStage.IPD_DONE,
  CaseStage.CASH_IPD_DONE,
  CaseStage.DISCHARGED,
  CaseStage.CASH_DISCHARGED,
])

export function formatDateParam(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function getDefaultCaseTrackerDateRange(): CaseTrackerDateRange {
  const range = getCurrentMonthRange()
  return { preset: 'current_month', ...range }
}

export function getCurrentMonthRange(): { fromDate: string; toDate: string } {
  const today = new Date()
  return {
    fromDate: formatDateParam(startOfMonth(today)),
    toDate: formatDateParam(today),
  }
}

export function getLast3MonthsRange(): { fromDate: string; toDate: string } {
  const today = new Date()
  return {
    fromDate: formatDateParam(subMonths(today, 3)),
    toDate: formatDateParam(today),
  }
}

export function getLast6MonthsRange(): { fromDate: string; toDate: string } {
  const today = new Date()
  return {
    fromDate: formatDateParam(subMonths(today, 6)),
    toDate: formatDateParam(today),
  }
}

export function resolvePresetRange(preset: DateRangePreset): { fromDate: string; toDate: string } {
  switch (preset) {
    case 'current_month':
      return getCurrentMonthRange()
    case 'last_3_months':
      return getLast3MonthsRange()
    case 'last_6_months':
      return getLast6MonthsRange()
    default:
      return getCurrentMonthRange()
  }
}

export function formatCaseTrackerDateRangeLabel(range: CaseTrackerDateRange): string {
  if (!range.fromDate && !range.toDate) return 'Date range'
  if (range.preset === 'current_month') return 'Current month'
  if (range.preset === 'last_3_months') return 'Last 3 months'
  if (range.preset === 'last_6_months') return 'Last 6 months'
  if (range.fromDate && range.toDate) {
    const from = new Date(range.fromDate)
    const to = new Date(range.toDate)
    return `${format(from, 'd MMM yyyy')} – ${format(to, 'd MMM yyyy')}`
  }
  return 'Date range'
}

export function monthKeyFromDateRange(range: CaseTrackerDateRange, fallback: string): string {
  if (!range.fromDate) return fallback
  const [y, m] = range.fromDate.split('-')
  return y && m ? `${y}-${m}` : fallback
}

type LeadLike = {
  caseStage?: CaseStage | string | null
  surgeryDate?: string | Date | null
  admissionRecord?: { surgeryDate?: string | Date | null } | null
}

function getLeadEffectiveTimestamp(lead: LeadLike, isIpdDone: boolean): number {
  if (isIpdDone) {
    const sd = lead.surgeryDate ?? lead.admissionRecord?.surgeryDate
    if (sd) {
      const t = new Date(sd as string).getTime()
      if (Number.isFinite(t) && t > 0) return t
    }
    return 0
  }

  const surgeryTs = (() => {
    const v = lead.surgeryDate
    if (!v) return Infinity
    const t = new Date(v as string).getTime()
    return Number.isFinite(t) ? t : Infinity
  })()
  const activityTs = getLatestActivityTime(lead)
  return Math.min(surgeryTs, activityTs) || activityTs
}

export function filterLeadsByCaseTrackerDateRange<T extends LeadLike>(
  leads: T[],
  fromDate: string | null,
  toDate: string | null
): T[] {
  if (!fromDate && !toDate) return leads

  const from = fromDate ? startOfDay(new Date(fromDate)).getTime() : Number.NEGATIVE_INFINITY
  const to = toDate ? endOfDay(new Date(toDate)).getTime() : Number.POSITIVE_INFINITY

  return leads.filter((lead) => {
    const isIpdDone = lead.caseStage != null && IPD_DONE_STAGES.has(lead.caseStage as CaseStage)
    const ts = getLeadEffectiveTimestamp(lead, isIpdDone)
    if (!ts) return false
    return ts >= from && ts <= to
  })
}

export function loadCaseTrackerDateRangeFromStorage(): CaseTrackerDateRange | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(CASE_TRACKER_DATE_RANGE_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CaseTrackerDateRange
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    // ignore invalid storage
  }
  return null
}

export function saveCaseTrackerDateRangeToStorage(range: CaseTrackerDateRange): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(CASE_TRACKER_DATE_RANGE_STORAGE_KEY, JSON.stringify(range))
}
