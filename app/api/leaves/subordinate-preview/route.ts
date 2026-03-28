import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { isManagerOf } from '@/lib/hierarchy'
import { getComputedBalancesForEmployee } from '@/lib/hrms/leave-policy-calculator'

/** Lets a manager load leave balances for a subordinate before marking leave (same rules as self-apply). */
export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    if (!hasPermission(user, 'hierarchy:leave:approve')) {
      return errorResponse('Forbidden', 403)
    }

    const employeeId = new URL(request.url).searchParams.get('employeeId')
    if (!employeeId?.trim()) {
      return errorResponse('employeeId is required', 400)
    }

    const manager = await prisma.employee.findUnique({ where: { userId: user.id } })
    if (!manager) {
      return errorResponse('Employee record not found', 404)
    }

    const inChain = await isManagerOf(manager.id, employeeId)
    if (!inChain) {
      return errorResponse('You can only view leave data for your direct or indirect reports', 403)
    }

    const subordinate = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: { select: { name: true, email: true } } },
    })
    if (!subordinate) {
      return errorResponse('Employee not found', 404)
    }

    let probationBlocksLeave = false
    let probationMessage: string | null = null
    if (subordinate.joinDate) {
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
      if (subordinate.joinDate > sixMonthsAgo) {
        probationBlocksLeave = true
        const probationEndDate = new Date(subordinate.joinDate)
        probationEndDate.setMonth(probationEndDate.getMonth() + 6)
        probationMessage = `This employee is in probation. Leave marking is available after ${probationEndDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`
      }
    }

    const balances = await getComputedBalancesForEmployee(employeeId)

    return successResponse({
      employeeId: subordinate.id,
      employeeName: subordinate.user.name,
      employeeEmail: subordinate.user.email,
      employeeCode: subordinate.employeeCode,
      probationBlocksLeave,
      probationMessage,
      balances: balances.map((b) => ({
        leaveTypeId: b.leaveTypeId,
        leaveTypeName: b.leaveTypeName,
        allocated: b.allocated,
        used: b.used,
        remaining: b.remaining,
        locked: b.locked,
        isProbation: b.isProbation,
        carryForward: b.carryForward,
      })),
    })
  } catch (error) {
    console.error('Error in subordinate-preview:', error)
    return errorResponse('Failed to load leave preview', 500)
  }
}
