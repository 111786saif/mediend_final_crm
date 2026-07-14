import { NextRequest } from 'next/server'
import { z } from 'zod'
import { EmployeeSeatingMiscCostStatus, Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { seatingMiscInclude } from '@/lib/finance/seating-misc-cost/mapper'

const bulkSchema = z.object({
  costType: z.enum(['MISC', 'OTHER']),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  entries: z
    .array(
      z.object({
        employeeId: z.string().min(1),
        amount: z.number().min(0),
      }),
    )
    .min(1),
})

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:read')) return errorResponse('Forbidden', 403)

    const employees = await prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        employeeCode: true,
        user: { select: { name: true } },
        department: { select: { name: true } },
      },
      orderBy: { user: { name: 'asc' } },
    })

    return successResponse({
      employees: employees.map((e) => ({
        id: e.id,
        employeeCode: e.employeeCode,
        name: e.user.name,
        department: e.department?.name ?? null,
      })),
    })
  } catch (error) {
    console.error('Error listing employees for bulk costs:', error)
    return errorResponse('Failed to load employees', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:write')) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const parsed = bulkSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message ?? 'Invalid input', 400)
    }

    const { costType, month, year, entries } = parsed.data
    const employeeIds = [...new Set(entries.map((e) => e.employeeId))]
    const amountByEmployee = new Map(entries.map((e) => [e.employeeId, e.amount]))

    const [existingEmployees, existingRecords, masters] = await Promise.all([
      prisma.employee.findMany({
        where: { id: { in: employeeIds }, status: 'ACTIVE' },
        select: { id: true },
      }),
      prisma.employeeMonthlySeatingMiscCost.findMany({
        where: { month, year, employeeId: { in: employeeIds } },
      }),
      prisma.employeeMasterSeatingCost.findMany({
        where: { employeeId: { in: employeeIds } },
        select: { id: true, employeeId: true, amount: true },
      }),
    ])

    if (existingEmployees.length !== employeeIds.length) {
      return errorResponse('One or more employees were not found or are inactive', 400)
    }

    const recordByEmployee = new Map(existingRecords.map((r) => [r.employeeId, r]))
    const masterByEmployee = new Map(masters.map((m) => [m.employeeId, m]))

    const saved = await prisma.$transaction(async (tx) => {
      const results: { employeeId: string; recordId: string; amount: number }[] = []

      for (const employeeId of employeeIds) {
        const amount = amountByEmployee.get(employeeId) ?? 0
        const existing = recordByEmployee.get(employeeId)
        const master = masterByEmployee.get(employeeId)

        if (existing) {
          const updated = await tx.employeeMonthlySeatingMiscCost.update({
            where: { id: existing.id },
            data: {
              ...(costType === 'MISC' ? { miscCost: amount } : { otherCost: amount }),
              status: EmployeeSeatingMiscCostStatus.APPROVED,
              updatedByUserId: user.id,
            },
            include: seatingMiscInclude,
          })

          await tx.employeeMonthlySeatingMiscCostHistory.create({
            data: {
              recordId: updated.id,
              action: costType === 'MISC' ? 'MISC_BULK_UPSERT' : 'OTHER_BULK_UPSERT',
              seatingCost: updated.seatingCost,
              miscCost: updated.miscCost,
              otherCost: updated.otherCost,
              status: updated.status,
              remarks: updated.remarks,
              changedByUserId: user.id,
            },
          })

          results.push({ employeeId, recordId: updated.id, amount })
        } else {
          const created = await tx.employeeMonthlySeatingMiscCost.create({
            data: {
              employeeId,
              month,
              year,
              seatingCost: master?.amount ?? 0,
              masterSeatingCostId: master?.id ?? null,
              miscCost: costType === 'MISC' ? amount : 0,
              otherCost: costType === 'OTHER' ? amount : 0,
              status: EmployeeSeatingMiscCostStatus.APPROVED,
              createdByUserId: user.id,
            },
            include: seatingMiscInclude,
          })

          await tx.employeeMonthlySeatingMiscCostHistory.create({
            data: {
              recordId: created.id,
              action: costType === 'MISC' ? 'MISC_BULK_CREATE' : 'OTHER_BULK_CREATE',
              seatingCost: created.seatingCost,
              miscCost: created.miscCost,
              otherCost: created.otherCost,
              status: created.status,
              remarks: created.remarks,
              changedByUserId: user.id,
            },
          })

          results.push({ employeeId, recordId: created.id, amount })
        }
      }

      return results
    })

    return successResponse({
      costType,
      month,
      year,
      count: saved.length,
      records: saved,
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse('Duplicate entry for employee and month', 409)
    }
    console.error('Error saving bulk sales team costs:', error)
    return errorResponse('Failed to save costs', 500)
  }
}
