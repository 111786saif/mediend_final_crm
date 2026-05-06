import { Prisma } from '@/generated/prisma/client'

/**
 * Canonical IPD date fallback chain:
 *   surgeryDate → conversionDate → leadEntryDate → createdDate
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
      { surgeryDate: dateFilter },
      { AND: [{ surgeryDate: null }, { conversionDate: dateFilter }] },
      { AND: [{ surgeryDate: null }, { conversionDate: null }, { leadEntryDate: dateFilter }] },
      { AND: [{ surgeryDate: null }, { conversionDate: null }, { leadEntryDate: null }, { createdDate: dateFilter }] },
    ],
  }
}

/**
 * Convenience wrapper: `pipelineStage IN (PL, COMPLETED)` + date fallback filter.
 * PL-stage leads have had their IPD done — they are awaiting financial closure.
 */
export function ipdDoneWhere(
  dateFilter: Prisma.DateTimeFilter,
): Prisma.LeadWhereInput {
  return {
    pipelineStage: { in: ['PL', 'COMPLETED'] },
    ...ipdDoneDateFilter(dateFilter),
  }
}

/**
 * In-memory date resolver for month bucketing.
 * Mirrors the SQL: COALESCE(surgeryDate, conversionDate, leadEntryDate, createdDate)
 */
export function resolveIpdDate(lead: {
  conversionDate: Date | null
  surgeryDate: Date | null
  leadEntryDate: Date | null
  createdDate: Date
}): Date {
  return lead.surgeryDate ?? lead.conversionDate ?? lead.leadEntryDate ?? lead.createdDate
}
