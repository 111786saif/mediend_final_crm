import { NextRequest } from 'next/server'
import { z } from 'zod'
import { InvoiceRequestStatus, Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { invoiceRequestInclude, mapInvoiceRequest } from '@/lib/finance/invoice-request/mapper'
import { logInvoiceRequestActivity } from '@/lib/finance/invoice-request/activity'

const createSchema = z.object({
  leadId: z.string().min(1),
  requestRemarks: z.string().max(5000).optional(),
  invoiceNumber: z.string().max(100).optional(),
  invoiceAmount: z.number().min(0).optional(),
})

const statusSchema = z.enum(['PENDING', 'VERIFIED', 'REJECTED']).optional()

/** PL Head consumption API — create invoice request (no PL UI in this task). */
export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'pl:write')) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message ?? 'Invalid request body', 400)
    }

    const lead = await prisma.lead.findUnique({
      where: { id: parsed.data.leadId },
      select: { id: true },
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
        invoiceNumber: parsed.data.invoiceNumber?.trim() || null,
        invoiceAmount: parsed.data.invoiceAmount ?? null,
        requestedById: user.id,
      },
      include: invoiceRequestInclude,
    })

    await logInvoiceRequestActivity(prisma, {
      requestId: created.id,
      action: 'SUBMITTED',
      message: `Invoice request submitted for lead ${created.lead.leadRef || created.leadId}`,
      remarks: created.requestRemarks,
      actorId: user.id,
    })

    return successResponse(mapInvoiceRequest(created), 'Invoice request submitted')
  } catch (error) {
    console.error('Error creating invoice request:', error)
    return errorResponse('Failed to create invoice request', 500)
  }
}

/** PL Head consumption API — list invoice requests (defaults to VERIFIED only). */
export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'pl:read')) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')
    const search = searchParams.get('search')?.trim()
    const leadId = searchParams.get('leadId')?.trim()
    const hospitalName = searchParams.get('hospitalName')?.trim()
    const latestPerLead = searchParams.get('latestPerLead') === 'true'

    const where: Prisma.InvoiceRequestWhereInput = {}

    if (statusParam && statusParam !== 'ALL') {
      const parsedStatus = statusSchema.safeParse(statusParam)
      if (!parsedStatus.success) {
        return errorResponse('Invalid status filter', 400)
      }
      where.status = parsedStatus.data as InvoiceRequestStatus
    } else if (!statusParam && !hospitalName && !latestPerLead) {
      where.status = InvoiceRequestStatus.VERIFIED
    }

    if (leadId) where.leadId = leadId
    if (hospitalName) {
      where.lead = { hospitalName }
    }
    if (search) {
      where.OR = [
        { lead: { leadRef: { contains: search, mode: 'insensitive' } } },
        { lead: { patientName: { contains: search, mode: 'insensitive' } } },
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
      ]
    }

    const requests = await prisma.invoiceRequest.findMany({
      where,
      include: invoiceRequestInclude,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    })

    let mapped = requests.map(mapInvoiceRequest)

    if (latestPerLead) {
      const byLead = new Map<string, (typeof mapped)[number]>()
      for (const req of mapped) {
        if (!byLead.has(req.leadId)) byLead.set(req.leadId, req)
      }
      mapped = Array.from(byLead.values())
    }

    return successResponse({
      requests: mapped,
      total: mapped.length,
    })
  } catch (error) {
    console.error('Error fetching PL invoice requests:', error)
    return errorResponse('Failed to fetch invoice requests', 500)
  }
}
