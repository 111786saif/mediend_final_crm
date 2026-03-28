import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  calculateLeaveDays,
  checkDateConflict,
  isSickLeaveType,
  parseDateOnlyLocal,
  startOfLocalDay,
} from '@/lib/hrms/leave-utils'
import { getComputedBalancesForEmployee, validateComputedBalance } from '@/lib/hrms/leave-policy-calculator'
import { findLeaveApprover } from '@/lib/hierarchy'
import { z } from 'zod'

const applyLeaveSchema = z.object({
  leaveTypeId: z.string(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(1, 'Reason is required'),
  /** Single calendar day only; counts as 0.5 against balance */
  isHalfDay: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      include: { user: { select: { name: true } } },
    })

    if (!employee) {
      return errorResponse('Employee record not found', 404)
    }

    // Check 6-month probation period (leaves locked during probation)
    if (employee.joinDate) {
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

      if (employee.joinDate > sixMonthsAgo) {
        const probationEndDate = new Date(employee.joinDate)
        probationEndDate.setMonth(probationEndDate.getMonth() + 6)
        return errorResponse(
          `You are in probation period. Leave applications will be available after ${probationEndDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
          400
        )
      }
    }

    const body = await request.json()
    const {
      leaveTypeId,
      startDate: startDateStr,
      endDate: endDateStr,
      reason,
      isHalfDay,
    } = applyLeaveSchema.parse(body)

    let startDate: Date
    let endDate: Date
    try {
      startDate = parseDateOnlyLocal(startDateStr)
      endDate = parseDateOnlyLocal(endDateStr)
    } catch {
      return errorResponse('Invalid date format', 400)
    }

    const startDay = startOfLocalDay(startDate)
    const endDay = startOfLocalDay(endDate)
    const today = startOfLocalDay(new Date())

    if (startDay > endDay) {
      return errorResponse('Start date must be before or equal to end date', 400)
    }

    const twoYearsAgo = startOfLocalDay(new Date())
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
    if (startDay < twoYearsAgo) {
      return errorResponse('Leave cannot be applied more than two years in the past', 400)
    }

    if (employee.joinDate) {
      const joinDay = startOfLocalDay(new Date(employee.joinDate))
      if (startDay < joinDay) {
        return errorResponse('Leave cannot start before your date of joining', 400)
      }
    }

    const leaveType = await prisma.leaveTypeMaster.findUnique({
      where: { id: leaveTypeId },
    })

    if (!leaveType || !leaveType.isActive) {
      return errorResponse('Invalid leave type', 400)
    }

    const sick = isSickLeaveType(leaveType)
    if (!sick) {
      if (startDay < today || endDay < today) {
        return errorResponse(
          'Casual Leave and Earned Leave can only be applied for today or a future date. Use Sick Leave (SL) for past dates.',
          400
        )
      }
    }

    if (isHalfDay) {
      if (startDateStr !== endDateStr) {
        return errorResponse('Half-day leave must use the same start and end date', 400)
      }
    }

    // Calculate days (0.5 for single-day half leave; otherwise inclusive calendar days)
    const days = isHalfDay ? 0.5 : calculateLeaveDays(startDate, endDate)

    // Validate against policy-computed balance
    const balances = await getComputedBalancesForEmployee(employee.id)
    const balanceValidation = validateComputedBalance(balances, leaveTypeId, days)
    const isUnpaid = !balanceValidation.valid

    if (!balanceValidation.valid && !balanceValidation.error?.includes('Insufficient')) {
      return errorResponse(balanceValidation.error ?? 'Cannot apply for leave', 400)
    }

    // Check for date conflicts
    const existingLeaves = await prisma.leaveRequest.findMany({
      where: {
        employeeId: employee.id,
        status: {
          in: ['PENDING', 'APPROVED'],
        },
      },
    })

    const conflictCheck = checkDateConflict(existingLeaves, startDate, endDate)
    if (conflictCheck.hasConflict) {
      return errorResponse('Leave request conflicts with existing approved/pending leave', 400)
    }

    // Compute target approver from hierarchy (immediate manager or next available if on leave)
    const targetApprover = await findLeaveApprover(employee.id, {
      leaveStartDate: startDate,
      leaveEndDate: endDate,
    })

    // Create leave request (allow unpaid when balance insufficient)
    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        leaveTypeId,
        startDate,
        endDate,
        days,
        reason,
        isUnpaid,
        targetApproverId: targetApprover?.id ?? null,
      },
      include: {
        leaveType: true,
        targetApprover: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    })

    // Notify target approver and all HR_HEAD users
    const hrHeads = await prisma.user.findMany({
      where: { role: 'HR_HEAD' },
      select: { id: true },
    })
    const notifyUserIds = new Set<string>()
    if (targetApprover?.user?.id) notifyUserIds.add(targetApprover.user.id)
    hrHeads.forEach((h) => notifyUserIds.add(h.id))
    const leaveTypeName = leaveType.name
    const empName = employee.user?.name ?? user.name ?? 'An employee'
    await prisma.notification.createMany({
      data: Array.from(notifyUserIds).map((userId) => ({
        userId,
        type: 'LEAVE_REQUESTED',
        title: 'Leave Request Submitted',
        message: `${empName} has applied for ${leaveTypeName} (${days === 0.5 ? '0.5' : days} day(s))`,
        link: '/hr/attendance-leaves',
        relatedId: leaveRequest.id,
      })),
    })

    return successResponse(leaveRequest, 'Leave request submitted successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error applying for leave:', error)
    return errorResponse('Failed to apply for leave', 500)
  }
}

