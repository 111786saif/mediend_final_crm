import { leadIdSchema } from '@/lib/lead-id'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { InvoiceRequestStatus } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { invoiceRequestInclude, mapInvoiceRequest } from '@/lib/finance/invoice-request/mapper'
import { logInvoiceRequestActivity } from '@/lib/finance/invoice-request/activity'

const createSchema = z.object({
  leadId: leadIdSchema,
  requestRemarks: z.string().max(5000).optional(),
})

/** Finance requests an invoice from P/L for a case. */
export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:write')) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? 'Invalid request body', 400)
    }

    const lead = await prisma.lead.findUnique({
      where: { id: parsed.data.leadId },
      select: { id: true, leadRef: true },
    })
    if (!lead) return errorResponse('Lead not found', 404)

    const pendingExists = await prisma.invoiceRequest.findFirst({
      where: {
        leadId: parsed.data.leadId,
        status: InvoiceRequestStatus.PENDING,
      },
      select: { id: true },
    })
    if (pendingExists) {
      return errorResponse('A pending invoice request already exists for this case', 409)
    }

    const created = await prisma.invoiceRequest.create({
      data: {
        leadId: parsed.data.leadId,
        requestRemarks: parsed.data.requestRemarks?.trim() || null,
        requestedById: user.id,
      },
      include: invoiceRequestInclude,
    })

    await logInvoiceRequestActivity(prisma, {
      requestId: created.id,
      action: 'REQUESTED',
      message: `Finance requested invoice from P/L for lead ${lead.leadRef || lead.id}`,
      remarks: created.requestRemarks,
      actorId: user.id,
    })

    return successResponse(mapInvoiceRequest(created), 'Invoice request sent to P/L')
  } catch (error) {
    console.error('Error creating finance invoice request:', error)
    return errorResponse('Failed to create invoice request', 500)
  }
}
