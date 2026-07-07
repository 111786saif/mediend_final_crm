import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  buildCumulativeLeadWhere,
  buildCumulativeStatusWhere,
  buildSurgeryWhere,
  buildCumulativeOrderBy,
  mapLeadToCumulativeRow,
  LEAD_SELECT,
  type CumulativeDatePreset,
  type CumulativeReportStatus,
  CUMULATIVE_REPORT_STATUSES,
} from '@/lib/cumulative-report'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

function parseFilters(searchParams: URLSearchParams) {
  return {
    datePreset: (searchParams.get('datePreset') as CumulativeDatePreset | null) ?? 'all',
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
    hospital: searchParams.get('hospital'),
    circle: searchParams.get('circle'),
    treatment: searchParams.get('treatment'),
    referralName: searchParams.get('referralName'),
    bdId: searchParams.get('bdId'),
    status: searchParams.get('status') as CumulativeReportStatus | null,
    search: searchParams.get('search'),
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'compliance:read')) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const filters = parseFilters(searchParams)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get('limit') ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
    )
    const sort = searchParams.get('sort')
    const dir = searchParams.get('dir')

    const where = buildCumulativeLeadWhere(filters)
    const skip = (page - 1) * limit

    const summaryWhere = buildCumulativeLeadWhere({
      ...filters,
      status: null,
    })

    const [totalRecords, rows, totalPatients, totalSurgeries, planning, ipdDone, pending, cancelled, followUp] =
      await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.findMany({
          where,
          select: LEAD_SELECT,
          orderBy: buildCumulativeOrderBy(sort, dir),
          skip,
          take: limit,
        }),
        prisma.lead.count({ where: summaryWhere }),
        prisma.lead.count({ where: { AND: [summaryWhere, buildSurgeryWhere()] } }),
        prisma.lead.count({
          where: { AND: [summaryWhere, buildCumulativeStatusWhere('Planning')] },
        }),
        prisma.lead.count({
          where: { AND: [summaryWhere, buildCumulativeStatusWhere('IPD Done')] },
        }),
        prisma.lead.count({
          where: { AND: [summaryWhere, buildCumulativeStatusWhere('Pending')] },
        }),
        prisma.lead.count({
          where: { AND: [summaryWhere, buildCumulativeStatusWhere('Cancelled')] },
        }),
        prisma.lead.count({
          where: { AND: [summaryWhere, buildCumulativeStatusWhere('Follow-up')] },
        }),
      ])

    const data = rows.map((lead, index) => ({
      ...mapLeadToCumulativeRow(lead),
      srNo: skip + index + 1,
    }))

    return successResponse({
      summary: {
        totalPatients,
        totalSurgeries,
        planning,
        ipdDone,
        pending,
        cancelled,
        followUp,
      },
      totalRecords,
      page,
      pageSize: limit,
      totalPages: Math.max(1, Math.ceil(totalRecords / limit)),
      data,
      statusOptions: CUMULATIVE_REPORT_STATUSES,
    })
  } catch (error) {
    console.error('Error fetching cumulative report:', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to fetch cumulative report',
      500,
    )
  }
}
