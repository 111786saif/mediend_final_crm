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
      where: { hospitalName: { not: null }, ...surgeryRange },
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

    const paidByLead = new Map<number | null, number>()
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

    if (!startDate && !endDate) {
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
    }

    let list = Array.from(byHospital.values())

    // Apply filters query parameter in JS
    const filtersParam = url.searchParams.get('filters')
    if (filtersParam) {
      try {
        const parsedFilters = JSON.parse(filtersParam)
        if (Array.isArray(parsedFilters)) {
          for (const f of parsedFilters) {
            const { field, operator, value } = f
            if (!field || value === undefined || value === null) continue

            if (field === 'hospital') {
              if (Array.isArray(value) && value.length > 0) {
                list = list.filter(h => value.includes(h.name))
              }
            } else if (
              field === 'totalCases' ||
              field === 'amountReceived' ||
              field === 'pendingOutstanding' ||
              field === 'mediendShare'
            ) {
              const { min, max } = value as { min: number | null; max: number | null }
              list = list.filter(h => {
                const val = h[field as keyof HospitalSummary] as number
                if (min != null && val < min) return false
                if (max != null && val > max) return false
                return true
              })
            }
          }
        }
      } catch (err) {
        console.error('Error parsing hospitals list filters:', err)
      }
    }

    list.sort(
      (a, b) => b.totalCases - a.totalCases || a.name.localeCompare(b.name)
    )

    return successResponse(list)
  } catch (error) {
    console.error('Error listing hospitals:', error)
    return errorResponse('Failed to list hospitals', 500)
  }
}
