import { Prisma } from '@/generated/prisma/client'
import { DoctorAppSessionUser } from '@/lib/doctor-app/auth'
import { prisma } from '@/lib/prisma'

export class DoctorAppContextError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'DoctorAppContextError'
    this.status = status
  }
}

export async function getDoctorAppContext(user: DoctorAppSessionUser) {
  const account = await prisma.doctorAppAccount.findUnique({
    where: { id: user.accountId },
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
    },
  })

  if (!account || !account.isActive || !account.doctor.isActive) {
    throw new DoctorAppContextError('Doctor session is no longer active', 401)
  }

  return {
    accountId: account.id,
    doctorId: account.doctor.id,
    doctorName: account.doctor.name,
    email: account.email,
  }
}

export function getDoctorScopedLeadWhere(doctorName: string): Prisma.LeadWhereInput {
  return {
    OR: [
      { opdDrName: { equals: doctorName, mode: 'insensitive' } },
      { ipdDrName: { equals: doctorName, mode: 'insensitive' } },
      { surgeonName: { equals: doctorName, mode: 'insensitive' } },
    ],
  }
}

export function parseOptionalDate(value: string | null | undefined, fieldName: string) {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? new Date(`${trimmed}T00:00:00`)
    : new Date(trimmed)

  if (Number.isNaN(parsed.getTime())) {
    throw new DoctorAppContextError(`${fieldName} must be a valid date`, 400)
  }

  return parsed
}

export function normalizeText(value: string | null | undefined) {
  if (value === undefined) {
    return undefined
  }

  if (value === null) {
    return null
  }

  const trimmed = value.trim()
  return trimmed || null
}
