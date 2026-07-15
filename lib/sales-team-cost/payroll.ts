import { prisma } from '@/lib/prisma'

function pickSalary(employee: {
  salary: number | null
  salaryStructures: { monthlyGross: number | null }[]
  monthlyPayrolls: { netPayable: number | null; adjustedGross: number | null }[]
}): number {
  const fromPayroll = employee.monthlyPayrolls[0]?.adjustedGross ?? employee.monthlyPayrolls[0]?.netPayable
  if (fromPayroll != null && fromPayroll > 0) return fromPayroll

  const fromStructure = employee.salaryStructures[0]?.monthlyGross
  if (fromStructure != null && fromStructure > 0) return fromStructure

  return employee.salary ?? 0
}

/**
 * Payroll-sourced monthly salary for an employee.
 * Wire to MonthlyPayroll / SalaryStructure when full integration is needed.
 */
export async function getSalaryForRole(employeeId: string): Promise<number> {
  const map = await loadSalariesByEmployeeIds([employeeId])
  return map.get(employeeId) ?? 0
}

/** One query for many employees — avoids N+1 in sales team cost hierarchy. */
export async function loadSalariesByEmployeeIds(
  employeeIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (employeeIds.length === 0) return map

  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: {
      id: true,
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

  for (const employee of employees) {
    map.set(employee.id, pickSalary(employee))
  }
  return map
}
