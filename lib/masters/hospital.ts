import { z } from 'zod'

export const PAYMENT_MODE_OPTIONS = [
  { value: 'CASHLESS', label: 'Cashless' },
  { value: 'EMI', label: 'EMI' },
  { value: 'CASH', label: 'Cash' },
  { value: 'REIMBURSEMENT', label: 'Reimbursement' },
] as const

export const SERVICE_COVERAGE_OPTIONS = [
  { value: 'PHARMACY', label: 'Pharmacy' },
  { value: 'INVESTIGATION', label: 'Investigation' },
  { value: 'CONSUMABLES', label: 'Consumables' },
  { value: 'ANESTHESIA', label: 'Anesthesia' },
] as const

export type PaymentMode = (typeof PAYMENT_MODE_OPTIONS)[number]['value']
export type ServiceCoverage = (typeof SERVICE_COVERAGE_OPTIONS)[number]['value']

export const paymentTrackingEntrySchema = z.object({
  date: z.string().min(1).max(40),
  note: z.string().max(2000).optional().nullable(),
})

export const hospitalMasterDetailsSchema = z.object({
  paymentModes: z.array(z.enum(['CASHLESS', 'EMI', 'CASH', 'REIMBURSEMENT'])).optional(),
  serviceCoverage: z
    .array(z.enum(['PHARMACY', 'INVESTIGATION', 'CONSUMABLES', 'ANESTHESIA']))
    .optional(),
  contact: z
    .object({
      name: z.string().max(200).optional().nullable(),
      phone: z.string().max(40).optional().nullable(),
      designation: z.string().max(200).optional().nullable(),
      department: z.string().max(200).optional().nullable(),
    })
    .optional()
    .nullable(),
  paymentTerms: z
    .object({
      cycleDays: z.number().int().min(0).max(3650).optional().nullable(),
      expectedDurationDays: z.number().int().min(0).max(3650).optional().nullable(),
      startDate: z.string().max(40).optional().nullable(),
      endDate: z.string().max(40).optional().nullable(),
      trackingEntries: z.array(paymentTrackingEntrySchema).optional(),
    })
    .optional()
    .nullable(),
  rating: z.number().min(1).max(5).optional().nullable(),
  remarks: z.string().max(10000).optional().nullable(),
  specialConditions: z.string().max(10000).optional().nullable(),
  hospitalAgreements: z.string().max(10000).optional().nullable(),
  internalComments: z.string().max(10000).optional().nullable(),
})

export type HospitalMasterDetails = z.infer<typeof hospitalMasterDetailsSchema>
export type PaymentTrackingEntry = z.infer<typeof paymentTrackingEntrySchema>

export function emptyHospitalDetails(): HospitalMasterDetails {
  return {
    paymentModes: [],
    serviceCoverage: [],
    contact: { name: '', phone: '', designation: '', department: '' },
    paymentTerms: {
      cycleDays: null,
      expectedDurationDays: null,
      startDate: '',
      endDate: '',
      trackingEntries: [],
    },
    rating: null,
    remarks: '',
    specialConditions: '',
    hospitalAgreements: '',
    internalComments: '',
  }
}

export function parseHospitalDetails(raw: unknown): HospitalMasterDetails {
  const parsed = hospitalMasterDetailsSchema.safeParse(raw ?? {})
  if (!parsed.success) return emptyHospitalDetails()
  const d = parsed.data
  return {
    paymentModes: d.paymentModes ?? [],
    serviceCoverage: d.serviceCoverage ?? [],
    contact: {
      name: d.contact?.name ?? '',
      phone: d.contact?.phone ?? '',
      designation: d.contact?.designation ?? '',
      department: d.contact?.department ?? '',
    },
    paymentTerms: {
      cycleDays: d.paymentTerms?.cycleDays ?? null,
      expectedDurationDays: d.paymentTerms?.expectedDurationDays ?? null,
      startDate: d.paymentTerms?.startDate ?? '',
      endDate: d.paymentTerms?.endDate ?? '',
      trackingEntries: d.paymentTerms?.trackingEntries ?? [],
    },
    rating: d.rating ?? null,
    remarks: d.remarks ?? '',
    specialConditions: d.specialConditions ?? '',
    hospitalAgreements: d.hospitalAgreements ?? '',
    internalComments: d.internalComments ?? '',
  }
}

/** Normalize details for DB (trim empties to null where useful). */
export function serializeHospitalDetails(details: HospitalMasterDetails): HospitalMasterDetails {
  const trim = (v: string | null | undefined) => {
    const t = (v ?? '').trim()
    return t === '' ? null : t
  }
  return {
    paymentModes: details.paymentModes ?? [],
    serviceCoverage: details.serviceCoverage ?? [],
    contact: {
      name: trim(details.contact?.name),
      phone: trim(details.contact?.phone),
      designation: trim(details.contact?.designation),
      department: trim(details.contact?.department),
    },
    paymentTerms: {
      cycleDays: details.paymentTerms?.cycleDays ?? null,
      expectedDurationDays: details.paymentTerms?.expectedDurationDays ?? null,
      startDate: trim(details.paymentTerms?.startDate),
      endDate: trim(details.paymentTerms?.endDate),
      trackingEntries: (details.paymentTerms?.trackingEntries ?? [])
        .map((e) => ({
          date: e.date.trim(),
          note: trim(e.note) ?? undefined,
        }))
        .filter((e) => e.date),
    },
    rating: details.rating ?? null,
    remarks: trim(details.remarks),
    specialConditions: trim(details.specialConditions),
    hospitalAgreements: trim(details.hospitalAgreements),
    internalComments: trim(details.internalComments),
  }
}
