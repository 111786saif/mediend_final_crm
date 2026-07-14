import { NextRequest } from 'next/server'
import { z } from 'zod'
import { EmployeeIncentiveStatus, Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { incentiveInclude, mapIncentiveRecord } from '@/lib/incentives/mapper'

const updateSchema = z.object({
  amount: z.number().positive().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'PAID']).optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  note: z.string().max(2000).nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'incentive:write')) return errorResponse('Forbidden', 403)

    const { id } = await params
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message ?? 'Invalid input', 400)
    }

    const existing = await prisma.employeeMonthlyIncentive.findUnique({
      where: { id },
      select: { id: true, employeeId: true, month: true, year: true },
    })
    if (!existing) return errorResponse('Incentive record not found', 404)

    const nextMonth = parsed.data.month ?? existing.month
    const nextYear = parsed.data.year ?? existing.year

    if (nextMonth !== existing.month || nextYear !== existing.year) {
      const duplicate = await prisma.employeeMonthlyIncentive.findUnique({
        where: {
          employeeId_month_year: {
            employeeId: existing.employeeId,
            month: nextMonth,
            year: nextYear,
          },
        },
      })
      if (duplicate && duplicate.id !== id) {
        return errorResponse('An incentive already exists for this employee in the selected month', 409)
      }
    }

    const updated = await prisma.employeeMonthlyIncentive.update({
      where: { id },
      data: {
        ...(parsed.data.amount != null ? { amount: parsed.data.amount } : {}),
        ...(parsed.data.status ? { status: parsed.data.status as EmployeeIncentiveStatus } : {}),
        ...(parsed.data.month != null ? { month: parsed.data.month } : {}),
        ...(parsed.data.year != null ? { year: parsed.data.year } : {}),
        ...(parsed.data.note !== undefined ? { note: parsed.data.note?.trim() || null } : {}),
        updatedByUserId: user.id,
      },
      include: incentiveInclude,
    })

    return successResponse(mapIncentiveRecord(updated))
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse('Duplicate incentive entry for employee and month', 409)
    }
    console.error('Error updating incentive:', error)
    return errorResponse('Failed to update incentive', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'incentive:write')) return errorResponse('Forbidden', 403)

    const { id } = await params
    const existing = await prisma.employeeMonthlyIncentive.findUnique({ where: { id } })
    if (!existing) return errorResponse('Incentive record not found', 404)

    await prisma.employeeMonthlyIncentive.delete({ where: { id } })
    return successResponse({ id })
  } catch (error) {
    console.error('Error deleting incentive:', error)
    return errorResponse('Failed to delete incentive', 500)
  }
}
