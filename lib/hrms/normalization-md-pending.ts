import type { Prisma } from '@/generated/prisma/client'

/**
 * Pending normalizations the MD may act on: only direct reports (same scope as MD team attendance).
 */
export function mdPendingNormalizationsWhere(mdEmployeeId: string): Prisma.AttendanceNormalizationWhereInput {
  return {
    status: 'PENDING',
    employee: { managerId: mdEmployeeId },
  }
}
