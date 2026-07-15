import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Prisma, SalesTeamBulkCostType } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  listBulkCostEntries,
  mapBulkCostEntry,
} from '@/lib/sales-team-cost/bulk-cost-entries'

const periodSchema = z.object({
  costType: z.enum(['MISC', 'OTHER']),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
})

const saveSchema = z
  .object({
    costType: z.enum(['MISC', 'OTHER']),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2000).max(2100),
    entries: z
      .array(
        z.object({
          id: z.string().min(1).optional(),
          amount: z.number().min(0),
          remark: z.string().trim().min(1, 'Remark is required'),
          employeeId: z.string().min(1).nullable().optional(),
        }),
      )
      .default([]),
    deletedIds: z.array(z.string().min(1)).optional().default([]),
  })
  .refine((data) => data.entries.length > 0 || data.deletedIds.length > 0, {
    message: 'Add at least one entry or delete an existing entry',
  })

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:read')) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const costTypeParam = searchParams.get('costType')
    const monthParam = searchParams.get('month')
    const yearParam = searchParams.get('year')

    // Employees list (for picker) when no period filters.
    if (!costTypeParam || !monthParam || !yearParam) {
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
    }

    const parsed = periodSchema.safeParse({
      costType: costTypeParam,
      month: monthParam,
      year: yearParam,
    })
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message ?? 'Invalid filters', 400)
    }

    const entries = await listBulkCostEntries(
      { month: parsed.data.month, year: parsed.data.year },
      parsed.data.costType as SalesTeamBulkCostType,
    )

    return successResponse({ entries })
  } catch (error) {
    console.error('Error listing sales team bulk costs:', error)
    return errorResponse('Failed to load bulk costs', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:write')) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const parsed = saveSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message ?? 'Invalid input', 400)
    }

    const { costType, month, year, entries, deletedIds } = parsed.data
    const costTypeEnum = costType as SalesTeamBulkCostType

    const employeeIds = [
      ...new Set(
        entries
          .map((e) => e.employeeId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ]

    if (employeeIds.length > 0) {
      const existingEmployees = await prisma.employee.findMany({
        where: { id: { in: employeeIds }, status: 'ACTIVE' },
        select: { id: true },
      })
      if (existingEmployees.length !== employeeIds.length) {
        return errorResponse('One or more employees were not found or are inactive', 400)
      }
    }

    const existingIds = entries.map((e) => e.id).filter((id): id is string => !!id)
    const existingRows =
      existingIds.length > 0
        ? await prisma.salesTeamBulkCostEntry.findMany({
            where: { id: { in: existingIds }, costType: costTypeEnum },
            include: {
              employee: { select: { user: { select: { name: true } } } },
            },
          })
        : []
    const existingById = new Map(existingRows.map((r) => [r.id, r]))

    if (existingIds.some((id) => !existingById.has(id))) {
      return errorResponse('One or more entries to update were not found', 404)
    }

    const deleteRows =
      deletedIds.length > 0
        ? await prisma.salesTeamBulkCostEntry.findMany({
            where: { id: { in: deletedIds }, costType: costTypeEnum },
            include: {
              employee: { select: { user: { select: { name: true } } } },
            },
          })
        : []
    const deleteById = new Map(deleteRows.map((r) => [r.id, r]))

    const employeeNameById = new Map<string, string>()
    if (employeeIds.length > 0) {
      const empNames = await prisma.employee.findMany({
        where: { id: { in: employeeIds } },
        select: { id: true, user: { select: { name: true } } },
      })
      for (const e of empNames) employeeNameById.set(e.id, e.user.name)
    }

    const saved = await prisma.$transaction(async (tx) => {
      const results = []

      for (const del of deleteRows) {
        await tx.salesTeamBulkCostEntryHistory.create({
          data: {
            entryId: del.id,
            costType: del.costType,
            month: del.month,
            year: del.year,
            action: 'DELETE',
            amount: del.amount,
            remark: del.remark,
            employeeId: del.employeeId,
            employeeName: del.employee?.user.name ?? null,
            changedByUserId: user.id,
          },
        })
        await tx.salesTeamBulkCostEntry.delete({ where: { id: del.id } })
      }

      for (const entry of entries) {
        const employeeId = entry.employeeId || null
        const employeeName = employeeId ? (employeeNameById.get(employeeId) ?? null) : null

        if (entry.id) {
          const prev = existingById.get(entry.id)!
          const changed =
            prev.amount !== entry.amount ||
            prev.remark !== entry.remark ||
            (prev.employeeId ?? null) !== employeeId

          const updated = await tx.salesTeamBulkCostEntry.update({
            where: { id: entry.id },
            data: {
              amount: entry.amount,
              remark: entry.remark,
              employeeId,
              month,
              year,
              updatedByUserId: user.id,
            },
            include: {
              employee: {
                select: {
                  id: true,
                  employeeCode: true,
                  user: { select: { name: true } },
                },
              },
              createdBy: { select: { name: true } },
              updatedBy: { select: { name: true } },
            },
          })

          if (changed) {
            await tx.salesTeamBulkCostEntryHistory.create({
              data: {
                entryId: updated.id,
                costType: updated.costType,
                month: updated.month,
                year: updated.year,
                action: 'UPDATE',
                amount: updated.amount,
                remark: updated.remark,
                employeeId: updated.employeeId,
                employeeName: updated.employee?.user.name ?? null,
                previousAmount: prev.amount,
                previousRemark: prev.remark,
                previousEmployeeId: prev.employeeId,
                previousEmployeeName: prev.employee?.user.name ?? null,
                changedByUserId: user.id,
              },
            })
          }

          results.push(mapBulkCostEntry(updated))
        } else {
          const created = await tx.salesTeamBulkCostEntry.create({
            data: {
              costType: costTypeEnum,
              month,
              year,
              amount: entry.amount,
              remark: entry.remark,
              employeeId,
              createdByUserId: user.id,
            },
            include: {
              employee: {
                select: {
                  id: true,
                  employeeCode: true,
                  user: { select: { name: true } },
                },
              },
              createdBy: { select: { name: true } },
              updatedBy: { select: { name: true } },
            },
          })

          await tx.salesTeamBulkCostEntryHistory.create({
            data: {
              entryId: created.id,
              costType: created.costType,
              month: created.month,
              year: created.year,
              action: 'CREATE',
              amount: created.amount,
              remark: created.remark,
              employeeId: created.employeeId,
              employeeName: employeeName ?? created.employee?.user.name ?? null,
              changedByUserId: user.id,
            },
          })

          results.push(mapBulkCostEntry(created))
        }
      }

      return results
    })

    return successResponse({
      costType,
      month,
      year,
      count: saved.length,
      deleted: deletedIds.filter((id) => deleteById.has(id)).length,
      entries: saved,
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return errorResponse('Entry not found', 404)
    }
    console.error('Error saving sales team bulk costs:', error)
    return errorResponse('Failed to save costs', 500)
  }
}
