import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPlOrFinanceWrite } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPlOrFinanceWrite(user)) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const body = await request.json()

    // Verify lead exists and has discharge sheet
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        dischargeSheet: {
          select: { id: true },
        },
      },
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    if (!lead.dischargeSheet) {
      return errorResponse('Lead must have a discharge sheet to update outstanding', 400)
    }

    // PLRecord fields
    const plAllowedFields = [
      'hospitalPayoutStatus',
      'doctorPayoutStatus',
      'mediendInvoiceStatus',
      'hospitalAmountPending',
      'doctorAmountPending',
      'doctorRemarks',
      'costBreakdownRemarks',
    ]

    // OutstandingCase fields
    const outstandingAllowedFields = ['paymentReceived', 'remark2']

    const plUpdateData: Record<string, unknown> = {}
    for (const key of plAllowedFields) {
      if (body[key] !== undefined) {
        if (key === 'hospitalAmountPending' || key === 'doctorAmountPending') {
          plUpdateData[key] = parseFloat(body[key]) || 0
        } else {
          plUpdateData[key] = body[key]
        }
      }
    }

    const outstandingUpdateData: Record<string, unknown> = {}
    for (const key of outstandingAllowedFields) {
      if (body[key] !== undefined) {
        if (key === 'paymentReceived') {
          outstandingUpdateData[key] = Boolean(body[key])
        } else {
          outstandingUpdateData[key] = body[key]
        }
      }
    }

    if (Object.keys(plUpdateData).length === 0 && Object.keys(outstandingUpdateData).length === 0) {
      return errorResponse('No valid fields to update', 400)
    }

    // Update PLRecord if needed
    if (Object.keys(plUpdateData).length > 0) {
      await prisma.pLRecord.upsert({
        where: { leadId: id },
        create: { leadId: id, ...plUpdateData },
        update: plUpdateData,
      })
    }

    // Update OutstandingCase paymentReceived / remark2 if needed
    if (Object.keys(outstandingUpdateData).length > 0) {
      const existingOutstanding = await prisma.outstandingCase.findUnique({ where: { leadId: id } })
      if (existingOutstanding) {
        await prisma.outstandingCase.update({
          where: { leadId: id },
          data: outstandingUpdateData,
        })
      }
    }

    // Fetch updated lead with relations
    const updatedLead = await prisma.lead.findUnique({
      where: { id },
      include: {
        plRecord: true,
        outstandingCase: true,
        dischargeSheet: {
          select: { id: true },
        },
      },
    })

    return successResponse(updatedLead, 'Outstanding record updated successfully')
  } catch (error) {
    console.error('Error updating outstanding record:', error)
    return errorResponse('Failed to update outstanding record', 500)
  }
}
