import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canWriteItPnl } from '@/lib/pnl/auth-it-pnl'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; resourceId: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWriteItPnl(user)) return errorResponse('Forbidden', 403)

    const { id: projectId, resourceId } = await context.params
    const existing = await prisma.iTProjectResource.findFirst({
      where: { id: resourceId, projectId },
    })
    if (!existing) return errorResponse('Not found', 404)

    const body = await request.json()
    const {
      resourceName,
      allocationPercent,
      paymentType,
      monthlyCost,
      oneTimeCost,
      startDate,
      endDate,
      isActive,
      seatCostApplied,
    } = body

    const resource = await prisma.iTProjectResource.update({
      where: { id: resourceId },
      data: {
        ...(resourceName !== undefined ? { resourceName: resourceName || null } : {}),
        ...(allocationPercent !== undefined ? { allocationPercent: Number(allocationPercent) || 0 } : {}),
        ...(paymentType ? { paymentType } : {}),
        ...(monthlyCost !== undefined ? { monthlyCost: Number(monthlyCost) || 0 } : {}),
        ...(oneTimeCost !== undefined ? { oneTimeCost: Number(oneTimeCost) || 0 } : {}),
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        ...(seatCostApplied !== undefined ? { seatCostApplied: Boolean(seatCostApplied) } : {}),
      },
      include: {
        employee: { include: { user: { select: { id: true, name: true, email: true } } } },
        freelancer: true,
      },
    })

    return successResponse(resource)
  } catch (error) {
    console.error('Error updating resource:', error)
    return errorResponse('Failed to update resource', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; resourceId: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWriteItPnl(user)) return errorResponse('Forbidden', 403)

    const { id: projectId, resourceId } = await context.params
    const existing = await prisma.iTProjectResource.findFirst({
      where: { id: resourceId, projectId },
    })
    if (!existing) return errorResponse('Not found', 404)

    await prisma.iTProjectResource.delete({ where: { id: resourceId } })
    return successResponse({ ok: true })
  } catch (error) {
    console.error('Error deleting resource:', error)
    return errorResponse('Failed to delete resource', 500)
  }
}
