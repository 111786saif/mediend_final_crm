import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { isManagerOf } from '@/lib/hierarchy'
import { z } from 'zod'

const approveSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  remarks: z.string().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const canOverride = hasPermission(user, 'hrms:leaves:write')
    const canApproveByHierarchy = hasPermission(user, 'hierarchy:leave:approve')
    if (!canOverride && !canApproveByHierarchy) {
      return errorResponse('Forbidden', 403)
    }

    const { id: leaveId } = await params

    const body = await request.json()
    const { status, remarks } = approveSchema.parse(body)

    // Get leave request
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: leaveId },
      include: {
        leaveType: true,
      },
    })

    if (!leaveRequest) {
      return errorResponse('Leave request not found', 404)
    }

    if (leaveRequest.status !== 'PENDING') {
      return errorResponse('Leave request is not pending', 400)
    }

    const approverEmployee = await prisma.employee.findUnique({
      where: { userId: user.id },
    })
    if (approverEmployee && approverEmployee.id === leaveRequest.employeeId) {
      return errorResponse('You cannot approve your own leave request', 403)
    }

    // If not HR/MD override, verify approver is in the applicant's management chain
    if (!canOverride && canApproveByHierarchy) {
      if (!approverEmployee) {
        return errorResponse('Employee record not found for approver', 403)
      }
      const inChain = await isManagerOf(approverEmployee.id, leaveRequest.employeeId)
      if (!inChain) {
        return errorResponse('You can only approve leave for your direct or indirect reports', 403)
      }
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status,
        approvedById: user.id,
        approvedAt: new Date(),
        remarks: remarks || null,
      },
      include: {
        employee: { select: { userId: true } },
        leaveType: { select: { name: true } },
      },
    })

    // Notify the employee
    const employeeUserId = updated.employee.userId
    if (employeeUserId) {
      await prisma.notification.create({
        data: {
          userId: employeeUserId,
          type: status === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
          title: status === 'APPROVED' ? 'Leave Approved' : 'Leave Rejected',
          message:
            status === 'APPROVED'
              ? `Your ${updated.leaveType.name} request has been approved.`
              : `Your ${updated.leaveType.name} request has been rejected.${remarks ? ` Reason: ${remarks}` : ''}`,
          link: '/employee/dashboard/core-hr',
          relatedId: leaveId,
        },
      })
    }

    // LeaveBalance rows are treated as imported baseline snapshots.
    // Current balances are derived from that snapshot + later accruals + approved leave history.

    return successResponse(updated, `Leave request ${status.toLowerCase()}`)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.errors)
      return errorResponse(`Invalid request data: ${error.errors.map(e => e.message).join(', ')}`, 400)
    }
    console.error('Error approving leave:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    return errorResponse(`Failed to approve leave: ${error instanceof Error ? error.message : 'Unknown error'}`, 500)
  }
}

