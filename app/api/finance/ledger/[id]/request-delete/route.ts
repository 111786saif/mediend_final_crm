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

    if (!hasPermission(user, 'finance:write')) {
      return errorResponse('Only finance team can request deletions', 403)
    }

    const { id } = await params
    const body = await request.json()
    const { reason } = body

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return errorResponse('Deletion reason is required', 400)
    }

    const entry = await prisma.ledgerEntry.findUnique({
      where: { id },
    })

    if (!entry) {
      return errorResponse('Ledger entry not found', 404)
    }

    if (entry.isDeleted) {
      return errorResponse('Entry is already deleted', 400)
    }

    if (entry.status !== LedgerStatus.APPROVED) {
      return errorResponse('Can only request deletion for approved entries', 400)
    }

    if (entry.deleteRequestStatus === LedgerStatus.PENDING) {
      return errorResponse('A delete request is already pending for this entry', 400)
    }

    const updatedEntry = await prisma.ledgerEntry.update({
      where: { id },
      data: {
        deleteRequestStatus: LedgerStatus.PENDING,
        deleteRequestReason: reason.trim(),
        deleteRequestedById: user.id,
        deleteRequestedAt: new Date(),
        deleteApprovalReason: null,
        deleteApprovedById: null,
        deleteApprovedAt: null,
      },
      include: {
        party: true,
        head: true,
        paymentType: true,
        paymentMode: true,
        deleteRequestedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    await prisma.ledgerAuditLog.create({
      data: {
        ledgerEntryId: entry.id,
        action: LedgerAuditAction.DELETE_REQUESTED,
        previousData: { deleteRequestStatus: null },
        newData: {
          deleteRequestStatus: LedgerStatus.PENDING,
          deleteRequestReason: reason.trim(),
        },
        reason: reason.trim(),
        performedById: user.id,
      },
    })

    return successResponse(updatedEntry, 'Delete request submitted successfully')
  } catch (error) {
    console.error('Error requesting delete:', error)
    return errorResponse('Failed to request deletion', 500)
  }
}
