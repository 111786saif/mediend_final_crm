import { NextRequest } from 'next/server'
import { z } from 'zod'
import { InvoiceRequestStatus } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { invoiceRequestInclude, mapInvoiceRequest } from '@/lib/finance/invoice-request/mapper'
import { logInvoiceRequestActivity } from '@/lib/finance/invoice-request/activity'

const attachSchema = z.object({
  invoicePdfUrl: z.string().min(1),
  invoicePdfName: z.string().optional(),
  invoiceNumber: z.string().max(100).optional(),
  invoiceAmount: z.number().min(0).optional(),
})

/** PL uploads invoice PDF/image against a pending Finance request. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'pl:write')) return errorResponse('Forbidden', 403)

    const { id } = await params
    const body = await request.json()
    const parsed = attachSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? 'Invalid request body', 400)
    }

    const existing = await prisma.invoiceRequest.findUnique({
      where: { id },
      include: { lead: { select: { leadRef: true } } },
    })
    if (!existing) return errorResponse('Invoice request not found', 404)
    if (existing.status !== InvoiceRequestStatus.PENDING) {
      return errorResponse('Only pending invoice requests can receive uploads', 400)
    }

    const updated = await prisma.invoiceRequest.update({
      where: { id },
      data: {
        invoicePdfUrl: parsed.data.invoicePdfUrl,
        invoicePdfName: parsed.data.invoicePdfName ?? null,
        ...(parsed.data.invoiceNumber !== undefined
          ? { invoiceNumber: parsed.data.invoiceNumber.trim() || null }
          : {}),
        ...(parsed.data.invoiceAmount !== undefined ? { invoiceAmount: parsed.data.invoiceAmount } : {}),
      },
      include: invoiceRequestInclude,
    })

    await logInvoiceRequestActivity(prisma, {
      requestId: id,
      action: 'UPLOADED',
      message: `P/L uploaded invoice for lead ${existing.lead.leadRef || existing.leadId}`,
      actorId: user.id,
    })

    return successResponse(mapInvoiceRequest(updated), 'Invoice uploaded')
  } catch (error) {
    console.error('Error attaching PL invoice upload:', error)
    return errorResponse('Failed to save invoice upload', 500)
  }
}
