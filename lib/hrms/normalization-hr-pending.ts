import type { Prisma } from '@/generated/prisma/client'
import { employeeNotInMDManagedCohortWhere } from '@/lib/hierarchy'

/**
 * Pending normalizations HR can act on:
 * - MANAGER type (manager applied for a report)
 * - EMPLOYEE_REQUEST (employee submitted directly to HR)
 * Self-normalizations are auto-approved and never appear here.
 */
export function hrPendingNormalizationsWhere(): Prisma.AttendanceNormalizationWhereInput {
  return {
    status: 'PENDING',
    employee: employeeNotInMDManagedCohortWhere(),
    type: { in: ['MANAGER', 'EMPLOYEE_REQUEST'] },
  }
}
