import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

import { getSubordinateUserIdsForLeadAccess } from '@/lib/hierarchy'

import { canonicalSalesCompletedWhere } from '@/lib/analytics/ipd-filters'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'analytics:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateFilter: Prisma.DateTimeFilter = {}
    if (startDate) dateFilter.gte = new Date(startDate)
    if (endDate) dateFilter.lte = new Date(endDate)

    const leadEntryDateFilter: Prisma.LeadWhereInput =
      Object.keys(dateFilter).length > 0
        ? {
            OR: [
              { leadEntryDate: dateFilter },
              { AND: [{ leadEntryDate: { equals: null } }, { createdDate: dateFilter }] },
            ],
          }
        : {}

    const baseWhere: Prisma.LeadWhereInput = {
      ...leadEntryDateFilter,
    }

    if (user.role === 'BD') {
      baseWhere.bdId = user.id
    } else if (user.role === 'TEAM_LEAD') {
      const subIds = await getSubordinateUserIdsForLeadAccess(user.id)
      baseWhere.bdId = { in: [user.id, ...subIds] }
    }

    const completedWhere = canonicalSalesCompletedWhere(dateFilter)

    if (user.role === 'BD') completedWhere.bdId = user.id
    else if (user.role === 'TEAM_LEAD') {
      const subIds = await getSubordinateUserIdsForLeadAccess(user.id)
      completedWhere.bdId = { in: [user.id, ...subIds] }
    }

    // Treatment Performance
    const treatmentStats = await prisma.lead.groupBy({
      by: ['treatment'],
      where: baseWhere,
      _count: { id: true },
    })

    const treatmentCompleted = await prisma.lead.groupBy({
      by: ['treatment'],
      where: completedWhere,
      _count: { id: true },
      _sum: {
        billAmount: true,
        netProfit: true,
      },
    })

    const treatmentMap = new Map<
      string,
      { count: number; revenue: number; profit: number; completed: number }
    >()

    treatmentStats.forEach((stat) => {
      if (stat.treatment) {
        treatmentMap.set(stat.treatment, {
          count: stat._count.id,
          revenue: 0,
          profit: 0,
          completed: 0,
        })
      }
    })

    treatmentCompleted.forEach((stat) => {
      if (stat.treatment) {
        const existing = treatmentMap.get(stat.treatment) || {
          count: 0,
          revenue: 0,
          profit: 0,
          completed: 0,
        }
        existing.completed = stat._count.id
        existing.revenue = stat._sum.billAmount || 0
        existing.profit = stat._sum.netProfit || 0
        treatmentMap.set(stat.treatment, existing)
      }
    })

    const treatmentPerformance = Array.from(treatmentMap.entries())
      .map(([treatment, data]) => {
        const conversionRate = data.count > 0 ? (data.completed / data.count) * 100 : 0
        const avgTicketSize = data.completed > 0 ? data.revenue / data.completed : 0
        const avgProfitMargin = data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0

        return {
          treatment,
          count: data.count,
          revenue: data.revenue,
          profit: data.profit,
          avgTicketSize: Math.round(avgTicketSize * 100) / 100,
          avgProfitMargin: Math.round(avgProfitMargin * 100) / 100,
          conversionRate: Math.round(conversionRate * 100) / 100,
        }
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20) // Top 20 treatments

    // Hospital Performance
    const hospitalStats = await prisma.lead.groupBy({
      by: ['hospitalName', 'circle'],
      where: baseWhere,
      _count: { id: true },
    })

    const hospitalCompleted = await prisma.lead.groupBy({
      by: ['hospitalName', 'circle'],
      where: completedWhere,
      _count: { id: true },
      _sum: {
        billAmount: true,
        netProfit: true,
        hospitalShare: true,
      },
      _avg: {
        discount: true,
        copay: true,
        settledTotal: true,
      },
    })

    const hospitalMap = new Map<
      string,
      {
        circle: string
        totalSurgeries: number
        revenue: number
        profit: number
        hospitalShare: number
        avgDiscount: number
        avgCopay: number
        avgSettledAmount: number
      }
    >()

    hospitalStats.forEach((stat) => {
      hospitalMap.set(stat.hospitalName, {
        circle: stat.circle,
        totalSurgeries: 0,
        revenue: 0,
        profit: 0,
        hospitalShare: 0,
        avgDiscount: 0,
        avgCopay: 0,
        avgSettledAmount: 0,
      })
    })

    hospitalCompleted.forEach((stat) => {
      const existing = hospitalMap.get(stat.hospitalName) || {
        circle: stat.circle,
        totalSurgeries: 0,
        revenue: 0,
        profit: 0,
        hospitalShare: 0,
        avgDiscount: 0,
        avgCopay: 0,
        avgSettledAmount: 0,
      }
      existing.totalSurgeries = stat._count.id
      existing.revenue = stat._sum.billAmount || 0
      existing.profit = stat._sum.netProfit || 0
      existing.hospitalShare = stat._sum.hospitalShare || 0
      existing.avgDiscount = stat._avg.discount || 0
      existing.avgCopay = stat._avg.copay || 0
      existing.avgSettledAmount = stat._avg.settledTotal || 0
      hospitalMap.set(stat.hospitalName, existing)
    })

    const hospitalPerformance = Array.from(hospitalMap.entries())
      .map(([hospitalName, data]) => {
        const avgTicketSize = data.totalSurgeries > 0 ? data.revenue / data.totalSurgeries : 0

        return {
          hospitalName,
          circle: data.circle,
          totalSurgeries: data.totalSurgeries,
          revenue: data.revenue,
          profit: data.profit,
          hospitalShare: data.hospitalShare,
          avgTicketSize: Math.round(avgTicketSize * 100) / 100,
          avgDiscount: Math.round(data.avgDiscount * 100) / 100,
          avgCopay: Math.round(data.avgCopay * 100) / 100,
          avgSettledAmount: Math.round(data.avgSettledAmount * 100) / 100,
        }
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 20) // Top 20 hospitals

    // Surgeon Performance
    const surgeonStats = await prisma.lead.groupBy({
      by: ['surgeonName', 'surgeonType'],
      where: completedWhere,
      _count: { id: true },
      _sum: {
        billAmount: true,
        netProfit: true,
        doctorShare: true,
      },
    })

    const surgeonPerformance = surgeonStats
      .filter((stat) => stat.surgeonName)
      .map((stat) => {
        const avgTicketSize = stat._count.id > 0 ? (stat._sum.billAmount || 0) / stat._count.id : 0

        return {
          surgeonName: stat.surgeonName!,
          surgeonType: stat.surgeonType || 'Unknown',
          totalSurgeries: stat._count.id,
          revenue: stat._sum.billAmount || 0,
          profit: stat._sum.netProfit || 0,
          doctorShare: stat._sum.doctorShare || 0,
          avgTicketSize: Math.round(avgTicketSize * 100) / 100,
        }
      })
      .sort((a, b) => b.totalSurgeries - a.totalSurgeries)
      .slice(0, 20) // Top 20 surgeons

    return successResponse({
      treatmentPerformance,
      hospitalPerformance,
      surgeonPerformance,
    })
  } catch (error) {
    console.error('Error fetching medical analytics:', error)
    return errorResponse('Failed to fetch medical analytics', 500)
  }
}
