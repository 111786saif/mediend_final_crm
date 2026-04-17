import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { LedgerStatus, LedgerAuditAction } from '@/generated/prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'finance:approve')) {
      return errorResponse('Only Admin/MD can reject delete requests', 403)
    }

    const { id } = await params
    const body = await request.json()
    const { reason } = body

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return errorResponse('Rejection reason is required', 400)
    }

    const entry = await prisma.ledgerEntry.findUnique({
      where: { id },
    })

    if (!entry) {
      return errorResponse('Ledger entry not found', 404)
    }

    if (entry.isDeleted) {
      return errorResponse('Cannot reject delete for already deleted entry', 400)
    }

    if (entry.deleteRequestStatus !== LedgerStatus.PENDING) {
      return errorResponse('No pending delete request found', 400)
    }

    const updatedEntry = await prisma.ledgerEntry.update({
      where: { id },
      data: {
        deleteRequestStatus: LedgerStatus.REJECTED,
        deleteApprovalReason: reason.trim(),
        deleteApprovedById: user.id,
        deleteApprovedAt: new Date(),
      },
      include: {
        party: true,
        head: true,
        paymentType: true,
        paymentMode: true,
        deleteRequestedBy: {
          select: { id: true, name: true, email: true },
        },
        deleteApprovedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    await prisma.ledgerAuditLog.create({
      data: {
        ledgerEntryId: entry.id,
        action: LedgerAuditAction.DELETE_REJECTED,
        previousData: { deleteRequestStatus: LedgerStatus.PENDING },
        newData: {
          deleteRequestStatus: LedgerStatus.REJECTED,
          deleteApprovalReason: reason.trim(),
        },
        reason: reason.trim(),
        performedById: user.id,
      },
    })

    return successResponse(updatedEntry, 'Delete request rejected')
  } catch (error) {
    console.error('Error rejecting delete request:', error)
    return errorResponse('Failed to reject delete request', 500)
  }
}
