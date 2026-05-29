import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { recomputeOutstandingFromInstallments } from '@/lib/pl/installments'
import type { InstallmentRecipient, InstallmentMode } from '@/generated/prisma/client'

const RECIPIENTS: InstallmentRecipient[] = ['HOSPITAL', 'DOCTOR', 'MEDIEND']
const MODES: InstallmentMode[] = ['CASH', 'UPI', 'NEFT', 'RTGS', 'CHEQUE', 'CARD', 'OTHER']

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'pl:read')) return errorResponse('Forbidden', 403)

    const url = new URL(request.url)
    const leadId = url.searchParams.get('leadId')
    if (!leadId) return errorResponse('leadId is required', 400)

    const rows = await prisma.paymentInstallment.findMany({
      where: { leadId },
      orderBy: { paidOn: 'desc' },
      include: { recordedBy: { select: { id: true, name: true } } },
    })
    return successResponse(rows)
  } catch (error) {
    console.error('Error listing installments:', error)
    return errorResponse('Failed to list installments', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'pl:write')) return errorResponse('Forbidden', 403)

    const body = await request.json()
    const leadId = String(body.leadId || '').trim()
    if (!leadId) return errorResponse('leadId is required', 400)

    const recipient = body.recipient as InstallmentRecipient
    if (!RECIPIENTS.includes(recipient)) return errorResponse('Invalid recipient', 400)

    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount <= 0) return errorResponse('amount must be > 0', 400)

    const paidOn = body.paidOn ? new Date(body.paidOn) : null
    if (!paidOn || Number.isNaN(paidOn.getTime())) return errorResponse('paidOn is required', 400)

    const mode = body.mode ? (body.mode as InstallmentMode) : null
    if (mode && !MODES.includes(mode)) return errorResponse('Invalid mode', 400)

    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true } })
    if (!lead) return errorResponse('Lead not found', 404)

    const created = await prisma.paymentInstallment.create({
      data: {
        leadId,
        recipient,
        amount,
        paidOn,
        mode,
        reference: body.reference ? String(body.reference).trim() || null : null,
        notes: body.notes ? String(body.notes).trim() || null : null,
        recordedById: user.id,
      },
      include: { recordedBy: { select: { id: true, name: true } } },
    })

    await recomputeOutstandingFromInstallments(leadId)

    return successResponse(created, 'Installment recorded')
  } catch (error) {
    console.error('Error creating installment:', error)
    return errorResponse('Failed to create installment', 500)
  }
}
