import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'
import { emptyToNull, hospitalMasterPatchSchema } from '@/lib/masters/schemas'
import { serializeHospitalDetails } from '@/lib/masters/hospital'
import { hospitalInclude, mapHospital } from '@/lib/masters/hospital-mapper'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'masters:write')) return forbiddenResponse()

  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON', 400)
  }

  const parsed = hospitalMasterPatchSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.flatten().formErrors.join(', ') || 'Invalid body', 400)
  }

  const d = parsed.data
  const data: Prisma.HospitalMasterUpdateInput = {}
  if (d.name !== undefined) data.name = d.name.trim()
  if (d.address !== undefined) data.address = d.address?.trim() || null
  if (d.googleMapLink !== undefined) data.googleMapLink = emptyToNull(d.googleMapLink)
  if (d.mouAgreementUrl !== undefined) data.mouAgreementUrl = emptyToNull(d.mouAgreementUrl)
  if (d.hospitalShare !== undefined) data.hospitalShare = d.hospitalShare
  if (d.mediendShare !== undefined) data.mediendShare = d.mediendShare
  if (d.details !== undefined) {
    data.details = d.details ? serializeHospitalDetails(d.details) : Prisma.JsonNull
  }
  if (d.isActive !== undefined) data.isActive = d.isActive

  try {
    await prisma.$transaction(async (tx) => {
      await tx.hospitalMaster.update({ where: { id }, data })
      if (d.insuranceIds !== undefined) {
        const ids = [...new Set(d.insuranceIds)]
        await tx.hospitalMasterInsurance.deleteMany({ where: { hospitalId: id } })
        if (ids.length > 0) {
          await tx.hospitalMasterInsurance.createMany({
            data: ids.map((insuranceId) => ({ hospitalId: id, insuranceId })),
            skipDuplicates: true,
          })
        }
      }
    })

    const updated = await prisma.hospitalMaster.findUniqueOrThrow({
      where: { id },
      include: hospitalInclude,
    })
    return successResponse({ item: mapHospital(updated) })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return errorResponse('Hospital not found', 404)
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return errorResponse('A hospital with this name already exists', 409)
    }
    throw e
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'masters:write')) return forbiddenResponse()

  const { id } = await context.params

  try {
    const updated = await prisma.hospitalMaster.update({
      where: { id },
      data: { isActive: false },
      include: hospitalInclude,
    })
    return successResponse({ item: mapHospital(updated) })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return errorResponse('Hospital not found', 404)
    }
    throw e
  }
}
