import { NextRequest } from 'next/server'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getSessionWithFreshUser } from '@/lib/session'
import { canAccessSalesDashboard, getSalesDashboardBdIdFilter } from '@/lib/analytics/sales-dashboard-access'
import { buildDateRange, isLeadConverted, normalizeCampaignName, normalizeCircleName, normalizeSourceName } from '@/lib/analytics/ipd-filters'

const money = (value: number | null | undefined) => Number((value ?? 0).toFixed(2))
const isOpdDone = (lead: { caseStage: string; status: string }) =>
  ['OPD_DONE', 'CASH_OPD_DONE'].includes(lead.caseStage) || ['11', 'OPD Done', 'OPD_DONE'].includes(lead.status)
const isClosed = (status: string) => ['25', 'Closed', 'Junk'].includes(status.trim())
const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate())

function percentage(numerator: number, denominator: number) {
  return denominator ? Number(((numerator / denominator) * 100).toFixed(1)) : 0
}

function addGroup(
  map: Map<string, { label: string; leads: number; opd: number; ipd: number; revenue: number; profit: number }>,
  label: string,
  values: { opd: boolean; ipd: boolean; revenue: number; profit: number },
) {
  const current = map.get(label) ?? { label, leads: 0, opd: 0, ipd: 0, revenue: 0, profit: 0 }
  current.leads += 1
  current.opd += values.opd ? 1 : 0
  current.ipd += values.ipd ? 1 : 0
  current.revenue += values.revenue
  current.profit += values.profit
  map.set(label, current)
}

function outputGroups(map: Map<string, { label: string; leads: number; opd: number; ipd: number; revenue: number; profit: number }>) {
  return Array.from(map.values())
    .map((row) => ({ ...row, revenue: money(row.revenue), profit: money(row.profit), conversionRate: percentage(row.ipd, row.leads) }))
    .sort((a, b) => b.leads - a.leads || a.label.localeCompare(b.label))
}

