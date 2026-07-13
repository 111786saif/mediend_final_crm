import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'
import { doctorMasterPatchSchema, emptyToNull } from '@/lib/masters/schemas'

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

  const parsed = doctorMasterPatchSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.flatten().formErrors.join(', ') || 'Invalid body', 400)
  }

  const d = parsed.data
  const data: Prisma.DoctorMasterUpdateInput = {}
  if (d.name !== undefined) data.name = d.name.trim()
  if (d.category !== undefined) data.category = emptyToNull(d.category)
  if (d.treatment !== undefined) data.treatment = emptyToNull(d.treatment)
  if (d.age !== undefined) data.age = d.age
  if (d.sex !== undefined) data.sex = emptyToNull((d.sex as string | null | undefined) ?? null)
  if (d.aadhaarNumber !== undefined) data.aadhaarNumber = emptyToNull(d.aadhaarNumber)
  if (d.aadhaarCardUrl !== undefined) data.aadhaarCardUrl = emptyToNull(d.aadhaarCardUrl)
  if (d.panNumber !== undefined) data.panNumber = emptyToNull(d.panNumber)
  if (d.panCardUrl !== undefined) data.panCardUrl = emptyToNull(d.panCardUrl)
  if (d.agreementUrl !== undefined) data.agreementUrl = emptyToNull(d.agreementUrl)
  if (d.experienceYears !== undefined) data.experienceYears = d.experienceYears
  if (d.experienceNotes !== undefined) data.experienceNotes = emptyToNull(d.experienceNotes)
  if (d.feeStructure !== undefined) data.feeStructure = emptyToNull(d.feeStructure)
  if (d.ratingAverage !== undefined) data.ratingAverage = d.ratingAverage
  if (d.ratingCount !== undefined) data.ratingCount = d.ratingCount
  if (d.documents !== undefined) data.documents = d.documents === null ? Prisma.DbNull : d.documents
  if (d.isActive !== undefined) data.isActive = d.isActive

  try {
    const updated = await prisma.doctorMaster.update({
      where: { id },
      data,
    })
    return successResponse({ item: updated })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return errorResponse('Doctor not found', 404)
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return errorResponse('A doctor with this name already exists', 409)
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
    const updated = await prisma.doctorMaster.update({
      where: { id },
      data: { isActive: false },
    })
    return successResponse({ item: updated })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return errorResponse('Doctor not found', 404)
    }
    throw e
  }
}
