import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasEffectivePermission } from '@/lib/rbac-new'
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'
import { doctorMasterFieldsSchema, emptyToNull } from '@/lib/masters/schemas'
import { normalizeIndianPhone } from '@/lib/doctor-app/phone'
import { syncDoctorAppAccountFromMaster } from '@/lib/doctor-app/master-sync'
import {
  DoctorAvailabilityError,
  listDoctorIdsOnApprovedLeaveForDate,
  parseDoctorAvailabilityDate,
} from '@/lib/doctor-availability'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')?.trim() || ''
    const includeInactive =
      searchParams.get('includeInactive') === 'true' && (await hasEffectivePermission(user, 'masters:read'))
    const availabilityDate = searchParams.get('availabilityDate')?.trim() || ''

    const where: Prisma.DoctorMasterWhereInput = {}
    if (!includeInactive) {
      where.isActive = true
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { treatment: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
      ]
    }

    const parsedAvailabilityDate = availabilityDate
      ? parseDoctorAvailabilityDate(availabilityDate, 'availabilityDate')
      : null
    if (parsedAvailabilityDate) {
      const unavailableDoctorIds = await listDoctorIdsOnApprovedLeaveForDate(
        prisma,
        parsedAvailabilityDate
      )
      if (unavailableDoctorIds.length > 0) {
        where.id = { notIn: unavailableDoctorIds }
      }
    }

    const items = await prisma.doctorMaster.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 500,
    })

    return successResponse({ items })
  } catch (error) {
    if (error instanceof DoctorAvailabilityError) {
      return errorResponse(error.message, error.status)
    }

    throw error
  }
}

export async function POST(request: NextRequest) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()
  if (!(await hasEffectivePermission(user, 'masters:write'))) return forbiddenResponse()

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON', 400)
  }

  const parsed = doctorMasterFieldsSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.flatten().formErrors.join(', ') || 'Invalid body', 400)
  }

  const d = parsed.data
  const phoneNumber = normalizeIndianPhone(d.phoneNumber)
  const isActive = d.isActive ?? true
  try {
    const created = await prisma.$transaction(async (tx) => {
      const doctor = await tx.doctorMaster.create({
        data: {
          name: d.name.trim(),
          category: emptyToNull(d.category ?? null),
          treatment: emptyToNull(d.treatment ?? null),
          age: d.age ?? null,
          sex: emptyToNull((d.sex as string | null | undefined) ?? null),
          phoneNumber,
          aadhaarNumber: emptyToNull(d.aadhaarNumber ?? null),
          aadhaarCardUrl: emptyToNull(d.aadhaarCardUrl ?? null),
          panNumber: emptyToNull(d.panNumber ?? null),
          panCardUrl: emptyToNull(d.panCardUrl ?? null),
          agreementUrl: emptyToNull(d.agreementUrl ?? null),
          experienceYears: d.experienceYears ?? null,
          experienceNotes: emptyToNull(d.experienceNotes ?? null),
          feeStructure: emptyToNull(d.feeStructure ?? null),
          ratingAverage: d.ratingAverage ?? null,
          ratingCount: d.ratingCount ?? 0,
          documents: d.documents ?? undefined,
          isActive,
        },
      })

      await syncDoctorAppAccountFromMaster(tx, {
        doctorId: doctor.id,
        phoneNumber,
        isActive: doctor.isActive,
      })

      return doctor
    })

    return successResponse({ item: created })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return errorResponse('A doctor with this name or phone number already exists', 409)
    }
    throw e
  }
}
