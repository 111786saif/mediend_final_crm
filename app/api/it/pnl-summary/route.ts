import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canReadItPnl } from '@/lib/pnl/auth-it-pnl'
import { monthlyCostForResource } from '@/lib/pnl/it-resource-cost'
import { getSeatCostPerEmployee } from '@/lib/pnl/pnl-config'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canReadItPnl(user)) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const startMonth = parseInt(searchParams.get('startMonth') || String(new Date().getMonth() + 1), 10)
    const startYear = parseInt(searchParams.get('startYear') || String(new Date().getFullYear()), 10)
    const endMonth = parseInt(searchParams.get('endMonth') || String(startMonth), 10)
    const endYear = parseInt(searchParams.get('endYear') || String(startYear), 10)

    const seatCostPerEmployee = await getSeatCostPerEmployee()

    const projects = await prisma.iTProject.findMany({
      include: {
        resources: {
          include: {
            employee: { select: { salary: true } },
            freelancer: true,
          },
        },
        bookings: true,
      },
    })

    type MonthKey = string
    const monthKeys: MonthKey[] = []
    let y = startYear
    let m = startMonth
    while (y < endYear || (y === endYear && m <= endMonth)) {
      monthKeys.push(`${y}-${m}`)
      m += 1
      if (m > 12) {
        m = 1
        y += 1
      }
    }

    const byProject: {
      projectId: string
      name: string
      clientName: string | null
      status: string
      monthly: Record<
        MonthKey,
        { revenue: number; cost: number; net: number }
      >
    }[] = []

    let totalRevenue = 0
    let totalCost = 0

    for (const p of projects) {
      const monthly: Record<MonthKey, { revenue: number; cost: number; net: number }> = {}
      for (const key of monthKeys) {
        const [ys, ms] = key.split('-').map(Number)
        let revenue = 0
        p.bookings.forEach((b) => {
          if (b.year === ys && b.month === ms) revenue += b.amount || 0
        })

        let cost = 0
        for (const r of p.resources) {
          const costInput = {
            resourceType: r.resourceType,
            allocationPercent: r.allocationPercent,
            paymentType: r.paymentType,
            monthlyCost: r.monthlyCost,
            oneTimeCost: r.oneTimeCost,
            startDate: r.startDate,
            endDate: r.endDate,
            isActive: r.isActive,
            employeeSalary: r.employee?.salary ?? null,
            seatCostApplied: r.seatCostApplied ?? false,
          }
          cost += monthlyCostForResource(costInput, ms, ys, seatCostPerEmployee)
        }

        monthly[key] = { revenue, cost, net: revenue - cost }
        totalRevenue += revenue
        totalCost += cost
      }

      byProject.push({
        projectId: p.id,
        name: p.name,
        clientName: p.clientName,
        status: p.status,
        monthly,
      })
    }

    const chartSeries = monthKeys.map((key) => {
      const [ys, ms] = key.split('-').map(Number)
      let rev = 0
      let c = 0
      for (const p of projects) {
        p.bookings.forEach((b) => {
          if (b.year === ys && b.month === ms) rev += b.amount || 0
        })
        for (const r of p.resources) {
          c += monthlyCostForResource(
            {
              resourceType: r.resourceType,
              allocationPercent: r.allocationPercent,
              paymentType: r.paymentType,
              monthlyCost: r.monthlyCost,
              oneTimeCost: r.oneTimeCost,
              startDate: r.startDate,
              endDate: r.endDate,
              isActive: r.isActive,
              employeeSalary: r.employee?.salary ?? null,
              seatCostApplied: r.seatCostApplied ?? false,
            },
            ms,
            ys,
            seatCostPerEmployee
          )
        }
      }
      return { monthKey: key, month: ms, year: ys, revenue: rev, cost: c, net: rev - c }
    })

    /** IT salary pre-calc (sum of salaried resource costs) per month — for Finance P&L hint */
    const itSalaryByMonth: Record<MonthKey, number> = {}
    for (const key of monthKeys) {
      const [ys, ms] = key.split('-').map(Number)
      let s = 0
      for (const p of projects) {
        for (const r of p.resources) {
          if (r.resourceType !== 'SALARIED') continue
          s += monthlyCostForResource(
            {
              resourceType: r.resourceType,
              allocationPercent: r.allocationPercent,
              paymentType: r.paymentType,
              monthlyCost: r.monthlyCost,
              oneTimeCost: r.oneTimeCost,
              startDate: r.startDate,
              endDate: r.endDate,
              isActive: r.isActive,
              employeeSalary: r.employee?.salary ?? null,
              seatCostApplied: r.seatCostApplied ?? false,
            },
            ms,
            ys,
            seatCostPerEmployee
          )
        }
      }
      itSalaryByMonth[key] = s
    }

    return successResponse({
      startMonth,
      startYear,
      endMonth,
      endYear,
      monthKeys,
      totalRevenue,
      totalCost,
      netProfit: totalRevenue - totalCost,
      projects: byProject,
      chartSeries,
      itSalaryByMonth,
    })
  } catch (error) {
    console.error('Error fetching IT P&L summary:', error)
    return errorResponse('Failed to fetch IT P&L summary', 500)
  }
}
