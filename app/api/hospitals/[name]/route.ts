import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'pl:read')) return errorResponse('Forbidden', 403)

    const { name: rawName } = await params
    const name = decodeURIComponent(rawName)

    const url = new URL(request.url)
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')
    const surgeryRange =
      startDate && endDate
        ? {
            surgeryDate: {
              gte: new Date(startDate),
              lte: new Date(`${endDate}T23:59:59.999`),
            },
          }
        : {}

    const records = await prisma.pLRecord.findMany({
      where: { hospitalName: name, ...surgeryRange },
      select: {
        leadId: true,
        hospitalName: true,
        doctorName: true,
        billAmount: true,
        mediendShareAmount: true,
        hospitalAmountPending: true,
        hospitalPayoutStatus: true,
        mediendInvoiceStatus: true,
        surgeryDate: true,
        month: true,
        status: true,
        lead: {
          select: {
            id: true,
            leadRef: true,
            patientName: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: { surgeryDate: 'desc' },
    })

    const leadIds = records.map((r) => r.leadId)
    const installments = leadIds.length
      ? await prisma.paymentInstallment.findMany({
          where: { leadId: { in: leadIds } },
          select: { leadId: true, recipient: true, amount: true, paidOn: true },
          orderBy: { paidOn: 'desc' },
        })
      : []

    const paidByLead = new Map<string, { DOCTOR: number; HOSPITAL: number; MEDIEND: number }>()
    for (const i of installments) {
      const e = paidByLead.get(i.leadId) ?? { DOCTOR: 0, HOSPITAL: 0, MEDIEND: 0 }
      e[i.recipient] += i.amount
      paidByLead.set(i.leadId, e)
    }

    const cases = records.map((r) => ({
      leadId: r.leadId,
      leadRef: r.lead?.leadRef ?? null,
      patientName: r.lead?.patientName ?? null,
      doctorName: r.doctorName,
      surgeryDate: r.surgeryDate,
      month: r.month,
      status: r.status,
      billAmount: r.billAmount,
      mediendShareAmount: r.mediendShareAmount,
      hospitalAmountPending: r.hospitalAmountPending,
      mediendInvoiceStatus: r.mediendInvoiceStatus,
      mediendReceived: paidByLead.get(r.leadId)?.MEDIEND ?? 0,
    }))

    const kpis = cases.reduce(
      (acc, c) => {
        acc.amountReceived += c.mediendReceived
        acc.pendingOutstanding += c.hospitalAmountPending ?? 0
        acc.mediendShare += c.mediendShareAmount ?? 0
        return acc
      },
      {
        totalCases: cases.length,
        amountReceived: 0,
        pendingOutstanding: 0,
        mediendShare: 0,
      }
    )

    return successResponse({ name, kpis, cases, installments })
  } catch (error) {
    console.error('Error fetching hospital detail:', error)
    return errorResponse('Failed to fetch hospital', 500)
  }
}
