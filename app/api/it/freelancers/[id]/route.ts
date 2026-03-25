import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canReadItPnl, canWriteItPnl } from '@/lib/pnl/auth-it-pnl'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(_request)
    if (!user) return unauthorizedResponse()
    if (!canReadItPnl(user)) return errorResponse('Forbidden', 403)

    const { id } = await context.params
    const row = await prisma.iTFreelancer.findUnique({ where: { id } })
    if (!row) return errorResponse('Not found', 404)
    return successResponse(row)
  } catch (error) {
    console.error('Error fetching freelancer:', error)
    return errorResponse('Failed to fetch freelancer', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWriteItPnl(user)) return errorResponse('Forbidden', 403)

    const { id } = await context.params
    const body = await request.json()
    const { name, email, phone, skill, isActive } = body

    const row = await prisma.iTFreelancer.update({
      where: { id },
      data: {
        ...(name != null ? { name: String(name).trim() } : {}),
        ...(email !== undefined ? { email: email?.trim() || null } : {}),
        ...(phone !== undefined ? { phone: phone?.trim() || null } : {}),
        ...(skill !== undefined ? { skill: skill?.trim() || null } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
      },
    })

    return successResponse(row)
  } catch (error) {
    console.error('Error updating freelancer:', error)
    return errorResponse('Failed to update freelancer', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWriteItPnl(user)) return errorResponse('Forbidden', 403)

    const { id } = await context.params
    await prisma.iTFreelancer.delete({ where: { id } })
    return successResponse({ ok: true })
  } catch (error) {
    console.error('Error deleting freelancer:', error)
    return errorResponse('Failed to delete freelancer', 500)
  }
}