/** A single, permission-scoped dataset for the executive KPI dashboard. */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionWithFreshUser()
    if (!user) return unauthorizedResponse()

    const privilegedRoles = ['SUPER_ADMIN', 'CRM_ADMIN', 'PL_HEAD', 'FINANCE_HEAD']
    if (!(await canAccessSalesDashboard(user)) && !privilegedRoles.includes(user.role)) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const date = buildDateRange(searchParams.get('startDate'), searchParams.get('endDate'), searchParams.get('tz'))
    const city = searchParams.get('city')?.trim()
    const source = searchParams.get('source')?.trim()
    const category = searchParams.get('category')?.trim()
    const bdId = searchParams.get('bdId')?.trim()
    const allowedBdIds = await getSalesDashboardBdIdFilter(user)
    if (bdId && allowedBdIds && !allowedBdIds.includes(bdId)) return errorResponse('Forbidden', 403)

    const leadDateWhere: Prisma.LeadWhereInput = Object.keys(date).length
      ? { OR: [{ leadEntryDate: date }, { AND: [{ leadEntryDate: null }, { createdDate: date }] }] }
      : {}
    const leadWhere: Prisma.LeadWhereInput = {
      ...leadDateWhere,
      ...(bdId ? { bdId } : allowedBdIds ? { bdId: { in: allowedBdIds } } : {}),
      ...(city ? { circle: city } : {}),
      ...(source ? { source } : {}),
      ...(category ? { category } : {}),
    }
    const plWhere: Prisma.PLRecordWhereInput = {
      ...(Object.keys(date).length ? { OR: [{ surgeryDate: date }, { AND: [{ surgeryDate: null }, { admissionDate: date }] }, { AND: [{ surgeryDate: null }, { admissionDate: null }, { month: date }] }] } : {}),
      ...(city ? { circle: city } : {}),
      ...(source ? { leadSource: source } : {}),
      ...(category ? { category } : {}),
      ...(bdId ? { lead: { is: { bdId } } } : allowedBdIds ? { lead: { is: { bdId: { in: allowedBdIds } } } } : {}),
    }

    const [leads, plRecords, targets, outstanding, campaignSpend] = await Promise.all([
      prisma.lead.findMany({
        where: leadWhere,
        select: {
          id: true, leadEntryDate: true, createdDate: true, surgeryDate: true, status: true, caseStage: true, pipelineStage: true,
          circle: true, source: true, campaignName: true, category: true, hospitalName: true, bdId: true, billAmount: true, netProfit: true,
          bd: { select: { name: true, employee: { select: { team: { select: { name: true } } } } } },
          callNotes: { select: { createdAt: true }, orderBy: { createdAt: 'asc' }, take: 1 },
          opdAppointments: { select: { status: true } },
        },
      }),
      prisma.pLRecord.findMany({ where: plWhere, select: {
        id: true, leadId: true, leadRef: true, surgeryDate: true, admissionDate: true, month: true, status: true, paymentType: true,
        managerName: true, bdmName: true, patientName: true, hospitalName: true, category: true, treatment: true, circle: true, leadSource: true,
        totalAmount: true, billAmount: true, cashOrDedPaid: true, mediendShareAmount: true, mediendNetProfit: true, mediendProfit: true,
        hospitalAmountPending: true, doctorAmountPending: true, hospitalPayoutStatus: true, doctorPayoutStatus: true,
      } }),
      prisma.target.findMany({ where: { periodStartDate: { lte: (date.lte as Date | undefined) ?? new Date() }, periodEndDate: { gte: (date.gte as Date | undefined) ?? new Date(0) } }, select: { targetType: true, targetForId: true, metric: true, targetValue: true, periodStartDate: true, periodEndDate: true } }),
      prisma.outstandingCase.findMany({ select: { paymentReceived: true, overallAmount: true, billAmount: true, settlementAmount: true, cashPaidByPatient: true, hospitalName: true, status: true } }),
      prisma.dailyCampaignSpend.findMany({ where: Object.keys(date).length ? { date } : undefined, select: { campaignName: true, spend: true, date: true } }),
    ])

    const cityGroups = new Map<string, { label: string; leads: number; opd: number; ipd: number; revenue: number; profit: number }>()
    const sourceGroups = new Map<string, { label: string; leads: number; opd: number; ipd: number; revenue: number; profit: number }>()
    const bdGroups = new Map<string, { label: string; leads: number; opd: number; ipd: number; revenue: number; profit: number }>()
    const teamGroups = new Map<string, { label: string; leads: number; opd: number; ipd: number; revenue: number; profit: number }>()
    const categoryGroups = new Map<string, { label: string; leads: number; opd: number; ipd: number; revenue: number; profit: number }>()
    const hospitalGroups = new Map<string, { label: string; leads: number; opd: number; ipd: number; revenue: number; profit: number }>()
    const campaignGroups = new Map<string, { label: string; leads: number; opd: number; ipd: number; revenue: number; profit: number }>()
    const monthlyGroups = new Map<string, { label: string; leads: number; opd: number; ipd: number; revenue: number; profit: number }>()
    const sla = { within5: 0, within15: 0, late: 0, pending: 0 }
    let opdBooked = 0
    let opdDone = 0
    let ipd = 0
    let closed = 0

    for (const lead of leads) {
      const converted = isLeadConverted(lead)
      const opd = isOpdDone(lead) || lead.opdAppointments.some((item) => item.status === 'DONE')
      const booked = lead.opdAppointments.some((item) => ['SCHEDULED', 'DONE'].includes(item.status))
      const values = { opd, ipd: converted, revenue: lead.billAmount, profit: lead.netProfit }
      if (booked) opdBooked += 1
      if (opd) opdDone += 1
      if (converted) ipd += 1
      if (isClosed(lead.status)) closed += 1
      addGroup(cityGroups, normalizeCircleName(lead.circle), values)
      addGroup(sourceGroups, normalizeSourceName(lead.source), values)
      addGroup(bdGroups, lead.bd?.name || 'Unassigned', values)
      addGroup(teamGroups, lead.bd?.employee?.team?.name || 'Unassigned', values)
      addGroup(categoryGroups, lead.category?.trim() || 'Not specified', values)
      addGroup(hospitalGroups, lead.hospitalName?.trim() || 'Not specified', values)
      addGroup(campaignGroups, normalizeCampaignName(lead.campaignName), values)
      const received = lead.leadEntryDate ?? lead.createdDate
      const month = `${received.getFullYear()}-${String(received.getMonth() + 1).padStart(2, '0')}`
      addGroup(monthlyGroups, month, values)
      const firstCall = lead.callNotes[0]?.createdAt
      if (!firstCall) sla.pending += 1
      else {
        const minutes = Math.max(0, (firstCall.getTime() - received.getTime()) / 60000)
        if (minutes <= 5) sla.within5 += 1
        else if (minutes <= 15) sla.within15 += 1
        else sla.late += 1
      }
    }

    const pl = plRecords.reduce((sum, row) => ({
      totalAmount: sum.totalAmount + row.totalAmount,
      revenue: sum.revenue + (row.billAmount || row.totalAmount),
      share: sum.share + row.mediendShareAmount,
      netProfit: sum.netProfit + (row.mediendNetProfit || row.mediendProfit),
      pending: sum.pending + row.hospitalAmountPending + row.doctorAmountPending,
    }), { totalAmount: 0, revenue: 0, share: 0, netProfit: 0, pending: 0 })
    const spend = campaignSpend.reduce((sum, row) => sum + row.spend, 0)
    const outstandingTotal = outstanding.reduce((sum, row) => sum + Math.max(0, row.overallAmount || row.billAmount - row.settlementAmount - row.cashPaidByPatient), 0)
    const outstandingPending = outstanding.filter((row) => !row.paymentReceived).length
    const targetTotal = targets.filter((target) => ['IPD_DONE', 'SURGERIES_DONE'].includes(target.metric)).reduce((sum, target) => sum + target.targetValue, 0)
    const now = new Date()
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const daysElapsed = Math.max(1, Math.floor((startOfDay(now).getTime() - currentMonthStart.getTime()) / 86400000) + 1)
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const projected = targetTotal ? (ipd / daysElapsed) * daysInMonth : null

    const leadDateLabels = Array.from(new Set(leads.map((lead) => normalizeCircleName(lead.circle)))).sort()
    const sourceLabels = Array.from(new Set(leads.map((lead) => normalizeSourceName(lead.source)))).sort()
    const categoryLabels = Array.from(new Set(leads.map((lead) => lead.category).filter((value): value is string => Boolean(value)))).sort()
    const bdLabels = Array.from(new Map(leads.map((lead) => [lead.bdId, lead.bd?.name || 'Unassigned'])).entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))

    return successResponse({
      summary: {
        leads: leads.length, opdBooked, opdDone, ipd, closed, conversionRate: percentage(ipd, leads.length),
        revenue: money(pl.revenue), totalCaseValue: money(pl.totalAmount), mediendShare: money(pl.share), netProfit: money(pl.netProfit),
        netMargin: percentage(pl.netProfit, pl.revenue), averageRevenue: ipd ? money(pl.revenue / ipd) : 0, averageProfit: ipd ? money(pl.netProfit / ipd) : 0,
        marketingSpend: money(spend), cpl: leads.length ? money(spend / leads.length) : 0, costPerIpd: ipd ? money(spend / ipd) : 0,
        roas: spend ? Number((pl.revenue / spend).toFixed(2)) : null, marketingRoi: spend ? Number((((pl.netProfit - spend) / spend) * 100).toFixed(1)) : null,
        outstanding: money(outstandingTotal + pl.pending), outstandingCases: outstandingPending,
      },
      funnel: [
        { label: 'Leads', value: leads.length }, { label: 'OPD booked', value: opdBooked }, { label: 'OPD completed', value: opdDone }, { label: 'IPD done', value: ipd }, { label: 'Closed', value: closed },
      ],
      sla: { ...sla, called: sla.within5 + sla.within15 + sla.late, within15Rate: percentage(sla.within5 + sla.within15, leads.length) },
      targets: { assigned: money(targetTotal), achieved: ipd, remaining: Math.max(0, money(targetTotal - ipd)), achievement: percentage(ipd, targetTotal), daysElapsed, daysRemaining: Math.max(0, daysInMonth - daysElapsed), requiredRunRate: targetTotal > ipd ? Number(((targetTotal - ipd) / Math.max(1, daysInMonth - daysElapsed)).toFixed(2)) : 0, currentRunRate: Number((ipd / daysElapsed).toFixed(2)), projected: projected === null ? null : Number(projected.toFixed(1)) },
      groups: { city: outputGroups(cityGroups), source: outputGroups(sourceGroups), bd: outputGroups(bdGroups), team: outputGroups(teamGroups), category: outputGroups(categoryGroups), hospital: outputGroups(hospitalGroups), campaign: outputGroups(campaignGroups), monthly: outputGroups(monthlyGroups) },
      finance: { plRecords: plRecords.length, revenue: money(pl.revenue), netProfit: money(pl.netProfit), share: money(pl.share), outstanding: money(outstandingTotal + pl.pending), outstandingCases: outstandingPending },
      dataAvailability: { callDuration: false, cashBankBalance: false, refundAndDiscountLedger: false, dueDate: false },
      filters: { cities: leadDateLabels, sources: sourceLabels, categories: categoryLabels, bds: bdLabels },
    })
  } catch (error) {
    console.error('KPI dashboard error:', error)
    return errorResponse('Failed to load KPI dashboard', 500)
  }
}
