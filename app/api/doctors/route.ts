import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

type DoctorSummary = {
  name: string
  totalCases: number
  totalBill: number
  totalPayable: number
  amountPaid: number
  amountPending: number
  doctorShare: number
  mediendShare: number
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'pl:read')) return errorResponse('Forbidden', 403)

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

    // Pull every PLRecord with a doctor name and aggregate in-memory. The dataset
    // is bounded by P/L records (one per discharged case), so this is fine.
    const records = await prisma.pLRecord.findMany({
      where: { doctorName: { not: null }, ...surgeryRange },
      select: {
        leadId: true,
        doctorName: true,
        billAmount: true,
        doctorCharges: true,
        mediendShareAmount: true,
        doctorAmountPending: true,
      },
    })

    const leadIds = records.map((r) => r.leadId)
    const installments = leadIds.length
      ? await prisma.paymentInstallment.findMany({
          where: { recipient: 'DOCTOR', leadId: { in: leadIds } },
          select: { leadId: true, amount: true },
        })
      : []

    const paidByLead = new Map<string, number>()
    for (const i of installments) {
      paidByLead.set(i.leadId, (paidByLead.get(i.leadId) ?? 0) + i.amount)
    }

    const byDoctor = new Map<string, DoctorSummary>()
    for (const r of records) {
      const name = (r.doctorName ?? '').trim()
      if (!name) continue
      const row = byDoctor.get(name) ?? {
        name,
        totalCases: 0,
        totalBill: 0,
        totalPayable: 0,
        amountPaid: 0,
        amountPending: 0,
        doctorShare: 0,
        mediendShare: 0,
      }
      row.totalCases += 1
      row.totalBill += r.billAmount ?? 0
      row.totalPayable += r.doctorCharges ?? 0
      row.amountPaid += paidByLead.get(r.leadId) ?? 0
      row.amountPending += r.doctorAmountPending ?? 0
      row.doctorShare += r.doctorCharges ?? 0
      row.mediendShare += r.mediendShareAmount ?? 0
      byDoctor.set(name, row)
    }

    // Include doctors from master list even if no cases yet — only when no date
    // filter is active, otherwise the list balloons with "0 cases in range" rows.
    if (!startDate && !endDate) {
      const masters = await prisma.doctorMaster.findMany({
        where: { isActive: true },
        select: { name: true },
      })
      for (const m of masters) {
        if (!byDoctor.has(m.name)) {
          byDoctor.set(m.name, {
            name: m.name,
            totalCases: 0,
            totalBill: 0,
            totalPayable: 0,
            amountPaid: 0,
            amountPending: 0,
            doctorShare: 0,
            mediendShare: 0,
          })
        }
      }
    }

    const list = Array.from(byDoctor.values()).sort((a, b) =>
      b.totalCases - a.totalCases || a.name.localeCompare(b.name)
    )

    return successResponse(list)
  } catch (error) {
    console.error('Error listing doctors:', error)
    return errorResponse('Failed to list doctors', 500)
  }
}
