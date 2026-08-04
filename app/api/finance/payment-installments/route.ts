import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

const statusSchema = z.enum(['PENDING', 'VERIFIED', 'REJECTED', 'ALL']).optional()

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'finance:read')) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')
    const search = searchParams.get('search')?.trim()
    const recipient = searchParams.get('recipient')?.trim()

    const parsedStatus = statusSchema.safeParse(statusParam ?? undefined)
    if (!parsedStatus.success) return errorResponse('Invalid status filter', 400)

    const where: Prisma.PaymentInstallmentWhereInput = {}

    if (parsedStatus.data && parsedStatus.data !== 'ALL') {
      where.verificationStatus = parsedStatus.data
    } else if (!statusParam) {
      where.verificationStatus = 'PENDING'
    }

    // Hospital collection → MediEND is what Finance typically verifies
    if (recipient === 'HOSPITAL' || recipient === 'DOCTOR' || recipient === 'MEDIEND') {
      where.recipient = recipient
    } else {
      where.recipient = 'MEDIEND'
    }

    if (search) {
      where.OR = [
        { lead: { leadRef: { contains: search, mode: 'insensitive' } } },
        { lead: { patientName: { contains: search, mode: 'insensitive' } } },
        { lead: { hospitalName: { contains: search, mode: 'insensitive' } } },
        { reference: { contains: search, mode: 'insensitive' } },
      ]
    }

    const rows = await prisma.paymentInstallment.findMany({
      where,
      include: {
        lead: {
          select: {
            id: true,
            leadRef: true,
            patientName: true,
            hospitalName: true,
          },
        },
        recordedBy: { select: { id: true, name: true } },
        verifiedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 200,
    })

    return successResponse({
      installments: rows.map((r) => ({
        id: r.id,
        leadId: r.leadId,
        recipient: r.recipient,
        amount: r.amount,
        paidOn: r.paidOn.toISOString(),
        mode: r.mode,
        reference: r.reference,
        notes: r.notes,
        verificationStatus: r.verificationStatus,
        verifiedAt: r.verifiedAt?.toISOString() ?? null,
        rejectionRemarks: r.rejectionRemarks,
        createdAt: r.createdAt.toISOString(),
        lead: r.lead,
        recordedBy: r.recordedBy,
        verifiedBy: r.verifiedBy,
      })),
      total: rows.length,
    })
  } catch (error) {
    console.error('Error listing finance payment installments:', error)
    return errorResponse('Failed to list payment installments', 500)
  }
}
