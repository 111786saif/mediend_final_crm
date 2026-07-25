import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPlOrFinanceRead } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { Prisma } from '@/generated/prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPlOrFinanceRead(user)) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let finalWhere: Prisma.LeadWhereInput = {
      pipelineStage: { in: ['PL', 'COMPLETED'] },
      plRecord: { outstandingStatus: 'OUTSTANDING' },
    }

    if (startDate || endDate) {
      const dischargeRange: Prisma.DateTimeFilter = {}
      if (startDate) dischargeRange.gte = new Date(startDate)
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        dischargeRange.lte = end
      }
      finalWhere.dischargeSheet = { dischargeDate: dischargeRange }
    } else {
      finalWhere.dischargeSheet = { isNot: null }
    }

    const filtersParam = searchParams.get('filters')
    if (filtersParam) {
      try {
        const parsedFilters = JSON.parse(filtersParam)
        if (Array.isArray(parsedFilters)) {
          const filterConditions: Prisma.LeadWhereInput[] = []

          for (const f of parsedFilters) {
            const { field, operator, value } = f
            if (!field || value === undefined || value === null) continue

            // ── multiSelect / in ─────────────────────────────────────────
            if (field === 'manager') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  OR: [
                    { plRecord: { managerName: { in: value } } },
                    { dischargeSheet: { managerName: { in: value } } },
                  ],
                })
              }
            } else if (field === 'bdm') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  OR: [
                    { plRecord: { bdmName: { in: value } } },
                    { dischargeSheet: { bdmName: { in: value } } },
                    { bd: { name: { in: value } } },
                  ],
                })
              }
            } else if (field === 'doctor') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  OR: [
                    { plRecord: { doctorName: { in: value } } },
                    { dischargeSheet: { doctorName: { in: value } } },
                  ],
                })
              }
            } else if (field === 'hospital') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  OR: [
                    { hospitalName: { in: value } },
                    { plRecord: { hospitalName: { in: value } } },
                    { dischargeSheet: { hospitalName: { in: value } } },
                  ],
                })
              }
            } else if (field === 'status') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  OR: [
                    { plRecord: { status: { in: value } } },
                    { dischargeSheet: { status: { in: value } } },
                    { caseStage: { in: value } },
                  ],
                })
              }
            } else if (field === 'category') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  OR: [
                    { category: { in: value } },
                    { plRecord: { category: { in: value } } },
                    { dischargeSheet: { category: { in: value } } },
                  ],
                })
              }
            } else if (field === 'paymentType') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  OR: [
                    { plRecord: { paymentType: { in: value } } },
                    { dischargeSheet: { paymentType: { in: value } } },
                  ],
                })
              }
            } else if (field === 'mediendPayout') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  plRecord: { hospitalPayoutStatus: { in: value } },
                })
              }
            } else if (field === 'doctorPayout') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  plRecord: { doctorPayoutStatus: { in: value } },
                })
              }
            } else if (field === 'invoiceStatus') {
              if (Array.isArray(value) && value.length > 0) {
                filterConditions.push({
                  plRecord: { mediendInvoiceStatus: { in: value } },
                })
              }

            // ── boolean ──────────────────────────────────────────────────
            } else if (field === 'paymentReceived') {
              if (typeof value === 'boolean') {
                filterConditions.push({
                  outstandingCase: { paymentReceived: value },
                })
              }

            // ── search / contains ────────────────────────────────────────
            } else if (field === 'leadRef') {
              if (typeof value === 'string' && value.trim()) {
                filterConditions.push({
                  leadRef: { contains: value.trim(), mode: 'insensitive' },
                })
              }
            } else if (field === 'patient') {
              if (typeof value === 'string' && value.trim()) {
                filterConditions.push({
                  OR: [
                    { patientName: { contains: value.trim(), mode: 'insensitive' } },
                    { plRecord: { patientName: { contains: value.trim(), mode: 'insensitive' } } },
                    { dischargeSheet: { patientName: { contains: value.trim(), mode: 'insensitive' } } },
                  ],
                })
              }
            } else if (field === 'treatment') {
              if (typeof value === 'string' && value.trim()) {
                filterConditions.push({
                  OR: [
                    { treatment: { contains: value.trim(), mode: 'insensitive' } },
                    { plRecord: { treatment: { contains: value.trim(), mode: 'insensitive' } } },
                    { dischargeSheet: { treatment: { contains: value.trim(), mode: 'insensitive' } } },
                  ],
                })
              }

            // ── dateRange / between ──────────────────────────────────────
            } else if (field === 'leadReceived') {
              if (Array.isArray(value) && value.length === 2 && value[0]) {
                const from = new Date(value[0])
                const to = new Date(value[1] || value[0])
                to.setHours(23, 59, 59, 999)
                filterConditions.push({
                  dischargeSheet: { markedAt: { gte: from, lte: to } },
                })
              }
            } else if (field === 'admissionDate') {
              if (Array.isArray(value) && value.length === 2 && value[0]) {
                const from = new Date(value[0])
                const to = new Date(value[1] || value[0])
                to.setHours(23, 59, 59, 999)
                filterConditions.push({
                  OR: [
                    { plRecord: { admissionDate: { gte: from, lte: to } } },
                    { admissionRecord: { is: { admissionDate: { gte: from, lte: to } } } },
                  ],
                })
              }
            } else if (field === 'surgeryDate') {
              if (Array.isArray(value) && value.length === 2 && value[0]) {
                const from = new Date(value[0])
                const to = new Date(value[1] || value[0])
                to.setHours(23, 59, 59, 999)
                filterConditions.push({
                  OR: [
                    { plRecord: { surgeryDate: { gte: from, lte: to } } },
                    { surgeryDate: { gte: from, lte: to } },
                    { admissionRecord: { is: { surgeryDate: { gte: from, lte: to } } } },
                  ],
                })
              }

            // ── numberRange / between ────────────────────────────────────
            } else if (field === 'hospitalTotalAmount') {
              const { min, max } = value as { min: number | null; max: number | null }
              const range: Prisma.FloatFilter = {}
              if (min != null) range.gte = min
              if (max != null) range.lte = max
              if (Object.keys(range).length > 0) {
                filterConditions.push({
                  OR: [
                    { plRecord: { hospitalShareAmount: range } },
                    { dischargeSheet: { hospitalShareAmount: range } },
                  ],
                })
              }
            } else if (field === 'hospitalOutstandingAmount') {
              const { min, max } = value as { min: number | null; max: number | null }
              const range: Prisma.FloatFilter = {}
              if (min != null) range.gte = min
              if (max != null) range.lte = max
              if (Object.keys(range).length > 0) {
                filterConditions.push({
                  plRecord: { hospitalAmountPending: range },
                })
              }
            } else if (field === 'doctorPayoutAmount') {
              const { min, max } = value as { min: number | null; max: number | null }
              const range: Prisma.FloatFilter = {}
              if (min != null) range.gte = min
              if (max != null) range.lte = max
              if (Object.keys(range).length > 0) {
                filterConditions.push({
                  OR: [
                    { plRecord: { doctorCharges: range } },
                    { dischargeSheet: { doctorCharges: range } },
                  ],
                })
              }
            } else if (field === 'doctorOutstandingAmount') {
              const { min, max } = value as { min: number | null; max: number | null }
              const range: Prisma.FloatFilter = {}
              if (min != null) range.gte = min
              if (max != null) range.lte = max
              if (Object.keys(range).length > 0) {
                filterConditions.push({
                  plRecord: { doctorAmountPending: range },
                })
              }
            } else if (field === 'totalBill') {
              const { min, max } = value as { min: number | null; max: number | null }
              const range: Prisma.FloatFilter = {}
              if (min != null) range.gte = min
              if (max != null) range.lte = max
              if (Object.keys(range).length > 0) {
                filterConditions.push({
                  OR: [
                    { plRecord: { billAmount: range } },
                    { dischargeSheet: { totalFinalBill: range } },
                    { billAmount: range },
                  ],
                })
              }
            } else if (field === 'approvedAmount') {
              const { min, max } = value as { min: number | null; max: number | null }
              const range: Prisma.FloatFilter = {}
              if (min != null) range.gte = min
              if (max != null) range.lte = max
              if (Object.keys(range).length > 0) {
                filterConditions.push({
                  OR: [
                    { plRecord: { totalAmount: range } },
                    { dischargeSheet: { finalApprovedAmount: range } },
                    { settledTotal: range },
                  ],
                })
              }
            } else if (field === 'deductionTotal') {
              const { min, max } = value as { min: number | null; max: number | null }
              const range: Prisma.FloatFilter = {}
              if (min != null) range.gte = min
              if (max != null) range.lte = max
              if (Object.keys(range).length > 0) {
                filterConditions.push({
                  OR: [
                    { dischargeSheet: { deductionAmount: range } },
                    { deduction: range },
                  ],
                })
              }
            } else if (field === 'deductionPaid') {
              const { min, max } = value as { min: number | null; max: number | null }
              const range: Prisma.FloatFilter = {}
              if (min != null) range.gte = min
              if (max != null) range.lte = max
              if (Object.keys(range).length > 0) {
                filterConditions.push({
                  OR: [
                    { plRecord: { cashOrDedPaid: range } },
                    { dischargeSheet: { cashOrDedPaid: range } },
                    { copay: range },
                  ],
                })
              }
            } else if (field === 'waivedOff') {
              const { min, max } = value as { min: number | null; max: number | null }
              const range: Prisma.FloatFilter = {}
              if (min != null) range.gte = min
              if (max != null) range.lte = max
              if (Object.keys(range).length > 0) {
                filterConditions.push({
                  dischargeSheet: { waivedOffAmount: range },
                })
              }
            } else if (field === 'netProfit') {
              const { min, max } = value as { min: number | null; max: number | null }
              const range: Prisma.FloatFilter = {}
              if (min != null) range.gte = min
              if (max != null) range.lte = max
              if (Object.keys(range).length > 0) {
                filterConditions.push({
                  OR: [
                    { plRecord: { finalProfit: range } },
                    { plRecord: { mediendNetProfit: range } },
                    { netProfit: range },
                  ],
                })
              }
            }
          }

          if (filterConditions.length > 0) {
            finalWhere = {
              AND: [finalWhere, ...filterConditions],
            }
          }
        }
      } catch (err) {
        console.error('Error parsing outstanding filters:', err)
      }
    }

    const leads = await prisma.lead.findMany({
      where: finalWhere,
      include: {
        bd: {
          select: {
            id: true,
            name: true,
            role: true,
            employee: {
              select: {
                team: {
                  select: {
                    id: true,
                    teamLead: { select: { user: { select: { name: true } } } },
                    department: { select: { head: { select: { name: true } } } },
                  },
                },
              },
            },
          },
        },
        admissionRecord: {
          select: {
            admissionDate: true,
            surgeryDate: true,
          },
        },
        dischargeSheet: {
          select: {
            id: true,
            month: true,
            admissionDate: true,
            surgeryDate: true,
            dischargeDate: true,
            status: true,
            paymentType: true,
            approvedOrCash: true,
            managerName: true,
            bdmName: true,
            patientName: true,
            doctorName: true,
            hospitalName: true,
            category: true,
            treatment: true,
            circle: true,
            leadSource: true,
            totalFinalBill: true,
            finalApprovedAmount: true,
            deductionAmount: true,
            waivedOffAmount: true,
            totalAmount: true,
            billAmount: true,
            cashOrDedPaid: true,
            mediendShareAmount: true,
            hospitalShareAmount: true,
            doctorCharges: true,
            doctorRemarks: true,
            costBreakdownRemarks: true,
            dischargeSummaryUrl: true,
            finalBillUrl: true,
            settlementLetterUrl: true,
            otNotesUrl: true,
            isFinalized: true,
            markedAt: true,
            finalizedAt: true,
            remarks: true,
            roomRentAmount: true,
            pharmacyAmount: true,
            investigationAmount: true,
            consumablesAmount: true,
            implantsAmount: true,
            instrumentsAmount: true,
          },
        },
        plRecord: {
          select: {
            hospitalPayoutStatus: true,
            doctorPayoutStatus: true,
            mediendInvoiceStatus: true,
            hospitalAmountPending: true,
            doctorAmountPending: true,
            month: true,
            admissionDate: true,
            surgeryDate: true,
            status: true,
            paymentType: true,
            approvedOrCash: true,
            managerName: true,
            managerRole: true,
            bdmName: true,
            patientName: true,
            doctorName: true,
            hospitalName: true,
            category: true,
            treatment: true,
            circle: true,
            leadSource: true,
            billAmount: true,
            totalAmount: true,
            cashOrDedPaid: true,
            finalProfit: true,
            mediendNetProfit: true,
            mediendShareAmount: true,
            hospitalShareAmount: true,
            doctorCharges: true,
            doctorRemarks: true,
            costBreakdownRemarks: true,
          },
        },
        kypSubmission: {
          select: {
            preAuthData: {
              select: {
                requestedHospitalName: true,
                suggestedHospitals: {
                  select: {
                    hospitalName: true,
                    suggestedDoctor: true,
                  },
                },
              },
            },
          },
        },
        outstandingCase: {
          select: {
            paymentReceived: true,
            remark2: true,
          },
        },
      },
      orderBy: {
        createdDate: 'desc',
      },
      take: 1000,
    })

    const mapped = leads.map((lead) => {
      const bd = lead.bd
        ? {
            name: lead.bd.name,
            team: lead.bd.employee?.team ?? null,
          }
        : lead.bd
      return { ...lead, bd }
    })

    return successResponse(mapped)
  } catch (error) {
    console.error('Error fetching outstanding records:', error)
    return errorResponse('Failed to fetch outstanding records', 500)
  }
}
