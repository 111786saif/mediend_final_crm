import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { UserRole } from '@/generated/prisma/client'

// Helper: deduplicate + sort a list of nullable strings into {label, value} options
function toOptions(values: Array<string | null | undefined>): Array<{ label: string; value: string }> {
  return [...new Set(values.filter((v): v is string => !!v && v.trim() !== ''))]
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({ label: name, value: name }))
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'pl:read')) {
      return errorResponse('Forbidden', 403)
    }

    // ─── Run all queries in parallel ─────────────────────────────────────
    const [
      // BDM names from User table where role=BD
      bdUsers,
      // Manager names
      plManagers, dsManagers,
      // Doctor names
      plDoctors, dsDoctors,
      // Hospital names
      plHospitals, dsHospitals, leadHospitals,
      // Statuses
      plStatuses, dsStatuses, leadStages,
      // Category
      plCategories, dsCategories, leadCategories,
      // Payment type
      plPaymentTypes, dsPaymentTypes,
      // Hospital Share bounds (hospitalTotalAmount)
      plHospShareBounds, dsHospShareBounds,
      // Hospital Pending bounds (hospitalOutstandingAmount)
      plHospPendingBounds,
      // Doctor Payout bounds (doctorPayoutAmount)
      dsDocChargesBounds,
      // Doctor Pending bounds (doctorOutstandingAmount)
      plDocPendingBounds,
      // Total Bill bounds
      plBillBounds, dsBillBounds, leadBillBounds,
      // Approved Amount bounds
      plApprovedBounds, dsApprovedBounds, leadApprovedBounds,
      // Total Deduction bounds
      dsDeductionBounds, leadDeductionBounds,
      // Deduction Paid bounds
      plDedPaidBounds, dsDedPaidBounds, leadDedPaidBounds,
      // Waived Off bounds
      dsWaivedBounds,
      // Net Profit bounds
      plNetProfitBounds, leadNetProfitBounds,
    ] = await Promise.all([
      // BDM
      prisma.user.findMany({
        where: { role: UserRole.BD },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
      // Manager
      prisma.pLRecord.findMany({ where: { managerName: { not: null } }, select: { managerName: true }, distinct: ['managerName'] }),
      prisma.dischargeSheet.findMany({ where: { managerName: { not: null } }, select: { managerName: true }, distinct: ['managerName'] }),
      // Doctor
      prisma.pLRecord.findMany({ where: { doctorName: { not: null } }, select: { doctorName: true }, distinct: ['doctorName'] }),
      prisma.dischargeSheet.findMany({ where: { doctorName: { not: null } }, select: { doctorName: true }, distinct: ['doctorName'] }),
      // Hospital
      prisma.pLRecord.findMany({ where: { hospitalName: { not: null } }, select: { hospitalName: true }, distinct: ['hospitalName'] }),
      prisma.dischargeSheet.findMany({ where: { hospitalName: { not: null } }, select: { hospitalName: true }, distinct: ['hospitalName'] }),
      prisma.lead.findMany({ where: { hospitalName: { not: '' } }, select: { hospitalName: true }, distinct: ['hospitalName'] }),
      // Statuses
      prisma.pLRecord.findMany({ where: { status: { not: null } }, select: { status: true }, distinct: ['status'] }),
      prisma.dischargeSheet.findMany({ where: { status: { not: null } }, select: { status: true }, distinct: ['status'] }),
      prisma.lead.findMany({ select: { caseStage: true }, distinct: ['caseStage'] }),
      // Category
      prisma.pLRecord.findMany({ where: { category: { not: null } }, select: { category: true }, distinct: ['category'] }),
      prisma.dischargeSheet.findMany({ where: { category: { not: null } }, select: { category: true }, distinct: ['category'] }),
      prisma.lead.findMany({ where: { category: { not: null } }, select: { category: true }, distinct: ['category'] }),
      // Payment Type
      prisma.pLRecord.findMany({ where: { paymentType: { not: null } }, select: { paymentType: true }, distinct: ['paymentType'] }),
      prisma.dischargeSheet.findMany({ where: { paymentType: { not: null } }, select: { paymentType: true }, distinct: ['paymentType'] }),

      // Bounds: Hospital Share (hospitalTotalAmount)
      prisma.pLRecord.aggregate({ _min: { hospitalShareAmount: true }, _max: { hospitalShareAmount: true }, where: { hospitalShareAmount: { gt: 0 } } }),
      prisma.dischargeSheet.aggregate({ _min: { hospitalShareAmount: true }, _max: { hospitalShareAmount: true }, where: { hospitalShareAmount: { gt: 0 } } }),
      // Bounds: Hospital Pending (hospitalOutstandingAmount)
      prisma.pLRecord.aggregate({ _min: { hospitalAmountPending: true }, _max: { hospitalAmountPending: true }, where: { hospitalAmountPending: { gt: 0 } } }),
      // Bounds: Doctor Charges (doctorPayoutAmount)
      prisma.dischargeSheet.aggregate({ _min: { doctorCharges: true }, _max: { doctorCharges: true }, where: { doctorCharges: { gt: 0 } } }),
      // Bounds: Doctor Pending (doctorOutstandingAmount)
      prisma.pLRecord.aggregate({ _min: { doctorAmountPending: true }, _max: { doctorAmountPending: true }, where: { doctorAmountPending: { gt: 0 } } }),

      // Bounds: Total Bill (totalBill)
      prisma.pLRecord.aggregate({ _min: { billAmount: true }, _max: { billAmount: true }, where: { billAmount: { gt: 0 } } }),
      prisma.dischargeSheet.aggregate({ _min: { totalFinalBill: true }, _max: { totalFinalBill: true }, where: { totalFinalBill: { gt: 0 } } }),
      prisma.lead.aggregate({ _min: { billAmount: true }, _max: { billAmount: true }, where: { billAmount: { gt: 0 } } }),
      // Bounds: Approved Amount (approvedAmount)
      prisma.pLRecord.aggregate({ _min: { totalAmount: true }, _max: { totalAmount: true }, where: { totalAmount: { gt: 0 } } }),
      prisma.dischargeSheet.aggregate({ _min: { finalApprovedAmount: true }, _max: { finalApprovedAmount: true }, where: { finalApprovedAmount: { gt: 0 } } }),
      prisma.lead.aggregate({ _min: { settledTotal: true }, _max: { settledTotal: true }, where: { settledTotal: { gt: 0 } } }),
      // Bounds: Total Deduction (deductionTotal)
      prisma.dischargeSheet.aggregate({ _min: { deductionAmount: true }, _max: { deductionAmount: true }, where: { deductionAmount: { gt: 0 } } }),
      prisma.lead.aggregate({ _min: { deduction: true }, _max: { deduction: true }, where: { deduction: { gt: 0 } } }),
      // Bounds: Deduction Paid (deductionPaid)
      prisma.pLRecord.aggregate({ _min: { cashOrDedPaid: true }, _max: { cashOrDedPaid: true }, where: { cashOrDedPaid: { gt: 0 } } }),
      prisma.dischargeSheet.aggregate({ _min: { cashOrDedPaid: true }, _max: { cashOrDedPaid: true }, where: { cashOrDedPaid: { gt: 0 } } }),
      prisma.lead.aggregate({ _min: { copay: true }, _max: { copay: true }, where: { copay: { gt: 0 } } }),
      // Bounds: Waived Off (waivedOff)
      prisma.dischargeSheet.aggregate({ _min: { waivedOffAmount: true }, _max: { waivedOffAmount: true }, where: { waivedOffAmount: { gt: 0 } } }),
      // Bounds: Net Profit (netProfit)
      prisma.pLRecord.aggregate({ _min: { finalProfit: true }, _max: { finalProfit: true } }),
      prisma.lead.aggregate({ _min: { netProfit: true }, _max: { netProfit: true } }),
    ])

    // Merge options
    const bdmOptions = bdUsers.map(u => ({ label: u.name, value: u.name }))
    const managerOptions = toOptions([
      ...plManagers.map(m => m.managerName),
      ...dsManagers.map(m => m.managerName),
    ])
    const doctorOptions = toOptions([
      ...plDoctors.map(d => d.doctorName),
      ...dsDoctors.map(d => d.doctorName),
    ])
    const hospitalOptions = toOptions([
      ...plHospitals.map(h => h.hospitalName),
      ...dsHospitals.map(h => h.hospitalName),
      ...leadHospitals.map(h => h.hospitalName),
    ])
    const statusOptions = toOptions([
      ...plStatuses.map(s => s.status),
      ...dsStatuses.map(s => s.status),
      ...leadStages.map(s => s.caseStage),
    ])
    const categoryOptions = toOptions([
      ...plCategories.map(c => c.category),
      ...dsCategories.map(c => c.category),
      ...leadCategories.map(c => c.category),
    ])

    const knownPaymentTypes = ['Cash', 'Cashless', 'CASH', 'INSURANCE', 'TPA']
    const dbPaymentTypes = [
      ...plPaymentTypes.map(p => p.paymentType),
      ...dsPaymentTypes.map(p => p.paymentType),
    ]
    const paymentTypeOptions = toOptions([...knownPaymentTypes, ...dbPaymentTypes])

    // Helper to extract clean min bounds
    const getMin = (...nums: Array<number | null | undefined>) => {
      const valid = nums.filter((n): n is number => n != null && n > 0)
      return valid.length > 0 ? Math.min(...valid) : 0
    }
    // Helper to extract clean max bounds
    const getMax = (...nums: Array<number | null | undefined>) => {
      const valid = nums.filter((n): n is number => n != null && n > 0)
      return valid.length > 0 ? Math.max(...valid) : 0
    }

    // Hospital Total Share min/max bounds
    const minHospTotal = getMin(plHospShareBounds._min.hospitalShareAmount, dsHospShareBounds._min.hospitalShareAmount)
    const maxHospTotal = getMax(plHospShareBounds._max.hospitalShareAmount, dsHospShareBounds._max.hospitalShareAmount)

    // Total Bill min/max bounds
    const minTotalBill = getMin(plBillBounds._min.billAmount, dsBillBounds._min.totalFinalBill, leadBillBounds._min.billAmount)
    const maxTotalBill = getMax(plBillBounds._max.billAmount, dsBillBounds._max.totalFinalBill, leadBillBounds._max.billAmount)

    // Approved Amount min/max bounds
    const minApproved = getMin(plApprovedBounds._min.totalAmount, dsApprovedBounds._min.finalApprovedAmount, leadApprovedBounds._min.settledTotal)
    const maxApproved = getMax(plApprovedBounds._max.totalAmount, dsApprovedBounds._max.finalApprovedAmount, leadApprovedBounds._max.settledTotal)

    // Total Deduction min/max bounds
    const minDeduction = getMin(dsDeductionBounds._min.deductionAmount, leadDeductionBounds._min.deduction)
    const maxDeduction = getMax(dsDeductionBounds._max.deductionAmount, leadDeductionBounds._max.deduction)

    // Deduction Paid min/max bounds
    const minDedPaid = getMin(plDedPaidBounds._min.cashOrDedPaid, dsDedPaidBounds._min.cashOrDedPaid, leadDedPaidBounds._min.copay)
    const maxDedPaid = getMax(plDedPaidBounds._max.cashOrDedPaid, dsDedPaidBounds._max.cashOrDedPaid, leadDedPaidBounds._max.copay)

    // Net Profit min/max bounds (can be negative)
    const minNetProfit = Math.min(plNetProfitBounds._min.finalProfit ?? 0, leadNetProfitBounds._min.netProfit ?? 0)
    const maxNetProfit = Math.max(plNetProfitBounds._max.finalProfit ?? 0, leadNetProfitBounds._max.netProfit ?? 0)

    return successResponse({
      filters: [
        // Dropdowns / multiSelect
        { field: 'manager', label: 'Manager', filterType: 'multiSelect', filterable: true, options: managerOptions },
        { field: 'bdm', label: 'BDM', filterType: 'multiSelect', filterable: true, options: bdmOptions },
        { field: 'doctor', label: 'Doctor', filterType: 'multiSelect', filterable: true, options: doctorOptions },
        { field: 'hospital', label: 'Hospital', filterType: 'multiSelect', filterable: true, options: hospitalOptions },
        { field: 'status', label: 'Status', filterType: 'multiSelect', filterable: true, options: statusOptions },
        { field: 'category', label: 'Category', filterType: 'multiSelect', filterable: true, options: categoryOptions },
        { field: 'paymentType', label: 'Payment Type', filterType: 'multiSelect', filterable: true, options: paymentTypeOptions },
        {
          field: 'mediendPayout',
          label: 'MediEND Payout',
          filterType: 'multiSelect',
          filterable: true,
          options: [
            { label: 'Pending', value: 'PENDING' },
            { label: 'Partial', value: 'PARTIAL' },
            { label: 'Paid', value: 'PAID' },
          ],
        },
        {
          field: 'doctorPayout',
          label: 'Doctor Payout',
          filterType: 'multiSelect',
          filterable: true,
          options: [
            { label: 'Pending', value: 'PENDING' },
            { label: 'Partial', value: 'PARTIAL' },
            { label: 'Paid', value: 'PAID' },
          ],
        },
        {
          field: 'invoiceStatus',
          label: 'Invoice Status',
          filterType: 'multiSelect',
          filterable: true,
          options: [
            { label: 'Pending', value: 'PENDING' },
            { label: 'Sent', value: 'SENT' },
            { label: 'Paid', value: 'PAID' },
          ],
        },
        {
          field: 'paymentReceived',
          label: 'Payment Received',
          filterType: 'boolean',
          filterable: true,
        },

        // Searches
        { field: 'leadRef', label: 'Lead Ref', filterType: 'search', filterable: true },
        { field: 'patient', label: 'Patient Name', filterType: 'search', filterable: true },
        { field: 'treatment', label: 'Treatment', filterType: 'search', filterable: true },

        // Dates
        { field: 'leadReceived', label: 'Lead Received Date', filterType: 'dateRange', filterable: true },
        { field: 'admissionDate', label: 'Admission Date', filterType: 'dateRange', filterable: true },
        { field: 'surgeryDate', label: 'Surgery Date', filterType: 'dateRange', filterable: true },

        // Number Ranges
        { field: 'hospitalTotalAmount', label: 'Hospital Total Amount', filterType: 'numberRange', filterable: true, min: minHospTotal, max: maxHospTotal },
        {
          field: 'hospitalOutstandingAmount',
          label: 'Hospital Outstanding Amount',
          filterType: 'numberRange',
          filterable: true,
          min: plHospPendingBounds._min.hospitalAmountPending ?? 0,
          max: plHospPendingBounds._max.hospitalAmountPending ?? 0,
        },
        {
          field: 'doctorPayoutAmount',
          label: 'Doctor Payout Amount',
          filterType: 'numberRange',
          filterable: true,
          min: dsDocChargesBounds._min.doctorCharges ?? 0,
          max: dsDocChargesBounds._max.doctorCharges ?? 0,
        },
        {
          field: 'doctorOutstandingAmount',
          label: 'Doctor Outstanding Amount',
          filterType: 'numberRange',
          filterable: true,
          min: plDocPendingBounds._min.doctorAmountPending ?? 0,
          max: plDocPendingBounds._max.doctorAmountPending ?? 0,
        },
        { field: 'totalBill', label: 'Total Bill', filterType: 'numberRange', filterable: true, min: minTotalBill, max: maxTotalBill },
        { field: 'approvedAmount', label: 'Approved Amount', filterType: 'numberRange', filterable: true, min: minApproved, max: maxApproved },
        { field: 'deductionTotal', label: 'Total Deduction', filterType: 'numberRange', filterable: true, min: minDeduction, max: maxDeduction },
        { field: 'deductionPaid', label: 'Deduction Paid', filterType: 'numberRange', filterable: true, min: minDedPaid, max: maxDedPaid },
        { field: 'waivedOff', label: 'Waived Off', filterType: 'numberRange', filterable: true, min: dsWaivedBounds._min.waivedOffAmount ?? 0, max: dsWaivedBounds._max.waivedOffAmount ?? 0 },
        { field: 'netProfit', label: 'Net Profit', filterType: 'numberRange', filterable: true, min: minNetProfit, max: maxNetProfit },
      ]
    })
  } catch (error) {
    console.error('[outstanding filter-config] Error:', error)
    return errorResponse('Failed to fetch outstanding filter config', 500)
  }
}
