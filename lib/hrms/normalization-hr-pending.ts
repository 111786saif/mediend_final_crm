import type { Prisma } from '@/generated/prisma/client'
import { employeeNotInMDManagedCohortWhere } from '@/lib/hierarchy'

/**
 * Pending normalizations HR can act on:
 * - MANAGER type (manager applied for a report)
 * - EMPLOYEE_REQUEST after the manager gate is cleared
 *   (manager approved, or skipped because the day was absent / no active manager)
 * Self-normalizations are auto-approved and never appear here.
 */
export function hrPendingNormalizationsWhere(): Prisma.AttendanceNormalizationWhereInput {
  return {
    status: 'PENDING',
    employee: employeeNotInMDManagedCohortWhere(),
    OR: [
      { type: 'MANAGER' },
      { type: 'EMPLOYEE_REQUEST', managerApprovedAt: { not: null } },
    ],
  }
}
