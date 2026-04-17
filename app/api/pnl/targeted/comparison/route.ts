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
    case 'SURGERY': return 'Surgery'
    case 'IT': return 'IT'
    case 'LOAN_DEMAT': return 'Loan & Demat'
    case 'GOOGLE_ADS': return 'Google Ads'
    default: return deptKey
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

    await ensureDefaultPnLCategories()

    // ── Fetch targeted entries ──
    const targetEntries = await prisma.targetPnLEntry.findMany({
      where: {
        OR: months.map((my) => ({ AND: [{ month: my.month }, { year: my.year }] })),
      },
    })

    const targetMap = new Map<string, number>()
    for (const e of targetEntries) {
      targetMap.set(`${e.departmentKey}-${e.sourceKey}-${e.year}-${e.month}`, e.amount)
    }

    // ── Compute actual PnL data (same logic as overview route) ──
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

    const actualRevenueMap: Record<PnlDepartmentKey, Map<string, number>> = {
      SURGERY: surgeryRevenue,
      IT: itRev,
      LOAN_DEMAT: loanRev,
      GOOGLE_ADS: adsRev,
    }

    // Fetch actual expense entries from PnLEntry
    const categories = await prisma.pnLCategory.findMany({
      where: { isActive: true, type: 'EXPENSE' },
    })

    const actualExpenseEntries = await prisma.pnLEntry.findMany({
      where: {
        category: { type: 'EXPENSE', isActive: true },
        OR: months.map((my) => ({ AND: [{ month: my.month }, { year: my.year }] })),
      },
      include: { category: true },
    })

    // Build actual expense lookup
    function getActualExpense(deptKey: string, srcKey: string, monthKey: string): number {
      const [ys, ms] = monthKey.split('-').map(Number)

      // Find the matching category
      const cat = categories.find(
        (c) => c.departmentKey === deptKey && c.sourceKey === srcKey
      )
      if (!cat) {
        // No category — use auto-fill hint
        if (srcKey === 'SEAT_COST') return seatHintsByDept[deptKey as PnlDepartmentKey]?.[monthKey] ?? 0
        if (srcKey === 'SALARY' && deptKey === 'IT') return itSalaryHint.get(monthKey) || 0
        if (srcKey === 'MARKETING' && deptKey === 'SURGERY') return marketingHint.get(monthKey) || 0
        return 0
      }

      // Check for manual entry
      const entry = actualExpenseEntries.find(
        (e) => e.categoryId === cat.id && e.month === ms && e.year === ys
      )
      if (entry && !entry.isAutoFilled) return entry.amount

      // Auto-fill hints
      if (srcKey === 'SEAT_COST') return seatHintsByDept[deptKey as PnlDepartmentKey]?.[monthKey] ?? 0
      if (srcKey === 'SALARY' && deptKey === 'IT') return itSalaryHint.get(monthKey) || 0
      if (srcKey === 'MARKETING' && deptKey === 'SURGERY') return marketingHint.get(monthKey) || 0

      return entry?.amount ?? 0
    }

    function variancePct(targeted: number, actual: number): number {
      if (targeted === 0) return actual === 0 ? 0 : 100
      return ((actual - targeted) / Math.abs(targeted)) * 100
    }

    let totalTargetedRevenue = 0
    let totalActualRevenue = 0
    let totalTargetedExpenses = 0
    let totalActualExpenses = 0

    const departments = PNL_DEPARTMENT_KEYS.map((deptKey) => {
      const revTargeted: Record<string, number> = {}
      const revActual: Record<string, number> = {}
      const revVariance: Record<string, number> = {}
      const revVariancePct: Record<string, number> = {}
      let revTotalTargeted = 0
      let revTotalActual = 0

      for (const k of monthKeys) {
        const targeted = targetMap.get(`${deptKey}-REVENUE-${k}`) ?? 0
        const actual = actualRevenueMap[deptKey]?.get(k) || 0
        revTargeted[k] = targeted
        revActual[k] = actual
        revVariance[k] = actual - targeted
        revVariancePct[k] = variancePct(targeted, actual)
        revTotalTargeted += targeted
        revTotalActual += actual
      }

      totalTargetedRevenue += revTotalTargeted
      totalActualRevenue += revTotalActual

      const expenses = PNL_EXPENSE_SOURCE_KEYS.map((srcKey) => {
        const targeted: Record<string, number> = {}
        const actual: Record<string, number> = {}
        const variance: Record<string, number> = {}
        const vPct: Record<string, number> = {}
        let expTotalTargeted = 0
        let expTotalActual = 0

        for (const k of monthKeys) {
          const t = targetMap.get(`${deptKey}-${srcKey}-${k}`) ?? 0
          const a = getActualExpense(deptKey, srcKey, k)
          targeted[k] = t
          actual[k] = a
          variance[k] = a - t
          vPct[k] = variancePct(t, a)
          expTotalTargeted += t
          expTotalActual += a
        }

        totalTargetedExpenses += expTotalTargeted
        totalActualExpenses += expTotalActual

        return {
          sourceKey: srcKey,
          name: EXPENSE_DISPLAY_NAMES[srcKey] || srcKey,
          targeted,
          actual,
          variance,
          variancePct: vPct,
          totalTargeted: expTotalTargeted,
          totalActual: expTotalActual,
          totalVariance: expTotalActual - expTotalTargeted,
          totalVariancePct: variancePct(expTotalTargeted, expTotalActual),
        }
      })

      // Net PnL
      const netTargeted: Record<string, number> = {}
      const netActual: Record<string, number> = {}
      const netVariance: Record<string, number> = {}
      let netTotalTargeted = 0
      let netTotalActual = 0

      for (const k of monthKeys) {
        const tRev = revTargeted[k]
        const tExp = expenses.reduce((s, e) => s + e.targeted[k], 0)
        const aRev = revActual[k]
        const aExp = expenses.reduce((s, e) => s + e.actual[k], 0)
        netTargeted[k] = tRev - tExp
        netActual[k] = aRev - aExp
        netVariance[k] = (aRev - aExp) - (tRev - tExp)
        netTotalTargeted += tRev - tExp
        netTotalActual += aRev - aExp
      }

      return {
        key: deptKey,
        name: deptDisplayName(deptKey),
        revenue: {
          sourceKey: 'REVENUE',
          name: 'Revenue',
          targeted: revTargeted,
          actual: revActual,
          variance: revVariance,
          variancePct: revVariancePct,
          totalTargeted: revTotalTargeted,
          totalActual: revTotalActual,
          totalVariance: revTotalActual - revTotalTargeted,
          totalVariancePct: variancePct(revTotalTargeted, revTotalActual),
        },
        expenses,
        net: {
          targeted: netTargeted,
          actual: netActual,
          variance: netVariance,
          totalTargeted: netTotalTargeted,
          totalActual: netTotalActual,
          totalVariance: netTotalActual - netTotalTargeted,
        },
      }
    })

    return successResponse({
      months,
      monthKeys,
      departments,
      totals: {
        targetedRevenue: totalTargetedRevenue,
        actualRevenue: totalActualRevenue,
        targetedExpenses: totalTargetedExpenses,
        actualExpenses: totalActualExpenses,
        targetedNet: totalTargetedRevenue - totalTargetedExpenses,
        actualNet: totalActualRevenue - totalActualExpenses,
      },
    })
  } catch (error) {
    console.error('Error building targeted vs actual comparison:', error)
    return errorResponse('Failed to load comparison', 500)
  }
}
