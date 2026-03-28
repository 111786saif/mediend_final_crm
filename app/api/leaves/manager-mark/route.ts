import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { isManagerOf } from '@/lib/hierarchy'
import {
  calculateLeaveDays,
  checkDateConflict,
  isSickLeaveType,
  parseDateOnlyLocal,
  startOfLocalDay,
} from '@/lib/hrms/leave-utils'
import { getComputedBalancesForEmployee, validateComputedBalance } from '@/lib/hrms/leave-policy-calculator'
import { z } from 'zod'

const bodySchema = z.object({
  employeeId: z.string(),
  leaveTypeId: z.string(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(1, 'Reason is required'),
  isHalfDay: z.boolean().optional(),
})

/**
 * Manager marks paid leave for a report as APPROVED immediately (no approval workflow).
 * Same date rules and balance checks as employee apply, but unpaid leave is not allowed.
 */
export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    if (!hasPermission(user, 'hierarchy:leave:approve')) {
      return errorResponse('Forbidden', 403)
    }

    const manager = await prisma.employee.findUnique({
      where: { userId: user.id },
      include: { user: { select: { name: true } } },
    })
    if (!manager) {
      return errorResponse('Employee record not found', 404)
    }

    const body = await request.json()
    const {
      employeeId,
      leaveTypeId,
      startDate: startDateStr,
      endDate: endDateStr,
      reason,
      isHalfDay,
    } = bodySchema.parse(body)

    if (employeeId === manager.id) {
      return errorResponse('Use this action for team members only', 400)
    }

    const inChain = await isManagerOf(manager.id, employeeId)
    if (!inChain) {
      return errorResponse('You can only mark leave for your direct or indirect reports', 403)
    }

    const subordinate = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: { select: { name: true, id: true } } },
    })
    if (!subordinate) {
      return errorResponse('Employee not found', 404)
    }

    if (subordinate.joinDate) {
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      if (subordinate.joinDate > sixMonthsAgo) {
        const probationEndDate = new Date(subordinate.joinDate)
        probationEndDate.setMonth(probationEndDate.getMonth() + 6)
        return errorResponse(
          `This employee is in probation. Leave marking is available after ${probationEndDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
          400
        )
      }
    }

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
      return errorResponse('Leave cannot be marked more than two years in the past', 400)
    }

    if (subordinate.joinDate) {
      const joinDay = startOfLocalDay(new Date(subordinate.joinDate))
      if (startDay < joinDay) {
        return errorResponse('Leave cannot start before the employee date of joining', 400)
      }
    }

    const leaveType = await prisma.leaveTypeMaster.findUnique({ where: { id: leaveTypeId } })
    if (!leaveType || !leaveType.isActive) {
      return errorResponse('Invalid leave type', 400)
    }

    const sick = isSickLeaveType(leaveType)
    if (!sick) {
      if (startDay < today || endDay < today) {
        return errorResponse(
          'Casual Leave and Earned Leave can only be marked for today or a future date. Use Sick Leave (SL) for past dates.',
          400
        )
      }
    }

    if (isHalfDay && startDateStr !== endDateStr) {
      return errorResponse('Half-day leave must use the same start and end date', 400)
    }

    const days = isHalfDay ? 0.5 : calculateLeaveDays(startDate, endDate)

    const balances = await getComputedBalancesForEmployee(employeeId)
    const balanceValidation = validateComputedBalance(balances, leaveTypeId, days)

    if (!balanceValidation.valid) {
      return errorResponse(
        balanceValidation.error ?? 'Insufficient or unavailable leave balance for this type',
        400
      )
    }

    const balanceRow = balances.find((b) => b.leaveTypeId === leaveTypeId)
    if (balanceRow && balanceRow.isProbation && balanceRow.locked > 0) {
      return errorResponse('This employee leave balance is still locked (probation).', 400)
    }

    const existingLeaves = await prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    })

    const conflictCheck = checkDateConflict(existingLeaves, startDate, endDate)
    if (conflictCheck.hasConflict) {
      return errorResponse('Leave overlaps existing approved or pending leave', 400)
    }

    const managerNote = `[Manager: ${manager.user?.name ?? 'Manager'}] ${reason}`

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId,
        startDate,
        endDate,
        days,
        reason: managerNote,
        isUnpaid: false,
        status: 'APPROVED',
        targetApproverId: null,
        approvedById: user.id,
        approvedAt: new Date(),
      },
      include: {
        leaveType: true,
      },
    })

    const empUserId = subordinate.user?.id
    if (empUserId) {
      await prisma.notification.create({
        data: {
          userId: empUserId,
          type: 'LEAVE_APPROVED',
          title: 'Leave recorded',
          message: `Your manager recorded ${leaveType.name} (${days === 0.5 ? '0.5' : days} day(s)) for you.`,
          link: '/employee/dashboard/core-hr',
          relatedId: leaveRequest.id,
        },
      })
    }

    return successResponse(leaveRequest, 'Leave marked and approved for team member')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0]?.message ?? 'Invalid request data', 400)
    }
    console.error('Error in manager-mark leave:', error)
    return errorResponse('Failed to mark leave', 500)
  }
}
