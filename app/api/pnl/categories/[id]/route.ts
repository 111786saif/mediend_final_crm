import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canReadPnl, canWritePnl } from '@/lib/pnl/auth-pnl'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWritePnl(user)) return errorResponse('Forbidden', 403)

    const { id } = await context.params
    const body = await request.json()
    const { name, sortOrder, isActive } = body

    const existing = await prisma.pnLCategory.findUnique({ where: { id } })
    if (!existing) return errorResponse('Not found', 404)

    const row = await prisma.pnLCategory.update({
      where: { id },
      data: {
        ...(name != null ? { name: String(name).trim() } : {}),
        ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    })

    return successResponse(row)
  } catch (error) {
    console.error('Error updating category:', error)
    return errorResponse('Failed to update category', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWritePnl(user)) return errorResponse('Forbidden', 403)

    const { id } = await context.params
    const existing = await prisma.pnLCategory.findUnique({ where: { id } })
    if (!existing) return errorResponse('Not found', 404)
    if (existing.isSystem && existing.sourceKey) {
      return errorResponse('Cannot delete system revenue/expense row; deactivate instead', 400)
    }

    await prisma.pnLCategory.update({
      where: { id },
      data: { isActive: false },
    })

    return successResponse({ ok: true })
  } catch (error) {
    console.error('Error deleting category:', error)
    return errorResponse('Failed to delete category', 500)
  }
}
