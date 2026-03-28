import type { PrismaClient } from '@/generated/prisma/client'

export type LeaveBalanceBaselineCodes = { CL: number; SL: number; EL: number }

type LeaveBalanceDb = Pick<PrismaClient, 'leaveBalance' | 'leaveTypeMaster'>

/**
 * Sets imported baseline for CL/SL/EL (allocated = remaining, used = 0). Only keys present in `balances` are updated.
 */
export async function applyLeaveBalanceBaseline(
  db: LeaveBalanceDb,
  employeeId: string,
  balances: Partial<LeaveBalanceBaselineCodes>
): Promise<void> {
  const codes = (['CL', 'SL', 'EL'] as const).filter(
    (c) => balances[c] !== undefined && balances[c] !== null && !Number.isNaN(balances[c] as number)
  )
  if (!codes.length) return

  const leaveTypes = await db.leaveTypeMaster.findMany({
    where: { code: { in: [...codes] }, isActive: true },
  })
  const byCode = new Map(leaveTypes.map((lt) => [lt.code ?? lt.name, lt]))

  for (const code of codes) {
    const remainingRaw = balances[code]!
    const lt = byCode.get(code)
    if (!lt) continue
    const value = Math.round(remainingRaw * 2) / 2

    await db.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId: { employeeId, leaveTypeId: lt.id },
      },
      create: {
        employeeId,
        leaveTypeId: lt.id,
        allocated: value,
        used: 0,
        remaining: value,
      },
      update: {
        allocated: value,
        used: 0,
        remaining: value,
      },
    })
  }
}
