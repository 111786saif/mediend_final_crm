import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { invoiceRequestInclude, mapInvoiceRequest } from '@/lib/finance/invoice-request/mapper'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:read')) return errorResponse('Forbidden', 403)

    const { id } = await params
    const record = await prisma.invoiceRequest.findUnique({
      where: { id },
      include: invoiceRequestInclude,
    })

    if (!record) return errorResponse('Invoice request not found', 404)

    return successResponse(mapInvoiceRequest(record))
  } catch (error) {
    console.error('Error fetching invoice request:', error)
    return errorResponse('Failed to fetch invoice request', 500)
  }
}
