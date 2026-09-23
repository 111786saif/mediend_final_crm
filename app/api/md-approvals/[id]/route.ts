import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'

const updateSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  responseNote: z.string().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    if (user.role !== 'MD' && user.role !== 'ADMIN') {
      return errorResponse('Only MD can approve or reject requests', 403)
    }

    const { id } = await params

    const existing = await prisma.mDApprovalRequest.findUnique({
      where: { id },
      include: { requestedBy: { select: { id: true, name: true } } },
    })

    if (!existing) {
      return errorResponse('Request not found', 404)
    }

    if (existing.status !== 'PENDING') {
      return errorResponse('Request is not pending', 400)
    }

    const body = await request.json()
    const { status, responseNote } = updateSchema.parse(body)

    const updated = await prisma.mDApprovalRequest.update({
      where: { id },
      data: {
        status,
        respondedById: user.id,
        responseNote: responseNote ?? undefined,
        respondedAt: new Date(),
      },
      include: {
        requestedBy: { select: { id: true, name: true } },
      },
    })

    // Notify the requester
    await prisma.notification.create({
      data: {
        userId: existing.requestedById,
        type: 'MD_APPROVAL_RESPONDED',
        title: status === 'APPROVED' ? 'MD Approval Granted' : 'MD Approval Rejected',
        message:
          status === 'APPROVED'
            ? `Your request "${existing.title}" has been approved.`
            : `Your request "${existing.title}" has been rejected.`,
        link: '/md/md-approvals',
        relatedId: String(id),
      },
    })

    // If approved with amount, notify FINANCE_HEAD
    if (status === 'APPROVED' && existing.amount != null) {
      const financeHeads = await prisma.user.findMany({
        where: { role: 'FINANCE_HEAD' },
        select: { id: true },
      })
      if (financeHeads.length > 0) {
        await prisma.notification.createMany({
          data: financeHeads.map((f) => ({
            userId: f.id,
            type: 'MD_APPROVAL_FINANCE_ACK',
            title: 'MD Approval - Finance Acknowledgment',
            message: `${existing.requestedBy.name}: ${existing.title} (₹${existing.amount}) - Awaiting your acknowledgment`,
            link: '/finance/team-approvals',
            relatedId: String(id),
          })),
        })
      }
    }

    return successResponse(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.errors[0].message, 400)
    }
    console.error('Error updating MD approval:', error)
    return errorResponse('Failed to update request', 500)
  }
}
