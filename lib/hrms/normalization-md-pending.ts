import type { Prisma } from '@/generated/prisma/client'
import { employeeMDManagedCohortWhere } from '@/lib/hierarchy'

/**
 * Pending normalization rows the MD may act on: direct-report employee requests (pre-manager),
 * or cohort-wide final approval (manager-submitted or manager-approved employee requests).
 */
export function mdPendingNormalizationsWhere(mdEmployeeId: string): Prisma.AttendanceNormalizationWhereInput {
  const cohort = employeeMDManagedCohortWhere()
  return {
    status: 'PENDING',
    OR: [
      {
        type: 'EMPLOYEE_REQUEST',
        managerApprovedAt: null,
        employee: { managerId: mdEmployeeId },
      },
      {
        employee: {
          AND: [cohort, { id: { not: mdEmployeeId } }],
        },
        OR: [
          { type: 'MANAGER' },
          {
            type: 'EMPLOYEE_REQUEST',
            managerApprovedAt: { not: null },
          },
        ],
      },
    ],
  }
}
