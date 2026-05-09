import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const { id: payrollId } = await params
    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      include: { user: true, department: true },
    })

    const monthlyPayroll = await prisma.monthlyPayroll.findUnique({
      where: { id: payrollId },
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            joinDate: true,
            designation: true,
            panNumber: true,
            bankAccountNumber: true,
            uanNumber: true,
            user: { select: { id: true, name: true, email: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
    })
    if (monthlyPayroll) {
      const isOwn = employee?.id === monthlyPayroll.employeeId
      const hasPayrollPermission = hasPermission(user, 'hrms:payroll:read') || hasPermission(user, 'finance:payroll:read')
      if (!isOwn && !hasPayrollPermission) return errorResponse('Forbidden', 403)
      // Employees can only see APPROVED or PAID; finance/HR can see DRAFT too
      if (isOwn && monthlyPayroll.status === 'DRAFT') return errorResponse('Payroll not yet released', 404)
      const salaryStructure = await prisma.salaryStructure.findFirst({
        where: { employeeId: monthlyPayroll.employeeId },
        orderBy: { effectiveFrom: 'desc' },
        select: {
          basicSalary: true,
          hraAllowance: true,
          medicalAllowance: true,
          conveyanceAllowance: true,
          otherAllowance: true,
          specialAllowance: true,
          monthlyGross: true,
          annualCtc: true,
          applyPf: true,
        },
      })
      return successResponse({ type: 'monthly', ...monthlyPayroll, salaryStructure: salaryStructure ?? null })
    }

    const payrollRecord = await prisma.payrollRecord.findUnique({
      where: { id: payrollId },
      include: {
        components: true,
        employee: {
          include: {
            user: { select: { id: true, name: true, email: true } },
            department: { select: { id: true, name: true } },
          },
        },
      },
    })
    if (!payrollRecord) return errorResponse('Payroll record not found', 404)

    const isOwnPayroll = employee?.id === payrollRecord.employeeId
    const canView = isOwnPayroll || hasPermission(user, 'hrms:payroll:read')
    if (!canView) return errorResponse('Forbidden', 403)

    return successResponse({ type: 'legacy', ...payrollRecord })
  } catch (error) {
    console.error('Error fetching payroll record:', error)
    return errorResponse('Failed to fetch payroll record', 500)
  }
}

