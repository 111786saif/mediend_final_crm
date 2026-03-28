import { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getAttendanceHeatmapPayloadForEmployee } from '@/lib/hrms/get-attendance-heatmap-payload'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }
    if (!hasPermission(user, 'hrms:attendance:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { employeeId } = await params
    const { searchParams } = new URL(request.url)
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    if (!fromDate || !toDate) {
      return errorResponse('fromDate and toDate are required', 400)
    }

    const payload = await getAttendanceHeatmapPayloadForEmployee(employeeId, fromDate, toDate)
    if (!payload) {
      return errorResponse('Employee not found', 404)
    }

    return successResponse(payload)
  } catch (error) {
    console.error('Error fetching HR employee attendance heatmap:', error)
    return errorResponse('Failed to fetch attendance', 500)
  }
}
