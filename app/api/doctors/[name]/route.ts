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
      where: { doctorName: name, ...surgeryRange },
      select: {
        leadId: true,
        doctorName: true,
        hospitalName: true,
        billAmount: true,
        doctorCharges: true,
        mediendShareAmount: true,
        doctorAmountPending: true,
        hospitalAmountPending: true,
        hospitalPayoutStatus: true,
        doctorPayoutStatus: true,
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
      hospitalName: r.hospitalName,
      surgeryDate: r.surgeryDate,
      month: r.month,
      status: r.status,
      billAmount: r.billAmount,
      doctorCharges: r.doctorCharges,
      doctorAmountPending: r.doctorAmountPending,
      doctorPayoutStatus: r.doctorPayoutStatus,
      doctorPaid: paidByLead.get(r.leadId)?.DOCTOR ?? 0,
      mediendShareAmount: r.mediendShareAmount,
    }))

    const kpis = cases.reduce(
      (acc, c) => {
        acc.totalBill += c.billAmount ?? 0
        acc.totalPayable += c.doctorCharges ?? 0
        acc.amountPaid += c.doctorPaid
        acc.amountPending += c.doctorAmountPending ?? 0
        acc.doctorShare += c.doctorCharges ?? 0
        acc.mediendShare += c.mediendShareAmount ?? 0
        return acc
      },
      {
        totalCases: cases.length,
        totalBill: 0,
        totalPayable: 0,
        amountPaid: 0,
        amountPending: 0,
        doctorShare: 0,
        mediendShare: 0,
      }
    )

    return successResponse({ name, kpis, cases, installments })
  } catch (error) {
    console.error('Error fetching doctor detail:', error)
    return errorResponse('Failed to fetch doctor', 500)
  }
}
