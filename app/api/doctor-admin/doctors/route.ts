import { NextRequest } from 'next/server'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getDoctorAdminUser } from '@/lib/doctor-admin/auth'
import { listDoctorAdminDoctors } from '@/lib/doctor-admin/doctors'

export async function GET(request: NextRequest) {
  try {
    const user = getDoctorAdminUser(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const search = request.nextUrl.searchParams.get('search') || ''
    const items = await listDoctorAdminDoctors(search)

    return successResponse({ items }, 'Doctors fetched')
  } catch (error) {
    console.error('[GET /api/doctor-admin/doctors]', error)
    return errorResponse('Internal server error', 500)
  }
}
