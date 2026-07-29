import { z } from 'zod'
import { UserRole, Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { registerTool } from '@/lib/ai/registry'
import { canonicalSalesCompletedWhere, buildDateRange } from '@/lib/analytics/ipd-filters'
import { headcountEmployeeWhere } from '@/lib/hrms/headcount'
import { parseYmdRange, defaultDateRange } from '@/lib/ai/date-utils'

const LEADERSHIP_ROLES: UserRole[] = [
  UserRole.MD,
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.SALES_HEAD,
  UserRole.EXECUTIVE_ASSISTANT,
]

const HR_KPI_ROLES: UserRole[] = [
  ...LEADERSHIP_ROLES,
  UserRole.HR_HEAD,
]

registerTool({
  name: 'getOrgSalesKpis',
  description:
    'Get organisation-wide sales KPIs: total IPD/surgeries, total revenue (bill amount), total profit, conversion rate. Leadership only.',
  scope: 'GLOBAL',
  allowedRoles: LEADERSHIP_ROLES,
  inputSchema: z.object({
    from: z.string().optional().describe('Start date YYYY-MM-DD'),
    to: z.string().optional().describe('End date YYYY-MM-DD'),
  }),
  execute: async ({ from, to }, actor) => {
    if (!actor.isGlobal && !LEADERSHIP_ROLES.includes(actor.user.role)) {
      return { error: 'OUT_OF_SCOPE', message: 'Organisation sales KPIs are restricted to leadership.' }
    }

    const defaults = defaultDateRange()
    const startDate = from || defaults.from
    const endDate = to || defaults.to
    const dateFilter = buildDateRange(startDate, endDate)
    const completedWhere = canonicalSalesCompletedWhere(dateFilter)

    const allLeadsWhere: Prisma.LeadWhereInput =
      Object.keys(dateFilter).length > 0
        ? {
            OR: [
              { leadEntryDate: dateFilter },
              { AND: [{ leadEntryDate: { equals: null } }, { createdDate: dateFilter }] },
            ],
          }
        : {}

    const [totalSurgeries, revenueAgg, profitAgg, totalLeads] = await Promise.all([
      prisma.lead.count({ where: completedWhere }),
      prisma.lead.aggregate({ where: completedWhere, _sum: { billAmount: true } }),
      prisma.lead.aggregate({ where: completedWhere, _sum: { netProfit: true } }),
      prisma.lead.count({ where: allLeadsWhere }),
    ])

    const totalRevenue = revenueAgg._sum.billAmount || 0
    const totalProfit = profitAgg._sum.netProfit || 0
    const conversionRate = totalLeads > 0 ? Math.round((totalSurgeries / totalLeads) * 1000) / 10 : 0

    return {
      from: startDate,
      to: endDate,
      kpis: {
        totalSurgeries,
        totalRevenue,
        totalProfit,
        totalLeads,
        conversionRate,
      },
    }
  },
})

registerTool({
  name: 'getOrgHrKpis',
  description:
    "Get organisation HR KPIs for today: headcount, presentToday, absentToday. Use for 'how many staff were present/absent today' at org level.",
  scope: 'GLOBAL',
  allowedRoles: HR_KPI_ROLES,
  inputSchema: z.object({}),
  execute: async (_input, actor) => {
    if (!HR_KPI_ROLES.includes(actor.user.role)) {
      return { error: 'OUT_OF_SCOPE', message: 'Organisation HR KPIs are restricted to leadership/HR.' }
    }

    const now = new Date()
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
    )
    const todayEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
    )

    const allEmployees = await prisma.employee.findMany({
      where: headcountEmployeeWhere,
      select: { id: true },
    })
    const totalHeadcount = allEmployees.length
    const employeeIds = allEmployees.map((e) => e.id)

    const todayPunchRows = await prisma.attendanceLog.findMany({
      where: {
        employeeId: { in: employeeIds },
        logDate: { gte: todayStart, lte: todayEnd },
        punchDirection: 'IN',
      },
      select: { employeeId: true },
      distinct: ['employeeId'],
    })

    const onLeaveToday = await prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'APPROVED',
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart },
      },
      select: { employeeId: true },
      distinct: ['employeeId'],
    })

    const presentIds = new Set(todayPunchRows.map((r) => r.employeeId))
    const leaveIds = new Set(onLeaveToday.map((r) => r.employeeId))
    const presentToday = presentIds.size
    const onLeave = leaveIds.size
    const absentToday = Math.max(0, totalHeadcount - presentToday - onLeave)

    return {
      totalHeadcount,
      presentToday,
      absentToday,
      onLeaveToday: onLeave,
    }
  },
})

