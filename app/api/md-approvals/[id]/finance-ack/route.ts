import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    if (user.role !== 'FINANCE_HEAD') {
      return errorResponse('Only Finance Head can acknowledge', 403)
    }

    const { id } = await params

    const existing = await prisma.mDApprovalRequest.findUnique({
      where: { id },
    })

    if (!existing) {
      return errorResponse('Request not found', 404)
    }

    if (existing.status !== 'APPROVED') {
      return errorResponse('Only approved requests need finance acknowledgment', 400)
    }

    if (existing.financeAcknowledged) {
      return errorResponse('Already acknowledged', 400)
    }

    const updated = await prisma.mDApprovalRequest.update({
      where: { id },
      data: {
        financeAcknowledged: true,
        financeAcknowledgedById: user.id,
        financeAcknowledgedAt: new Date(),
      },
    })

    // Notify MD
    const mdUsers = await prisma.user.findMany({
      where: { role: 'MD' },
      select: { id: true },
    })
    if (mdUsers.length > 0) {
      await prisma.notification.createMany({
        data: mdUsers.map((m) => ({
          userId: m.id,
          type: 'MD_APPROVAL_FINANCE_ACK',
          title: 'Finance Acknowledged',
          message: `Finance has acknowledged: ${existing.title}`,
          link: '/md/md-approvals',
          relatedId: String(id),
        })),
      })
    }

    return successResponse(updated)
  } catch (error) {
    console.error('Error acknowledging MD approval:', error)
    return errorResponse('Failed to acknowledge', 500)
  }
}
