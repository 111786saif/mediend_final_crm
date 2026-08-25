import { prisma } from '@/lib/prisma'
import { last10DigitsFromStored } from '@/lib/phone-search'

type LeadDuplicateStore = Pick<typeof prisma, 'lead'>
type IncomingLeadDuplicateStore = Pick<typeof prisma, 'incomingLead'>

export const DUPLICATE_LEAD_STATUS = 'Duplicate lead'

export class DuplicateLeadPhoneError extends Error {
  leadId: string
  leadRef: string
  duplicateCount: number
  normalizedPhone: string
  treatment?: string | null

  constructor(input: {
    leadId: string
    leadRef: string
    duplicateCount: number
    normalizedPhone: string
    treatment?: string | null
  }) {
    super(`Duplicate lead detected for phone ${input.normalizedPhone} and treatment ${input.treatment || 'N/A'}. Existing lead: ${input.leadRef}`)
    this.name = 'DuplicateLeadPhoneError'
    this.leadId = input.leadId
    this.leadRef = input.leadRef
    this.duplicateCount = input.duplicateCount
    this.normalizedPhone = input.normalizedPhone
    this.treatment = input.treatment
  }
}

export function normalizeLeadPhoneToLast10(raw: string | null | undefined) {
  return last10DigitsFromStored(raw)
}

export function normalizeTreatmentForComparison(treatment: string | null | undefined): string {
  if (!treatment) return ''
  const s = String(treatment).trim().toLowerCase()
  if (['not specified', 'n/a', 'na', 'none', 'null', '-', '--', 'tbd', 'unknown'].includes(s)) {
    return ''
  }
  return s
}

export async function findCanonicalLeadByPhoneAndTreatment(
  normalizedPhone: string,
  treatment?: string | null,
  db: LeadDuplicateStore = prisma
) {
  const candidates = await db.lead.findMany({
    where: {
      phoneNumber: { contains: normalizedPhone },
    },
    select: {
      id: true,
      leadRef: true,
      phoneNumber: true,
      treatment: true,
      duplCount: true,
      createdDate: true,
    },
    orderBy: {
      createdDate: 'asc',
    },
  })

  const normalizedInputTreatment = normalizeTreatmentForComparison(treatment)

  return (
    candidates.find((lead) => {
      if (normalizeLeadPhoneToLast10(lead.phoneNumber) !== normalizedPhone) {
        return false
      }
      const leadTreatment = normalizeTreatmentForComparison(lead.treatment)
      if (normalizedInputTreatment) {
        return leadTreatment === normalizedInputTreatment
      }
      return !leadTreatment
    }) ?? null
  )
}

export async function findCanonicalLeadByPrimaryPhone(
  normalizedPhone: string,
  treatment?: string | null,
  db: LeadDuplicateStore = prisma
) {
  return findCanonicalLeadByPhoneAndTreatment(normalizedPhone, treatment, db)
}

export async function recordDuplicateLeadHitByPrimaryPhone(
  normalizedPhone: string,
  treatment?: string | null,
  db: LeadDuplicateStore = prisma
) {
  const existingLead = await findCanonicalLeadByPhoneAndTreatment(normalizedPhone, treatment, db)
  if (!existingLead) return null

  return db.lead.update({
    where: { id: existingLead.id },
    data: {
      duplCount: {
        increment: 1,
      },
    },
    select: {
      id: true,
      leadRef: true,
      duplCount: true,
    },
  })
}

export async function findLatestPriorIncomingLeadByPrimaryPhone(
  normalizedPhone: string,
  options?: {
    beforeReceivedAt?: Date | null
    excludeIncomingLeadId?: string | null
    db?: IncomingLeadDuplicateStore
  }
) {
  const db = options?.db ?? prisma

  return db.incomingLead.findFirst({
    where: {
      normalizedPhone,
      ...(options?.excludeIncomingLeadId
        ? {
            id: {
              not: options.excludeIncomingLeadId,
            },
          }
        : {}),
      ...(options?.beforeReceivedAt
        ? {
            receivedAt: {
              lt: options.beforeReceivedAt,
            },
          }
        : {}),
    },
    select: {
      id: true,
      status: true,
      processedLeadId: true,
      receivedAt: true,
    },
    orderBy: {
      receivedAt: 'desc',
    },
  })
}
