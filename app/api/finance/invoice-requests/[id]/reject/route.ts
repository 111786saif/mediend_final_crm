import { NextRequest } from 'next/server'
import { z } from 'zod'
import { InvoiceRequestStatus } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { invoiceRequestInclude, mapInvoiceRequest } from '@/lib/finance/invoice-request/mapper'
import { logInvoiceRequestActivity } from '@/lib/finance/invoice-request/activity'

const rejectSchema = z.object({
  rejectionRemarks: z.string().min(1).max(5000),
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

    const existing = await prisma.invoiceRequest.findUnique({ where: { id } })
    if (!existing) return errorResponse('Invoice request not found', 404)
    if (existing.status !== InvoiceRequestStatus.PENDING) {
      return errorResponse('Only pending invoice requests can be rejected', 400)
    }

    const updated = await prisma.invoiceRequest.update({
      where: { id },
      data: {
        status: InvoiceRequestStatus.REJECTED,
        rejectionRemarks: parsed.data.rejectionRemarks.trim(),
        invoicePdfUrl: null,
        invoicePdfName: null,
        financeRemarks: null,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
      include: invoiceRequestInclude,
    })

    await logInvoiceRequestActivity(prisma, {
      requestId: id,
      action: 'REJECTED',
      message: `Invoice request rejected for lead ${updated.lead.leadRef || updated.leadId}`,
      remarks: updated.rejectionRemarks,
      actorId: user.id,
    })

    return successResponse(mapInvoiceRequest(updated), 'Invoice request rejected')
  } catch (error) {
    console.error('Error rejecting invoice request:', error)
    return errorResponse('Failed to reject invoice request', 500)
  }
}
