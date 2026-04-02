import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionWithFreshUser } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { startOfMonth, startOfDay, endOfDay, subMonths, setDate, getDaysInMonth } from 'date-fns'

import { getSubordinateUserIdsForLeadAccess } from '@/lib/hierarchy'

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionWithFreshUser()
    if (!user) return unauthorizedResponse()

    if (
      user.role !== 'MD' &&
      user.role !== 'ADMIN' &&
      user.role !== 'SALES_HEAD' &&
      user.role !== 'EXECUTIVE_ASSISTANT' &&
      user.role !== 'TEAM_LEAD' &&
      user.role !== 'DIGITAL_MARKETING_HEAD'
    ) {
      return errorResponse('Forbidden', 403)
    }

    let teamScope: import('@/generated/prisma/client').Prisma.LeadWhereInput = {}
    if (user.role === 'TEAM_LEAD') {
      const subIds = await getSubordinateUserIdsForLeadAccess(user.id)
      teamScope = { bdId: { in: [user.id, ...subIds] } }
    }

    const { searchParams } = new URL(request.url)
    const startParam = searchParams.get('startDate')
    const endParam = searchParams.get('endDate')

    const today = new Date()
    let thisMonthStart: Date
    let thisMonthEnd: Date
    let lastMonthStart: Date
    let lastMonthEndThisDay: Date
    let dayOfMonth: number

    if (startParam && endParam) {
      thisMonthStart = startOfDay(new Date(startParam))
      thisMonthEnd = endOfDay(new Date(endParam))
      lastMonthStart = startOfDay(subMonths(thisMonthStart, 1))
      lastMonthEndThisDay = endOfDay(subMonths(thisMonthEnd, 1))
      dayOfMonth = thisMonthEnd.getDate()
    } else {
      dayOfMonth = today.getDate()
      thisMonthStart = startOfMonth(today)
      thisMonthEnd = endOfDay(today)
      lastMonthStart = startOfMonth(subMonths(today, 1))
      lastMonthEndThisDay = endOfDay(
        setDate(subMonths(today, 1), Math.min(dayOfMonth, getDaysInMonth(subMonths(today, 1))))
      )
    }

    const currentYear = today.getFullYear()
    const completedWhereBase: Prisma.LeadWhereInput = { pipelineStage: 'COMPLETED', ...teamScope }

    const [ipdThisMonth, ipdByThisDayLastMonth, allCompletedThisYear] = await Promise.all([
      prisma.lead.count({
        where: {
          ...completedWhereBase,
          OR: [
            { conversionDate: { gte: thisMonthStart, lte: thisMonthEnd } },
            {
              AND: [
                { conversionDate: { equals: null } },
                { leadDate: { gte: thisMonthStart, lte: thisMonthEnd } },
              ],
            },
          ],
        },
      }),
      prisma.lead.count({
        where: {
          ...completedWhereBase,
          OR: [
            { conversionDate: { gte: lastMonthStart, lte: lastMonthEndThisDay } },
            {
              AND: [
                { conversionDate: { equals: null } },
                { leadDate: { gte: lastMonthStart, lte: lastMonthEndThisDay } },
              ],
            },
          ],
        },
      }),
      prisma.lead.findMany({
        where: {
          ...completedWhereBase,
          OR: [
            { conversionDate: { gte: new Date(currentYear, 0, 1), lte: today } },
            {
              AND: [
                { conversionDate: { equals: null } },
                { leadDate: { gte: new Date(currentYear, 0, 1), lte: today } },
              ],
            },
          ],
        },
        select: { conversionDate: true, leadDate: true, createdDate: true },
      }),
    ])

    const monthCounts = new Map<string, number>()
    const monthCountsUpToThisDay = new Map<string, number>()
    for (let m = 1; m <= 12; m++) {
      const monthStart = new Date(currentYear, m - 1, 1)
      const monthEnd = new Date(currentYear, m, 0, 23, 59, 59, 999)
      const thisDayInMonth = endOfDay(new Date(currentYear, m - 1, Math.min(dayOfMonth, getDaysInMonth(monthStart))))
      if (monthEnd > today) break
      monthCounts.set(String(m), 0)
      monthCountsUpToThisDay.set(String(m), 0)
    }
    allCompletedThisYear.forEach((lead) => {
      const d = lead.conversionDate ?? lead.leadDate ?? lead.createdDate
      if (d.getFullYear() !== currentYear) return
      const m = d.getMonth() + 1
      const key = String(m)
      monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1)
      const day = d.getDate()
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
