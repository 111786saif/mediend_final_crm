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
        surgeryDate: hasDate ? dateFilter : { not: null },
      },
    ],
  }
  if (extra) Object.assign(where, extra)
  return where
}

/**
 * Date filter on surgeryDate only. Returns stage-only filter if empty.
 */
export function ipdDoneDateFilter(
  dateFilter: Prisma.DateTimeFilter,
): Prisma.LeadWhereInput {
  const hasDate = Object.keys(dateFilter).length > 0
  return {
    OR: [
      {
        caseStage: { in: [...CANONICAL_STAGES] },
        ...(hasDate ? { surgeryDate: dateFilter } : {}),
      },
      {
        caseStage: { in: [...PL_FALLBACK_STAGES] },
        surgeryDate: hasDate ? dateFilter : { not: null },
      },
    ],
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
