import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { applyLeaveBalanceBaseline } from '@/lib/hrms/apply-leave-balance-baseline'
import { z } from 'zod'

const patchSchema = z.object({
  action: z.enum(['approve', 'reject']),
  remarks: z.string().max(2000).optional().nullable(),
})

function canAccess(user: { role: string } | null): boolean {
  return user?.role === 'MD' || user?.role === 'ADMIN'
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canAccess(user)) return errorResponse('Forbidden', 403)

    const { id } = await params
    const body = await request.json()
    const { action, remarks } = patchSchema.parse(body)

    const row = await prisma.leaveBalanceEditRequest.findUnique({
      where: { id },
      include: {
        employee: { include: { user: { select: { id: true, name: true } } } },
        requestedBy: { select: { id: true } },
      },
    })
    if (!row) return errorResponse('Request not found', 404)
    if (row.status !== 'PENDING') {
      return errorResponse('This request has already been processed', 400)
    }

    if (action === 'reject') {
      await prisma.leaveBalanceEditRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedByUserId: user.id,
          reviewedAt: new Date(),
          reviewRemarks: remarks?.trim() || null,
        },
      })
      const hrUserId = row.requestedBy.id
      await prisma.notification.create({
        data: {
          userId: hrUserId,
          type: 'LEAVE_BALANCE_EDIT_RESOLVED',
          title: 'Leave balance change rejected',
          message: `MD rejected the baseline update for ${row.employee.user.name}.`,
          link: '/hr/dashboard',
          relatedId: String(id),
        },
      })
      return successResponse({ message: 'Request rejected' })
    }

    await prisma.$transaction(async (tx) => {
      await applyLeaveBalanceBaseline(tx, row.employeeId, {
        CL: row.proposedCL,
        SL: row.proposedSL,
        EL: row.proposedEL,
      })
      await tx.leaveBalanceEditRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedByUserId: user.id,
          reviewedAt: new Date(),
          reviewRemarks: remarks?.trim() || null,
        },
      })
    })

    const hrUserId = row.requestedBy.id
    await prisma.notification.create({
      data: {
        userId: hrUserId,
        type: 'LEAVE_BALANCE_EDIT_RESOLVED',
        title: 'Leave balance change approved',
        message: `MD approved the baseline CL/SL/EL update for ${row.employee.user.name}.`,
        link: '/hr/dashboard',
        relatedId: String(id),
      },
    })

    const empUserId = row.employee.user.id
    if (empUserId) {
      await prisma.notification.create({
        data: {
          userId: empUserId,
          type: 'LEAVE_BALANCE_EDIT_RESOLVED',
          title: 'Your leave balances were updated',
          message: 'Your leave baseline balances (CL/SL/EL) were updated after MD approval.',
          link: '/employee/dashboard/core-hr',
          relatedId: String(id),
        },
      })
    }

    return successResponse({ message: 'Balances updated and request approved' })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return errorResponse(`Invalid request: ${e.errors.map((x) => x.message).join(', ')}`, 400)
    }
    console.error('md leave-balance-edit-requests PATCH:', e)
    return errorResponse('Failed to process request', 500)
  }
}
