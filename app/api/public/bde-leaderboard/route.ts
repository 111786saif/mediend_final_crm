import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma, UserRole } from '@/generated/prisma/client'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { calculateActual } from '@/lib/analytics/target-progress'
import { canonicalSalesCompletedWhere } from '@/lib/analytics/ipd-filters'
import { headcountEmployeeWhere } from '@/lib/hrms/headcount'
import { startOfMonth, endOfMonth, startOfYear } from 'date-fns'

/**
 * GET /api/public/bde-leaderboard
 * Public route to fetch BDE rankings based on target achieved percentage.
 * Query params:
 *   - month: YYYY-MM (optional, default current month)
 *   - category: department/category name (optional, default "All")
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const monthParam = searchParams.get('month')
    const categoryParam = searchParams.get('category') || 'All'

    const now = new Date()
    let selectedMonth = now
    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split('-').map(Number)
      selectedMonth = new Date(y, m - 1, 1)
    }

    const monthStr = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`
    const periodStart = startOfMonth(selectedMonth)
    const periodEnd = endOfMonth(selectedMonth)

    const yearStart = startOfYear(selectedMonth)
    const yearEnd = periodEnd

    // 1. Fetch all active BD members and their departments
    const bdEmployees = await prisma.employee.findMany({
      where: {
        ...headcountEmployeeWhere,
        user: { role: { in: [UserRole.BD, UserRole.TEAM_LEAD, UserRole.ASSISTANT_CATEGORY_MANAGER] } },
      },
      select: {
        id: true,
        userId: true,
        employeeCode: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profilePicture: true,
            role: true,
          },
        },
      },
      orderBy: { user: { name: 'asc' } },
    })

    // 2. Fetch monthly targets for all BDs
    const monthlyTargets = await prisma.target.findMany({
      where: {
        targetType: 'BD',
        periodStartDate: { lte: periodEnd },
        periodEndDate: { gte: periodStart },
      },
      select: {
        targetForId: true,
        targetValue: true,
      },
    })

    const targetMap = new Map<string, number>()
    for (const t of monthlyTargets) {
      const cur = targetMap.get(t.targetForId) || 0
      targetMap.set(t.targetForId, cur + t.targetValue)
    }

    // 3. Extract unique categories/departments
    const categoriesSet = new Set<string>()
    for (const emp of bdEmployees) {
      const catName = emp.department?.name || 'General'
      categoriesSet.add(catName)
    }
    const categoriesList = ['All', ...Array.from(categoriesSet).sort((a, b) => a.localeCompare(b))]

    // 4. Calculate actuals, last IPD date, and target achievement for each BD member
    const allMembersData = await Promise.all(
      bdEmployees.map(async (emp) => {
        const userId = emp.userId
        const name = emp.user.name
        const profilePicture = emp.user.profilePicture
        const category = emp.department?.name || 'General'

        const targetValue = targetMap.get(userId) ?? 0
        const actual = await calculateActual(userId, 'IPD_DONE', periodStart, periodEnd)
        const annualActual = await calculateActual(userId, 'IPD_DONE', yearStart, yearEnd)

        // Find the date of the latest IPD done for this user in the period
        const completedWhere: Prisma.LeadWhereInput = {
          bdId: userId,
          ...canonicalSalesCompletedWhere({ gte: periodStart, lte: periodEnd }),
        }
        const latestLead = await prisma.lead.findFirst({
          where: completedWhere,
          select: {
            surgeryDate: true,
            admissionRecord: { select: { surgeryDate: true } },
            createdDate: true,
          },
          orderBy: [
            { surgeryDate: 'desc' },
            { createdDate: 'desc' },
          ],
        })

        const lastIpdDate = latestLead
          ? (latestLead.surgeryDate || latestLead.admissionRecord?.surgeryDate || latestLead.createdDate || null)
          : null

        const percentage = targetValue > 0 ? Math.round((actual / targetValue) * 100 * 10) / 10 : 0

        return {
          id: emp.id,
          userId,
          name,
          profilePicture,
          category,
          targetValue,
          actual,
          percentage,
          annualActual,
          lastIpdTime: lastIpdDate ? new Date(lastIpdDate).getTime() : Infinity,
        }
      })
    )

    // Filter by selected category if provided (case-insensitive check for ALL)
    const normalizedCat = (categoryParam || 'ALL').toUpperCase()
    const filteredMembers = normalizedCat !== 'ALL'
      ? allMembersData.filter((m) => m.category.toUpperCase() === normalizedCat)
      : allMembersData

    // 5. Rank by target achieved percentage (descending), then earliest last IPD done (ascending timestamp tie-breaker), then actual IPD done (descending)
    const sortedByMonthly = [...filteredMembers].sort((a, b) => {
      if (b.percentage !== a.percentage) {
        return b.percentage - a.percentage
      }
      if (a.lastIpdTime !== b.lastIpdTime) {
        return a.lastIpdTime - b.lastIpdTime
      }
      return b.actual - a.actual
    })

    const monthlyRankings = sortedByMonthly.map((m, idx) => {
      const { lastIpdTime, ...rest } = m
      return {
        ...rest,
        rank: idx + 1,
      }
    })

    // 6. Annual YTD Rankings (sorted by annual IPD done)
    const sortedByAnnual = [...filteredMembers].sort((a, b) => b.annualActual - a.annualActual)
    const annualRankings = sortedByAnnual.map((m, idx) => ({
      ...m,
      rank: idx + 1,
    }))

    // Only populate monthly podium if there is actual progress (>0 percentage or >0 actual)
    const hasMonthlyProgress = sortedByMonthly.some(
      (m) => m.percentage > 0 || m.actual > 0
    )

    const monthlyTopThree = {
      first: hasMonthlyProgress ? monthlyRankings[0] || null : null,
      second: hasMonthlyProgress && (monthlyRankings[1]?.percentage > 0 || monthlyRankings[1]?.actual > 0) ? monthlyRankings[1] : null,
      third: hasMonthlyProgress && (monthlyRankings[2]?.percentage > 0 || monthlyRankings[2]?.actual > 0) ? monthlyRankings[2] : null,
    }

    return successResponse({
      month: monthStr,
      category: categoryParam,
      categories: categoriesList,
      monthlyTopThree,
      rankings: monthlyRankings,
    })
  } catch (error) {
    console.error('Error fetching public BDE leaderboard:', error)
    return errorResponse('Failed to fetch BDE leaderboard', 500)
  }
}
