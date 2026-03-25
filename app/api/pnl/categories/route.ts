import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canReadPnl, canWritePnl } from '@/lib/pnl/auth-pnl'
import { ensureDefaultPnLCategories } from '@/lib/pnl/ensure-default-categories'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canReadPnl(user)) return errorResponse('Forbidden', 403)

    await ensureDefaultPnLCategories()

    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const data = await prisma.pnLCategory.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    })

    return successResponse({ data })
  } catch (error) {
    console.error('Error fetching PnL categories:', error)
    return errorResponse('Failed to fetch categories', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWritePnl(user)) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const { name, type, sortOrder, departmentKey } = body
    if (!name || !type) return errorResponse('name and type required', 400)
    if (type !== 'REVENUE' && type !== 'EXPENSE') return errorResponse('Invalid type', 400)

    const maxSort = await prisma.pnLCategory.aggregate({ _max: { sortOrder: true } })
    const nextOrder = (maxSort._max.sortOrder ?? 0) + 1

    const dk =
      departmentKey != null && String(departmentKey).trim() !== ''
        ? String(departmentKey).trim().toUpperCase()
        : null

    const row = await prisma.pnLCategory.create({
      data: {
        name: String(name).trim(),
        type,
        isSystem: false,
        sortOrder: sortOrder != null ? Number(sortOrder) : nextOrder,
        isActive: true,
        departmentKey: type === 'EXPENSE' ? dk : null,
        createdById: user.id,
      },
    })

    return successResponse(row)
  } catch (error) {
    console.error('Error creating category:', error)
    return errorResponse('Failed to create category', 500)
  }
}
