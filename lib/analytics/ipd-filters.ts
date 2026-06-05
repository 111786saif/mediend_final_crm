import { Prisma } from '@/generated/prisma/client'

/**
 * Org-wide truth for "IPD done / surgery":
 *   caseStage IN ('IPD_DONE','CASH_IPD_DONE','DISCHARGED','CASH_DISCHARGED')
 *   AND surgeryDate within the date range.
 *
 * BD marks IPD_DONE → sets caseStage + surgeryDate. That is the single
 * source of truth. DISCHARGED leads are included because BD did the
 * surgery — insurance just processed it further.
 *
 * Every endpoint that counts IPD done / surgeries MUST use
 * `canonicalSalesCompletedWhere(dateFilter)`.
 */

export function canonicalSalesCompletedWhere(
  dateFilter: Prisma.DateTimeFilter,
  extra?: Prisma.LeadWhereInput,
): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {
    caseStage: { in: ['IPD_DONE', 'CASH_IPD_DONE', 'DISCHARGED', 'CASH_DISCHARGED'] },
  }
  if (Object.keys(dateFilter).length > 0) {
    where.surgeryDate = dateFilter
  }
  if (extra) Object.assign(where, extra)
  return where
}

/**
 * Date filter on surgeryDate only. Returns {} if empty.
 */
export function ipdDoneDateFilter(
  dateFilter: Prisma.DateTimeFilter,
): Prisma.LeadWhereInput {
  if (Object.keys(dateFilter).length === 0) {
    return { caseStage: { in: ['IPD_DONE', 'CASH_IPD_DONE', 'DISCHARGED', 'CASH_DISCHARGED'] } }
  }
  return {
    caseStage: { in: ['IPD_DONE', 'CASH_IPD_DONE', 'DISCHARGED', 'CASH_DISCHARGED'] },
    surgeryDate: dateFilter,
  }
}

/**
 * Counts leads that transitioned to IPD_DONE / CASH_IPD_DONE within the
 * given date range, using the caseStageHistory.changedAt timestamp.
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
