import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { getDoctorAdminUser } from '@/lib/doctor-admin/auth'
import {
  createDoctorAdminMaster,
  DoctorAdminMasterError,
  isDoctorAdminMasterType,
  listDoctorAdminMasters,
} from '@/lib/doctor-admin/masters'

const listSchema = z.object({
  search: z.string().optional().default(''),
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform(value => value !== 'false'),
})

const implantCreateSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().optional().nullable(),
  category: z.string().trim().optional().nullable(),
  manufacturer: z.string().trim().optional().nullable(),
  unitCost: z.union([z.number(), z.string(), z.null()]).optional(),
  description: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
})

const optionCreateSchema = z.object({
  code: z.string().trim().min(1),
  label: z.string().trim().min(1),
  displayOrder: z.union([z.number(), z.string()]).optional(),
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
