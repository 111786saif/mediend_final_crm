import { NextRequest } from 'next/server'
import { z } from 'zod'
import { IpdStatus } from '@/generated/prisma/client'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import {
  nullableOptionalStringField,
  optionalEnumField,
  optionalIntField,
  optionalStringField,
  requiredStringField,
} from '@/lib/doctor-api-validation'
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

function normalizeDoctorMobileIpdStatusInput(value: unknown) {
  if (typeof value !== 'string') {
    return value
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  const key = trimmed.toLowerCase().replace(/[\s-]+/g, '_')

  if (['scheduled', 'schedule'].includes(key)) return 'scheduled'
  if (['admitted', 'admission_done', 'admitted_done'].includes(key)) return 'admitted'
  if (['surgery_done', 'ipd_done', 'done'].includes(key)) return 'surgery_done'
  if (['discharged', 'discharge_done'].includes(key)) return 'discharged'
  if (['closed', 'complete', 'completed'].includes(key)) return 'closed'
  if (['no_show', 'noshow', 'cancelled', 'canceled'].includes(key)) return 'no_show'

  return trimmed
}

const ipdImplantSchema = z.object({
  implantId: requiredStringField('Implant ID'),
  quantity: optionalIntField('Implant quantity', { min: 1 }),
  notes: nullableOptionalStringField('Implant notes'),
})

const ipdSurgeryUpdateSchema = z
  .object({
    status: z.preprocess(
      normalizeDoctorMobileIpdStatusInput,
      optionalEnumField('Status', doctorMobileIpdStatuses)
    ),
    ipdAdmissionDate: nullableOptionalStringField('IPD admission date'),
    admissionTime: nullableOptionalStringField('Admission time'),
    ipdHospital: optionalStringField('IPD hospital'),
    surgeryDate: nullableOptionalStringField('Surgery date'),
    operationTime: nullableOptionalStringField('Operation time'),
    hospitalAddress: nullableOptionalStringField('Hospital address'),
    googleMapLocation: nullableOptionalStringField('Google map location'),
    tpa: nullableOptionalStringField('TPA'),
    instrument: nullableOptionalStringField('Instrument'),
    implantConsumables: nullableOptionalStringField('Implant consumables'),
    ipdStatus: z.nativeEnum(IpdStatus, {
      invalid_type_error: 'IPD status is invalid',
    }).nullable().optional(),
    ipdStatusReason: nullableOptionalStringField('IPD status reason'),
    implantUsed: z.boolean().nullable().optional(),
    implantsUsed: z.array(ipdImplantSchema).optional(),
    noShowReason: nullableOptionalStringField('No-show reason'),
    newSurgeryDate: nullableOptionalStringField('New surgery date'),
    ipdDischargeDate: nullableOptionalStringField('IPD discharge date'),
    dischargeDate: nullableOptionalStringField('Discharge date'),
    procedureNotes: nullableOptionalStringField('Procedure notes'),
    notes: nullableOptionalStringField('Notes'),
    prescriptionImageUrl: nullableOptionalStringField('Prescription image URL'),
    prescriptionImageUrls: z
      .array(
        z
          .string({
            invalid_type_error: 'Prescription image URL must be a string',
          })
          .trim()
          .min(1, 'Prescription image URL is required')
      )
      .optional(),
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

const forbiddenIpdFields = ['ipdDrName', 'ipdContactNo'] as const

function assertNoForbiddenFields(
  payload: unknown,
  fields: readonly string[],
  message: string
) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return
  }

  const hasForbiddenField = fields.some((field) => field in payload)
  if (hasForbiddenField) {
    throw new DoctorAppApiError(message, 400)
  }
}

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

  assertNoForbiddenFields(
    Object.fromEntries(formData.entries()),
    forbiddenIpdFields,
    'Doctors cannot update IPD doctor name or contact number.'
  )

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
    let input
    if (contentType.includes('multipart/form-data')) {
      input = parseMultipartPayload(await request.formData())
    } else {
      const payload = await request.json()
      assertNoForbiddenFields(
        payload,
        forbiddenIpdFields,
        'Doctors cannot update IPD doctor name or contact number.'
      )
      input = ipdSurgeryUpdateSchema.parse(payload)
    }
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
