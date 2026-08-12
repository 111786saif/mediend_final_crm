import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasEffectivePermission } from '@/lib/rbac-new'
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'
import { z } from 'zod'

const patchBody = z.object({
  name: z.string().min(1).max(500).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()
  if (!(await hasEffectivePermission(user, 'masters:write'))) return forbiddenResponse()

  const { id } = await context.params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Invalid JSON', 400)
  }

  const parsed = patchBody.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.flatten().formErrors.join(', ') || 'Invalid body', 400)
  }

  const data: Prisma.TPAMasterUpdateInput = {}
  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim()
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive

  try {
    const updated = await prisma.tPAMaster.update({
      where: { id },
      data,
    })
    return successResponse({ item: updated })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return errorResponse('TPA not found', 404)
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return errorResponse('A TPA with this name already exists', 409)
    }
    throw e
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()
  if (!(await hasEffectivePermission(user, 'masters:write'))) return forbiddenResponse()

  const { id } = await context.params

  try {
    const updated = await prisma.tPAMaster.update({
      where: { id },
      data: { isActive: false },
    })
    return successResponse({ item: updated })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      return errorResponse('TPA not found', 404)
    }
    throw e
  }
}
