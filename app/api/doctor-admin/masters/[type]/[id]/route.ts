import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import {
  nullableOptionalStringField,
  optionalNumberField,
  requiredStringField,
} from '@/lib/doctor-api-validation'
import { getDoctorAdminUser } from '@/lib/doctor-admin/auth'
import {
  DoctorAdminMasterError,
  isDoctorAdminMasterType,
  updateDoctorAdminMaster,
} from '@/lib/doctor-admin/masters'

const implantUpdateSchema = z.object({
  name: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    requiredStringField('Implant name').optional()
  ),
  code: nullableOptionalStringField('Implant code'),
  category: nullableOptionalStringField('Category'),
  manufacturer: nullableOptionalStringField('Manufacturer'),
  unitCost: optionalNumberField('Unit cost', { min: 0, nullable: true }),
  description: nullableOptionalStringField('Description'),
  isActive: z.boolean().optional(),
})

const optionUpdateSchema = z.object({
  code: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    requiredStringField('Code').optional()
  ),
  label: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    requiredStringField('Label').optional()
  ),
  displayOrder: optionalNumberField('Display order', { min: 0 }),
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
