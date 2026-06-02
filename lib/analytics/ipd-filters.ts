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
 * Convenience wrapper: filters leads currently at IPD_DONE / CASH_IPD_DONE
 * using the date fallback chain. Once marked IPD done, a lead is counted as
 * "IPD done" regardless of whether it later moves to DISCHARGED / PL.
 */
export function ipdDoneWhere(
  dateFilter: Prisma.DateTimeFilter,
): Prisma.LeadWhereInput {
  return {
    caseStage: { in: ['IPD_DONE', 'CASH_IPD_DONE'] },
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
