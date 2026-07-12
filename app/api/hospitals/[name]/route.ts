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

    let finalWhere: any = { hospitalName: name, ...surgeryRange }

    const filtersParam = url.searchParams.get('filters')
    let mediendReceivedFilter: any = null

    if (filtersParam) {
      try {
        const parsedFilters = JSON.parse(filtersParam)
        if (Array.isArray(parsedFilters)) {
          const filterConditions: any[] = []

          for (const f of parsedFilters) {
            const { field, operator, value } = f
            if (!field || value === undefined || value === null) continue

            // ── multiSelect / in ─────────────────────────────────────────
            if (field === 'doctor') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({ doctorName: { in: value } })
              }
            } else if (field === 'status') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({ status: { in: value } })
              }
            } else if (field === 'mediendInvoiceStatus') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({ mediendInvoiceStatus: { in: value } })
              }

            // ── search / contains ────────────────────────────────────────
            } else if (field === 'leadRef') {
              if (typeof value === 'string' && value.trim()) {
                filterConditions.push({
                  lead: { leadRef: { contains: value.trim(), mode: 'insensitive' } }
                })
              }
            } else if (field === 'patientName') {
              if (typeof value === 'string' && value.trim()) {
                filterConditions.push({
                  lead: { patientName: { contains: value.trim(), mode: 'insensitive' } }
                })
              }

            // ── dateRange / between ──────────────────────────────────────
            } else if (field === 'month') {
              if (Array.isArray(value) && value.length === 2 && value[0]) {
                const from = new Date(value[0])
                const to = new Date(value[1] || value[0])
                to.setHours(23, 59, 59, 999)
                filterConditions.push({ month: { gte: from, lte: to } })
              }
            } else if (field === 'surgeryDate') {
              if (Array.isArray(value) && value.length === 2 && value[0]) {
                const from = new Date(value[0])
                const to = new Date(value[1] || value[0])
                to.setHours(23, 59, 59, 999)
                filterConditions.push({ surgeryDate: { gte: from, lte: to } })
              }

            // ── numberRange / between ────────────────────────────────────
            } else if (field === 'billAmount') {
              const { min, max } = value as { min: number | null; max: number | null }
              const range: any = {}
              if (min != null) range.gte = min
              if (max != null) range.lte = max
              if (Object.keys(range).length > 0) {
                filterConditions.push({ billAmount: range })
              }
            } else if (field === 'mediendShareAmount') {
              const { min, max } = value as { min: number | null; max: number | null }
              const range: any = {}
              if (min != null) range.gte = min
              if (max != null) range.lte = max
              if (Object.keys(range).length > 0) {
                filterConditions.push({ mediendShareAmount: range })
              }
            } else if (field === 'hospitalAmountPending') {
              const { min, max } = value as { min: number | null; max: number | null }
              const range: any = {}
              if (min != null) range.gte = min
              if (max != null) range.lte = max
              if (Object.keys(range).length > 0) {
                filterConditions.push({ hospitalAmountPending: range })
              }
            } else if (field === 'mediendReceived') {
              mediendReceivedFilter = value
            }
          }

          if (filterConditions.length > 0) {
            finalWhere = {
              AND: [finalWhere, ...filterConditions],
            }
          }
        }
      } catch (err) {
        console.error('Error parsing hospital details filters:', err)
      }
    }

    const records = await prisma.pLRecord.findMany({
      where: finalWhere,
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

    let cases = records.map((r) => ({
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

    // JavaScript post-filtering for Computed Paid amount bounds
    if (mediendReceivedFilter) {
      const { min, max } = mediendReceivedFilter as { min: number | null; max: number | null }
      cases = cases.filter(c => {
        if (min != null && c.mediendReceived < min) return false
        if (max != null && c.mediendReceived > max) return false
        return true
      })
    }

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
