import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma, PaidByParty } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

function mediendExpenseForPl(pl: {
  cabCharges: number
  dcCharges: number
  referralAmount: number
  doctorCharges: number
  implantCost: number
  instrumentsCost: number
  implantPaidBy: PaidByParty | null
  instrumentsPaidBy: PaidByParty | null
}): number {
  let exp =
    pl.cabCharges + pl.dcCharges + pl.referralAmount + pl.doctorCharges
  if (pl.implantPaidBy !== 'HOSPITAL') {
    exp += pl.implantCost
  }
  if (pl.instrumentsPaidBy !== 'HOSPITAL') {
    exp += pl.instrumentsCost
  }
  return exp
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'leads:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const teamId = searchParams.get('teamId')

    const surgeryRange: Prisma.DateTimeFilter = {}
    if (startDate) surgeryRange.gte = new Date(startDate)
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      surgeryRange.lte = end
    }

    const leadWhere: Prisma.LeadWhereInput = {
      plRecord: { isNot: null },
      ...(Object.keys(surgeryRange).length > 0
        ? {
            OR: [
              { plRecord: { surgeryDate: surgeryRange } },
              {
                AND: [
                  { plRecord: { surgeryDate: null } },
                  { surgeryDate: surgeryRange },
                ],
              },
            ],
          }
        : {}),
    }

    if (teamId && teamId !== 'all') {
      leadWhere.bd = { teamId }
    }

    const records = await prisma.pLRecord.findMany({
      where: {
        lead: leadWhere,
      },
      include: {
        lead: {
          select: {
            id: true,
            bdId: true,
            bd: {
              select: {
                id: true,
                name: true,
                teamId: true,
                team: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })

    let totalMediendShare = 0
    let totalExpenses = 0
    const categoryMap = new Map<string, { count: number; revenue: number }>()
    const hospitalMap = new Map<string, { count: number; revenue: number }>()
    const bdMap = new Map<
      string,
      { bdId: string; bdName: string; teamName: string | null; count: number; mediendShare: number; expenses: number }
    >()

    for (const pl of records) {
      const share = pl.mediendShareAmount || 0
      const exp = mediendExpenseForPl(pl)
      const net = share - exp

      totalMediendShare += share
      totalExpenses += exp

      const cat = pl.category?.trim() || 'Uncategorized'
      const c = categoryMap.get(cat) || { count: 0, revenue: 0 }
      c.count += 1
      c.revenue += net
      categoryMap.set(cat, c)

      const hosp = pl.hospitalName?.trim() || 'Unknown'
      const h = hospitalMap.get(hosp) || { count: 0, revenue: 0 }
      h.count += 1
      h.revenue += net
      hospitalMap.set(hosp, h)

      const bdId = pl.lead.bdId
      const bdName = pl.lead.bd?.name || 'Unknown'
      const teamName = pl.lead.bd?.team?.name ?? null
      const b = bdMap.get(bdId) || {
        bdId,
        bdName,
        teamName,
        count: 0,
        mediendShare: 0,
        expenses: 0,
      }
      b.count += 1
      b.mediendShare += share
      b.expenses += exp
      bdMap.set(bdId, b)
    }

    const surgeryCount = records.length
    const netProfit = totalMediendShare - totalExpenses

    const diseaseDistribution = Array.from(categoryMap.entries())
      .map(([category, v]) => ({ category, count: v.count, revenue: v.revenue }))
      .sort((a, b) => b.count - a.count)

    const hospitalDistribution = Array.from(hospitalMap.entries())
      .map(([hospital, v]) => ({ hospital, count: v.count, revenue: v.revenue }))
      .sort((a, b) => b.count - a.count)

    const bdBreakdown = Array.from(bdMap.values()).map((b) => ({
      bdId: b.bdId,
      bdName: b.bdName,
      teamName: b.teamName,
      surgeries: b.count,
      revenue: b.mediendShare,
      expenses: b.expenses,
      netProfit: b.mediendShare - b.expenses,
    }))

    const teams = await prisma.team.findMany({
      select: {
        id: true,
        name: true,
        teamLead: { select: { name: true } },
      },
      orderBy: { name: 'asc' },
    })

    return successResponse({
      surgeryCount,
      totalRevenue: totalMediendShare,
      totalExpenses,
      netProfit,
      avgRevenuePerSurgery: surgeryCount > 0 ? netProfit / surgeryCount : 0,
      diseaseDistribution,
      hospitalDistribution,
      bdBreakdown,
      teams,
    })
  } catch (error) {
    console.error('pl-surgery-dashboard error:', error)
    return errorResponse('Failed to load surgery dashboard', 500)
  }
}
