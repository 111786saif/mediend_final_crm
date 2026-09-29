import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
    })

    if (!employee) {
      return errorResponse('Employee record not found', 404)
    }

    const [payrollRecords, monthlyPayrolls] = await Promise.all([
      prisma.payrollRecord.findMany({
        where: { employeeId: employee.id },
        // This endpoint drives the employee's payroll list. Amounts remain
        // available only in the individually authorized payslip download.
        select: {
          id: true,
          month: true,
          year: true,
          disbursedAt: true,
          status: true,
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
      prisma.monthlyPayroll.findMany({
        where: {
          employeeId: employee.id,
          status: { in: ['APPROVED', 'PAID'] },
        },
        select: {
          id: true,
          month: true,
          year: true,
          status: true,
        },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
      }),
    ])

    return successResponse({
      monthlyPayrolls,
      payrollRecords,
    })
  } catch (error) {
    console.error('Error fetching payroll:', error)
    return errorResponse('Failed to fetch payroll records', 500)
  }
}

