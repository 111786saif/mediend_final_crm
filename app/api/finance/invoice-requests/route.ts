import { NextRequest } from 'next/server'
import { z } from 'zod'
import { InvoiceRequestStatus, Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { invoiceRequestInclude, mapInvoiceRequest } from '@/lib/finance/invoice-request/mapper'

const statusSchema = z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional()

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:read')) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')
    const search = searchParams.get('search')?.trim()
    const parsedStatus = statusSchema.safeParse(statusParam ?? undefined)

    if (statusParam && !parsedStatus.success) {
      return errorResponse('Invalid status filter', 400)
    }

    const where: Prisma.InvoiceRequestWhereInput = {}
    if (parsedStatus.data) {
      where.status = parsedStatus.data as InvoiceRequestStatus
    } else {
      where.status = InvoiceRequestStatus.PENDING
    }

    if (search) {
      where.OR = [
        { lead: { leadRef: { contains: search, mode: 'insensitive' } } },
        { lead: { patientName: { contains: search, mode: 'insensitive' } } },
        { lead: { hospitalName: { contains: search, mode: 'insensitive' } } },
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
      ]
    }

    const requests = await prisma.invoiceRequest.findMany({
      where,
      include: invoiceRequestInclude,
      orderBy: { createdAt: 'desc' },
    })

    return successResponse({
      requests: requests.map(mapInvoiceRequest),
      total: requests.length,
    })
  } catch (error) {
    console.error('Error fetching invoice requests:', error)
    const errMsg = error instanceof Error ? error.message : ''
    const message =
      errMsg.includes('invoiceRequest') ||
      errMsg.includes('InvoiceRequest') ||
      errMsg.includes("Cannot read properties of undefined (reading 'findMany')")
        ? 'InvoiceRequest table not found. Run: npx prisma db execute --file prisma/migrations/20260711120000_add_invoice_request/migration.sql then npx prisma generate and restart the dev server.'
        : 'Failed to fetch invoice requests'
    return errorResponse(message, 500)
  }
}
