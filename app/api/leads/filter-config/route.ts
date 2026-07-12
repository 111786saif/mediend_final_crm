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

    if (!hasPermission(user, 'leads:read')) {
      return errorResponse('Forbidden', 403)
    }

    // ─── Run all queries in parallel ─────────────────────────────────────
    const [
      // BDM: always use User table with role=BD for complete, authoritative list
      bdUsers,
      // Lead refs (for KYP case tracker column filter)
      leadRefs,
      plHospitals, dsHospitals, leadHospitals,
      plDoctors, dsDoctors,
      plManagers, dsManagers,
      plCategories, dsCategories, leadCategories,
      plCircles, dsCircles, leadCircles,
      plPaymentTypes, dsPaymentTypes,
      billAmountBounds,
      totalAmountBounds,
      hospitalShareBounds,
      netProfitBounds,
      // doctor charges live on DischargeSheet, not PLRecord
      dsDocChargesBounds,
      // Treatment
      plTreatments, dsTreatments, leadTreatments,
    ] = await Promise.all([
      // BDM names — from User table (role = BD), always authoritative
      prisma.user.findMany({
        where: { role: UserRole.BD },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),

      // Lead refs — distinct values from Lead table (used by KYP case tracker)
      prisma.lead.findMany({
        select: { leadRef: true },
        distinct: ['leadRef'],
        orderBy: { leadRef: 'asc' },
      }),

      // Hospital names
      prisma.pLRecord.findMany({ where: { hospitalName: { not: null } }, select: { hospitalName: true }, distinct: ['hospitalName'] }),
      prisma.dischargeSheet.findMany({ where: { hospitalName: { not: null } }, select: { hospitalName: true }, distinct: ['hospitalName'] }),
      prisma.lead.findMany({ where: { hospitalName: { not: '' } }, select: { hospitalName: true }, distinct: ['hospitalName'] }),

      // Doctor names
      prisma.pLRecord.findMany({ where: { doctorName: { not: null } }, select: { doctorName: true }, distinct: ['doctorName'] }),
      prisma.dischargeSheet.findMany({ where: { doctorName: { not: null } }, select: { doctorName: true }, distinct: ['doctorName'] }),

      // Manager names
      prisma.pLRecord.findMany({ where: { managerName: { not: null } }, select: { managerName: true }, distinct: ['managerName'] }),
      prisma.dischargeSheet.findMany({ where: { managerName: { not: null } }, select: { managerName: true }, distinct: ['managerName'] }),

      // Category
      prisma.pLRecord.findMany({ where: { category: { not: null } }, select: { category: true }, distinct: ['category'] }),
      prisma.dischargeSheet.findMany({ where: { category: { not: null } }, select: { category: true }, distinct: ['category'] }),
      prisma.lead.findMany({ where: { category: { not: null } }, select: { category: true }, distinct: ['category'] }),

      // Circle
      prisma.pLRecord.findMany({ where: { circle: { not: null } }, select: { circle: true }, distinct: ['circle'] }),
      prisma.dischargeSheet.findMany({ where: { circle: { not: null } }, select: { circle: true }, distinct: ['circle'] }),
      prisma.lead.findMany({ where: { circle: { not: '' } }, select: { circle: true }, distinct: ['circle'] }),

      // Payment type
      prisma.pLRecord.findMany({ where: { paymentType: { not: null } }, select: { paymentType: true }, distinct: ['paymentType'] }),
      prisma.dischargeSheet.findMany({ where: { paymentType: { not: null } }, select: { paymentType: true }, distinct: ['paymentType'] }),

      // Numeric bounds — all on PLRecord (doctorCharges is only on DischargeSheet)
      prisma.pLRecord.aggregate({ _min: { billAmount: true }, _max: { billAmount: true }, where: { billAmount: { gt: 0 } } }),
      prisma.pLRecord.aggregate({ _min: { totalAmount: true }, _max: { totalAmount: true }, where: { totalAmount: { gt: 0 } } }),
      prisma.pLRecord.aggregate({ _min: { hospitalShareAmount: true }, _max: { hospitalShareAmount: true }, where: { hospitalShareAmount: { gt: 0 } } }),
      prisma.pLRecord.aggregate({ _min: { finalProfit: true }, _max: { finalProfit: true } }),
      // doctorCharges lives on DischargeSheet
      prisma.dischargeSheet.aggregate({ _min: { doctorCharges: true }, _max: { doctorCharges: true }, where: { doctorCharges: { gt: 0 } } }),

      // Treatment names
      prisma.pLRecord.findMany({ where: { treatment: { not: null } }, select: { treatment: true }, distinct: ['treatment'] }),
      prisma.dischargeSheet.findMany({ where: { treatment: { not: null } }, select: { treatment: true }, distinct: ['treatment'] }),
      prisma.lead.findMany({ where: { treatment: { not: '' } }, select: { treatment: true }, distinct: ['treatment'] }),
    ])

    // ─── Merge sets ───────────────────────────────────────────────────────
    // BDM: use User.name from the user table (authoritative)
    const bdmOptions = bdUsers.map(u => ({ label: u.name, value: u.name }))

    const hospitalOptions = toOptions([
      ...plHospitals.map(h => h.hospitalName),
      ...dsHospitals.map(h => h.hospitalName),
      ...leadHospitals.map(h => h.hospitalName),
    ])
    const doctorOptions = toOptions([
      ...plDoctors.map(d => d.doctorName),
      ...dsDoctors.map(d => d.doctorName),
    ])
    const managerOptions = toOptions([
      ...plManagers.map(m => m.managerName),
      ...dsManagers.map(m => m.managerName),
    ])
    const categoryOptions = toOptions([
      ...plCategories.map(c => c.category),
      ...dsCategories.map(c => c.category),
      ...leadCategories.map(c => c.category),
    ])
    const circleOptions = toOptions([
      ...plCircles.map(c => c.circle),
      ...dsCircles.map(c => c.circle),
      ...leadCircles.map(c => c.circle),
    ]).filter(o => o.value !== 'Unknown')

    const treatmentOptions = toOptions([
      ...plTreatments.map(t => t.treatment),
      ...dsTreatments.map(t => t.treatment),
      ...leadTreatments.map(t => t.treatment),
    ])

    // Payment Type: merge hardcoded known values with any additional DB values
    // so CASH / Cashless are always shown even if no data exists yet
    const knownPaymentTypes = ['Cash', 'Cashless', 'CASH', 'INSURANCE', 'TPA']
    const dbPaymentTypes = [
      ...plPaymentTypes.map(p => p.paymentType),
      ...dsPaymentTypes.map(p => p.paymentType),
    ]
    const paymentTypeOptions = toOptions([...knownPaymentTypes, ...dbPaymentTypes])

    // Lead ref options (string values of leadRef)
    const leadRefOptions = toOptions(leadRefs.map(r => r.leadRef != null ? String(r.leadRef) : null))

    return successResponse({
      filters: [
        // ── multiSelect ──────────────────────────────────────────────────
        { field: 'leadRef', label: 'Lead Ref', filterType: 'multiSelect', filterable: true, options: leadRefOptions },
        { field: 'bdm', label: 'BDM', filterType: 'multiSelect', filterable: true, options: bdmOptions },
        { field: 'hospital', label: 'Hospital', filterType: 'multiSelect', filterable: true, options: hospitalOptions },
        { field: 'doctor', label: 'Doctor', filterType: 'multiSelect', filterable: true, options: doctorOptions },
        { field: 'manager', label: 'Manager', filterType: 'multiSelect', filterable: true, options: managerOptions },
        { field: 'category', label: 'Category', filterType: 'multiSelect', filterable: true, options: categoryOptions },
        { field: 'circle', label: 'Circle', filterType: 'multiSelect', filterable: true, options: circleOptions },
        { field: 'treatment', label: 'Treatment', filterType: 'multiSelect', filterable: true, options: treatmentOptions },
        { field: 'paymentType', label: 'Payment Type', filterType: 'multiSelect', filterable: true, options: paymentTypeOptions },
        {
          field: 'outstandingStatus', label: 'PL Status', filterType: 'multiSelect', filterable: true,
          options: [
            { label: 'New', value: 'NEW' },
            { label: 'Draft', value: 'DRAFT' },
            { label: 'Outstanding', value: 'OUTSTANDING' },
          ],
        },
        {
          field: 'hospPayout', label: 'MediEND Payout', filterType: 'multiSelect', filterable: true,
          options: [
            { label: 'Pending', value: 'PENDING' },
            { label: 'Partial', value: 'PARTIAL' },
            { label: 'Paid', value: 'PAID' },
          ],
        },
        {
          field: 'docPayout', label: 'Doctor Payout', filterType: 'multiSelect', filterable: true,
          options: [
            { label: 'Pending', value: 'PENDING' },
            { label: 'Partial', value: 'PARTIAL' },
            { label: 'Paid', value: 'PAID' },
          ],
        },
        {
          field: 'invoice', label: 'Invoice Status', filterType: 'multiSelect', filterable: true,
          options: [
            { label: 'Pending', value: 'PENDING' },
            { label: 'Sent', value: 'SENT' },
            { label: 'Paid', value: 'PAID' },
          ],
        },

        // ── search ───────────────────────────────────────────────────────
        { field: 'treatment', label: 'Treatment', filterType: 'search', filterable: true },
        { field: 'patient', label: 'Patient Name', filterType: 'search', filterable: true },

        // ── dateRange ────────────────────────────────────────────────────
        { field: 'date', label: 'Lead Date', filterType: 'dateRange', filterable: true },
        { field: 'admissionDate', label: 'Admission Date', filterType: 'dateRange', filterable: true },
        { field: 'surgeryDate', label: 'Surgery Date', filterType: 'dateRange', filterable: true },

        // ── numberRange ──────────────────────────────────────────────────
        {
          field: 'totalBill', label: 'Total Bill', filterType: 'numberRange', filterable: true,
          min: billAmountBounds._min.billAmount ?? 0,
          max: billAmountBounds._max.billAmount ?? 0,
        },
        {
          field: 'approvedAmount', label: 'Approved Amount', filterType: 'numberRange', filterable: true,
          min: totalAmountBounds._min.totalAmount ?? 0,
          max: totalAmountBounds._max.totalAmount ?? 0,
        },
        {
          field: 'hospitalShareAmt', label: 'MediEND Share', filterType: 'numberRange', filterable: true,
          min: hospitalShareBounds._min.hospitalShareAmount ?? 0,
          max: hospitalShareBounds._max.hospitalShareAmount ?? 0,
        },
        {
          field: 'doctorCharges', label: 'Doctor Fee', filterType: 'numberRange', filterable: true,
          min: dsDocChargesBounds._min.doctorCharges ?? 0,
          max: dsDocChargesBounds._max.doctorCharges ?? 0,
        },
        {
          field: 'netProfit', label: 'Net Profit', filterType: 'numberRange', filterable: true,
          min: netProfitBounds._min.finalProfit ?? 0,
          max: netProfitBounds._max.finalProfit ?? 0,
        },
      ],
    })
  } catch (error) {
    console.error('[filter-config] Error:', error)
    return errorResponse('Failed to fetch filter config', 500)
  }
}
