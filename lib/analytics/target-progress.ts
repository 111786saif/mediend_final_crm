import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { canonicalSalesCompletedWhere } from '@/lib/analytics/ipd-filters'

/**
 * Computes the "actual" achieved value for a BD against a given target metric,
 * over an arbitrary date range. Shared by /api/targets/progress and
 * /api/targets/trend so both routes score periods identically.
 */
export async function calculateActual(
  bdId: string,
  metric: string,
  start: Date,
  end: Date
): Promise<number> {
  // IPD_DONE / SURGERIES_DONE: count leads by surgeryDate using the canonical filter
  if (metric === 'IPD_DONE' || metric === 'SURGERIES_DONE') {
    const dateFilter: Prisma.DateTimeFilter = { gte: start, lte: end }
    const completedWhere: Prisma.LeadWhereInput = {
      bdId,
      ...canonicalSalesCompletedWhere(dateFilter),
    }
    return prisma.lead.count({ where: completedWhere })
  }

  // LEADS_GENERATED: count leads received in the period (not closed/converted),
  // using leadEntryDate with createdDate as fallback — same convention used
  // elsewhere (e.g. bd-detail analytics) for "leads received" counts.
  if (metric === 'LEADS_GENERATED') {
    return prisma.lead.count({
      where: {
        bdId,
        OR: [
          { leadEntryDate: { gte: start, lte: end } },
          { AND: [{ leadEntryDate: null }, { createdDate: { gte: start, lte: end } }] },
        ],
      },
    })
  }

  const baseWhere: Prisma.LeadWhereInput = {
    bdId,
    pipelineStage: 'COMPLETED',
    OR: [
      { conversionDate: { gte: start, lte: end } },
      { AND: [{ conversionDate: null }, { surgeryDate: { gte: start, lte: end } }] },
      { AND: [{ conversionDate: null }, { surgeryDate: null }, { leadEntryDate: { gte: start, lte: end } }] },
    ],
  }

  switch (metric) {
    case 'LEADS_CLOSED':
      return prisma.lead.count({ where: baseWhere })
    case 'NET_PROFIT': {
      const agg = await prisma.lead.aggregate({ where: baseWhere, _sum: { netProfit: true } })
      return agg._sum.netProfit || 0
    }
    case 'BILL_AMOUNT': {
      const agg = await prisma.lead.aggregate({ where: baseWhere, _sum: { billAmount: true } })
      return agg._sum.billAmount || 0
    }
    default:
      return 0
  }
}