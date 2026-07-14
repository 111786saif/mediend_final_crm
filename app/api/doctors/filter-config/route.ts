import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPlOrFinanceRead } from '@/lib/rbac'
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
    if (!hasPlOrFinanceRead(user)) return errorResponse('Forbidden', 403)

    // Pull every PLRecord with a doctor name and aggregate in-memory.
    const records = await prisma.pLRecord.findMany({
      where: { doctorName: { not: null } },
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

    // Include doctors from master list even if no cases yet
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

    const list = Array.from(byDoctor.values())

    // Compute min/max limits across all aggregated doctors
    const totalCasesVals = list.map(x => x.totalCases)
    const totalBillVals = list.map(x => x.totalBill)
    const totalPayableVals = list.map(x => x.totalPayable)
    const amountPaidVals = list.map(x => x.amountPaid)
    const amountPendingVals = list.map(x => x.amountPending)
    const doctorShareVals = list.map(x => x.doctorShare)
    const mediendShareVals = list.map(x => x.mediendShare)

    const bounds = {
      totalCases: { min: Math.min(...totalCasesVals, 0), max: Math.max(...totalCasesVals, 0) },
      totalBill: { min: Math.min(...totalBillVals, 0), max: Math.max(...totalBillVals, 0) },
      totalPayable: { min: Math.min(...totalPayableVals, 0), max: Math.max(...totalPayableVals, 0) },
      amountPaid: { min: Math.min(...amountPaidVals, 0), max: Math.max(...amountPaidVals, 0) },
      amountPending: { min: Math.min(...amountPendingVals, 0), max: Math.max(...amountPendingVals, 0) },
      doctorShare: { min: Math.min(...doctorShareVals, 0), max: Math.max(...doctorShareVals, 0) },
      mediendShare: { min: Math.min(...mediendShareVals, 0), max: Math.max(...mediendShareVals, 0) },
    }

    const doctorOptions = list
      .map(d => ({ label: d.name, value: d.name }))
      .sort((a, b) => a.label.localeCompare(b.label))

    return successResponse({
      filters: [
        { field: 'doctor', label: 'Doctor', filterType: 'multiSelect', filterable: true, options: doctorOptions },
        { field: 'totalCases', label: 'Cases', filterType: 'numberRange', filterable: true, min: bounds.totalCases.min, max: bounds.totalCases.max },
        { field: 'totalBill', label: 'Total Bill', filterType: 'numberRange', filterable: true, min: bounds.totalBill.min, max: bounds.totalBill.max },
        { field: 'totalPayable', label: 'Total Payable', filterType: 'numberRange', filterable: true, min: bounds.totalPayable.min, max: bounds.totalPayable.max },
        { field: 'amountPaid', label: 'Paid', filterType: 'numberRange', filterable: true, min: bounds.amountPaid.min, max: bounds.amountPaid.max },
        { field: 'amountPending', label: 'Pending', filterType: 'numberRange', filterable: true, min: bounds.amountPending.min, max: bounds.amountPending.max },
        { field: 'doctorShare', label: 'Doctor Share', filterType: 'numberRange', filterable: true, min: bounds.doctorShare.min, max: bounds.doctorShare.max },
        { field: 'mediendShare', label: 'MediEND Share', filterType: 'numberRange', filterable: true, min: bounds.mediendShare.min, max: bounds.mediendShare.max },
      ]
    })
  } catch (error) {
    console.error('[doctors list filter-config] Error:', error)
    return errorResponse('Failed to fetch doctors list filter config', 500)
  }
}
