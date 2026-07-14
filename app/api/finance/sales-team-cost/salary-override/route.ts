import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getSalaryForRole } from '@/lib/sales-team-cost/payroll'
import type { SalaryOverrideHistoryEntry } from '@/lib/sales-team-cost/types'

const upsertSchema = z.object({
  employeeId: z.string().min(1),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  amount: z.number().min(0),
  reason: z.string().trim().min(1, 'Reason for change is required').max(2000),
})

function parsePeriod(searchParams: URLSearchParams) {
  const month = Number(searchParams.get('month'))
  const year = Number(searchParams.get('year'))
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('Invalid month')
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Invalid year')
  return { month, year }
}

/** GET salary override activity log for an employee (optionally filtered by month/year). */
export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:read')) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')?.trim()
    if (!employeeId) return errorResponse('employeeId is required', 400)

    const monthParam = searchParams.get('month')
    const yearParam = searchParams.get('year')
    const where: {
      employeeId: string
      month?: number
      year?: number
    } = { employeeId }

    if (monthParam || yearParam) {
      try {
        const period = parsePeriod(searchParams)
        where.month = period.month
        where.year = period.year
      } catch {
        return errorResponse('Invalid month or year', 400)
      }
    }

    const [history, override, payrollSalary, employee] = await Promise.all([
      prisma.employeeSalesTeamSalaryOverrideHistory.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: {
          employee: { select: { user: { select: { name: true } } } },
          updatedBy: { select: { name: true } },
        },
      }),
      monthParam && yearParam
        ? prisma.employeeSalesTeamSalaryOverride.findUnique({
            where: {
              employeeId_month_year: {
                employeeId,
                month: Number(monthParam),
                year: Number(yearParam),
              },
            },
          })
        : Promise.resolve(null),
      getSalaryForRole(employeeId),
      prisma.employee.findUnique({
        where: { id: employeeId },
        select: { user: { select: { name: true } } },
      }),
    ])

    if (!employee) return errorResponse('Employee not found', 404)

    const entries: SalaryOverrideHistoryEntry[] = history.map((h) => ({
      id: h.id,
      employeeId: h.employeeId,
      employeeName: h.employee.user.name,
      month: h.month,
      year: h.year,
      previousSalary: h.previousSalary,
      updatedSalary: h.updatedSalary,
      difference: h.difference,
      reason: h.reason,
      updatedBy: h.updatedBy.name,
      updatedAt: h.updatedAt.toISOString(),
    }))

    return successResponse({
      employeeId,
      employeeName: employee.user.name,
      payrollSalary,
      overrideAmount: override?.amount ?? null,
      displaySalary: override?.amount ?? payrollSalary,
      salaryIsOverride: override != null,
      history: entries,
    })
  } catch (error) {
    console.error('Error fetching salary override history:', error)
    const errMsg = error instanceof Error ? error.message : ''
    if (errMsg.includes('employeeSalesTeamSalaryOverride') || errMsg.includes('Unknown field')) {
      return errorResponse(
        'Salary override model not loaded. Run npm run db:generate and restart the Dev Server.',
        500,
      )
    }
    return errorResponse('Failed to fetch salary activity log', 500)
  }
}

/** Upsert Sales Team Cost salary override (does not modify Payroll). */
export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:write')) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const parsed = upsertSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message ?? 'Invalid input', 400)
    }

    const { employeeId, month, year, amount, reason } = parsed.data

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, user: { select: { name: true } } },
    })
    if (!employee) return errorResponse('Employee not found', 404)

    const [payrollSalary, existing] = await Promise.all([
      getSalaryForRole(employeeId),
      prisma.employeeSalesTeamSalaryOverride.findUnique({
        where: { employeeId_month_year: { employeeId, month, year } },
      }),
    ])

    const previousSalary = existing?.amount ?? payrollSalary
    if (previousSalary === amount) {
      return errorResponse('Updated salary is the same as the current value', 400)
    }

    const difference = amount - previousSalary

    const result = await prisma.$transaction(async (tx) => {
      const override = await tx.employeeSalesTeamSalaryOverride.upsert({
        where: { employeeId_month_year: { employeeId, month, year } },
        create: {
          employeeId,
          month,
          year,
          amount,
          reason,
          updatedByUserId: user.id,
        },
        update: {
          amount,
          reason,
          updatedByUserId: user.id,
        },
      })

      const history = await tx.employeeSalesTeamSalaryOverrideHistory.create({
        data: {
          employeeId,
          month,
          year,
          previousSalary,
          updatedSalary: amount,
          difference,
          reason,
          updatedByUserId: user.id,
        },
        include: {
          employee: { select: { user: { select: { name: true } } } },
          updatedBy: { select: { name: true } },
        },
      })

      return { override, history }
    })

    const historyEntry: SalaryOverrideHistoryEntry = {
      id: result.history.id,
      employeeId: result.history.employeeId,
      employeeName: result.history.employee.user.name,
      month: result.history.month,
      year: result.history.year,
      previousSalary: result.history.previousSalary,
      updatedSalary: result.history.updatedSalary,
      difference: result.history.difference,
      reason: result.history.reason,
      updatedBy: result.history.updatedBy.name,
      updatedAt: result.history.updatedAt.toISOString(),
    }

    return successResponse({
      employeeId,
      employeeName: employee.user.name,
      payrollSalary,
      overrideAmount: result.override.amount,
      displaySalary: result.override.amount,
      salaryIsOverride: true,
      historyEntry,
    })
  } catch (error) {
    console.error('Error saving salary override:', error)
    const errMsg = error instanceof Error ? error.message : String(error)
    if (
      errMsg.includes('employeeSalesTeamSalaryOverride') ||
      errMsg.includes('Unknown field') ||
      errMsg.includes("Cannot read properties of undefined (reading 'findUnique')") ||
      errMsg.includes("Cannot read properties of undefined (reading 'findMany')") ||
      errMsg.includes("Cannot read properties of undefined (reading 'upsert')")
    ) {
      return errorResponse(
        'Salary override model not loaded. Run npm run db:generate and restart the Dev Server.',
        500,
      )
    }
    return errorResponse('Failed to save salary override', 500)
  }
}