registerTool({
  name: 'getOrgIpdLeaderboard',
  description:
    'Organisation-wide BD IPD leaderboard for a date range. Leadership only.',
  scope: 'GLOBAL',
  allowedRoles: LEADERSHIP_ROLES,
  inputSchema: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.number().int().min(1).max(50).default(20).optional(),
  }),
  execute: async ({ from, to, limit }, actor) => {
    if (!actor.isGlobal && !LEADERSHIP_ROLES.includes(actor.user.role)) {
      return { error: 'OUT_OF_SCOPE', message: 'Org leaderboard is restricted to leadership.' }
    }

    const range = parseYmdRange(from, to)
    const dateFilter: Prisma.DateTimeFilter = { gte: range.start, lte: range.end }

    const bds = await prisma.user.findMany({
      where: { role: UserRole.BD, employee: { isNot: null } },
      select: { id: true, name: true },
    })

    const rows = await Promise.all(
      bds.map(async (bd) => {
        const ipdDone = await prisma.lead.count({
          where: {
            bdId: bd.id,
            ...canonicalSalesCompletedWhere(dateFilter),
          },
        })
        return { bdId: bd.id, name: bd.name, ipdDone }
      })
    )

    rows.sort((a, b) => b.ipdDone - a.ipdDone)
    const top = rows.slice(0, limit ?? 20)

    return {
      from: range.from,
      to: range.to,
      leaderboard: top,
      top: top[0] ?? null,
    }
  },
})

registerTool({
  name: 'getIpdBreakdown',
  description:
    'Break down IPD done by dimension: circle, treatment, hospital, source, or campaign. Leadership / sales dashboard roles.',
  scope: 'GLOBAL',
  allowedRoles: [
    ...LEADERSHIP_ROLES,
    UserRole.CATEGORY_MANAGER,
    UserRole.DIGITAL_MARKETING_HEAD,
  ],
  inputSchema: z.object({
    dimension: z.enum(['circle', 'treatment', 'hospital', 'source', 'campaign']),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  execute: async ({ dimension, from, to }, actor) => {
    if (
      !actor.isGlobal &&
      ![
        ...LEADERSHIP_ROLES,
        UserRole.CATEGORY_MANAGER,
        UserRole.DIGITAL_MARKETING_HEAD,
      ].includes(actor.user.role)
    ) {
      return { error: 'OUT_OF_SCOPE', message: 'IPD breakdown is restricted.' }
    }

    const range = parseYmdRange(from, to)
    const dateFilter: Prisma.DateTimeFilter = { gte: range.start, lte: range.end }
    const where = canonicalSalesCompletedWhere(dateFilter)

    // For CM, clamp to their subtree BDs
    if (actor.user.role === UserRole.CATEGORY_MANAGER && actor.subordinateUserIds.length > 0) {
      Object.assign(where, {
        bdId: { in: [actor.user.id, ...actor.subordinateUserIds] },
      })
    }

    const fieldMap = {
      circle: 'circle',
      treatment: 'treatment',
      hospital: 'hospitalName',
      source: 'source',
      campaign: 'campaignName',
    } as const

    const field = fieldMap[dimension]
    const leads = await prisma.lead.findMany({
      where,
      select: {
        circle: true,
        treatment: true,
        hospitalName: true,
        source: true,
        campaignName: true,
        billAmount: true,
        netProfit: true,
      },
    })

    const buckets = new Map<
      string,
      { key: string; count: number; revenue: number; profit: number }
    >()

    for (const lead of leads) {
      const raw = lead[field as keyof typeof lead]
      const key = String(raw ?? 'Unknown') || 'Unknown'
      const b = buckets.get(key) ?? { key, count: 0, revenue: 0, profit: 0 }
      b.count++
      b.revenue += lead.billAmount || 0
      b.profit += lead.netProfit || 0
      buckets.set(key, b)
    }

    const breakdown = [...buckets.values()].sort((a, b) => b.count - a.count)

    return {
      dimension,
      from: range.from,
      to: range.to,
      breakdown,
    }
  },
})

registerTool({
  name: 'searchEmployeeDirectory',
  description:
    'Search the employee directory by name or employee code. Leadership / HR only. Returns basic identity fields, not sensitive HR data.',
  scope: 'GLOBAL',
  allowedRoles: [...HR_KPI_ROLES, UserRole.IT_HEAD],
  requiresAnyPermission: ['hrms:employees:read', 'users:read'],
  inputSchema: z.object({
    query: z.string().min(1).describe('Name or employee code to search'),
    limit: z.number().int().min(1).max(30).default(10).optional(),
  }),
  execute: async ({ query, limit }, actor) => {
    if (
      !HR_KPI_ROLES.includes(actor.user.role) &&
      actor.user.role !== UserRole.IT_HEAD &&
      !actor.permissions.has('hrms:employees:read')
    ) {
      return { error: 'OUT_OF_SCOPE', message: 'Employee directory search is restricted.' }
    }

    const employees = await prisma.employee.findMany({
      where: {
        OR: [
          { employeeCode: { contains: query, mode: 'insensitive' } },
          { user: { name: { contains: query, mode: 'insensitive' } } },
          { user: { email: { contains: query, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        employeeCode: true,
        department: { select: { name: true } },
        user: { select: { name: true, email: true, role: true } },
      },
      take: limit ?? 10,
    })

    return {
      results: employees.map((e) => ({
        name: e.user.name,
        email: e.user.email,
        role: e.user.role,
        employeeCode: e.employeeCode,
        department: e.department?.name ?? null,
      })),
    }
  },
})
