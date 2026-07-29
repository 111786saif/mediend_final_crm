import { NextRequest } from 'next/server'
import { z } from 'zod'
import { CaseStage } from '@/generated/prisma/client'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import { DoctorAppApiError, updateDoctorOpdAppointment } from '@/lib/doctor-app/appointments'
import { KYP_UPLOAD_MAX_BYTES } from '@/lib/upload-limits'

const opdUpdateSchema = z.object({
  opdHospital: z.string().trim().min(1).optional(),
  opdDrName: z.string().trim().min(1).optional(),
  opdContactNo: z.string().trim().min(1).optional(),
  opdCharges: z.coerce.number().int().min(0).optional(),
  opdScheduleDate: z.string().trim().nullable().optional(),
  followUpDate: z.string().trim().nullable().optional(),
  remarks: z.string().trim().nullable().optional(),
  status: z.string().trim().min(1).optional(),
  caseStage: z.nativeEnum(CaseStage).optional(),
  markOpdDone: z.boolean().optional(),
  surgeryAdvised: z.string().trim().nullable().optional(),
  surgeryRemarksType: z.string().trim().nullable().optional(),
  reasonNoSurgery: z.string().trim().nullable().optional(),
  followUpReason: z.string().trim().nullable().optional(),
  implantRequired: z.boolean().nullable().optional(),
  diagnosis: z.string().trim().nullable().optional(),
})

function getOptionalFormValue(formData: FormData, key: string) {
  const value = formData.get(key)
  if (typeof value !== 'string') {
    return undefined
  }

  return value
}

function parseOptionalBoolean(value: string | undefined, fieldName: string) {
  if (value === undefined) {
    return undefined
  }

  const normalized = value.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  if (['true', '1', 'yes', 'y'].includes(normalized)) {
    return true
  }

  if (['false', '0', 'no', 'n'].includes(normalized)) {
    return false
  }

  throw new DoctorAppApiError(`${fieldName} must be a valid boolean`, 400)
}

function parseMultipartPayload(formData: FormData) {
  const files = formData
    .getAll('prescriptionImages')
    .filter((value): value is File => value instanceof File && value.size > 0)

  for (const file of files) {
    if (file.size > KYP_UPLOAD_MAX_BYTES) {
      throw new DoctorAppApiError(
        `File too large (max ${KYP_UPLOAD_MAX_BYTES / (1024 * 1024)} MB)`,
        413
      )
    }
  }

  const payload = {
    opdHospital: getOptionalFormValue(formData, 'opdHospital'),
    opdDrName: getOptionalFormValue(formData, 'opdDrName'),
    opdContactNo: getOptionalFormValue(formData, 'opdContactNo'),
    opdCharges: getOptionalFormValue(formData, 'opdCharges'),
    opdScheduleDate: getOptionalFormValue(formData, 'opdScheduleDate'),
    followUpDate: getOptionalFormValue(formData, 'followUpDate'),
    remarks: getOptionalFormValue(formData, 'remarks'),
    status: getOptionalFormValue(formData, 'status'),
    caseStage: getOptionalFormValue(formData, 'caseStage'),
    markOpdDone: parseOptionalBoolean(getOptionalFormValue(formData, 'markOpdDone'), 'markOpdDone'),
    surgeryAdvised: getOptionalFormValue(formData, 'surgeryAdvised'),
    surgeryRemarksType: getOptionalFormValue(formData, 'surgeryRemarksType'),
    reasonNoSurgery:
      getOptionalFormValue(formData, 'reasonNoSurgery') ??
      getOptionalFormValue(formData, 'reasonForNoSurgery'),
    followUpReason: getOptionalFormValue(formData, 'followUpReason'),
    implantRequired: parseOptionalBoolean(
      getOptionalFormValue(formData, 'implantRequired'),
      'implantRequired'
    ),
    diagnosis: getOptionalFormValue(formData, 'diagnosis'),
  }

  return {
    ...opdUpdateSchema.parse(payload),
    prescriptionImages: files,
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getDoctorAppSessionFromRequest(request)
    if (!session) {
      return unauthorizedResponse()
    }

    const { id } = await params
    const contentType = request.headers.get('content-type') || ''
    const input = contentType.includes('multipart/form-data')
      ? parseMultipartPayload(await request.formData())
      : opdUpdateSchema.parse(await request.json())
    const result = await updateDoctorOpdAppointment(session, id, input)

    return successResponse(result, 'OPD updated')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAppApiError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[PUT /api/mobile/v1/appointments/[id]/opd-update]', error)
    return errorResponse('Internal server error', 500)
  }
}
