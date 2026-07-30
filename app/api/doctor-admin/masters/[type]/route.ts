import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import {
  booleanStringField,
  nullableOptionalStringField,
  optionalNumberField,
  optionalStringField,
  requiredStringField,
} from '@/lib/doctor-api-validation'
import { getDoctorAdminUser } from '@/lib/doctor-admin/auth'
import {
  createDoctorAdminMaster,
  DoctorAdminMasterError,
  isDoctorAdminMasterType,
  listDoctorAdminMasters,
} from '@/lib/doctor-admin/masters'

const listSchema = z.object({
  search: optionalStringField('Search').default(''),
  includeInactive: booleanStringField('includeInactive', { defaultValue: true }),
})

const implantCreateSchema = z.object({
  name: requiredStringField('Implant name'),
  code: nullableOptionalStringField('Implant code'),
  category: nullableOptionalStringField('Category'),
  manufacturer: nullableOptionalStringField('Manufacturer'),
  unitCost: optionalNumberField('Unit cost', { min: 0, nullable: true }),
  description: nullableOptionalStringField('Description'),
  isActive: z.boolean().optional(),
})

const optionCreateSchema = z.object({
  code: requiredStringField('Code'),
  label: requiredStringField('Label'),
  displayOrder: optionalNumberField('Display order', { min: 0 }),
  isActive: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const user = getDoctorAdminUser(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const { type } = await params
    if (!isDoctorAdminMasterType(type)) {
      return errorResponse('Unknown master type', 404)
    }

    const query = Object.fromEntries(request.nextUrl.searchParams.entries())
    const input = listSchema.parse(query)
    const items = await listDoctorAdminMasters(type, input.search, input.includeInactive)

    return successResponse({ items }, 'Master records fetched')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAdminMasterError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[GET /api/doctor-admin/masters/[type]]', error)
    return errorResponse('Internal server error', 500)
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const user = getDoctorAdminUser(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const { type } = await params
    if (!isDoctorAdminMasterType(type)) {
      return errorResponse('Unknown master type', 404)
    }

    const body = await request.json()
    const input =
      type === 'implants' ? implantCreateSchema.parse(body) : optionCreateSchema.parse(body)
    const item = await createDoctorAdminMaster(type, input as Record<string, unknown>)

    return successResponse({ item }, 'Master record created')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAdminMasterError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[POST /api/doctor-admin/masters/[type]]', error)
    return errorResponse('Internal server error', 500)
  }
}
