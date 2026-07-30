import { z } from 'zod'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { registerTool } from '@/lib/ai/registry'
import { calculateActual } from '@/lib/analytics/target-progress'
import { canonicalSalesCompletedWhere } from '@/lib/analytics/ipd-filters'
import { getComputedBalancesForEmployee } from '@/lib/hrms/leave-policy-calculator'
import { getAttendanceHeatmapPayloadForEmployee } from '@/lib/hrms/get-attendance-heatmap-payload'
import {
  groupAttendanceByDate,
  getDepartmentTiming,
} from '@/lib/hrms/attendance-utils'
import {
  currentMonthYYYYMM,
  monthToRange,
  parseYmdRange,
  progressStatus,
} from '@/lib/ai/date-utils'
import type { AiActor } from '@/lib/ai/actor'

function requireEmployee(actor: AiActor) {
  if (!actor.employeeId) {
    return {
      error: 'NOT_FOUND' as const,
      message: 'No employee record linked to your account.',
    }
  }
  return null
}

registerTool({
  name: 'getMyTargetProgress',
  description:
    "Get the current user's sales target(s) for a month, including target value, actual achievement, percentage, and status. Use when the user asks about their target or how much they have completed.",
  scope: 'SELF',
  requiresEmployee: true,
  requiresAnyPermission: ['targets:read'],
  inputSchema: z.object({
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional()
      .describe('Month as YYYY-MM. Defaults to current month.'),
  }),
  execute: async ({ month }, actor) => {
    const err = requireEmployee(actor)
    if (err) return err
    if (!actor.permissions.has('targets:read') && !actor.isGlobal) {
      return { error: 'OUT_OF_SCOPE', message: 'You do not have targets:read permission.' }
    }

    const m = month || currentMonthYYYYMM()
    const { start, end } = monthToRange(m)

    const targets = await prisma.target.findMany({
      where: {
        targetType: 'BD',
        targetForId: actor.user.id,
        periodStartDate: { lte: end },
        periodEndDate: { gte: start },
      },
      include: { bonusRules: true },
      orderBy: { periodStartDate: 'desc' },
    })

    const results = await Promise.all(
      targets.map(async (t) => {
        const actual = await calculateActual(actor.user.id, t.metric, start, end)
        const percentage =
          t.targetValue > 0 ? Math.round((actual / t.targetValue) * 1000) / 10 : 0
        return {
          id: t.id,
          metric: t.metric,
          targetValue: t.targetValue,
          actual,
          percentage,
          status: progressStatus(percentage),
          periodStartDate: t.periodStartDate.toISOString().slice(0, 10),
          periodEndDate: t.periodEndDate.toISOString().slice(0, 10),
          bonusRules: t.bonusRules,
        }
      })
    )

    return { month: m, targets: results }
  },
})

registerTool({
  name: 'getMyTargetTrend',
  description:
    "Get the current user's target vs actual trend over recent months or weeks.",
  scope: 'SELF',
  requiresEmployee: true,
  requiresAnyPermission: ['targets:read'],
  inputSchema: z.object({
    periodType: z.enum(['MONTH', 'WEEK']).default('MONTH'),
    count: z.number().int().min(1).max(12).default(6),
    metric: z.string().optional().describe('Override metric, e.g. IPD_DONE'),
  }),
  execute: async ({ periodType, count, metric }, actor) => {
    const err = requireEmployee(actor)
    if (err) return err

    const now = new Date()
    const points: Array<{
      label: string
      actual: number
      targetValue: number | null
      percentage: number | null
      hasTarget: boolean
    }> = []

    for (let i = count - 1; i >= 0; i--) {
      let start: Date
      let end: Date
      let label: string

      if (periodType === 'MONTH') {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        start = new Date(d.getFullYear(), d.getMonth(), 1)
        end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
        label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      } else {
        const day = new Date(now)
        day.setDate(day.getDate() - i * 7)
        const dayOfWeek = day.getDay()
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
        start = new Date(day)
        start.setDate(day.getDate() + mondayOffset)
        start.setHours(0, 0, 0, 0)
        end = new Date(start)
        end.setDate(start.getDate() + 6)
        end.setHours(23, 59, 59, 999)
        label = start.toISOString().slice(0, 10)
      }

      const target = await prisma.target.findFirst({
        where: {
          targetType: 'BD',
          targetForId: actor.user.id,
          periodType,
          periodStartDate: { lte: end },
          periodEndDate: { gte: start },
          ...(metric ? { metric: metric as never } : {}),
        },
        orderBy: { periodStartDate: 'desc' },
      })

      const useMetric = metric || target?.metric || 'IPD_DONE'
      const actual = await calculateActual(actor.user.id, useMetric, start, end)
      const targetValue = target?.targetValue ?? null
      const percentage =
        targetValue && targetValue > 0
          ? Math.round((actual / targetValue) * 1000) / 10
          : null

      points.push({
        label,
        actual,
        targetValue,
        percentage,
        hasTarget: Boolean(target),
      })
    }

    return { periodType, metric: metric || 'IPD_DONE', points }
  },
})

