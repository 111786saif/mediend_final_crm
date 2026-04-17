import { Prisma } from '@/generated/prisma/client'

/**
 * Canonical IPD date fallback chain:
 *   conversionDate → surgeryDate → leadDate → createdDate
 *
 * All endpoints that count "IPD done" must use this same chain
 * for both date-range filtering and in-memory month bucketing.
 */

/**
 * Returns a Prisma OR clause that filters leads using the 4-step
 * date fallback chain. If `dateFilter` is empty, returns `{}`.
 */
export function ipdDoneDateFilter(
  dateFilter: Prisma.DateTimeFilter,
): Prisma.LeadWhereInput {
  if (Object.keys(dateFilter).length === 0) return {}

  return {
    OR: [
      { conversionDate: dateFilter },
      { AND: [{ conversionDate: null }, { surgeryDate: dateFilter }] },
      { AND: [{ conversionDate: null }, { surgeryDate: null }, { leadDate: dateFilter }] },
      { AND: [{ conversionDate: null }, { surgeryDate: null }, { leadDate: null }, { createdDate: dateFilter }] },
    ],
  }
}

/**
 * Convenience wrapper: `pipelineStage = 'COMPLETED'` + date fallback filter.
 */
export function ipdDoneWhere(
  dateFilter: Prisma.DateTimeFilter,
): Prisma.LeadWhereInput {
  return {
    pipelineStage: 'COMPLETED',
    ...ipdDoneDateFilter(dateFilter),
  }
}

/**
 * In-memory date resolver for month bucketing.
 * Mirrors the SQL: COALESCE(conversionDate, surgeryDate, leadDate, createdDate)
 */
export function resolveIpdDate(lead: {
  conversionDate: Date | null
  surgeryDate: Date | null
  leadDate: Date | null
  createdDate: Date
}): Date {
  return lead.conversionDate ?? lead.surgeryDate ?? lead.leadDate ?? lead.createdDate
}
