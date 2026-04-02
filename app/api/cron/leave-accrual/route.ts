import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { subMonths } from 'date-fns'

/**
 * Monthly leave accrual cron job.
 * Should run on the 1st of each month (e.g. "0 1 1 * *" UTC = 6:30 AM IST on the 1st).
 *
 * Logic:
 * - Only processes ACTIVE / ON_PIP employees (not TERMINATED / ON_NOTICE)
 * - Skips employees still in probation (joinDate within last 6 months) —
 *   their balances are computed dynamically from DOJ in leave-policy-calculator.ts
 * - Increments LeaveBalance.allocated + LeaveBalance.remaining by leaveType.monthlyAccrual
 * - Creates the LeaveBalance row if it doesn't exist yet
 * - Idempotent guard: tracks last accrual month in CronJobLog; won't double-accrue in the same month
 */

const JOB_NAME = 'leave_accrual'

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Auth
    const authHeader = request.headers.get('authorization')
    const expectedSecret = process.env.CRON_SECRET
    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    // Accrual month label e.g. "2026-04"
    const accrualMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

    // Idempotency: check if we already ran this month
    const alreadyRan = await prisma.cronJobLog.findFirst({
      where: {
        jobName: JOB_NAME,
        status: 'success',
        message: { contains: accrualMonth },
      },
    })
    if (alreadyRan) {
      return NextResponse.json({
        success: true,
        jobName: JOB_NAME,
        skipped: true,
        reason: `Already accrued for ${accrualMonth}`,
      })
    }

    // Probation cutoff: employees who joined before this date are past probation
    const probationCutoff = subMonths(now, 6)

    // Fetch all eligible employees (ACTIVE or ON_PIP, past probation)
    const employees = await prisma.employee.findMany({
      where: {
        status: { in: ['ACTIVE', 'ON_PIP'] },
        joinDate: { not: null, lt: probationCutoff },
      },
      select: { id: true },
    })

    // Fetch all active leave types
    const leaveTypes = await prisma.leaveTypeMaster.findMany({
      where: { isActive: true },
      select: { id: true, name: true, monthlyAccrual: true },
    })

    let updatedCount = 0
    let createdCount = 0

    for (const employee of employees) {
      for (const lt of leaveTypes) {
        if (lt.monthlyAccrual <= 0) continue

        const existing = await prisma.leaveBalance.findUnique({
          where: { employeeId_leaveTypeId: { employeeId: employee.id, leaveTypeId: lt.id } },
        })

        if (existing) {
          await prisma.leaveBalance.update({
            where: { employeeId_leaveTypeId: { employeeId: employee.id, leaveTypeId: lt.id } },
            data: {
              allocated: { increment: lt.monthlyAccrual },
              remaining: { increment: lt.monthlyAccrual },
            },
          })
          updatedCount++
        } else {
          await prisma.leaveBalance.create({
            data: {
              employeeId: employee.id,
              leaveTypeId: lt.id,
              allocated: lt.monthlyAccrual,
              used: 0,
              remaining: lt.monthlyAccrual,
            },
          })
          createdCount++
        }
      }
    }

    const durationMs = Date.now() - startTime
    const message = `Leave accrual for ${accrualMonth}: ${employees.length} employees × ${leaveTypes.length} leave types. Updated: ${updatedCount}, Created: ${createdCount}`

    await prisma.cronJobLog.create({
      data: {
        jobName: JOB_NAME,
        status: 'success',
        durationMs,
        recordsProcessed: updatedCount + createdCount,
        message,
      },
    })

    return NextResponse.json({
      success: true,
      jobName: JOB_NAME,
      accrualMonth,
      employeesProcessed: employees.length,
      leaveTypesProcessed: leaveTypes.length,
      updatedCount,
      createdCount,
      durationMs,
    })
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    await prisma.cronJobLog.create({
      data: {
        jobName: JOB_NAME,
        status: 'error',
        durationMs,
        recordsProcessed: 0,
        message: 'Leave accrual failed',
        error: errorMessage,
      },
    })

    return NextResponse.json({ error: errorMessage, jobName: JOB_NAME, durationMs }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}
