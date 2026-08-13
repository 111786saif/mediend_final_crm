import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasEffectivePlOrFinanceRead } from '@/lib/rbac-new'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

type HospitalSummary = {
  name: string
  totalCases: number
  amountReceived: number
  pendingOutstanding: number
  mediendShare: number
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!(await hasEffectivePlOrFinanceRead(user))) return errorResponse('Forbidden', 403)

    // Pull every PLRecord with a hospital name and aggregate in-memory.
    const records = await prisma.pLRecord.findMany({
      where: { hospitalName: { not: null } },
      select: {
        leadId: true,
        hospitalName: true,
        mediendShareAmount: true,
        hospitalAmountPending: true,
      },
    })

    const leadIds = records.map((r) => r.leadId)
    const installments = leadIds.length
      ? await prisma.paymentInstallment.findMany({
          where: { recipient: 'MEDIEND', leadId: { in: leadIds } },
          select: { leadId: true, amount: true },
        })
      : []

    const paidByLead = new Map<string, number>()
    for (const i of installments) {
      paidByLead.set(i.leadId, (paidByLead.get(i.leadId) ?? 0) + i.amount)
    }

    const byHospital = new Map<string, HospitalSummary>()
    for (const r of records) {
      const name = (r.hospitalName ?? '').trim()
      if (!name) continue
      const row = byHospital.get(name) ?? {
        name,
        totalCases: 0,
        amountReceived: 0,
        pendingOutstanding: 0,
        mediendShare: 0,
      }
      row.totalCases += 1
      row.amountReceived += paidByLead.get(r.leadId) ?? 0
      row.pendingOutstanding += r.hospitalAmountPending ?? 0
      row.mediendShare += r.mediendShareAmount ?? 0
      byHospital.set(name, row)
    }

    // Include hospitals from master list even if no cases yet
    const masters = await prisma.hospitalMaster.findMany({
      where: { isActive: true },
      select: { name: true },
    })
    for (const m of masters) {
      if (!byHospital.has(m.name)) {
        byHospital.set(m.name, {
          name: m.name,
          totalCases: 0,
          amountReceived: 0,
          pendingOutstanding: 0,
          mediendShare: 0,
        })
      }
    }

    const list = Array.from(byHospital.values())

    // Compute min/max limits across all aggregated hospitals
    const totalCasesVals = list.map(x => x.totalCases)
    const amountReceivedVals = list.map(x => x.amountReceived)
    const pendingOutstandingVals = list.map(x => x.pendingOutstanding)
    const mediendShareVals = list.map(x => x.mediendShare)

    const bounds = {
      totalCases: { min: Math.min(...totalCasesVals, 0), max: Math.max(...totalCasesVals, 0) },
      amountReceived: { min: Math.min(...amountReceivedVals, 0), max: Math.max(...amountReceivedVals, 0) },
      pendingOutstanding: { min: Math.min(...pendingOutstandingVals, 0), max: Math.max(...pendingOutstandingVals, 0) },
      mediendShare: { min: Math.min(...mediendShareVals, 0), max: Math.max(...mediendShareVals, 0) },
    }

    const hospitalOptions = list
      .map(h => ({ label: h.name, value: h.name }))
      .sort((a, b) => a.label.localeCompare(b.label))

    return successResponse({
      filters: [
        { field: 'hospital', label: 'Hospital', filterType: 'multiSelect', filterable: true, options: hospitalOptions },
        { field: 'totalCases', label: 'Cases', filterType: 'numberRange', filterable: true, min: bounds.totalCases.min, max: bounds.totalCases.max },
        { field: 'amountReceived', label: 'Amount Received', filterType: 'numberRange', filterable: true, min: bounds.amountReceived.min, max: bounds.amountReceived.max },
        { field: 'pendingOutstanding', label: 'Pending Outstanding', filterType: 'numberRange', filterable: true, min: bounds.pendingOutstanding.min, max: bounds.pendingOutstanding.max },
        { field: 'mediendShare', label: 'MediEND Share', filterType: 'numberRange', filterable: true, min: bounds.mediendShare.min, max: bounds.mediendShare.max },
      ]
    })
  } catch (error) {
    console.error('[hospitals list filter-config] Error:', error)
    return errorResponse('Failed to fetch hospitals list filter config', 500)
  }
}
