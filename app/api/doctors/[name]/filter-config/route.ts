import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPlOrFinanceRead } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

// Helper: deduplicate + sort a list of nullable strings into {label, value} options
function toOptions(values: Array<string | null | undefined>): Array<{ label: string; value: string }> {
  return [...new Set(values.filter((v): v is string => !!v && v.trim() !== ''))]
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ label: name, value: name }))
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPlOrFinanceRead(user)) return errorResponse('Forbidden', 403)

    const { name: rawName } = await params
    const name = decodeURIComponent(rawName)

    // ─── Run queries in parallel, scoped to this doctor ───────────────────
    const [
      plHospitals,
      plStatuses,
      plPayoutStatuses,
      billBounds,
      chargesBounds,
      pendingBounds,
      paidBounds,
    ] = await Promise.all([
      // Distinct Hospital Names
      prisma.pLRecord.findMany({
        where: { doctorName: name, hospitalName: { not: null } },
        select: { hospitalName: true },
        distinct: ['hospitalName'],
      }),
      // Distinct Statuses
      prisma.pLRecord.findMany({
        where: { doctorName: name, status: { not: null } },
        select: { status: true },
        distinct: ['status'],
      }),
      // Distinct Doctor Payout Statuses
      prisma.pLRecord.findMany({
        where: { doctorName: name, doctorPayoutStatus: { not: null } },
        select: { doctorPayoutStatus: true },
        distinct: ['doctorPayoutStatus'],
      }),
      // Numeric Bounds: Bill Amount
      prisma.pLRecord.aggregate({
        _min: { billAmount: true },
        _max: { billAmount: true },
        where: { doctorName: name, billAmount: { gt: 0 } },
      }),
      // Numeric Bounds: Doctor Charges
      prisma.pLRecord.aggregate({
        _min: { doctorCharges: true },
        _max: { doctorCharges: true },
        where: { doctorName: name, doctorCharges: { gt: 0 } },
      }),
      // Numeric Bounds: Doctor Pending
      prisma.pLRecord.aggregate({
        _min: { doctorAmountPending: true },
        _max: { doctorAmountPending: true },
        where: { doctorName: name, doctorAmountPending: { gt: 0 } },
      }),
      // Numeric Bounds: Doctor Paid
      prisma.paymentInstallment.aggregate({
        _min: { amount: true },
        _max: { amount: true },
        where: {
          recipient: 'DOCTOR',
          lead: {
            plRecord: { doctorName: name }
          },
          amount: { gt: 0 }
        }
      }),
    ])

    const hospitalOptions = toOptions(plHospitals.map(h => h.hospitalName))
    const statusOptions = toOptions(plStatuses.map(s => s.status))
    const payoutOptions = toOptions(plPayoutStatuses.map(s => s.doctorPayoutStatus))

    return successResponse({
      filters: [
        // Dropdowns / multiSelect
        { field: 'hospital', label: 'Hospital', filterType: 'multiSelect', filterable: true, options: hospitalOptions },
        { field: 'status', label: 'Status', filterType: 'multiSelect', filterable: true, options: statusOptions },
        { field: 'doctorPayoutStatus', label: 'Payout Status', filterType: 'multiSelect', filterable: true, options: payoutOptions },

        // Searches
        { field: 'leadRef', label: 'Lead Ref', filterType: 'search', filterable: true },
        { field: 'patientName', label: 'Patient Name', filterType: 'search', filterable: true },

        // Dates
        { field: 'month', label: 'Month', filterType: 'dateRange', filterable: true },
        { field: 'surgeryDate', label: 'Surgery Date', filterType: 'dateRange', filterable: true },

        // Number Ranges
        {
          field: 'billAmount',
          label: 'Bill Amount',
          filterType: 'numberRange',
          filterable: true,
          min: billBounds._min.billAmount ?? 0,
          max: billBounds._max.billAmount ?? 0,
        },
        {
          field: 'doctorCharges',
          label: 'Doctor Charges',
          filterType: 'numberRange',
          filterable: true,
          min: chargesBounds._min.doctorCharges ?? 0,
          max: chargesBounds._max.doctorCharges ?? 0,
        },
        {
          field: 'doctorPaid',
          label: 'Paid Amount',
          filterType: 'numberRange',
          filterable: true,
          min: paidBounds._min.amount ?? 0,
          max: paidBounds._max.amount ?? 0,
        },
        {
          field: 'doctorAmountPending',
          label: 'Pending Amount',
          filterType: 'numberRange',
          filterable: true,
          min: pendingBounds._min.doctorAmountPending ?? 0,
          max: pendingBounds._max.doctorAmountPending ?? 0,
        },
      ]
    })
  } catch (error) {
    console.error('[doctor details filter-config] Error:', error)
    return errorResponse('Failed to fetch doctor filter config', 500)
  }
}
