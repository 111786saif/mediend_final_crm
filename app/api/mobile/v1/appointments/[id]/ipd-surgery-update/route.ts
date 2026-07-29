import { NextRequest } from 'next/server'
import { z } from 'zod'
import { IpdStatus } from '@/generated/prisma/client'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import { getDoctorAppSessionFromRequest } from '@/lib/doctor-app/auth'
import { DoctorAppApiError, updateDoctorIpdAppointment } from '@/lib/doctor-app/appointments'
import { KYP_UPLOAD_MAX_BYTES } from '@/lib/upload-limits'

const doctorMobileIpdStatuses = [
  'scheduled',
  'admitted',
  'surgery_done',
  'discharged',
  'closed',
  'no_show',
] as const

const ipdImplantSchema = z.object({
  implantId: z.string().trim().min(1),
  quantity: z.coerce.number().int().min(1).optional(),
  notes: z.string().trim().nullable().optional(),
})

const ipdSurgeryUpdateSchema = z
  .object({
    status: z.enum(doctorMobileIpdStatuses).optional(),
    ipdAdmissionDate: z.string().trim().nullable().optional(),
    admissionTime: z.string().trim().nullable().optional(),
    ipdHospital: z.string().trim().min(1).optional(),
    ipdDrName: z.string().trim().min(1).optional(),
    ipdContactNo: z.string().trim().min(1).optional(),
    surgeryDate: z.string().trim().nullable().optional(),
    operationTime: z.string().trim().nullable().optional(),
    hospitalAddress: z.string().trim().nullable().optional(),
    googleMapLocation: z.string().trim().nullable().optional(),
    tpa: z.string().trim().nullable().optional(),
    instrument: z.string().trim().nullable().optional(),
    implantConsumables: z.string().trim().nullable().optional(),
    ipdStatus: z.nativeEnum(IpdStatus).nullable().optional(),
    ipdStatusReason: z.string().trim().nullable().optional(),
    implantUsed: z.boolean().nullable().optional(),
    implantsUsed: z.array(ipdImplantSchema).optional(),
    noShowReason: z.string().trim().nullable().optional(),
    newSurgeryDate: z.string().trim().nullable().optional(),
    ipdDischargeDate: z.string().trim().nullable().optional(),
    dischargeDate: z.string().trim().nullable().optional(),
    procedureNotes: z.string().trim().nullable().optional(),
    notes: z.string().trim().nullable().optional(),
    prescriptionImageUrl: z.string().trim().nullable().optional(),
    prescriptionImageUrls: z.array(z.string().trim()).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === 'surgery_done') {
      if (value.implantUsed === undefined || value.implantUsed === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'implantUsed (true/false) is required when status is surgery_done',
          path: ['implantUsed'],
        })
      }

      if (value.implantUsed === true && (!value.implantsUsed || value.implantsUsed.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'At least one implant is required when implantUsed is true',
          path: ['implantsUsed'],
        })
      }
    }

    if (value.status === 'no_show' && !value.noShowReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'noShowReason is required when status is no_show',
        path: ['noShowReason'],
      })
    }
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

function parseImplantsUsedFromFormData(formData: FormData) {
  const grouped = new Map<number, Record<string, string>>()

  formData.forEach((rawValue, key) => {
    if (typeof rawValue !== 'string') {
      return
    }

    const match = key.match(/^implantsUsed\[(\d+)\]\[(implantId|quantity|notes)\]$/)
    if (!match) {
      return
    }

    const index = Number(match[1])
    const field = match[2]
    const item = grouped.get(index) || {}
    item[field] = rawValue
    grouped.set(index, item)
  })

  if (grouped.size === 0) {
    const jsonValue = getOptionalFormValue(formData, 'implantsUsed')
    if (!jsonValue?.trim()) {
      return undefined
    }

    try {
      const parsed = JSON.parse(jsonValue)
      return z.array(ipdImplantSchema).parse(parsed)
    } catch {
      throw new DoctorAppApiError('implantsUsed must be a valid JSON array', 400)
    }
  }

  return Array.from(grouped.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, item]) => ({
      implantId: item.implantId,
      quantity: item.quantity,
      notes: item.notes,
    }))
}

