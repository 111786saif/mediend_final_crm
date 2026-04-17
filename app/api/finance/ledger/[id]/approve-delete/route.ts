import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { LedgerAuditAction, LedgerStatus, TransactionType } from '@/generated/prisma/client'
import { reverseBalanceUpdate } from '@/lib/finance'

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
      return errorResponse('Only Admin/MD can approve delete requests', 403)
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const { reason } = body

    const entry = await prisma.ledgerEntry.findUnique({
      where: { id },
      include: {
        party: true,
        head: true,
        paymentMode: true,
        fromPaymentMode: true,
        toPaymentMode: true,
      },
    })

    if (!entry) {
      return errorResponse('Ledger entry not found', 404)
    }

    if (entry.isDeleted) {
      return errorResponse('Entry is already deleted', 400)
    }

    if (entry.deleteRequestStatus !== LedgerStatus.PENDING) {
      return errorResponse('No pending delete request found', 400)
    }

    const deletedEntry = await prisma.$transaction(async (tx) => {
      const deleted = await tx.ledgerEntry.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedById: user.id,
          deletedReason: entry.deleteRequestReason,
          deleteRequestStatus: null,
          deleteRequestReason: null,
          deleteRequestedById: null,
          deleteRequestedAt: null,
          deleteApprovalReason: reason?.trim() || null,
          deleteApprovedById: user.id,
          deleteApprovedAt: new Date(),
        },
        include: {
          party: true,
          head: true,
          paymentType: true,
          paymentMode: true,
          deletedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      // Reverse balance if entry was approved
      if (entry.status === LedgerStatus.APPROVED) {
        if (entry.transactionType === TransactionType.CREDIT) {
          const amount = entry.receivedAmount || 0
          await reverseBalanceUpdate(entry.paymentModeId!, TransactionType.CREDIT, amount, tx)
        } else if (entry.transactionType === TransactionType.DEBIT) {
          const amount = entry.paymentAmount || 0
          await reverseBalanceUpdate(entry.paymentModeId!, TransactionType.DEBIT, amount, tx)
        } else if (entry.transactionType === TransactionType.SELF_TRANSFER) {
          const amount = entry.transferAmount || 0
          await reverseBalanceUpdate(entry.fromPaymentModeId!, TransactionType.DEBIT, amount, tx)
          await reverseBalanceUpdate(entry.toPaymentModeId!, TransactionType.CREDIT, amount, tx)
        }
      }

      await tx.ledgerAuditLog.create({
        data: {
          ledgerEntryId: entry.id,
          action: LedgerAuditAction.DELETE_APPROVED,
          previousData: { deleteRequestStatus: LedgerStatus.PENDING },
          newData: { deleteRequestStatus: null, isDeleted: true },
          reason: reason?.trim() || 'Approved delete request',
          performedById: user.id,
        },
      })

      await tx.ledgerAuditLog.create({
        data: {
          ledgerEntryId: entry.id,
          action: LedgerAuditAction.DELETED,
          previousData: {
            isDeleted: false,
            status: entry.status,
            serialNumber: entry.serialNumber,
          },
          newData: {
            isDeleted: true,
            deletedAt: deleted.deletedAt,
            deletedReason: entry.deleteRequestReason,
          },
          reason: entry.deleteRequestReason || reason?.trim() || 'Delete request approved',
          performedById: user.id,
        },
      })

      return deleted
    })

    return successResponse(deletedEntry, 'Delete request approved — entry deleted')
  } catch (error) {
    console.error('Error approving delete request:', error)
    return errorResponse('Failed to approve delete request', 500)
  }
}
