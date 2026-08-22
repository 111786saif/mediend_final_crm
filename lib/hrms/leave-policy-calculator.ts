import { prisma } from '@/lib/prisma'
import { differenceInMonths } from 'date-fns'

export interface ComputedBalance {
  leaveTypeId: string
  leaveTypeName: string
  allocated: number
  used: number
  remaining: number
  locked: number
  carryForward: boolean
  isProbation: boolean
}

const PROBATION_MONTHS = 6

/**
 * Compute leave balances from policy: monthly accrual + approved leave history.
 * Policy: CL 1/month, SL 0.5/month, EL 0.5/month. Pure accrual, no bonus at month 7.
 */
export async function getComputedBalancesForEmployee(
  employeeId: string
): Promise<ComputedBalance[]> {
  const [employeeResult, leaveTypes, approvedLeaves, dbBalances] = await Promise.all([
    prisma.$queryRaw<
      Array<{ joinDate: Date | null; isProbation: boolean }>
    >`
      SELECT
        e."joinDate",
        (e."joinDate" IS NOT NULL AND e."joinDate"::date > ((CURRENT_DATE - INTERVAL '6 months')::date)) AS "isProbation"
      FROM "Employee" e
      WHERE e.id = ${employeeId}
    `,
    prisma.leaveTypeMaster.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        monthlyAccrual: true,
        carryForward: true,
      },
    }),
    prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
      },
      select: { leaveTypeId: true, days: true },
    }),
    prisma.leaveBalance.findMany({
      where: { employeeId },
      select: { leaveTypeId: true, allocated: true },
    }),
  ])

  const row = employeeResult[0]
  const joinDate = row?.joinDate ?? null
  const isProbation = row?.isProbation ?? false
  const now = new Date()

  const usedByLeaveType = new Map<string, number>()
  for (const l of approvedLeaves) {
    usedByLeaveType.set(l.leaveTypeId, (usedByLeaveType.get(l.leaveTypeId) ?? 0) + l.days)
  }

  const dbBalanceByLeaveType = new Map(dbBalances.map((b) => [b.leaveTypeId, b]))

  const balances: ComputedBalance[] = leaveTypes.map((lt) => {
    let allocated = 0
    let locked = 0

    const dbBalance = dbBalanceByLeaveType.get(lt.id)
    if (dbBalance && !isProbation) {
      // Active employee with imported balance: use DB allocated, subtract CRM-approved leaves
      allocated = dbBalance.allocated
      locked = 0
    } else if (joinDate) {
      // Probation / new employee: use DOJ formula (no DB record)
      const monthsWorked = Math.max(0, differenceInMonths(now, joinDate))
      allocated = monthsWorked * lt.monthlyAccrual

      // During probation, allocated is locked
      if (isProbation) {
        locked = allocated
      }
    }

    const used = usedByLeaveType.get(lt.id) ?? 0
    const remaining = Math.max(0, allocated - used)

    return {
      leaveTypeId: lt.id,
      leaveTypeName: lt.name,
      allocated,
      used,
      remaining,
      locked,
      carryForward: lt.carryForward,
      isProbation,
    }
  })

  return balances
}

export interface ValidateBalanceResult {
  valid: boolean
  error?: string
}

/**
 * Validate that an employee has sufficient balance for a leave request.
 */
export function validateComputedBalance(
  balances: ComputedBalance[],
  leaveTypeId: string,
  days: number
): ValidateBalanceResult {
  const balance = balances.find((b) => b.leaveTypeId === leaveTypeId)
  if (!balance) {
    return { valid: false, error: 'Leave type not found' }
  }

  // LWB (Leave Without Benefits / Unpaid) has no balance limit
  if (balance.leaveTypeName.toUpperCase() === 'LWB') {
    return { valid: true }
  }

  const available = balance.remaining
  if (available < days) {
    return {
      valid: false,
      error: `Insufficient leave balance. Available: ${available}, Requested: ${days}`,
    }
  }

  return { valid: true }
}