registerTool({
  name: 'getMyIpdCount',
  description:
    "Count how many IPDs / surgeries the current user has completed in a date range.",
  scope: 'SELF',
  requiresEmployee: true,
  inputSchema: z.object({
    from: z.string().optional().describe('Start date YYYY-MM-DD'),
    to: z.string().optional().describe('End date YYYY-MM-DD'),
  }),
  execute: async ({ from, to }, actor) => {
    const range = parseYmdRange(from, to)
    const dateFilter: Prisma.DateTimeFilter = { gte: range.start, lte: range.end }
    const count = await prisma.lead.count({
      where: {
        bdId: actor.user.id,
        ...canonicalSalesCompletedWhere(dateFilter),
      },
    })
    return { from: range.from, to: range.to, ipdDone: count }
  },
})

registerTool({
  name: 'getMyLeaveBalance',
  description:
    "Get the current user's leave balances (CL, SL, EL) — allocated, used, remaining.",
  scope: 'SELF',
  requiresEmployee: true,
  inputSchema: z.object({}),
  execute: async (_input, actor) => {
    const err = requireEmployee(actor)
    if (err) return err
    const balances = await getComputedBalancesForEmployee(actor.employeeId!)
    return { balances }
  },
})

registerTool({
  name: 'getMyLeaveHistory',
  description: "List the current user's leave requests, optionally filtered by status.",
  scope: 'SELF',
  requiresEmployee: true,
  inputSchema: z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  }),
  execute: async ({ status }, actor) => {
    const err = requireEmployee(actor)
    if (err) return err
    const requests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: actor.employeeId!,
        ...(status ? { status } : {}),
      },
      include: {
        leaveType: { select: { name: true, code: true } },
      },
      orderBy: { startDate: 'desc' },
      take: 50,
    })
    return {
      requests: requests.map((r) => ({
        id: r.id,
        leaveType: r.leaveType.name,
        startDate: r.startDate.toISOString().slice(0, 10),
        endDate: r.endDate.toISOString().slice(0, 10),
        days: r.days,
        status: r.status,
        reason: r.reason,
        isUnpaid: r.isUnpaid,
      })),
    }
  },
})

registerTool({
  name: 'getMyAttendance',
  description:
    "Get the current user's attendance heatmap (daily punches, leaves, holidays) for a date range.",
  scope: 'SELF',
  requiresEmployee: true,
  inputSchema: z.object({
    from: z.string().optional().describe('Start date YYYY-MM-DD'),
    to: z.string().optional().describe('End date YYYY-MM-DD'),
  }),
  execute: async ({ from, to }, actor) => {
    const err = requireEmployee(actor)
    if (err) return err
    const range = parseYmdRange(from, to)
    const payload = await getAttendanceHeatmapPayloadForEmployee(
      actor.employeeId!,
      range.from,
      range.to
    )
    return payload ?? { error: 'NOT_FOUND', message: 'Attendance data not found.' }
  },
})

