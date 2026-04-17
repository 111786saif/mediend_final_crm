import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canReadPnl } from '@/lib/pnl/auth-pnl'
import {
  departmentRevenueByMonth,
  expandMonthRange,
  itRevenueByMonth,
  itSalaryHintByMonth,
  surgeryRevenueByMonth,
} from '@/lib/pnl/aggregate-revenue'
import { marketingSpendByMonth } from '@/lib/pnl/daily-spend-aggregator'
import { getSeatCostPerEmployee } from '@/lib/pnl/pnl-config'
import {
  buildSeatCostHintsByMonth,
  getEmployeeCountByPnlDepartment,
} from '@/lib/pnl/seat-cost'
import { PNL_DEPARTMENT_KEYS, PNL_EXPENSE_SOURCE_KEYS, type PnlDepartmentKey } from '@/lib/pnl/constants'

const EXPENSE_DISPLAY_NAMES: Record<string, string> = {
  SALARY: 'Salary',
  SEAT_COST: 'Seat Cost',
  MARKETING: 'Marketing',
  FREELANCERS: 'Freelancers',
  MISC: 'Miscellaneous',
}

function deptDisplayName(deptKey: PnlDepartmentKey): string {
  switch (deptKey) {
    case 'SURGERY':
      return 'Surgery'
    case 'IT':
      return 'IT'
    case 'LOAN_DEMAT':
      return 'Loan & Demat'
    case 'GOOGLE_ADS':
      return 'Google Ads'
    default:
      return deptKey
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canReadPnl(user)) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const startMonth = parseInt(searchParams.get('startMonth') || String(new Date().getMonth() + 1), 10)
    const startYear = parseInt(searchParams.get('startYear') || String(new Date().getFullYear()), 10)
    const endMonth = parseInt(searchParams.get('endMonth') || String(startMonth), 10)
    const endYear = parseInt(searchParams.get('endYear') || String(startYear), 10)

    const months = expandMonthRange(startMonth, startYear, endMonth, endYear)
    const monthKeys = months.map((m) => `${m.year}-${m.month}`)

    // Fetch saved target entries
    const targetEntries = await prisma.targetPnLEntry.findMany({
      where: {
        OR: months.map((my) => ({ AND: [{ month: my.month }, { year: my.year }] })),
      },
    })

    // Build lookup: "SURGERY-REVENUE-2026-4" -> amount
    const savedMap = new Map<string, number>()
    const savedKeys: string[] = []
    for (const e of targetEntries) {
      const key = `${e.departmentKey}-${e.sourceKey}-${e.year}-${e.month}`
      savedMap.set(key, e.amount)
      savedKeys.push(key)
    }

    // Compute hints from actual data (same as regular PnL overview)
    const [surgeryRevenue, itRev, loanRev, adsRev, itSalaryHint, marketingHint] = await Promise.all([
      surgeryRevenueByMonth(months),
      itRevenueByMonth(months),
      departmentRevenueByMonth('LOAN_DEMAT', months),
      departmentRevenueByMonth('GOOGLE_ADS', months),
      itSalaryHintByMonth(months),
      marketingSpendByMonth(months),
    ])

    const seatCostPerEmployee = await getSeatCostPerEmployee()
    const headcountByDept = await getEmployeeCountByPnlDepartment()
    const seatHintsByDept = buildSeatCostHintsByMonth(months, headcountByDept, seatCostPerEmployee)

    const revenueHintMap: Record<PnlDepartmentKey, Map<string, number>> = {
      SURGERY: surgeryRevenue,
      IT: itRev,
      LOAN_DEMAT: loanRev,
      GOOGLE_ADS: adsRev,
    }

    let grandTotalRevenue = 0
    let grandTotalExpenses = 0

    const departments = PNL_DEPARTMENT_KEYS.map((deptKey) => {
      const revenueByMonth: Record<string, number> = {}
      const revenueHints: Record<string, number> = {}
      let totalRevenue = 0
      let totalExpenses = 0

      for (const k of monthKeys) {
        const revHint = revenueHintMap[deptKey]?.get(k) || 0
        revenueHints[k] = revHint
        const savedKey = `${deptKey}-REVENUE-${k}`
        const rev = savedMap.has(savedKey) ? savedMap.get(savedKey)! : revHint
        revenueByMonth[k] = rev
        totalRevenue += rev
      }

      const expenseCategories = PNL_EXPENSE_SOURCE_KEYS.map((srcKey) => {
        const amounts: Record<string, number> = {}
        const hints: Record<string, number> = {}

        for (const k of monthKeys) {
          // Compute hint for this expense category
          let hint = 0
          if (srcKey === 'SEAT_COST') {
            hint = seatHintsByDept[deptKey]?.[k] ?? 0
          } else if (srcKey === 'SALARY' && deptKey === 'IT') {
            hint = itSalaryHint.get(k) || 0
          } else if (srcKey === 'MARKETING' && deptKey === 'SURGERY') {
            hint = marketingHint.get(k) || 0
          }
          hints[k] = hint

          const savedKey = `${deptKey}-${srcKey}-${k}`
          const amt = savedMap.has(savedKey) ? savedMap.get(savedKey)! : hint
          amounts[k] = amt
          totalExpenses += amt
        }

        return {
          sourceKey: srcKey,
          name: EXPENSE_DISPLAY_NAMES[srcKey] || srcKey,
          amounts,
          hints,
        }
      })

      grandTotalRevenue += totalRevenue
      grandTotalExpenses += totalExpenses

      return {
        key: deptKey,
        name: deptDisplayName(deptKey),
        revenueByMonth,
        revenueHints,
        expenseCategories,
        totalRevenue,
        totalExpenses,
        netPnL: totalRevenue - totalExpenses,
      }
    })

    return successResponse({
      months,
      monthKeys,
      departments,
      totals: {
        totalRevenue: grandTotalRevenue,
        totalExpenses: grandTotalExpenses,
        netPnL: grandTotalRevenue - grandTotalExpenses,
      },
      savedKeys,
    })
  } catch (error) {
    console.error('Error building targeted PnL overview:', error)
    return errorResponse('Failed to load targeted overview', 500)
  }
}
