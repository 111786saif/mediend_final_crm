import { z } from 'zod'
import { hospitalMasterDetailsSchema } from '@/lib/masters/hospital'

/** Relative `/uploads/...` or absolute URL */
const uploadUrl = z.string().min(1).max(2000)

export const doctorDocumentSchema = z.object({
  name: z.string().min(1).max(500),
  url: uploadUrl,
  type: z.enum(['DEGREE', 'DOCUMENTATION', 'MOU', 'OTHER']),
})

export type DoctorDocument = z.infer<typeof doctorDocumentSchema>

export const doctorMasterFieldsSchema = z.object({
  name: z.string().min(1).max(500),
  category: z.string().max(200).optional().nullable(),
  treatment: z.string().max(500).optional().nullable(),
  age: z.number().int().min(0).max(120).optional().nullable(),
  sex: z.string().max(20).optional().nullable(),
  phoneNumber: z.string().max(20).optional().nullable(),
  aadhaarNumber: z.string().max(20).optional().nullable(),
  aadhaarCardUrl: z.string().max(2000).optional().nullable(),
  panNumber: z.string().max(20).optional().nullable(),
  panCardUrl: z.string().max(2000).optional().nullable(),
  agreementUrl: z.string().max(2000).optional().nullable(),
  experienceYears: z.number().int().min(0).max(80).optional().nullable(),
  experienceNotes: z.string().max(5000).optional().nullable(),
  feeStructure: z.string().max(5000).optional().nullable(),
  ratingAverage: z.number().min(0).max(5).optional().nullable(),
  ratingCount: z.number().int().min(0).optional().nullable(),
  documents: z.array(doctorDocumentSchema).optional().nullable(),
  isActive: z.boolean().optional(),
})

export const doctorMasterPatchSchema = doctorMasterFieldsSchema.partial().extend({
  name: z.string().min(1).max(500).optional(),
})

export const hospitalMasterFieldsSchema = z.object({
  name: z.string().min(1).max(500),
  address: z.string().max(10000).optional().nullable(),
  googleMapLink: z.string().max(2000).optional().nullable().or(z.literal('')),
  mouAgreementUrl: z.string().max(2000).optional().nullable(),
  hospitalShare: z.number().min(0).max(100).optional().nullable(),
  mediendShare: z.number().min(0).max(100).optional().nullable(),
  details: hospitalMasterDetailsSchema.optional().nullable(),
  insuranceIds: z.array(z.string().min(1)).optional(),
  isActive: z.boolean().optional(),
})

export const hospitalMasterPatchSchema = hospitalMasterFieldsSchema.partial().extend({
  name: z.string().min(1).max(500).optional(),
})

export function emptyToNull(v: string | null | undefined): string | null {
  if (v == null) return null
  const t = v.trim()
  return t === '' ? null : t
}
