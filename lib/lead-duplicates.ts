import { prisma } from '@/lib/prisma'
import { last10DigitsFromStored } from '@/lib/phone-search'

type LeadDuplicateStore = Pick<typeof prisma, 'lead'>

export class DuplicateLeadPhoneError extends Error {
  leadId: string
  leadRef: string
  duplicateCount: number
  normalizedPhone: string

  constructor(input: {
    leadId: string
    leadRef: string
    duplicateCount: number
    normalizedPhone: string
  }) {
    super(`Duplicate lead detected for phone ${input.normalizedPhone}. Existing lead: ${input.leadRef}`)
    this.name = 'DuplicateLeadPhoneError'
    this.leadId = input.leadId
    this.leadRef = input.leadRef
    this.duplicateCount = input.duplicateCount
    this.normalizedPhone = input.normalizedPhone
  }
}

export function normalizeLeadPhoneToLast10(raw: string | null | undefined) {
  return last10DigitsFromStored(raw)
}

export async function findLatestLeadByPrimaryPhone(
  normalizedPhone: string,
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
      duplCount: true,
      createdDate: true,
    },
    orderBy: {
      createdDate: 'desc',
    },
  })

  return (
    candidates.find((lead) => normalizeLeadPhoneToLast10(lead.phoneNumber) === normalizedPhone) ??
    null
  )
}

export async function recordDuplicateLeadHitByPrimaryPhone(
  normalizedPhone: string,
  db: LeadDuplicateStore = prisma
) {
  const existingLead = await findLatestLeadByPrimaryPhone(normalizedPhone, db)
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
