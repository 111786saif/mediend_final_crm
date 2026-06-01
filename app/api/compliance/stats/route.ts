import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma, ComplianceCallStatus } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

const DISCHARGED_STAGES = [
  'DISCHARGED',
  'CASH_DISCHARGED',
  'PL_PENDING',
  'OUTSTANDING',
  'IPD_DONE',
] as const

async function backfillComplianceCalls() {
  const orphans = await prisma.lead.findMany({
    where: {
      caseStage: { in: DISCHARGED_STAGES as unknown as Prisma.EnumCaseStageFilter['in'] },
      complianceCall: null,
    },
    select: { id: true },
  })
  if (orphans.length === 0) return
  await prisma.complianceCall.createMany({
    data: orphans.map((l) => ({ leadId: l.id })),
    skipDuplicates: true,
  })
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'compliance:read')) return errorResponse('Forbidden', 403)

    await backfillComplianceCalls()

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const where: Prisma.ComplianceCallWhereInput = {}
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    // Discharge counters are global (independent of the page's month filter):
    // total discharges in the current calendar month and today, off the
    // canonical DischargeSheet.dischargeDate.
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const [ratingGroups, pending, aggregate, dischargesThisMonth, dischargesToday] =
      await Promise.all([
        prisma.complianceCall.groupBy({
          by: ['rating'],
          where: { ...where, status: ComplianceCallStatus.COMPLETED, rating: { not: null } },
          _count: { _all: true },
        }),
        prisma.complianceCall.count({
          where: { ...where, status: ComplianceCallStatus.PENDING },
        }),
        prisma.complianceCall.aggregate({
          where: { ...where, status: ComplianceCallStatus.COMPLETED, rating: { not: null } },
          _avg: { rating: true },
          _count: { _all: true },
        }),
        prisma.dischargeSheet.count({ where: { dischargeDate: { gte: monthStart } } }),
        prisma.dischargeSheet.count({ where: { dischargeDate: { gte: todayStart } } }),
      ])

    const byRating: Record<'1' | '2' | '3' | '4' | '5', number> = {
      '1': 0, '2': 0, '3': 0, '4': 0, '5': 0,
    }
    for (const g of ratingGroups) {
      if (g.rating != null && g.rating >= 1 && g.rating <= 5) {
        byRating[String(g.rating) as '1' | '2' | '3' | '4' | '5'] = g._count._all
      }
    }

    return successResponse({
      byRating,
      pending,
      totalCompleted: aggregate._count._all,
      averageRating: aggregate._avg.rating,
      dischargesThisMonth,
      dischargesToday,
    })
  } catch (error) {
    console.error('Error fetching compliance stats:', error)
    return errorResponse('Failed to fetch compliance stats', 500)
  }
}
