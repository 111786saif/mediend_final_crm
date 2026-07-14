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
import type { SeatingMiscCostRow } from '@/lib/finance/seating-misc-cost/types'

const createSchema = z.object({
  employeeIds: z.array(z.string().min(1)).min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  miscCost: z.number().min(0),
  status: z.enum(['PENDING', 'APPROVED', 'PAID']).optional(),
  remarks: z.string().max(2000).nullable().optional(),
})

function parsePeriod(searchParams: URLSearchParams) {
  const now = new Date()
  const month = searchParams.get('month') ? Number(searchParams.get('month')) : now.getMonth() + 1
  const year = searchParams.get('year') ? Number(searchParams.get('year')) : now.getFullYear()
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('Invalid month')
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Invalid year')
  return { month, year }
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:read')) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    let period
    try {
      period = parsePeriod(searchParams)
    } catch {
      return errorResponse('Invalid month or year', 400)
    }

    const search = searchParams.get('search')?.trim()
    const departmentId = searchParams.get('departmentId')

    const employeeWhere: Prisma.EmployeeWhereInput = { status: 'ACTIVE' }
    if (departmentId && departmentId !== 'all') {
      employeeWhere.departmentId = departmentId
    }
    if (search) {
      employeeWhere.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { employeeCode: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [employees, records, departments] = await Promise.all([
      prisma.employee.findMany({
        where: employeeWhere,
        select: {
          id: true,
          employeeCode: true,
          designation: true,
          departmentId: true,
          user: { select: { name: true } },
          department: { select: { name: true } },
          masterSeatingCost: { select: { id: true, amount: true } },
        },
        orderBy: { user: { name: 'asc' } },
      }),
      prisma.employeeMonthlySeatingMiscCost.findMany({
        where: { month: period.month, year: period.year },
        include: seatingMiscInclude,
      }),
      prisma.department.findMany({
        where: { employees: { some: { status: 'ACTIVE' } } },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ])

    const recordsByEmployee = new Map(records.map((r) => [r.employeeId, r]))

    const rows: SeatingMiscCostRow[] = employees.map((e) => {
      const record = recordsByEmployee.get(e.id)
      return {
        employeeId: e.id,
        employeeName: e.user.name,
        employeeCode: e.employeeCode,
        department: e.department?.name ?? null,
        departmentId: e.departmentId,
        designation: e.designation,
        recordId: record?.id ?? null,
        seatingCost: record?.seatingCost ?? null,
        miscCost: record?.miscCost ?? null,
        otherCost: record?.otherCost ?? null,
        month: period.month,
        year: period.year,
        status: record?.status ?? null,
        remarks: record?.remarks ?? null,
        masterSeatingAmount: e.masterSeatingCost?.amount ?? null,
        masterSeatingCostId: e.masterSeatingCost?.id ?? null,
      }
    })

    return successResponse({ rows, departments, month: period.month, year: period.year })
  } catch (error) {
    console.error('Error fetching seating & misc costs:', error)
    const errMsg = error instanceof Error ? error.message : ''
    const message =
      errMsg.includes('employeeMonthlySeatingMiscCost') ||
      errMsg.includes("Cannot read properties of undefined (reading 'findMany')")
        ? 'Seating & Misc Cost model not loaded. Run npx prisma generate and restart the dev server.'
        : 'Failed to fetch seating & misc costs'
    return errorResponse(message, 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:write')) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message ?? 'Invalid input', 400)
    }

    const { employeeIds, month, year, miscCost, status, remarks } = parsed.data

    const existing = await prisma.employeeMonthlySeatingMiscCost.findMany({
      where: { month, year, employeeId: { in: employeeIds } },
      include: {
        employee: { select: { employeeCode: true, user: { select: { name: true } } } },
      },
    })
    if (existing.length > 0) {
      const names = existing
        .map((e) => `${e.employee.user.name} (${e.employee.employeeCode})`)
        .join(', ')
      return errorResponse(`Cost already exists for this month: ${names}`, 409)
    }

    const masters = await prisma.employeeMasterSeatingCost.findMany({
      where: { employeeId: { in: employeeIds } },
      select: { id: true, employeeId: true, amount: true },
    })
    const masterByEmployee = new Map(masters.map((m) => [m.employeeId, m]))

    const created = await prisma.$transaction(
      employeeIds.map((employeeId) => {
        const master = masterByEmployee.get(employeeId)
        const recordStatus =
          (status as EmployeeSeatingMiscCostStatus) ?? EmployeeSeatingMiscCostStatus.PENDING
        return prisma.employeeMonthlySeatingMiscCost.create({
          data: {
            employeeId,
            month,
            year,
            seatingCost: master?.amount ?? 0,
            masterSeatingCostId: master?.id ?? null,
            miscCost,
            otherCost: 0,
            status: recordStatus,
            remarks: remarks?.trim() || null,
            createdByUserId: user.id,
          },
          include: seatingMiscInclude,
        })
      }),
    )

    for (const record of created) {
      await appendSeatingMiscHistory(
        record.id,
        'CREATED',
        {
          seatingCost: record.seatingCost,
          miscCost: record.miscCost,
          otherCost: record.otherCost,
          status: record.status,
          remarks: record.remarks,
        },
        user.id,
      )
    }

    return successResponse({
      records: created.map(mapSeatingMiscRecord),
      count: created.length,
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse('Duplicate entry for employee and month', 409)
    }
    console.error('Error creating seating & misc costs:', error)
    return errorResponse('Failed to create seating & misc costs', 500)
  }
}
