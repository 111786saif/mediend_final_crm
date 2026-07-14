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

    // ─── Run queries in parallel, scoped to this hospital ─────────────────
    const [
      plDoctors,
      plStatuses,
      plInvoiceStatuses,
      billBounds,
      shareBounds,
      pendingBounds,
      receivedBounds,
    ] = await Promise.all([
      // Distinct Doctor Names
      prisma.pLRecord.findMany({
        where: { hospitalName: name, doctorName: { not: null } },
        select: { doctorName: true },
        distinct: ['doctorName'],
      }),
      // Distinct Statuses
      prisma.pLRecord.findMany({
        where: { hospitalName: name, status: { not: null } },
        select: { status: true },
        distinct: ['status'],
      }),
      // Distinct Invoice Statuses
      prisma.pLRecord.findMany({
        where: { hospitalName: name, mediendInvoiceStatus: { not: null } },
        select: { mediendInvoiceStatus: true },
        distinct: ['mediendInvoiceStatus'],
      }),
      // Numeric Bounds: Bill Amount
      prisma.pLRecord.aggregate({
        _min: { billAmount: true },
        _max: { billAmount: true },
        where: { hospitalName: name, billAmount: { gt: 0 } },
      }),
      // Numeric Bounds: MediEND Share
      prisma.pLRecord.aggregate({
        _min: { mediendShareAmount: true },
        _max: { mediendShareAmount: true },
        where: { hospitalName: name, mediendShareAmount: { gt: 0 } },
      }),
      // Numeric Bounds: Hospital Pending (Outstanding Amount)
      prisma.pLRecord.aggregate({
        _min: { hospitalAmountPending: true },
        _max: { hospitalAmountPending: true },
        where: { hospitalName: name, hospitalAmountPending: { gt: 0 } },
      }),
      // Numeric Bounds: MediEND Received
      prisma.paymentInstallment.aggregate({
        _min: { amount: true },
        _max: { amount: true },
        where: {
          recipient: 'MEDIEND',
          lead: {
            plRecord: { hospitalName: name }
          },
          amount: { gt: 0 }
        }
      }),
    ])

    const doctorOptions = toOptions(plDoctors.map(d => d.doctorName))
    const statusOptions = toOptions(plStatuses.map(s => s.status))
    const invoiceOptions = toOptions(plInvoiceStatuses.map(s => s.mediendInvoiceStatus))

    return successResponse({
      filters: [
        // Dropdowns / multiSelect
        { field: 'doctor', label: 'Doctor', filterType: 'multiSelect', filterable: true, options: doctorOptions },
        { field: 'status', label: 'Status', filterType: 'multiSelect', filterable: true, options: statusOptions },
        { field: 'mediendInvoiceStatus', label: 'Invoice Status', filterType: 'multiSelect', filterable: true, options: invoiceOptions },

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
          field: 'mediendShareAmount',
          label: 'MediEND Share',
          filterType: 'numberRange',
          filterable: true,
          min: shareBounds._min.mediendShareAmount ?? 0,
          max: shareBounds._max.mediendShareAmount ?? 0,
        },
        {
          field: 'mediendReceived',
          label: 'Received Amount',
          filterType: 'numberRange',
          filterable: true,
          min: receivedBounds._min.amount ?? 0,
          max: receivedBounds._max.amount ?? 0,
        },
        {
          field: 'hospitalAmountPending',
          label: 'Pending Amount',
          filterType: 'numberRange',
          filterable: true,
          min: pendingBounds._min.hospitalAmountPending ?? 0,
          max: pendingBounds._max.hospitalAmountPending ?? 0,
        },
      ]
    })
  } catch (error) {
    console.error('[hospital details filter-config] Error:', error)
    return errorResponse('Failed to fetch hospital filter config', 500)
  }
}
