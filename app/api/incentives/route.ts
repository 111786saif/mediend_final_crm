import { NextRequest } from 'next/server'
import { z } from 'zod'
import { EmployeeIncentiveStatus, Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { incentiveInclude, mapIncentiveRecord } from '@/lib/incentives/mapper'
import {
  canCreateEffectiveIncentives,
  canReadEffectiveIncentives,
} from '@/lib/incentives/permissions-server'
import type { IncentiveEmployeeOption } from '@/lib/incentives/types'

const entrySchema = z.object({
  employeeId: z.string().min(1),
  amount: z.number().positive(),
})

const createSchema = z
  .object({
    employeeIds: z.array(z.string().min(1)).optional(),
    entries: z.array(entrySchema).optional(),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(2000).max(2100),
    amount: z.number().positive().optional(),
    status: z.enum(['PENDING', 'APPROVED', 'PAID']).optional(),
    note: z.string().max(2000).nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.entries && data.entries.length > 0) return true
      return Boolean(data.employeeIds?.length && data.amount)
    },
    { message: 'Provide entries or employeeIds with amount' },
  )

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!(await canReadEffectiveIncentives(user))) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month')
    const year = searchParams.get('year')
    const status = searchParams.get('status')
    const search = searchParams.get('search')?.trim()

    const where: Prisma.EmployeeMonthlyIncentiveWhereInput = {}
    if (month) where.month = Number(month)
    if (year) where.year = Number(year)
    if (status && ['PENDING', 'APPROVED', 'PAID'].includes(status)) {
      where.status = status as EmployeeIncentiveStatus
    }
    if (search) {
      where.employee = {
        OR: [
          { user: { name: { contains: search, mode: 'insensitive' } } },
          { employeeCode: { contains: search, mode: 'insensitive' } },
          { designation: { contains: search, mode: 'insensitive' } },
          { department: { name: { contains: search, mode: 'insensitive' } } },
        ],
      }
    }

    const [records, employees] = await Promise.all([
      prisma.employeeMonthlyIncentive.findMany({
        where,
        include: incentiveInclude,
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { employee: { user: { name: 'asc' } } }],
      }),
      prisma.employee.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          employeeCode: true,
          designation: true,
          user: { select: { name: true } },
          department: { select: { name: true } },
        },
        orderBy: { user: { name: 'asc' } },
      }),
    ])

    const employeeOptions: IncentiveEmployeeOption[] = employees.map((e) => ({
      id: e.id,
      employeeCode: e.employeeCode,
      name: e.user.name,
      department: e.department?.name ?? null,
      designation: e.designation,
    }))

    return successResponse({
      records: records.map(mapIncentiveRecord),
      employees: employeeOptions,
    })
  } catch (error) {
    console.error('Error fetching incentives:', error)
    const message =
      error instanceof Error && error.message.includes('employeeMonthlyIncentive')
        ? 'Incentive model not loaded. Restart the dev server after running npx prisma generate.'
        : 'Failed to fetch incentives'
    return errorResponse(message, 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!(await canCreateEffectiveIncentives(user))) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message ?? 'Invalid input', 400)
    }

    const { month, year, note } = parsed.data
    const status = EmployeeIncentiveStatus.PENDING

    const rows =
      parsed.data.entries && parsed.data.entries.length > 0
        ? parsed.data.entries
        : parsed.data.employeeIds!.map((employeeId) => ({
            employeeId,
            amount: parsed.data.amount!,
          }))

    const employeeIds = rows.map((r) => r.employeeId)

    const existing = await prisma.employeeMonthlyIncentive.findMany({
      where: {
        month,
        year,
        employeeId: { in: employeeIds },
      },
      include: {
        employee: { select: { employeeCode: true, user: { select: { name: true } } } },
      },
    })

    if (existing.length > 0) {
      const names = existing.map((e) => `${e.employee.user.name} (${e.employee.employeeCode})`).join(', ')
      return errorResponse(`Incentive already exists for this month: ${names}`, 409)
    }

    const created = await prisma.$transaction(
      rows.map(({ employeeId, amount }) =>
        prisma.employeeMonthlyIncentive.create({
          data: {
            employeeId,
            month,
            year,
            amount,
            status,
            note: note?.trim() || null,
            createdByUserId: user.id,
          },
          include: incentiveInclude,
        }),
      ),
    )

    return successResponse({
      records: created.map(mapIncentiveRecord),
      count: created.length,
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse('Duplicate incentive entry for employee and month', 409)
    }
    console.error('Error creating incentives:', error)
    return errorResponse('Failed to create incentives', 500)
  }
}
