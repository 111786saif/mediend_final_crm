import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canReadPnl } from '@/lib/pnl/auth-pnl'
import {
  departmentRevenueByMonth,
  expandMonthRange,
  itRevenueByMonth,
  surgeryRevenueByMonth,
} from '@/lib/pnl/aggregate-revenue'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ dept: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canReadPnl(user)) return errorResponse('Forbidden', 403)

    const { dept } = await context.params
    const { searchParams } = new URL(request.url)
    const startMonth = parseInt(searchParams.get('startMonth') || '1', 10)
    const startYear = parseInt(searchParams.get('startYear') || String(new Date().getFullYear()), 10)
    const endMonth = parseInt(searchParams.get('endMonth') || String(startMonth), 10)
    const endYear = parseInt(searchParams.get('endYear') || String(startYear), 10)

    const months = expandMonthRange(startMonth, startYear, endMonth, endYear)

    switch (dept) {
      case 'surgery': {
        const m = await surgeryRevenueByMonth(months)
        const total = Array.from(m.values()).reduce((a, b) => a + b, 0)
        return successResponse({ department: 'surgery', months, totalsByMonth: Object.fromEntries(m), total })
      }
      case 'it': {
        const projects = await prisma.iTProject.findMany({
          include: {
            _count: { select: { resources: true } },
            bookings: true,
          },
        })
        const revMap = await itRevenueByMonth(months)
        return successResponse({
          department: 'it',
          projects,
          totalsByMonth: Object.fromEntries(revMap),
          total: Array.from(revMap.values()).reduce((a, b) => a + b, 0),
        })
      }
      case 'loan-demat': {
        const m = await departmentRevenueByMonth('LOAN_DEMAT', months)
        return successResponse({
          department: 'loan-demat',
          months,
          totalsByMonth: Object.fromEntries(m),
          total: Array.from(m.values()).reduce((a, b) => a + b, 0),
        })
      }
      case 'google-ads': {
        const m = await departmentRevenueByMonth('GOOGLE_ADS', months)
        return successResponse({
          department: 'google-ads',
          months,
          totalsByMonth: Object.fromEntries(m),
          total: Array.from(m.values()).reduce((a, b) => a + b, 0),
        })
      }
      default:
        return errorResponse('Unknown department', 400)
    }
  } catch (error) {
    console.error('Error loading department PnL:', error)
    return errorResponse('Failed to load', 500)
  }
}
