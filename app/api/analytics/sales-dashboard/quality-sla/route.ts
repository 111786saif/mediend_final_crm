import { NextRequest } from 'next/server'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getSessionWithFreshUser } from '@/lib/session'
import { buildDateRange, isLeadConverted, normalizeCircleName, normalizeSourceName } from '@/lib/analytics/ipd-filters'
import { canAccessSalesDashboard, getSalesDashboardBdIdFilter } from '@/lib/analytics/sales-dashboard-access'

type Metrics = { totalLeads: number; opd: number; ipd: number; closed: number }
type Row = Metrics & { key: string; label: string }

const empty = (): Metrics => ({ totalLeads: 0, opd: 0, ipd: 0, closed: 0 })
const isOpd = (lead: { caseStage: string; status: string }) =>
  lead.caseStage === 'OPD_DONE' || lead.caseStage === 'CASH_OPD_DONE' || ['11', 'OPD Done', 'OPD_DONE'].includes(lead.status)
const isClosed = (status: string) => ['25', 'Closed'].includes(status.trim())

function addMetric(map: Map<string, Row>, key: string, label: string, lead: { caseStage: string; pipelineStage: string; surgeryDate: Date | null; status: string }) {
  const row = map.get(key) ?? { key, label, ...empty() }
  row.totalLeads += 1
  if (isOpd(lead)) row.opd += 1
  if (isLeadConverted(lead)) row.ipd += 1
  if (isClosed(lead.status)) row.closed += 1
  map.set(key, row)
}

function output(map: Map<string, Row>) {
  return Array.from(map.values()).map((row) => ({
    ...row,
    conversionRate: row.totalLeads ? Number(((row.ipd / row.totalLeads) * 100).toFixed(1)) : 0,
  })).sort((a, b) => b.totalLeads - a.totalLeads || a.label.localeCompare(b.label))
}

/** Lead quality and first recorded call-note SLA.  A call is counted only once a CallNote exists. */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionWithFreshUser()
    if (!user) return unauthorizedResponse()
    if (!(await canAccessSalesDashboard(user))) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const dateFilter = buildDateRange(searchParams.get('startDate'), searchParams.get('endDate'), searchParams.get('tz'))
    const allowedBdIds = await getSalesDashboardBdIdFilter(user)
    const city = searchParams.get('city')?.trim()
    const source = searchParams.get('source')?.trim()
    const bdId = searchParams.get('bdId')?.trim()
    const teamId = searchParams.get('teamId')?.trim()

    let teamBdIds: string[] | undefined
    if (teamId) {
      const team = await prisma.departmentTeam.findUnique({ where: { id: teamId }, select: { members: { select: { userId: true } } } })
      teamBdIds = team?.members.map((member) => member.userId) ?? []
    }
    const scopedIds = [allowedBdIds, teamBdIds].filter((v): v is string[] => !!v)
    const bdScope = scopedIds.length ? scopedIds.reduce((result, ids) => result.filter((id) => ids.includes(id))) : undefined

    const leadDateWhere: Prisma.LeadWhereInput = Object.keys(dateFilter).length ? {
      OR: [{ leadEntryDate: dateFilter }, { AND: [{ leadEntryDate: null }, { createdDate: dateFilter }] }],
    } : {}
    if (bdId && bdScope && !bdScope.includes(bdId)) return errorResponse('Forbidden', 403)
    const where: Prisma.LeadWhereInput = {
      ...leadDateWhere,
      ...(bdId ? { bdId } : bdScope ? { bdId: { in: bdScope } } : {}),
      ...(city ? { circle: city } : {}),
      ...(source ? { source } : {}),
    }

    const leads = await prisma.lead.findMany({
      where,
      select: {
        id: true, bdId: true, bdeName: true, circle: true, source: true, status: true, caseStage: true, pipelineStage: true,
        surgeryDate: true, leadEntryDate: true, createdDate: true,
        bd: { select: { name: true, employee: { select: { team: { select: { id: true, name: true } } } } } },
        callNotes: { select: { createdAt: true }, orderBy: { createdAt: 'asc' }, take: 1 },
      },
    })

    const cities = new Map<string, Row>(), sources = new Map<string, Row>(), bds = new Map<string, Row>(), teams = new Map<string, Row>()
    const totals = empty()
    const sla = { within5Minutes: 0, within15Minutes: 0, late: 0, pending: 0 }
    for (const lead of leads) {
      const metricLead = lead as { caseStage: string; pipelineStage: string; surgeryDate: Date | null; status: string }
      totals.totalLeads += 1
      if (isOpd(metricLead)) totals.opd += 1
      if (isLeadConverted(metricLead)) totals.ipd += 1
      if (isClosed(metricLead.status)) totals.closed += 1
      const cityLabel = normalizeCircleName(lead.circle)
      const sourceLabel = normalizeSourceName(lead.source)
      const rawBdName = lead.bd?.name || lead.bdeName || 'Archived BD'
      const bdLabel = /^c[a-z0-9]{18,}$/i.test(rawBdName) ? (lead.bdeName || 'Archived BD') : rawBdName
      const team = lead.bd?.employee?.team
      addMetric(cities, cityLabel, cityLabel, metricLead)
      addMetric(sources, sourceLabel, sourceLabel, metricLead)
      addMetric(bds, lead.bdId, bdLabel, metricLead)
      addMetric(teams, team?.id || 'unassigned', team?.name || 'Unassigned', metricLead)

      const firstCall = lead.callNotes[0]?.createdAt
      if (!firstCall) { sla.pending += 1; continue }
      const receivedAt = lead.leadEntryDate ?? lead.createdDate
      const minutes = Math.max(0, (firstCall.getTime() - receivedAt.getTime()) / 60000)
      if (minutes <= 5) sla.within5Minutes += 1
      else if (minutes <= 15) sla.within15Minutes += 1
      else sla.late += 1
    }
    const called = sla.within5Minutes + sla.within15Minutes + sla.late
    return successResponse({
      totals: { ...totals, conversionRate: totals.totalLeads ? Number(((totals.ipd / totals.totalLeads) * 100).toFixed(1)) : 0 },
      filters: { cities: output(cities).map(({ key, label }) => ({ key, label })), sources: output(sources).map(({ key, label }) => ({ key, label })), bds: output(bds).map(({ key, label }) => ({ key, label })), teams: output(teams).map(({ key, label }) => ({ key, label })) },
      cityWise: output(cities), sourceWise: output(sources), bdWise: output(bds), teamWise: output(teams),
      sla: { ...sla, called, within15Rate: leads.length ? Number((((sla.within5Minutes + sla.within15Minutes) / leads.length) * 100).toFixed(1)) : 0 },
    })
  } catch (error) {
    console.error('Lead quality and SLA dashboard error:', error)
    return errorResponse('Failed to fetch lead quality dashboard', 500)
  }
}
