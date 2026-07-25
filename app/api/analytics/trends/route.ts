import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns'

import { getSalesDashboardBdIdFilter } from '@/lib/analytics/sales-dashboard-access'
import { isSubtreeScopedSalesRole } from '@/lib/sales-hierarchy-roles'
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
    const period = searchParams.get('period') || 'daily' // daily, weekly, monthly

    if (!startDate || !endDate) {
      return errorResponse('startDate and endDate are required', 400)
    }

    const dateFilter = buildDateRange(startDate, endDate)
    const start = dateFilter.gte as Date
    const end = dateFilter.lte as Date

    const baseWhere: Prisma.LeadWhereInput = {
      createdDate: {
        gte: start,
        lte: end,
      },
    }

    // Role-based filtering
    const subtreeBdIds = isSubtreeScopedSalesRole(user.role)
      ? await getSalesDashboardBdIdFilter(user)
      : undefined
    if (user.role === 'BD') {
      baseWhere.bdId = user.id
    } else if (subtreeBdIds) {
      baseWhere.bdId = { in: subtreeBdIds }
    }

    const completedWhere: Prisma.LeadWhereInput = {
      ...canonicalSalesCompletedWhere({ gte: start, lte: end }),
    }
    if (user.role === 'BD') completedWhere.bdId = user.id
    else if (subtreeBdIds) completedWhere.bdId = { in: subtreeBdIds }

    const allLeads = await prisma.lead.findMany({
      where: baseWhere,
      select: {
        id: true,
        createdDate: true,
        pipelineStage: true,
        surgeryDate: true,
        billAmount: true,
        netProfit: true,
      },
    })

    const completedLeads = await prisma.lead.findMany({
      where: completedWhere,
      select: {
        id: true,
        createdDate: true,
        surgeryDate: true,
        billAmount: true,
        netProfit: true,
      },
    })

    // Group by period
    let periods: Date[]
    let periodKey: (date: Date) => string
    let periodLabel: (date: Date) => string

    if (period === 'daily') {
      periods = eachDayOfInterval({ start, end })
      periodKey = (date) => format(date, 'yyyy-MM-dd')
      periodLabel = (date) => format(date, 'MMM dd')
    } else if (period === 'weekly') {
      periods = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 })
      periodKey = (date) => format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
      periodLabel = (date) => `Week of ${format(startOfWeek(date, { weekStartsOn: 1 }), 'MMM dd')}`
    } else {
      // monthly
      periods = eachMonthOfInterval({ start, end })
      periodKey = (date) => format(date, 'yyyy-MM')
      periodLabel = (date) => format(date, 'MMM yyyy')
    }

    const trendMap = new Map<
      string,
      {
        period: string
        leadsCreated: number
        leadsCompleted: number
        leadsLost: number
        revenue: number
        profit: number
        conversionRate: number
        avgTicketSize: number
        avgTimeToClose: number
      }
    >()

    // Initialize all periods
    periods.forEach((periodDate) => {
      const key = periodKey(periodDate)
      trendMap.set(key, {
        period: periodLabel(periodDate),
        leadsCreated: 0,
        leadsCompleted: 0,
        leadsLost: 0,
        revenue: 0,
        profit: 0,
        conversionRate: 0,
        avgTicketSize: 0,
        avgTimeToClose: 0,
      })
    })

    // Process all leads
    allLeads.forEach((lead) => {
      const key = periodKey(lead.createdDate)
      const data = trendMap.get(key)
      if (data) {
        data.leadsCreated++
        if (lead.surgeryDate) {
          data.leadsCompleted++
        } else if (lead.pipelineStage === 'LOST') {
          data.leadsLost++
        }
      }
    })

    // Process completed leads for revenue, profit, and time metrics
    const timeToCloseData: number[] = []
    completedLeads.forEach((lead) => {
      const date = lead.surgeryDate || lead.createdDate
      const key = periodKey(date)
      const data = trendMap.get(key)
      if (data) {
        data.revenue += lead.billAmount || 0
        data.profit += lead.netProfit || 0

        if (lead.surgeryDate && lead.createdDate) {
          const daysToClose = Math.floor(
            (lead.surgeryDate.getTime() - lead.createdDate.getTime()) / (1000 * 60 * 60 * 24)
          )
          timeToCloseData.push(daysToClose)
        }
      }
    })

    // Calculate derived metrics
    trendMap.forEach((data, key) => {
      data.conversionRate = data.leadsCreated > 0 ? (data.leadsCompleted / data.leadsCreated) * 100 : 0
      data.avgTicketSize = data.leadsCompleted > 0 ? data.revenue / data.leadsCompleted : 0
      data.avgTimeToClose =
        timeToCloseData.length > 0
          ? timeToCloseData.reduce((sum, days) => sum + days, 0) / timeToCloseData.length
          : 0

      // Round values
      data.conversionRate = Math.round(data.conversionRate * 100) / 100
      data.avgTicketSize = Math.round(data.avgTicketSize * 100) / 100
      data.avgTimeToClose = Math.round(data.avgTimeToClose * 100) / 100
    })

    const trendData = Array.from(trendMap.values()).sort((a, b) => {
      // Sort by period key for proper chronological order
      const aKey = periods.find((p) => periodLabel(p) === a.period)?.getTime() || 0
      const bKey = periods.find((p) => periodLabel(p) === b.period)?.getTime() || 0
      return aKey - bKey
    })

    return successResponse({
      period,
      trendData,
    })
  } catch (error) {
    console.error('Error fetching trends analytics:', error)
    return errorResponse('Failed to fetch trends analytics', 500)
  }
}
