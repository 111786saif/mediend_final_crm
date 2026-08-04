import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { recomputeOutstandingFromInstallments } from '@/lib/pl/installments'

const rejectSchema = z.object({
  rejectionRemarks: z.string().trim().min(1, 'Rejection remarks are required').max(5000),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:write')) return errorResponse('Forbidden', 403)

    const { id } = await params
    const body = await request.json()
    const parsed = rejectSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? 'Invalid request body', 400)
    }

    const existing = await prisma.paymentInstallment.findUnique({ where: { id } })
    if (!existing) return errorResponse('Payment installment not found', 404)
    if (existing.verificationStatus !== 'PENDING') {
      return errorResponse('Only pending payments can be rejected', 400)
    }

    const updated = await prisma.paymentInstallment.update({
      where: { id },
      data: {
        verificationStatus: 'REJECTED',
        verifiedById: user.id,
        verifiedAt: new Date(),
        rejectionRemarks: parsed.data.rejectionRemarks,
      },
      include: {
        lead: {
          select: { id: true, leadRef: true, patientName: true, hospitalName: true },
        },
        recordedBy: { select: { id: true, name: true } },
        verifiedBy: { select: { id: true, name: true } },
      },
    })

    await recomputeOutstandingFromInstallments(existing.leadId)

    return successResponse(
      {
        ...updated,
        paidOn: updated.paidOn.toISOString(),
        verifiedAt: updated.verifiedAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
      },
      'Payment rejected',
    )
  } catch (error) {
    console.error('Error rejecting payment installment:', error)
    return errorResponse('Failed to reject payment', 500)
  }
}
