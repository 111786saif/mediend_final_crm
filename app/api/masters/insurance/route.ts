import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasEffectivePermission } from '@/lib/rbac-new'
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'
import { z } from 'zod'

const postBody = z.object({
  name: z.string().min(1).max(500),
})

export async function GET(request: NextRequest) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() || ''
  const includeInactive =
    searchParams.get('includeInactive') === 'true' && (await hasEffectivePermission(user, 'masters:read'))

  const where: Prisma.InsuranceMasterWhereInput = {}
  if (!includeInactive) {
    where.isActive = true
  }
  if (search) {
    where.name = { contains: search, mode: 'insensitive' }
  }

  const items = await prisma.insuranceMaster.findMany({
    where,
    orderBy: { name: 'asc' },
    take: 500,
  })

  return successResponse({ items })
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

  const parsed = postBody.safeParse(body)
  if (!parsed.success) {
    return errorResponse(parsed.error.flatten().formErrors.join(', ') || 'Invalid body', 400)
  }

  try {
    const created = await prisma.insuranceMaster.create({
      data: { name: parsed.data.name.trim() },
    })
    return successResponse({ item: created })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return errorResponse('An insurance company with this name already exists', 409)
    }
    throw e
  }
}
