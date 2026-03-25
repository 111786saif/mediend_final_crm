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
    const project = await prisma.iTProject.findUnique({
      where: { id },
      include: {
        resources: {
          include: {
            employee: { include: { user: { select: { id: true, name: true, email: true } } } },
            freelancer: true,
          },
        },
        bookings: { orderBy: [{ year: 'asc' }, { month: 'asc' }] },
      },
    })

    if (!project) return errorResponse('Not found', 404)
    return successResponse(project)
  } catch (error) {
    console.error('Error fetching IT project:', error)
    return errorResponse('Failed to fetch project', 500)
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
    const {
      name,
      clientName,
      description,
      projectValue,
      billingType,
      monthlyBilling,
      startDate,
      endDate,
      status,
    } = body

    const existing = await prisma.iTProject.findUnique({ where: { id } })
    if (!existing) return errorResponse('Not found', 404)

    const project = await prisma.iTProject.update({
      where: { id },
      data: {
        ...(name != null ? { name: String(name).trim() } : {}),
        ...(clientName !== undefined ? { clientName: clientName?.trim() || null } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
        ...(projectValue !== undefined ? { projectValue: Number(projectValue) || 0 } : {}),
        ...(billingType ? { billingType } : {}),
        ...(monthlyBilling !== undefined ? { monthlyBilling: monthlyBilling != null ? Number(monthlyBilling) : null } : {}),
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
        ...(status ? { status } : {}),
      },
    })

    return successResponse(project)
  } catch (error) {
    console.error('Error updating IT project:', error)
    return errorResponse('Failed to update project', 500)
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
    await prisma.iTProject.delete({ where: { id } })
    return successResponse({ ok: true })
  } catch (error) {
    console.error('Error deleting IT project:', error)
    return errorResponse('Failed to delete project', 500)
  }
}
