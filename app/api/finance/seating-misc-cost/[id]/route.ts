import { NextRequest } from 'next/server'
import { z } from 'zod'
import { EmployeeSeatingMiscCostStatus, Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  appendSeatingMiscHistory,
  mapSeatingMiscRecord,
  seatingMiscInclude,
} from '@/lib/finance/seating-misc-cost/mapper'

const updateSchema = z.object({
  miscCost: z.number().min(0).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'PAID']).optional(),
  remarks: z.string().max(2000).nullable().optional(),
  refreshSeatingFromMaster: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:write')) return errorResponse('Forbidden', 403)

    const { id } = await params
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message ?? 'Invalid input', 400)
    }

    const existing = await prisma.employeeMonthlySeatingMiscCost.findUnique({
      where: { id },
      include: { employee: { select: { masterSeatingCost: { select: { id: true, amount: true } } } } },
    })
    if (!existing) return errorResponse('Record not found', 404)

    let seatingCost = existing.seatingCost
    let masterSeatingCostId = existing.masterSeatingCostId

    if (parsed.data.refreshSeatingFromMaster) {
      const master = existing.employee.masterSeatingCost
      if (!master) {
        return errorResponse('No master seating cost configured for this employee', 400)
      }
      seatingCost = master.amount
      masterSeatingCostId = master.id
    }

    const updated = await prisma.employeeMonthlySeatingMiscCost.update({
      where: { id },
      data: {
        seatingCost,
        masterSeatingCostId,
        miscCost: parsed.data.miscCost ?? undefined,
        status: parsed.data.status
          ? (parsed.data.status as EmployeeSeatingMiscCostStatus)
          : undefined,
        remarks: parsed.data.remarks !== undefined ? parsed.data.remarks?.trim() || null : undefined,
        updatedByUserId: user.id,
      },
      include: seatingMiscInclude,
    })

    await appendSeatingMiscHistory(
      updated.id,
      'UPDATED',
      {
        seatingCost: updated.seatingCost,
        miscCost: updated.miscCost,
        otherCost: updated.otherCost,
        status: updated.status,
        remarks: updated.remarks,
      },
      user.id,
    )

    return successResponse(mapSeatingMiscRecord(updated))
  } catch (error) {
    console.error('Error updating seating & misc cost:', error)
    return errorResponse('Failed to update record', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:write')) return errorResponse('Forbidden', 403)

    const { id } = await params
    const existing = await prisma.employeeMonthlySeatingMiscCost.findUnique({ where: { id } })
    if (!existing) return errorResponse('Record not found', 404)

    await appendSeatingMiscHistory(
      existing.id,
      'DELETED',
      {
        seatingCost: existing.seatingCost,
        miscCost: existing.miscCost,
        otherCost: existing.otherCost,
        status: existing.status,
        remarks: existing.remarks,
      },
      user.id,
    )

    await prisma.employeeMonthlySeatingMiscCost.delete({ where: { id } })
    return successResponse({ id })
  } catch (error) {
    console.error('Error deleting seating & misc cost:', error)
    return errorResponse('Failed to delete record', 500)
  }
}
