import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canAccessMasterSeatingCost } from '@/lib/finance/master-seating-cost/types'

const updateSchema = z.object({
  amount: z.number().positive(),
  note: z.string().max(2000).nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canAccessMasterSeatingCost(user)) return errorResponse('Forbidden', 403)

    const { id } = await params
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message ?? 'Invalid input', 400)
    }

    const existing = await prisma.employeeMasterSeatingCost.findUnique({ where: { id } })
    if (!existing) return errorResponse('Seating cost record not found', 404)

    const updated = await prisma.employeeMasterSeatingCost.update({
      where: { id },
      data: {
        amount: parsed.data.amount,
        note: parsed.data.note !== undefined ? parsed.data.note?.trim() || null : undefined,
        updatedByUserId: user.id,
      },
    })

    return successResponse({
      id: updated.id,
      employeeId: updated.employeeId,
      amount: updated.amount,
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error('Error updating master seating cost:', error)
    return errorResponse('Failed to update seating cost', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canAccessMasterSeatingCost(user)) return errorResponse('Forbidden', 403)

    const { id } = await params
    const existing = await prisma.employeeMasterSeatingCost.findUnique({ where: { id } })
    if (!existing) return errorResponse('Seating cost record not found', 404)

    await prisma.employeeMasterSeatingCost.delete({ where: { id } })
    return successResponse({ id })
  } catch (error) {
    console.error('Error deleting master seating cost:', error)
    return errorResponse('Failed to delete seating cost', 500)
  }
}