function parsePrescriptionImageUrls(formData: FormData) {
  const singular = getOptionalFormValue(formData, 'prescriptionImageUrl')
  const plural = formData
    .getAll('prescriptionImageUrls')
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean)

  if (!singular && plural.length === 0) {
    return {
      prescriptionImageUrl: undefined,
      prescriptionImageUrls: undefined,
    }
  }

  const merged = [...(singular ? [singular.trim()] : []), ...plural]

  return {
    prescriptionImageUrl: singular?.trim() || undefined,
    prescriptionImageUrls: merged,
  }
}

function parseMultipartPayload(formData: FormData) {
  const files = [
    ...formData
      .getAll('prescriptionImages')
      .filter((value): value is File => value instanceof File && value.size > 0),
    ...formData
      .getAll('prescription')
      .filter((value): value is File => value instanceof File && value.size > 0),
  ]

  for (const file of files) {
    if (file.size > KYP_UPLOAD_MAX_BYTES) {
      throw new DoctorAppApiError(
        `File too large (max ${KYP_UPLOAD_MAX_BYTES / (1024 * 1024)} MB)`,
        413
      )
    }
  }

  const payload = {
    status: getOptionalFormValue(formData, 'status'),
    ipdAdmissionDate: getOptionalFormValue(formData, 'ipdAdmissionDate'),
    admissionTime: getOptionalFormValue(formData, 'admissionTime'),
    ipdHospital: getOptionalFormValue(formData, 'ipdHospital'),
    ipdDrName: getOptionalFormValue(formData, 'ipdDrName'),
    ipdContactNo: getOptionalFormValue(formData, 'ipdContactNo'),
    surgeryDate: getOptionalFormValue(formData, 'surgeryDate'),
    operationTime: getOptionalFormValue(formData, 'operationTime'),
    hospitalAddress: getOptionalFormValue(formData, 'hospitalAddress'),
    googleMapLocation: getOptionalFormValue(formData, 'googleMapLocation'),
    tpa: getOptionalFormValue(formData, 'tpa'),
    instrument: getOptionalFormValue(formData, 'instrument'),
    implantConsumables: getOptionalFormValue(formData, 'implantConsumables'),
    ipdStatus: getOptionalFormValue(formData, 'ipdStatus'),
    ipdStatusReason: getOptionalFormValue(formData, 'ipdStatusReason'),
    implantUsed: parseOptionalBoolean(getOptionalFormValue(formData, 'implantUsed'), 'implantUsed'),
    implantsUsed: parseImplantsUsedFromFormData(formData),
    noShowReason: getOptionalFormValue(formData, 'noShowReason'),
    newSurgeryDate: getOptionalFormValue(formData, 'newSurgeryDate'),
    ipdDischargeDate: getOptionalFormValue(formData, 'ipdDischargeDate'),
    dischargeDate: getOptionalFormValue(formData, 'dischargeDate'),
    procedureNotes: getOptionalFormValue(formData, 'procedureNotes'),
    notes: getOptionalFormValue(formData, 'notes'),
    ...parsePrescriptionImageUrls(formData),
  }

  return {
    ...ipdSurgeryUpdateSchema.parse(payload),
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
      : ipdSurgeryUpdateSchema.parse(await request.json())
    const result = await updateDoctorIpdAppointment(session, id, input)

    return successResponse(result, 'IPD surgery updated')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAppApiError) {
      return errorResponse(error.message, error.status)
    }

    console.error('[PUT /api/mobile/v1/appointments/[id]/ipd-surgery-update]', error)
    return errorResponse('Internal server error', 500)
  }
}
