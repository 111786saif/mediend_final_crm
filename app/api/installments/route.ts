import { optionalLeadId } from '@/lib/lead-id'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasEffectivePlOrFinanceRead, hasEffectivePlOrFinanceWrite } from '@/lib/rbac-new'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { recomputeOutstandingFromInstallments } from '@/lib/pl/installments'
import type { InstallmentRecipient, InstallmentMode } from '@/generated/prisma/client'

const RECIPIENTS: InstallmentRecipient[] = ['HOSPITAL', 'DOCTOR', 'MEDIEND']
const MODES: InstallmentMode[] = ['CASH', 'UPI', 'NEFT', 'RTGS', 'CHEQUE', 'CARD', 'OTHER']

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!(await hasEffectivePlOrFinanceRead(user))) return errorResponse('Forbidden', 403)

    const url = new URL(request.url)
    const leadId = optionalLeadId(url.searchParams.get('leadId'))
    if (!leadId) return errorResponse('leadId is required', 400)

    const rows = await prisma.paymentInstallment.findMany({
      where: { leadId },
      orderBy: { paidOn: 'desc' },
      include: { recordedBy: { select: { id: true, name: true } } },
    })
    return successResponse(rows)
  } catch (error) {
    console.error('Error listing payment installments:', error)
    return errorResponse('Failed to list installments', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!(await hasEffectivePlOrFinanceWrite(user))) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const leadId = optionalLeadId(body.leadId)
    const hospitalName = body.hospitalName ? String(body.hospitalName).trim() : ''

    // Case-linked OR hospital-level (no case) MediEND receipt
    if (!leadId && !hospitalName) {
      return errorResponse('leadId or hospitalName is required', 400)
    }

    const recipient = body.recipient as InstallmentRecipient
    if (!RECIPIENTS.includes(recipient)) return errorResponse('Invalid recipient', 400)

    // Hospital-level payments (no case) are only for MediEND verification
    if (!leadId && recipient !== 'MEDIEND') {
      return errorResponse('Hospital-level payments must use recipient MEDIEND', 400)
    }

    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) return errorResponse('amount must be > 0', 400)

    const paidOn = body.paidOn ? new Date(body.paidOn) : null
    if (!paidOn || Number.isNaN(paidOn.getTime())) return errorResponse('paidOn is required', 400)

    const mode = body.mode ? (body.mode as InstallmentMode) : null
    if (!mode || !MODES.includes(mode)) return errorResponse('Payment mode is required', 400)

    if (leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } })
      if (!lead) return errorResponse('Lead not found', 404)
    }

    // MediEND receipts need Finance verification before they reduce outstanding.
    // Hospital / Doctor payouts apply immediately (auto-verified).
    const needsFinanceVerification = recipient === 'MEDIEND'

    // Omit leadId entirely for hospital-level rows — passing null makes Prisma
    // treat the create as relation-style and require `lead`.
    const created = await prisma.paymentInstallment.create({
      data: {
        ...(leadId ? { leadId } : {}),
        hospitalName: hospitalName || null,
        recipient,
        amount,
        paidOn,
        mode,
        reference: body.reference ? String(body.reference).trim() || null : null,
        notes: body.notes ? String(body.notes).trim() || null : null,
        recordedById: user.id,
        verificationStatus: needsFinanceVerification ? 'PENDING' : 'VERIFIED',
        verifiedById: needsFinanceVerification ? null : user.id,
        verifiedAt: needsFinanceVerification ? null : new Date(),
      },
      include: { recordedBy: { select: { id: true, name: true } } },
    })

    if (leadId) {
      await recomputeOutstandingFromInstallments(leadId)
    }

    return successResponse(created, 'Installment recorded')
  } catch (error) {
    console.error('Error creating installment:', error)
    return errorResponse('Failed to create installment', 500)
  }
}
