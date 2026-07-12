import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'
import { z } from 'zod'

const postBody = z.object({
  name: z.string().min(1).max(500),
  address: z.string().max(10000).optional().nullable(),
  googleMapLink: z.string().max(2000).optional().nullable().or(z.literal('')),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() || ''
  const includeInactive =
    searchParams.get('includeInactive') === 'true' && hasPermission(user, 'masters:read')

  const where: Prisma.HospitalMasterWhereInput = {}
  if (!includeInactive) {
    where.isActive = true
  }
  if (search) {
    where.name = { contains: search, mode: 'insensitive' }
  }

  const items = await prisma.hospitalMaster.findMany({
    where,
    orderBy: { name: 'asc' },
    take: 500,
  })

  return successResponse({ items })
}

export async function POST(request: NextRequest) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()
  if (!hasPermission(user, 'masters:write')) return forbiddenResponse()

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

  const { name, address, googleMapLink, isActive } = parsed.data
  const link = googleMapLink === '' ? null : googleMapLink ?? null

  try {
    const created = await prisma.hospitalMaster.create({
      data: {
        name: name.trim(),
        address: address?.trim() || null,
        googleMapLink: link,
        isActive: isActive ?? true,
      },
    })
    return successResponse({ item: created })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return errorResponse('A hospital with this name already exists', 409)
    }
    throw e
  }
}
