import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { incentiveInclude, mapIncentiveRecord } from '@/lib/incentives/mapper'

/**
 * GET /api/incentives/me?month=&year=
 *
 * Self-scoped incentive lookup — deliberately separate from GET /api/incentives,
 * which requires the admin-tier `incentive:read` permission and returns every
 * employee's records. This route requires no special permission because it can
 * only ever return the calling user's own row (looked up via their Employee
 * record), so there's no cross-employee data exposure.
 *
 * Defaults to the current calendar month/year if not provided. Used by the
 * Score Card on the Home page to show the official, finance-approved/paid
 * incentive amount for BD/Team Lead once it's been entered — alongside the
 * live/projected estimate computed from BonusRules, which is always available
 * even before Finance has recorded anything.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const now = new Date()
    const month = Number(searchParams.get('month')) || now.getMonth() + 1
    const year = Number(searchParams.get('year')) || now.getFullYear()

    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })

    if (!employee) {
      // No employee record linked to this user — nothing to show, not an error.
      return successResponse({ record: null })
    }

    const record = await prisma.employeeMonthlyIncentive.findUnique({
      where: {
        employeeId_month_year: {
          employeeId: employee.id,
          month,
          year,
        },
      },
      include: incentiveInclude,
    })

    return successResponse({ record: record ? mapIncentiveRecord(record) : null })
  } catch (error) {
    console.error('Error fetching own incentive:', error)
    const message =
      error instanceof Error && error.message.includes('employeeMonthlyIncentive')
        ? 'Incentive model not loaded. Restart the dev server after running npx prisma generate.'
        : 'Failed to fetch incentive'
    return errorResponse(message, 500)
  }
}