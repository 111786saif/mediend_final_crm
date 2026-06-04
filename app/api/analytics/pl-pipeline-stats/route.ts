import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { ipdDoneDateFilter } from '@/lib/analytics/ipd-filters'

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

    const range: Prisma.DateTimeFilter = {}
    if (startDate) range.gte = new Date(startDate)
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      range.lte = end
    }

    const dateWhere = Object.keys(range).length > 0 ? range : undefined
    if (!dateWhere) {
      return successResponse({
        admitted: 0,
        surgeryScheduled: 0,
        ipdDone: 0,
        discharged: 0,
      })
    }

    const [admitted, surgeryScheduled, ipdDone, discharged] = await Promise.all([
      prisma.admissionRecord.count({
        where: { admissionDate: dateWhere },
      }),
      prisma.admissionRecord.count({
        where: {
          expectedSurgeryDate: dateWhere,
        },
      }),
      prisma.lead.count({
        where: {
          caseStage: { in: ['IPD_DONE', 'CASH_IPD_DONE'] },
          ...ipdDoneDateFilter(dateWhere),
        },
      }),
      prisma.dischargeSheet.count({
        where: { dischargeDate: dateWhere },
      }),
    ])

    return successResponse({
      admitted,
      surgeryScheduled,
      ipdDone,
      discharged,
    })
  } catch (error) {
    console.error('pl-pipeline-stats error:', error)
    return errorResponse('Failed to load pipeline stats', 500)
  }
}
