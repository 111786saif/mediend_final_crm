import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

import { getSubordinateUserIdsForLeadAccess } from '@/lib/hierarchy'

import { canonicalSalesCompletedWhere, buildDateRange } from '@/lib/analytics/ipd-filters'

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

    const dateFilter = buildDateRange(startDate, endDate)

    const where = canonicalSalesCompletedWhere(dateFilter)

    // Role-based filtering
    if (user.role === 'BD') {
      where.bdId = user.id
    } else if (user.role === 'TEAM_LEAD') {
      const subIds = await getSubordinateUserIdsForLeadAccess(user.id)
      where.bdId = { in: [user.id, ...subIds] }
    }

    // Financial Breakdown
    const financialAgg = await prisma.lead.aggregate({
      where,
      _sum: {
        billAmount: true,
        discount: true,
        copay: true,
        deduction: true,
        settledTotal: true,
        netProfit: true,
        mediendProfit: true,
        hospitalShare: true,
        doctorShare: true,
        othersShare: true,
      },
      _count: {
        id: true,
      },
    })

    const totalBillAmount = financialAgg._sum.billAmount || 0
    const totalDiscount = financialAgg._sum.discount || 0
    const totalCopay = financialAgg._sum.copay || 0
    const totalDeduction = financialAgg._sum.deduction || 0
    const totalSettledAmount = financialAgg._sum.settledTotal || 0
    const totalNetProfit = financialAgg._sum.netProfit || 0
    const mediendProfit = financialAgg._sum.mediendProfit || 0
    const hospitalShare = financialAgg._sum.hospitalShare || 0
    const doctorShare = financialAgg._sum.doctorShare || 0
    const othersShare = financialAgg._sum.othersShare || 0

    const profitMargin = totalBillAmount > 0 ? (totalNetProfit / totalBillAmount) * 100 : 0
    const discountRate = totalBillAmount > 0 ? (totalDiscount / totalBillAmount) * 100 : 0

    // Payment Mode Analysis
    const paymentModeStats = await prisma.lead.groupBy({
      by: ['modeOfPayment'],
      where,
      _count: { id: true },
      _sum: {
        billAmount: true,
      },
    })

    const totalPaymentAmount = paymentModeStats.reduce((sum, stat) => sum + (stat._sum.billAmount || 0), 0)

    const paymentModeAnalysis = paymentModeStats
      .filter((stat) => stat.modeOfPayment)
      .map((stat) => {
        const percentage = totalPaymentAmount > 0 ? ((stat._sum.billAmount || 0) / totalPaymentAmount) * 100 : 0
        const avgAmount = stat._count.id > 0 ? (stat._sum.billAmount || 0) / stat._count.id : 0

        return {
          modeOfPayment: stat.modeOfPayment!,
          count: stat._count.id,
          totalAmount: stat._sum.billAmount || 0,
          avgAmount: Math.round(avgAmount * 100) / 100,
          percentage: Math.round(percentage * 100) / 100,
        }
      })
      .sort((a, b) => b.totalAmount - a.totalAmount)

    // Insurance Analysis
    const insuranceStats = await prisma.lead.groupBy({
      by: ['insuranceName', 'tpa'],
      where: {
        ...where,
        insuranceName: { not: null },
      },
      _count: { id: true },
      _sum: {
        sumInsured: true,
        roomRent: true,
        icu: true,
        capping: true,
        settledTotal: true,
        copay: true,
        billAmount: true,
        netProfit: true,
      },
    })

    // Get approval/rejection counts from InsuranceCase if available
    const insuranceCases = await prisma.insuranceCase.findMany({
      where: {
        lead: {
          ...where,
          insuranceName: { not: null },
        },
      },
      select: {
        lead: {
          select: {
            insuranceName: true,
            tpa: true,
          },
        },
        caseStatus: true,
      },
    })

    const insuranceMap = new Map<
      string,
      {
        tpa: string | null
        totalCases: number
        approvedCases: number
        rejectedCases: number
        sumInsured: number
        roomRent: number
        icu: number
        capping: number
        settlementAmount: number
        copay: number
        revenue: number
        profit: number
      }
    >()

    insuranceStats.forEach((stat) => {
      if (stat.insuranceName) {
        insuranceMap.set(stat.insuranceName, {
          tpa: stat.tpa,
          totalCases: stat._count.id,
          approvedCases: 0,
          rejectedCases: 0,
          sumInsured: stat._sum.sumInsured || 0,
          roomRent: stat._sum.roomRent || 0,
          icu: stat._sum.icu || 0,
          capping: stat._sum.capping || 0,
          settlementAmount: stat._sum.settledTotal || 0,
          copay: stat._sum.copay || 0,
          revenue: stat._sum.billAmount || 0,
          profit: stat._sum.netProfit || 0,
        })
      }
    })

    insuranceCases.forEach((insuranceCase) => {
      const insuranceName = insuranceCase.lead.insuranceName
      if (insuranceName) {
        const existing = insuranceMap.get(insuranceName)
        if (existing) {
          if (insuranceCase.caseStatus === 'APPROVED') {
            existing.approvedCases++
          } else if (insuranceCase.caseStatus === 'REJECTED') {
            existing.rejectedCases++
          }
        }
      }
    })

    const insuranceAnalysis = Array.from(insuranceMap.entries())
      .map(([insuranceName, data]) => {
        const approvalRate = data.totalCases > 0 ? (data.approvedCases / data.totalCases) * 100 : 0
        const avgSumInsured = data.totalCases > 0 ? data.sumInsured / data.totalCases : 0
        const avgRoomRent = data.totalCases > 0 ? data.roomRent / data.totalCases : 0
        const avgICU = data.totalCases > 0 ? data.icu / data.totalCases : 0
        const avgCapping = data.totalCases > 0 ? data.capping / data.totalCases : 0
        const avgSettlementAmount = data.totalCases > 0 ? data.settlementAmount / data.totalCases : 0
        const avgCopay = data.totalCases > 0 ? data.copay / data.totalCases : 0

        return {
          insuranceName,
          tpa: data.tpa,
          totalCases: data.totalCases,
          approvedCases: data.approvedCases,
          rejectedCases: data.rejectedCases,
          approvalRate: Math.round(approvalRate * 100) / 100,
          avgSumInsured: Math.round(avgSumInsured * 100) / 100,
          avgRoomRent: Math.round(avgRoomRent * 100) / 100,
          avgICU: Math.round(avgICU * 100) / 100,
          avgCapping: Math.round(avgCapping * 100) / 100,
          avgSettlementAmount: Math.round(avgSettlementAmount * 100) / 100,
          avgCopay: Math.round(avgCopay * 100) / 100,
          revenue: data.revenue,
          profit: data.profit,
        }
      })
      .sort((a, b) => b.totalCases - a.totalCases)

    return successResponse({
      financialBreakdown: {
        totalBillAmount,
        totalDiscount,
        totalCopay,
        totalDeduction,
        totalSettledAmount,
        totalNetProfit,
        mediendProfit,
        hospitalShare,
        doctorShare,
        othersShare,
        profitMargin: Math.round(profitMargin * 100) / 100,
        discountRate: Math.round(discountRate * 100) / 100,
      },
      paymentModeAnalysis,
      insuranceAnalysis,
    })
  } catch (error) {
    console.error('Error fetching financial analytics:', error)
    return errorResponse('Failed to fetch financial analytics', 500)
  }
}
