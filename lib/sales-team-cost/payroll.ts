import { prisma } from '@/lib/prisma'

/**
 * Payroll-sourced monthly salary for an employee.
 * Wire to MonthlyPayroll / SalaryStructure when full integration is needed.
 */
export async function getSalaryForRole(employeeId: string): Promise<number> {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: {
      salary: true,
      salaryStructures: {
        orderBy: { effectiveFrom: 'desc' },
        take: 1,
        select: { monthlyGross: true },
      },
      monthlyPayrolls: {
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 1,
        select: { netPayable: true, adjustedGross: true },
      },
    },
  })

  if (!employee) return 0

  const fromPayroll = employee.monthlyPayrolls[0]?.adjustedGross ?? employee.monthlyPayrolls[0]?.netPayable
  if (fromPayroll != null && fromPayroll > 0) return fromPayroll

  const fromStructure = employee.salaryStructures[0]?.monthlyGross
  if (fromStructure != null && fromStructure > 0) return fromStructure

  return employee.salary ?? 0
}