registerTool({
  name: 'getMyAttendanceStats',
  description:
    "Get the current user's attendance stats for a period: late, grace, half-day, absent, penalty counts.",
  scope: 'SELF',
  requiresEmployee: true,
  inputSchema: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  execute: async ({ from, to }, actor) => {
    const err = requireEmployee(actor)
    if (err) return err

    const employee = await prisma.employee.findUnique({
      where: { id: actor.employeeId! },
      include: { department: true },
    })
    if (!employee) return { error: 'NOT_FOUND', message: 'Employee not found.' }

    const range = parseYmdRange(from, to)
    const timing = getDepartmentTiming(employee.department)

    const [logs, normalizations] = await Promise.all([
      prisma.attendanceLog.findMany({
        where: {
          employeeId: employee.id,
          logDate: { gte: range.start, lte: range.end },
        },
        orderBy: { logDate: 'desc' },
      }),
      prisma.attendanceNormalization.findMany({
        where: {
          employeeId: employee.id,
          status: 'APPROVED',
          date: { gte: range.start, lte: range.end },
        },
        select: { date: true },
      }),
    ])

    const grouped = groupAttendanceByDate(logs, timing)
    const normDates = new Set(
      normalizations.map((n) => n.date.toISOString().split('T')[0])
    )

    let grace1Count = 0
    let grace2Count = 0
    let latePenaltyCount = 0
    let halfDayCount = 0
    let absentCount = 0
    let fullDayCount = 0

    for (const day of grouped) {
      const dateKey = day.date.toISOString().split('T')[0]
      if (normDates.has(dateKey)) {
        fullDayCount++
        continue
      }
      switch (day.status) {
        case 'on-time':
          fullDayCount++
          break
        case 'grace-1':
          grace1Count++
          break
        case 'grace-2':
          grace2Count++
          break
        case 'late-penalty':
          latePenaltyCount++
          break
        case 'half-day':
          halfDayCount++
          break
        case 'absent':
          absentCount++
          break
      }
    }

    return {
      from: range.from,
      to: range.to,
      grace1Count,
      grace2Count,
      latePenaltyCount,
      halfDayCount,
      absentCount,
      fullDayCount,
      daysWithPunches: grouped.length,
    }
  },
})

registerTool({
  name: 'getMyIncentive',
  description:
    "Get the current user's official monthly incentive record (amount and status).",
  scope: 'SELF',
  requiresEmployee: true,
  inputSchema: z.object({
    month: z.number().int().min(1).max(12).optional(),
    year: z.number().int().min(2020).max(2100).optional(),
  }),
  execute: async ({ month, year }, actor) => {
    const err = requireEmployee(actor)
    if (err) return err

    const now = new Date()
    const m = month ?? now.getMonth() + 1
    const y = year ?? now.getFullYear()

    const record = await prisma.employeeMonthlyIncentive.findFirst({
      where: {
        employeeId: actor.employeeId!,
        month: m,
        year: y,
      },
    })

    return { month: m, year: y, record: record ? { id: record.id, amount: record.amount, status: record.status, note: record.note } : null }
  },
})

registerTool({
  name: 'getMyLeads',
  description:
    "Query the current user's own leads/cases with optional filters. Always scoped to the current user — cannot query other BDs' leads.",
  scope: 'SELF',
  inputSchema: z.object({
    status: z.string().optional(),
    pipelineStage: z
      .enum(['SALES', 'INSURANCE', 'PL', 'COMPLETED', 'LOST'])
      .optional(),
    caseStage: z.string().optional(),
    circle: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    limit: z.number().max(50).default(20).optional(),
  }),
  execute: async (input, actor) => {
    const where: Prisma.LeadWhereInput = { bdId: actor.user.id }

    if (input.status) where.status = input.status
    if (input.pipelineStage) where.pipelineStage = input.pipelineStage
    if (input.caseStage) where.caseStage = input.caseStage as never
    if (input.circle) where.circle = input.circle
    if (input.startDate || input.endDate) {
      where.createdDate = {}
      if (input.startDate) where.createdDate.gte = new Date(input.startDate)
      if (input.endDate) where.createdDate.lte = new Date(input.endDate)
    }

    const leads = await prisma.lead.findMany({
      where,
      take: input.limit ?? 20,
      select: {
        id: true,
        leadRef: true,
        patientName: true,
        status: true,
        pipelineStage: true,
        caseStage: true,
        circle: true,
        hospitalName: true,
        treatment: true,
        billAmount: true,
        netProfit: true,
        conversionDate: true,
        createdDate: true,
        source: true,
      },
      orderBy: { createdDate: 'desc' },
    })

    return {
      count: leads.length,
      leads: leads.map((l) => ({
        ...l,
        conversionDate: l.conversionDate?.toISOString() ?? null,
        createdDate: l.createdDate.toISOString(),
      })),
    }
  },
})
