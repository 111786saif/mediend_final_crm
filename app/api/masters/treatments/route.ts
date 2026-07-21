import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'
import { z } from 'zod'

const postBody = z.object({
  name: z.string().min(1).max(500),
  category: z.string().min(1).max(200),
  atsNewDelhi: z.number().min(0).nullable().optional(),
  atsMumbai: z.number().min(0).nullable().optional(),
  atsPune: z.number().min(0).nullable().optional(),
  atsHyderabad: z.number().min(0).nullable().optional(),
  atsBangalore: z.number().min(0).nullable().optional(),
})

export async function GET(request: NextRequest) {
  const user = getSessionFromRequest(request)
  if (!user) return unauthorizedResponse()

  const sp = request.nextUrl.searchParams
  const search = sp.get('search')?.trim() || ''
  const includeInactive =
    sp.get('includeInactive') === 'true' && hasPermission(user, 'masters:read')
  const category = sp.get('category')?.trim() || ''

  const where: Prisma.TreatmentMasterWhereInput = {}
  if (!includeInactive) where.isActive = true
  if (search) where.name = { contains: search, mode: 'insensitive' }
  if (category) where.category = { contains: category, mode: 'insensitive' }

  const items = await prisma.treatmentMaster.findMany({
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

  try {
    const item = await prisma.treatmentMaster.create({
      data: {
        name: parsed.data.name.trim(),
        category: parsed.data.category.trim(),
        atsNewDelhi: parsed.data.atsNewDelhi ?? null,
        atsMumbai: parsed.data.atsMumbai ?? null,
        atsPune: parsed.data.atsPune ?? null,
        atsHyderabad: parsed.data.atsHyderabad ?? null,
        atsBangalore: parsed.data.atsBangalore ?? null,
      },
    })
    return successResponse({ item }, 'Treatment created')
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return errorResponse('A treatment with this name already exists', 409)
    }
    throw e
  }
}
