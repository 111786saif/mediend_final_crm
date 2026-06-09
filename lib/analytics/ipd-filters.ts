import { Prisma } from '@/generated/prisma/client'

const CANONICAL_STAGES = ['IPD_DONE', 'CASH_IPD_DONE', 'DISCHARGED', 'CASH_DISCHARGED'] as const
const PL_FALLBACK_STAGES = ['PL_PENDING', 'OUTSTANDING'] as const

/**
 * Org-wide truth for "IPD done / surgery":
 *   caseStage IN ('IPD_DONE','CASH_IPD_DONE','DISCHARGED','CASH_DISCHARGED')
 *     AND (Lead.surgeryDate OR AdmissionRecord.surgeryDate) within range
 *   OR (caseStage IN ('PL_PENDING','OUTSTANDING')
 *     AND (Lead.surgeryDate OR AdmissionRecord.surgeryDate) within range)
 *
 * BD marks IPD_DONE → sets caseStage + (Lead.surgeryDate or AdmissionRecord.surgeryDate).
 * DISCHARGED leads are included because BD did the surgery — insurance just
 * processed it further. Some legacy leads have surgeryDate only on AdmissionRecord.
 *
 * Every endpoint that counts IPD done / surgeries MUST use
 * `canonicalSalesCompletedWhere(dateFilter)`.
 */

export function canonicalSalesCompletedWhere(
  dateFilter: Prisma.DateTimeFilter,
  extra?: Prisma.LeadWhereInput,
): Prisma.LeadWhereInput {
  const hasDate = Object.keys(dateFilter).length > 0
  const surgeryOr = hasDate
    ? [
        { surgeryDate: dateFilter },
        { admissionRecord: { is: { surgeryDate: dateFilter } } },
      ]
    : [
        { surgeryDate: { not: null } },
        { admissionRecord: { is: { surgeryDate: { not: null } } } },
      ]
  const where: Prisma.LeadWhereInput = {
    OR: [
      {
        caseStage: { in: [...CANONICAL_STAGES] },
        OR: surgeryOr,
      },
      {
        caseStage: { in: [...PL_FALLBACK_STAGES] },
        OR: surgeryOr,
      },
    ],
  }
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
): Prisma.DateTimeFilter {
  const filter: Prisma.DateTimeFilter = {}
  if (startDate) {
    filter.gte = typeof startDate === 'string'
      ? new Date(startDate + 'T00:00:00.000Z')
      : startDate
  }
  if (endDate) {
    filter.lte = typeof endDate === 'string'
      ? new Date(endDate + 'T23:59:59.999Z')
      : endDate
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
