import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasEffectivePermission } from '@/lib/rbac-new'
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'
import { emptyToNull, hospitalMasterFieldsSchema } from '@/lib/masters/schemas'
import { serializeHospitalDetails } from '@/lib/masters/hospital'
import { hospitalInclude, mapHospital } from '@/lib/masters/hospital-mapper'

export async function GET(request: NextRequest) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() || ''
  const includeInactive =
    searchParams.get('includeInactive') === 'true' && (await hasEffectivePermission(user, 'masters:read'))

  const where: Prisma.HospitalMasterWhereInput = {}
  if (!includeInactive) {
    where.isActive = true
  }
  if (search) {
    where.name = { contains: search, mode: 'insensitive' }
  }

  const rows = await prisma.hospitalMaster.findMany({
    where,
    include: hospitalInclude,
    orderBy: { name: 'asc' },
    take: 500,
  })

  return successResponse({ items: rows.map(mapHospital) })
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

  const parsed = hospitalMasterFieldsSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.flatten().formErrors.join(', ') || 'Invalid body', 400)
  }

  const {
    name,
    address,
    googleMapLink,
    mouAgreementUrl,
    hospitalShare,
    mediendShare,
    details,
    isActive,
    insuranceIds,
  } = parsed.data
  const link = emptyToNull(googleMapLink ?? null)
  const mou = emptyToNull(mouAgreementUrl ?? null)
  const ids = [...new Set(insuranceIds ?? [])]
  const detailsJson = details ? serializeHospitalDetails(details) : Prisma.JsonNull

  try {
    const created = await prisma.hospitalMaster.create({
      data: {
        name: name.trim(),
        address: address?.trim() || null,
        googleMapLink: link,
        mouAgreementUrl: mou,
        hospitalShare: hospitalShare ?? null,
        mediendShare: mediendShare ?? null,
        details: detailsJson,
        isActive: isActive ?? true,
        insuranceProviders:
          ids.length > 0
            ? { create: ids.map((insuranceId) => ({ insuranceId })) }
            : undefined,
      },
      include: hospitalInclude,
    })
    return successResponse({ item: mapHospital(created) })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return errorResponse('A hospital with this name already exists', 409)
    }
    throw e
  }
}
