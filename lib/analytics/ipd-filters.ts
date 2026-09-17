import { Prisma } from '@/generated/prisma/client'

export const CANONICAL_STAGES = ['IPD_DONE', 'CASH_IPD_DONE', 'DISCHARGED', 'CASH_DISCHARGED'] as const
export const PL_FALLBACK_STAGES = ['PL_PENDING', 'OUTSTANDING'] as const

export const ALL_CONVERTED_STAGES = [...CANONICAL_STAGES, ...PL_FALLBACK_STAGES] as const

/**
 * Checks if a lead object represents a converted / IPD-done lead.
 * Counts IPD_DONE, CASH_IPD_DONE, and DISCHARGED (and CASH_DISCHARGED/PL_PENDING/COMPLETED)
 * without requiring surgeryDate to be non-null.
 */
export function isLeadConverted(lead: {
  caseStage?: string | null
  pipelineStage?: string | null
  surgeryDate?: Date | null
}): boolean {
  if (lead.pipelineStage === 'COMPLETED') return true
  const cs = lead.caseStage
  if (cs && (ALL_CONVERTED_STAGES as readonly string[]).includes(cs)) {
    return true
  }
  if (lead.surgeryDate != null) return true
  return false
}

/**
 * Prisma WHERE filter for converted leads matching any of the canonical conversion stages.
 */
export function leadConvertedWhere(): Prisma.LeadWhereInput {
  return {
    OR: [
      { caseStage: { in: [...ALL_CONVERTED_STAGES] } },
      { pipelineStage: 'COMPLETED' },
      { surgeryDate: { not: null } },
    ],
  }
}

/**
 * Normalizes campaign names to merge spelling duplicates and artifact formatting (e.g. double hyphens, trailing dots).
 */
export function normalizeCampaignName(raw: string | null | undefined): string {
  if (!raw) return 'Not Specified'
  let s = raw.trim()
  if (!s || s === '—') return 'Not Specified'
  s = s.replace(/-{2,}/g, '-')
  s = s.replace(/[\.\s-]+$/, '')
  return s || 'Not Specified'
}

/**
 * Normalizes source names.
 */
export function normalizeSourceName(raw: string | null | undefined): string {
  if (!raw) return 'Not Specified'
  const s = raw.trim()
  if (!s || s === '—') return 'Not Specified'
  return s
}

/**
 * Normalizes circle / city names.
 */
export function normalizeCircleName(raw: string | null | undefined): string {
  if (!raw) return 'Unknown'
  const s = raw.trim()
  if (!s || s === '—') return 'Unknown'
  const lower = s.toLowerCase()
  if (lower === 'mumbai') return 'Mumbai'
  if (lower === 'delhi' || lower === 'new delhi' || lower === 'delhi-ncr') return 'Delhi'
  if (lower === 'pune') return 'Pune'
  if (lower === 'bangalore' || lower === 'bengaluru') return 'Bangalore'
  if (lower === 'hyderabad' || lower === 'hydrabad') return 'Hyderabad'
  if (lower === 'kolkata') return 'Kolkata'
  if (lower === 'nashik' || lower === 'nasik') return 'Nashik'
  if (lower === 'ludhiana' || lower === 'ludhiyana') return 'Ludhiana'
  return s
}

/**
 * Org-wide truth for "IPD done / surgery / converted":
 *   caseStage IN ('IPD_DONE','CASH_IPD_DONE','DISCHARGED','CASH_DISCHARGED')
 *     OR caseStage IN ('PL_PENDING','OUTSTANDING')
 *     OR pipelineStage = 'COMPLETED'
 *
 * If a dateFilter is provided, filters by surgery date (or lead entry/created date fallback).
 */
export function canonicalSalesCompletedWhere(
  dateFilter: Prisma.DateTimeFilter,
  extra?: Prisma.LeadWhereInput,
): Prisma.LeadWhereInput {
  const hasDate = Object.keys(dateFilter).length > 0
  const surgeryOr: Prisma.LeadWhereInput[] = hasDate
    ? [
        { surgeryDate: dateFilter },
        { admissionRecord: { is: { surgeryDate: dateFilter } } },
        { AND: [{ surgeryDate: null }, { OR: [{ leadEntryDate: dateFilter }, { createdDate: dateFilter }] }] },
      ]
    : []

  const stageFilter: Prisma.LeadWhereInput = {
    OR: [
      { caseStage: { in: [...ALL_CONVERTED_STAGES] } },
      { pipelineStage: 'COMPLETED' },
      { surgeryDate: { not: null } },
    ],
  }

  const where: Prisma.LeadWhereInput = hasDate
    ? {
        AND: [
          stageFilter,
          { OR: surgeryOr },
        ],
      }
    : stageFilter

  if (extra) Object.assign(where, extra)
  return where
}

/**
 * Counts leads that transitioned to IPD_DONE / CASH_IPD_DONE within the
 * given date range, using the caseStageHistory.changedAt timestamp.
 * 
 * @deprecated Use canonicalSalesCompletedWhere. This function filters by
 * status change date (changedAt), not by surgery date.
 */
export function ipdDoneWhere(
  dateFilter: Prisma.DateTimeFilter,
): Prisma.LeadWhereInput {
  return {
    caseStage: { in: ['IPD_DONE', 'CASH_IPD_DONE'] },
    caseStageHistory: {
      some: {
        toStage: { in: ['IPD_DONE', 'CASH_IPD_DONE'] },
        changedAt: dateFilter,
      },
    },
  }
}

/**
 * Alias for canonicalSalesCompletedWhere. Kept as a named export
 * so older callers can swap in gradually.
 *
 * @deprecated Import canonicalSalesCompletedWhere directly instead.
 */
export function ipdDoneDateFilter(
  dateFilter: Prisma.DateTimeFilter,
  extra?: Prisma.LeadWhereInput,
): Prisma.LeadWhereInput {
  return canonicalSalesCompletedWhere(dateFilter, extra)
}

/**
 * Canonical UTC date range builder for IPD done queries.
 * All endpoints MUST use this to avoid timezone drift between
 * startOfDay/endOfDay (date-fns), raw new Date(), and .setHours().
 *
 * Produces the same result regardless of server timezone.
 *
 * Overload 1: from YYYY-MM-DD strings (most API routes).
 * Overload 2: from Date objects (target-achievement overlap, etc.).
 */
export function buildDateRange(
  startDate: string | null | Date,
  endDate: string | null | Date,
  timezone?: string | null,
): Prisma.DateTimeFilter {
  const filter: Prisma.DateTimeFilter = {}
  const isUtc = timezone?.toUpperCase() === 'UTC'

  if (startDate) {
    if (typeof startDate === 'string') {
      filter.gte = isUtc
        ? new Date(`${startDate}T00:00:00.000Z`)
        : new Date(`${startDate}T00:00:00.000+05:30`)
    } else {
      filter.gte = startDate
    }
  }
  if (endDate) {
    if (typeof endDate === 'string') {
      filter.lte = isUtc
        ? new Date(`${endDate}T23:59:59.999Z`)
        : new Date(`${endDate}T23:59:59.999+05:30`)
    } else {
      filter.lte = endDate
    }
  }
  return filter
}

/**
 * In-memory date resolver for month bucketing in trend charts.
 * Uses Lead.surgeryDate first, then AdmissionRecord.surgeryDate.
 * No createdDate fallback — leads without a surgery date are excluded.
 */
export function resolveIpdDate(lead: {
  surgeryDate: Date | null
  admissionSurgeryDate?: Date | null
}): Date | null {
  return lead.surgeryDate ?? lead.admissionSurgeryDate ?? null
}
