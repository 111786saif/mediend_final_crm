import { Prisma } from '@/generated/prisma/client'

/**
 * Org-wide truth for "IPD done / surgery" date filtering:
 *   surgeryDate ONLY.
 *
 * BD marks IPD_DONE → sets surgeryDate + pipelineStage = 'PL' atomically.
 * Every endpoint that counts IPD done / surgeries MUST filter by
 * `surgeryDate` and `pipelineStage IN ('PL', 'COMPLETED')`.
 */

/**
 * Canonical sales-side where for a completed surgery / IPD done.
 * - pipelineStage IN ('PL', 'COMPLETED')
 * - date filter on surgeryDate only
 */
export function canonicalSalesCompletedWhere(
  dateFilter: Prisma.DateTimeFilter,
  extra?: Prisma.LeadWhereInput,
): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {
    pipelineStage: { in: ['PL', 'COMPLETED'] },
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
  if (Object.keys(dateFilter).length === 0) return {}
  return { surgeryDate: dateFilter }
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
