import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { getDoctorAdminUser } from '@/lib/doctor-admin/auth'
import {
  DoctorAdminMasterError,
  isDoctorAdminMasterType,
  updateDoctorAdminMaster,
} from '@/lib/doctor-admin/masters'

const implantUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  code: z.string().trim().optional().nullable(),
  category: z.string().trim().optional().nullable(),
  manufacturer: z.string().trim().optional().nullable(),
  unitCost: z.union([z.number(), z.string(), z.null()]).optional(),
  description: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
})

const optionUpdateSchema = z.object({
  code: z.string().trim().min(1).optional(),
  label: z.string().trim().min(1).optional(),
  displayOrder: z.union([z.number(), z.string()]).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  try {
    const user = getDoctorAdminUser(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const { type, id } = await params
    if (!isDoctorAdminMasterType(type)) {
      return errorResponse('Unknown master type', 404)
    }

    const body = await request.json()
    const input =
      type === 'implants' ? implantUpdateSchema.parse(body) : optionUpdateSchema.parse(body)
    const item = await updateDoctorAdminMaster(type, id, input as Record<string, unknown>)

    return successResponse({ item }, 'Master record updated')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAdminMasterError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[PATCH /api/doctor-admin/masters/[type]/[id]]', error)
    return errorResponse('Internal server error', 500)
  }
}
