import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getAttendanceHeatmapPayloadForEmployee } from '@/lib/hrms/get-attendance-heatmap-payload'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })

    if (!employee) {
      return errorResponse('Employee record not found', 404)
    }

    const { searchParams } = new URL(request.url)
    let fromDate = searchParams.get('fromDate')
    let toDate = searchParams.get('toDate')

    if (!fromDate && !toDate) {
      const now = new Date()
      const y = now.getUTCFullYear()
      const mo = now.getUTCMonth()
      fromDate = `${y}-${String(mo + 1).padStart(2, '0')}-01`
      toDate = now.toISOString().split('T')[0]!
    } else {
      if (!fromDate) fromDate = '2000-01-01'
      if (!toDate) toDate = new Date().toISOString().split('T')[0]!
    }

    const payload = await getAttendanceHeatmapPayloadForEmployee(employee.id, fromDate, toDate)

    if (!payload) {
      return errorResponse('Employee record not found', 404)
    }

    return successResponse(payload)
  } catch (error) {
    console.error('Error fetching attendance:', error)
    return errorResponse('Failed to fetch attendance', 500)
  }
}
