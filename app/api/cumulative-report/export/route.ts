import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  buildCumulativeLeadWhere,
  buildCumulativeOrderBy,
  mapLeadToCumulativeRow,
  LEAD_SELECT,
  type CumulativeDatePreset,
  type CumulativeReportStatus,
} from '@/lib/cumulative-report'

const MAX_EXPORT_ROWS = 10000

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
    const sort = searchParams.get('sort')
    const dir = searchParams.get('dir')
    const where = buildCumulativeLeadWhere(filters)

    const rows = await prisma.lead.findMany({
      where,
      select: LEAD_SELECT,
      orderBy: buildCumulativeOrderBy(sort, dir),
      take: MAX_EXPORT_ROWS,
    })

    const sheetRows = rows.map((lead, index) => {
      const row = mapLeadToCumulativeRow(lead)
      return {
        'Sr. No.': index + 1,
        Date: row.date,
        'Patient Name': row.patientName,
        'Patient Contact': row.patientContact,
        'Referral Name': row.referralName,
        'Referral Contact': row.referralContact,
        Treatment: row.treatment,
        'Hospital Name': row.hospitalName,
        Circle: row.circle,
        'Business Developer': row.businessDeveloper,
        Status: row.status,
      }
    })

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(sheetRows)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cumulative Report')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    const filename = `cumulative-report-${new Date().toISOString().slice(0, 10)}.xlsx`
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error exporting cumulative report:', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to export cumulative report',
      500,
    )
  }
}
