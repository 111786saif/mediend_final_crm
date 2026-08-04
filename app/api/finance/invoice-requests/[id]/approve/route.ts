import { NextRequest } from 'next/server'
import { z } from 'zod'
import { InvoiceRequestStatus } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { invoiceRequestInclude, mapInvoiceRequest } from '@/lib/finance/invoice-request/mapper'
import { logInvoiceRequestActivity } from '@/lib/finance/invoice-request/activity'

const approveSchema = z.object({
  invoicePdfUrl: z.string().min(1).optional(),
  invoicePdfName: z.string().optional(),
  financeRemarks: z.string().max(5000).optional(),
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
    const parsed = approveSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? 'Invalid request body', 400)
    }

    const existing = await prisma.invoiceRequest.findUnique({ where: { id } })
    if (!existing) return errorResponse('Invoice request not found', 404)
    if (existing.status !== InvoiceRequestStatus.PENDING) {
      return errorResponse('Only pending invoice requests can be approved', 400)
    }

    const invoicePdfUrl = parsed.data.invoicePdfUrl ?? existing.invoicePdfUrl
    if (!invoicePdfUrl) {
      return errorResponse(
        'Invoice file is required. P/L must upload the invoice or Finance must attach a file.',
        400,
      )
    }

    const updated = await prisma.invoiceRequest.update({
      where: { id },
      data: {
        status: InvoiceRequestStatus.VERIFIED,
        invoicePdfUrl,
        invoicePdfName: parsed.data.invoicePdfName ?? existing.invoicePdfName ?? null,
        financeRemarks: parsed.data.financeRemarks?.trim() || null,
        rejectionRemarks: null,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
      include: invoiceRequestInclude,
    })

    await logInvoiceRequestActivity(prisma, {
      requestId: id,
      action: 'VERIFIED',
      message: `Invoice request verified for lead ${updated.lead.leadRef || updated.leadId}`,
      remarks: updated.financeRemarks,
      actorId: user.id,
    })

    return successResponse(mapInvoiceRequest(updated), 'Invoice request verified')
  } catch (error) {
    console.error('Error approving invoice request:', error)
    return errorResponse('Failed to approve invoice request', 500)
  }
}
