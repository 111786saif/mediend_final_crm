import { Prisma } from '@/generated/prisma/client'

const CANONICAL_STAGES = ['IPD_DONE', 'CASH_IPD_DONE', 'DISCHARGED', 'CASH_DISCHARGED'] as const
const PL_FALLBACK_STAGES = ['PL_PENDING', 'OUTSTANDING'] as const

/**
 * Org-wide truth for "IPD done / surgery":
 *   caseStage IN ('IPD_DONE','CASH_IPD_DONE','DISCHARGED','CASH_DISCHARGED')
 *   OR (caseStage IN ('PL_PENDING','OUTSTANDING') AND surgeryDate IS NOT NULL)
 *   AND surgeryDate within the date range (when provided).
 *
 * BD marks IPD_DONE → sets caseStage + surgeryDate. That is the single
 * source of truth. DISCHARGED leads are included because BD did the
 * surgery — insurance just processed it further.
 *
 * PL_PENDING / OUTSTANDING leads that still have a surgeryDate also count —
 * these are leads that completed surgery and moved to PL/outstanding.
 *
 * Every endpoint that counts IPD done / surgeries MUST use
 * `canonicalSalesCompletedWhere(dateFilter)`.
 */

export function canonicalSalesCompletedWhere(
  dateFilter: Prisma.DateTimeFilter,
  extra?: Prisma.LeadWhereInput,
): Prisma.LeadWhereInput {
  const hasDate = Object.keys(dateFilter).length > 0
  const where: Prisma.LeadWhereInput = {
    OR: [
      {
        caseStage: { in: [...CANONICAL_STAGES] },
        ...(hasDate ? { surgeryDate: dateFilter } : {}),
      },
      {
        caseStage: { in: [...PL_FALLBACK_STAGES] },
        OR: [
          { surgeryDate: hasDate ? dateFilter : { not: null } },
          { admissionRecord: { is: { surgeryDate: hasDate ? dateFilter : { not: null } } } },
        ],
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
 * Falls back to createdDate only for display purposes (legacy leads
 * that may lack surgeryDate).
 */
export function resolveIpdDate(lead: {
  conversionDate: Date | null
  surgeryDate: Date | null
  leadEntryDate: Date | null
  createdDate: Date
}): Date {
  return lead.surgeryDate ?? lead.createdDate
}
