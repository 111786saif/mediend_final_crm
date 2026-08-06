import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { recomputeOutstandingFromInstallments } from '@/lib/pl/installments'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:write')) return errorResponse('Forbidden', 403)

    const { id } = await params
    const existing = await prisma.paymentInstallment.findUnique({ where: { id } })
    if (!existing) return errorResponse('Payment installment not found', 404)
    if (existing.verificationStatus !== 'PENDING') {
      return errorResponse('Only pending payments can be verified', 400)
    }

    const updated = await prisma.paymentInstallment.update({
      where: { id },
      data: {
        verificationStatus: 'VERIFIED',
        verifiedById: user.id,
        verifiedAt: new Date(),
        rejectionRemarks: null,
      },
      include: {
        lead: {
          select: { id: true, leadRef: true, patientName: true, hospitalName: true },
        },
        recordedBy: { select: { id: true, name: true } },
        verifiedBy: { select: { id: true, name: true } },
      },
    })

    if (existing.leadId) {
      await recomputeOutstandingFromInstallments(existing.leadId)
    }

    return successResponse(
      {
        ...updated,
        paidOn: updated.paidOn.toISOString(),
        verifiedAt: updated.verifiedAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
      },
      'Payment verified',
    )
  } catch (error) {
    console.error('Error verifying payment installment:', error)
    return errorResponse('Failed to verify payment', 500)
  }
}
