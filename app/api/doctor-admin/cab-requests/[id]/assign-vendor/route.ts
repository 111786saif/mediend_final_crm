import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { nullableOptionalStringField, requiredStringField } from '@/lib/doctor-api-validation'
import { getDoctorAdminUser } from '@/lib/doctor-admin/auth'
import { assignDoctorAdminCabVendor, DoctorAdminCabError } from '@/lib/doctor-admin/cab-requests'

const assignSchema = z.object({
  vendorName: requiredStringField('Vendor name'),
  vendorPhone: nullableOptionalStringField('Vendor phone'),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getDoctorAdminUser(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const { id } = await params
    const body = await request.json()
    const input = assignSchema.parse(body)
    const item = await assignDoctorAdminCabVendor(id, user.id, input)

    return successResponse({ item }, 'Vendor assigned')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAdminCabError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[PUT /api/doctor-admin/cab-requests/[id]/assign-vendor]', error)
    return errorResponse('Internal server error', 500)
  }
}
