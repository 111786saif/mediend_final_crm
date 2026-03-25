import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canReadPnl } from '@/lib/pnl/auth-pnl'
import { ensureDefaultPnLCategories } from '@/lib/pnl/ensure-default-categories'
import {
  departmentRevenueByMonth,
  expandMonthRange,
  itRevenueByMonth,
  itSalaryHintByMonth,
  surgeryRevenueByMonth,
} from '@/lib/pnl/aggregate-revenue'
import { getSeatCostPerEmployee } from '@/lib/pnl/pnl-config'
import {
  buildSeatCostHintsByMonth,
  getEmployeeCountByPnlDepartment,
} from '@/lib/pnl/seat-cost'
import { PNL_DEPARTMENT_KEYS, type PnlDepartmentKey } from '@/lib/pnl/constants'

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

    await ensureDefaultPnLCategories()

    const months = expandMonthRange(startMonth, startYear, endMonth, endYear)
    const monthKeys = months.map((m) => `${m.year}-${m.month}`)

    const surgeryRevenue = await surgeryRevenueByMonth(months)
    const itRev = await itRevenueByMonth(months)
    const loanRev = await departmentRevenueByMonth('LOAN_DEMAT', months)
    const adsRev = await departmentRevenueByMonth('GOOGLE_ADS', months)
    const itSalaryHint = await itSalaryHintByMonth(months)

    const seatCostPerEmployee = await getSeatCostPerEmployee()
    const headcountByDept = await getEmployeeCountByPnlDepartment()
    const seatHintsByDept = buildSeatCostHintsByMonth(months, headcountByDept, seatCostPerEmployee)

    const categories = await prisma.pnLCategory.findMany({
      where: { isActive: true },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }],
    })

    const entries = await prisma.pnLEntry.findMany({
      where: {
        OR: months.map((my) => ({ AND: [{ month: my.month }, { year: my.year }] })),
      },
      include: { category: true },
    })

    function amountForCategoryMonth(
      cat: (typeof categories)[0],
      k: string,
      my: { month: number; year: number }
    ): { amount: number; auto: boolean } {
      const row = entries.find((e) => e.categoryId === cat.id && e.month === my.month && e.year === my.year)

      if (cat.type === 'REVENUE') {
        if (cat.sourceKey === 'SURGERY') {
          if (row && !row.isAutoFilled) return { amount: row.amount, auto: false }
          return { amount: surgeryRevenue.get(k) || 0, auto: true }
        }
        if (cat.sourceKey === 'IT') {
          if (row && !row.isAutoFilled) return { amount: row.amount, auto: false }
          return { amount: itRev.get(k) || 0, auto: true }
        }
        if (cat.sourceKey === 'LOAN_DEMAT') {
          if (row && !row.isAutoFilled) return { amount: row.amount, auto: false }
          return { amount: loanRev.get(k) || 0, auto: true }
        }
        if (cat.sourceKey === 'GOOGLE_ADS') {
          if (row && !row.isAutoFilled) return { amount: row.amount, auto: false }
          return { amount: adsRev.get(k) || 0, auto: true }
        }
        if (!cat.sourceKey) {
          return { amount: row?.amount ?? 0, auto: row?.isAutoFilled ?? false }
        }
        return { amount: row?.amount ?? 0, auto: row?.isAutoFilled ?? false }
      }

      // EXPENSE
      if (row && !row.isAutoFilled) {
        return { amount: row.amount, auto: false }
      }

      if (cat.sourceKey === 'SALARY' && cat.departmentKey === 'IT') {
        return { amount: itSalaryHint.get(k) || 0, auto: true }
      }
      if (cat.sourceKey === 'SEAT_COST' && cat.departmentKey) {
        const dk = cat.departmentKey as PnlDepartmentKey
        const hint = seatHintsByDept[dk]?.[k] ?? 0
        return { amount: hint, auto: true }
      }

      return { amount: row?.amount ?? 0, auto: row?.isAutoFilled ?? false }
    }

    const categoryRows: {
      categoryId: string
      name: string
      type: string
      sourceKey: string | null
      departmentKey: string | null
      isSystem: boolean
      amounts: Record<string, number>
      isAutoFilled: Record<string, boolean>
    }[] = []

    let totalRevenue = 0
    let totalExpenses = 0

    for (const c of categories) {
      const amounts: Record<string, number> = {}
      const isAutoFilled: Record<string, boolean> = {}
      for (const my of months) {
        const k = `${my.year}-${my.month}`
        const { amount, auto } = amountForCategoryMonth(c, k, my)
        amounts[k] = amount
        isAutoFilled[k] = auto
        if (c.type === 'REVENUE') totalRevenue += amount
        else totalExpenses += amount
      }
      categoryRows.push({
        categoryId: c.id,
        name: c.name,
        type: c.type,
        sourceKey: c.sourceKey,
        departmentKey: c.departmentKey,
        isSystem: c.isSystem,
        amounts,
        isAutoFilled,
      })
    }

    const chartSeries = monthKeys.map((k) => {
      const [ys, ms] = k.split('-').map(Number)
      let rev = 0
      rev += surgeryRevenue.get(k) || 0
      rev += itRev.get(k) || 0
      rev += loanRev.get(k) || 0
      rev += adsRev.get(k) || 0

      let exp = 0
      for (const c of categories.filter((x) => x.type === 'EXPENSE')) {
        const my = months.find((m) => `${m.year}-${m.month}` === k)!
        const { amount } = amountForCategoryMonth(c, k, my)
        exp += amount
      }

      return {
        monthKey: k,
        month: ms,
        year: ys,
        revenue: rev,
        expenses: exp,
        net: rev - exp,
      }
    })

    const itSalaryHintRow = Object.fromEntries(monthKeys.map((k) => [k, itSalaryHint.get(k) || 0]))

    const revenueByDeptKey = (key: PnlDepartmentKey): Map<string, number> => {
      switch (key) {
        case 'SURGERY':
          return surgeryRevenue
        case 'IT':
          return itRev
        case 'LOAN_DEMAT':
          return loanRev
        case 'GOOGLE_ADS':
          return adsRev
        default:
          return new Map()
      }
    }

    const departments = PNL_DEPARTMENT_KEYS.map((deptKey) => {
      const revMap = revenueByDeptKey(deptKey)
      const revenueByMonth: Record<string, number> = {}
      const expensesByMonth: Record<string, number> = {}
      const netByMonth: Record<string, number> = {}

      let totalRev = 0
      let totalExp = 0

      for (const my of months) {
        const k = `${my.year}-${my.month}`
        const rev = revMap.get(k) || 0
        revenueByMonth[k] = rev
        totalRev += rev

        let expSum = 0
        for (const c of categories) {
          if (c.type !== 'EXPENSE' || c.departmentKey !== deptKey) continue
          const { amount } = amountForCategoryMonth(c, k, my)
          expSum += amount
        }
        expensesByMonth[k] = expSum
        totalExp += expSum
        netByMonth[k] = rev - expSum
      }

      const expenseCats = categories.filter((c) => c.type === 'EXPENSE' && c.departmentKey === deptKey)

      const expenseCategories = expenseCats.map((c) => {
        const amounts: Record<string, number> = {}
        const isAutoFilled: Record<string, boolean> = {}
        const seatCostHint: Record<string, number> = {}
        const salaryHint: Record<string, number> = {}

        for (const my of months) {
          const k = `${my.year}-${my.month}`
          const { amount, auto } = amountForCategoryMonth(c, k, my)
          amounts[k] = amount
          isAutoFilled[k] = auto
          if (c.sourceKey === 'SEAT_COST') {
            seatCostHint[k] = seatHintsByDept[deptKey]?.[k] ?? 0
          }
          if (c.sourceKey === 'SALARY' && deptKey === 'IT') {
            salaryHint[k] = itSalaryHint.get(k) || 0
          }
        }

        return {
          categoryId: c.id,
          name: c.name,
          sourceKey: c.sourceKey,
          departmentKey: c.departmentKey,
          isSystem: c.isSystem,
          amounts,
          isAutoFilled,
          seatCostHint: c.sourceKey === 'SEAT_COST' ? seatCostHint : undefined,
          salaryHint: c.sourceKey === 'SALARY' && deptKey === 'IT' ? salaryHint : undefined,
        }
      })

      return {
        key: deptKey,
        name: deptDisplayName(deptKey),
        revenueByMonth,
        expensesByMonth,
        netByMonth,
        totalRevenue: totalRev,
        totalExpenses: totalExp,
        netPnL: totalRev - totalExp,
        marginPct: totalRev > 0 ? ((totalRev - totalExp) / totalRev) * 100 : 0,
        headcount: headcountByDept[deptKey],
        expenseCategories,
      }
    })

    const revenueCategories = categoryRows.filter((c) => c.type === 'REVENUE')

    return successResponse({
      months,
      monthKeys,
      categories: categoryRows,
      revenueCategories,
      departments,
      revenueByDepartment: {
        SURGERY: Object.fromEntries(monthKeys.map((k) => [k, surgeryRevenue.get(k) || 0])),
        IT: Object.fromEntries(monthKeys.map((k) => [k, itRev.get(k) || 0])),
        LOAN_DEMAT: Object.fromEntries(monthKeys.map((k) => [k, loanRev.get(k) || 0])),
        GOOGLE_ADS: Object.fromEntries(monthKeys.map((k) => [k, adsRev.get(k) || 0])),
      },
      itSalaryHintByMonth: itSalaryHintRow,
      seatCostPerEmployee,
      headcountByDepartment: headcountByDept,
      seatCostHintsByDepartment: seatHintsByDept,
      totals: {
        totalRevenue,
        totalExpenses,
        netPnL: totalRevenue - totalExpenses,
      },
      chartSeries,
    })
  } catch (error) {
    console.error('Error building PnL overview:', error)
    return errorResponse('Failed to load overview', 500)
  }
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
