import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canonicalSalesCompletedWhere, buildDateRange } from '@/lib/analytics/ipd-filters'

function buildLeadDateWhere(
  dateField: 'admission' | 'surgery' | 'discharge',
  range: Prisma.DateTimeFilter,
): Prisma.LeadWhereInput {
  if (dateField === 'admission') {
    return {
      admissionRecord: {
        is: {
          admissionDate: range,
        },
      },
    }
  }

  if (dateField === 'discharge') {
    return {
      dischargeSheet: {
        is: {
          dischargeDate: range,
        },
      },
    }
  }

  return { surgeryDate: range }
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'leads:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const range = buildDateRange(startDate, endDate)
    const dateWhere = Object.keys(range).length > 0 ? range : undefined
    if (!dateWhere) {
      return successResponse({
        admitted: 0,
        surgeryScheduled: 0,
        ipdDone: 0,
        discharged: 0,
        postponed: 0,
        cancelled: 0,
        posted: 0,
      })
    }

    const [admitted, surgeryScheduled, ipdDone, discharged, postponed, cancelled, posted] = await Promise.all([
      prisma.lead.count({
        where: {
          caseStage: 'ADMITTED',
          ...buildLeadDateWhere('admission', dateWhere),
        },
      }),
      prisma.lead.count({
        where: {
          caseStage: { in: ['PREAUTH_COMPLETE', 'INITIATED'] },
          ...buildLeadDateWhere('surgery', dateWhere),
        },
      }),
      prisma.lead.count({
        where: canonicalSalesCompletedWhere(dateWhere),
      }),
      prisma.lead.count({
        where: {
          caseStage: { in: ['DISCHARGED', 'CASH_DISCHARGED'] },
          ...buildLeadDateWhere('discharge', dateWhere),
        },
      }),
      prisma.lead.count({
        where: {
          admissionRecord: {
            ipdStatus: 'POSTPONED',
          },
          ...buildLeadDateWhere('surgery', dateWhere),
        },
      }),
      prisma.lead.count({
        where: {
          admissionRecord: {
            ipdStatus: 'CANCELLED',
          },
          ...buildLeadDateWhere('surgery', dateWhere),
        },
      }),
      prisma.lead.count({
        where: {
          caseStage: 'INITIATED',
          ...buildLeadDateWhere('surgery', dateWhere),
        },
      }),
    ])

    return successResponse({
      admitted,
      surgeryScheduled,
      ipdDone,
      discharged,
      postponed,
      cancelled,
      posted,
    })
  } catch (error) {
    console.error('pl-pipeline-stats error:', error)
    return errorResponse('Failed to load pipeline stats', 500)
  }
}
