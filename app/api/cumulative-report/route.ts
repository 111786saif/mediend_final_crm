import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  buildConcernCategoryReport,
  buildCumulativeSurgeryLeadWhereForYear,
  buildPatientSummaryForYear,
} from '@/lib/cumulative-report-monthly'

function parseYear(searchParams: URLSearchParams): number {
  const yearParam = searchParams.get('year')
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()
  if (!Number.isFinite(year) || year < 2000 || year > 3000) {
    throw new Error('Invalid year')
  }
  return year
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'compliance:read')) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const year = parseYear(searchParams)
    const surgeryWhere = buildCumulativeSurgeryLeadWhereForYear(year)
    const start = new Date(year, 0, 1)
    const end = new Date(year + 1, 0, 1)

    const [surgeryLeads, concernCalls] = await Promise.all([
      prisma.lead.findMany({
        where: surgeryWhere,
        select: {
          surgeryDate: true,
          complianceCall: {
            select: {
              status: true,
              satisfaction: true,
            },
          },
        },
      }),
      prisma.complianceCall.findMany({
        where: {
          lead: {
            surgeryDate: { gte: start, lt: end },
          },
        },
        select: {
          satisfaction: true,
          concernCategories: true,
          lead: { select: { surgeryDate: true } },
        },
      }),
    ])

    const patientSummary = buildPatientSummaryForYear(surgeryLeads, year)
    const concernCategory = buildConcernCategoryReport(concernCalls, year)

    return successResponse({
      year,
      patientSummary,
      concernCategory,
    })
  } catch (error) {
    console.error('Error fetching cumulative report:', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to fetch cumulative report',
      500,
    )
  }
}
