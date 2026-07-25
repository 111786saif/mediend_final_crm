import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionWithFreshUser } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canonicalSalesCompletedWhere, resolveIpdDate, buildDateRange } from '@/lib/analytics/ipd-filters'
import {
  canAccessSalesDashboard,
  getSalesDashboardBdIdFilter,
} from '@/lib/analytics/sales-dashboard-access'

function daysInMonthUTC(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionWithFreshUser()
    if (!user) return unauthorizedResponse()

    if (!canAccessSalesDashboard(user)) {
      return errorResponse('Forbidden', 403)
    }

    const bdIdFilter = await getSalesDashboardBdIdFilter(user)
    const teamScope: import('@/generated/prisma/client').Prisma.LeadWhereInput = bdIdFilter
      ? { bdId: { in: bdIdFilter } }
      : {}

    const { searchParams } = new URL(request.url)
    const startParam = searchParams.get('startDate')
    const endParam = searchParams.get('endDate')

    const today = new Date()
    let thisMonthStart: Date
    let thisMonthEnd: Date
    let lastMonthStart: Date
    let lastMonthEndThisDay: Date
    let dayOfMonth: number
    let dateFilter: Prisma.DateTimeFilter

    if (startParam && endParam) {
      dateFilter = buildDateRange(startParam, endParam)
      thisMonthStart = dateFilter.gte as Date
      thisMonthEnd = dateFilter.lte as Date
      dayOfMonth = thisMonthEnd.getUTCDate()
      const prev = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()))
      lastMonthStart = prev(thisMonthStart)
      lastMonthEndThisDay = new Date(Date.UTC(thisMonthEnd.getUTCFullYear(), thisMonthEnd.getUTCMonth() - 1, Math.min(dayOfMonth, new Date(Date.UTC(thisMonthEnd.getUTCFullYear(), thisMonthEnd.getUTCMonth(), 0)).getUTCDate()), 23, 59, 59, 999))
    } else {
      const now = new Date()
      dayOfMonth = now.getUTCDate()
      const y = now.getUTCFullYear()
      const m = now.getUTCMonth()
      thisMonthStart = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0))
      thisMonthEnd = new Date(Date.UTC(y, m, now.getUTCDate(), 23, 59, 59, 999))
      dateFilter = { gte: thisMonthStart, lte: thisMonthEnd }
      lastMonthStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0))
      lastMonthEndThisDay = new Date(Date.UTC(y, m - 1, Math.min(dayOfMonth, new Date(Date.UTC(y, m, 0)).getUTCDate()), 23, 59, 59, 999))
    }

    const currentYear = today.getUTCFullYear()
    const completedWhereBase: Prisma.LeadWhereInput = { ...teamScope }

    const [ipdThisMonth, ipdByThisDayLastMonth, allCompletedThisYear] = await Promise.all([
      prisma.lead.count({
        where: {
          ...completedWhereBase,
          ...canonicalSalesCompletedWhere(dateFilter),
        },
      }),
      prisma.lead.count({
        where: {
          ...completedWhereBase,
          ...canonicalSalesCompletedWhere({ gte: lastMonthStart, lte: lastMonthEndThisDay }),
        },
      }),
      prisma.lead.findMany({
        where: {
          ...completedWhereBase,
          ...canonicalSalesCompletedWhere({ gte: new Date(Date.UTC(currentYear, 0, 1, 0, 0, 0)), lte: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 23, 59, 59, 999)) }),
        },
        select: { surgeryDate: true, admissionRecord: { select: { surgeryDate: true } } },
      }),
    ])

    const monthCounts = new Map<string, number>()
    const monthCountsUpToThisDay = new Map<string, number>()
    for (let m = 1; m <= 12; m++) {
      const monthEnd = new Date(Date.UTC(currentYear, m, 0, 23, 59, 59, 999))
      if (monthEnd > today) break
      monthCounts.set(String(m), 0)
      monthCountsUpToThisDay.set(String(m), 0)
    }
    allCompletedThisYear.forEach((lead) => {
      const d = resolveIpdDate({ surgeryDate: lead.surgeryDate, admissionSurgeryDate: lead.admissionRecord?.surgeryDate })
      if (!d) return
      if (d.getUTCFullYear() !== currentYear) return
      const m = d.getUTCMonth() + 1
      const key = String(m)
      monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1)
      const day = d.getUTCDate()
      if (day <= dayOfMonth) {
        monthCountsUpToThisDay.set(key, (monthCountsUpToThisDay.get(key) ?? 0) + 1)
      }
    })

    let ipdBestMonthByThisDay = 0
    monthCountsUpToThisDay.forEach((count) => {
      if (count > ipdBestMonthByThisDay) ipdBestMonthByThisDay = count
    })

    let bestMonthThisYear = { month: 0, count: 0 }
    monthCounts.forEach((count, key) => {
      const month = parseInt(key, 10)
      if (count > bestMonthThisYear.count) {
        bestMonthThisYear = { month, count }
      }
    })

    return successResponse({
      ipdThisMonth,
      ipdByThisDayLastMonth,
      ipdBestMonthByThisDay,
      bestMonthThisYear: {
        month: bestMonthThisYear.month,
        monthLabel: bestMonthThisYear.month ? new Date(currentYear, bestMonthThisYear.month - 1, 1).toLocaleString('default', { month: 'short', year: 'numeric' }) : null,
        count: bestMonthThisYear.count,
      },
      asOfDate: today.toISOString().slice(0, 10),
      dayOfMonth,
    })
  } catch (error) {
    console.error('IPD comparison error:', error)
    return errorResponse('Failed to fetch IPD comparison', 500)
  }
}
