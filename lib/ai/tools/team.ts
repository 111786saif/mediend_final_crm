import { z } from 'zod'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { registerTool } from '@/lib/ai/registry'
import { resolveSubject } from '@/lib/ai/resolve-subject'
import { calculateActual } from '@/lib/analytics/target-progress'
import { canonicalSalesCompletedWhere } from '@/lib/analytics/ipd-filters'
import { getComputedBalancesForEmployee } from '@/lib/hrms/leave-policy-calculator'
import {
  groupAttendanceByDate,
  getDepartmentTiming,
} from '@/lib/hrms/attendance-utils'
import { headcountEmployeeWhere } from '@/lib/hrms/headcount'
import {
  currentMonthYYYYMM,
  monthToRange,
  parseYmdRange,
  progressStatus,
} from '@/lib/ai/date-utils'
import type { AiActor } from '@/lib/ai/actor'

registerTool({
  name: 'getTeamAttendanceSummary',
  description:
    "Summarise attendance for the caller's team (subordinates): present, absent, late, on-leave counts for a date or range. Use for 'how many of my staff were present/absent'.",
  scope: 'TEAM',
  requiresEmployee: true,
  inputSchema: z.object({
    from: z.string().optional().describe('Start date YYYY-MM-DD'),
    to: z.string().optional().describe('End date YYYY-MM-DD'),
  }),
  execute: async ({ from, to }, actor) => {
    if (actor.subordinateEmployeeIds.length === 0) {
      return { error: 'OUT_OF_SCOPE', message: 'You have no team members under you.' }
    }

    const range = parseYmdRange(from, to)
    const members = await prisma.employee.findMany({
      where: { id: { in: actor.subordinateEmployeeIds }, ...headcountEmployeeWhere },
      include: {
        user: { select: { name: true, email: true } },
        department: true,
      },
    })

    const [logs, leaves] = await Promise.all([
      prisma.attendanceLog.findMany({
        where: {
          employeeId: { in: actor.subordinateEmployeeIds },
          logDate: { gte: range.start, lte: range.end },
        },
      }),
      prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: actor.subordinateEmployeeIds },
          status: 'APPROVED',
          startDate: { lte: range.end },
          endDate: { gte: range.start },
        },
        select: { employeeId: true, startDate: true, endDate: true },
      }),
    ])

    const logsByEmp = new Map<string, typeof logs>()
    for (const log of logs) {
      const arr = logsByEmp.get(log.employeeId) ?? []
      arr.push(log)
      logsByEmp.set(log.employeeId, arr)
    }

    const onLeaveIds = new Set<string>()
    for (const leave of leaves) {
      onLeaveIds.add(leave.employeeId)
    }

    let present = 0
    let absent = 0
    let late = 0
    let onLeave = 0

    const memberRows = members.map((m) => {
      const timing = getDepartmentTiming(m.department)
      const empLogs = logsByEmp.get(m.id) ?? []
      const grouped = groupAttendanceByDate(empLogs, timing)
      const hasPunch = grouped.length > 0
      const isOnLeave = onLeaveIds.has(m.id)
      const isLate = grouped.some(
        (d) =>
          d.status === 'late-penalty' ||
          d.status === 'grace-1' ||
          d.status === 'grace-2'
      )

      let status: 'present' | 'absent' | 'late' | 'on_leave'
      if (isOnLeave && !hasPunch) {
        status = 'on_leave'
        onLeave++
      } else if (!hasPunch) {
        status = 'absent'
        absent++
      } else if (isLate) {
        status = 'late'
        late++
        present++
      } else {
        status = 'present'
        present++
      }

      return {
        name: m.user.name,
        employeeCode: m.employeeCode,
        status,
        punchDays: grouped.length,
      }
    })

    return {
      from: range.from,
      to: range.to,
      summary: { present, absent, late, onLeave, total: members.length },
      members: memberRows,
    }
  },
})

registerTool({
  name: 'getTeamLeaveBalances',
  description: "Get leave balances for all of the caller's team members.",
  scope: 'TEAM',
  requiresEmployee: true,
  inputSchema: z.object({}),
  execute: async (_input, actor) => {
    if (actor.subordinateEmployeeIds.length === 0) {
      return { error: 'OUT_OF_SCOPE', message: 'You have no team members under you.' }
    }

    const members = await prisma.employee.findMany({
      where: { id: { in: actor.subordinateEmployeeIds }, ...headcountEmployeeWhere },
      select: {
        id: true,
        employeeCode: true,
        user: { select: { name: true } },
      },
    })

    const balances = await Promise.all(
      members.map(async (m) => ({
        employeeId: m.id,
        name: m.user.name,
        employeeCode: m.employeeCode,
        balances: await getComputedBalancesForEmployee(m.id),
      }))
    )

    return { balances }
  },
})

registerTool({
  name: 'getTeamLeaveRequests',
  description: "List leave requests for the caller's team, optionally filtered by status.",
  scope: 'TEAM',
  requiresEmployee: true,
  inputSchema: z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  }),
  execute: async ({ status }, actor) => {
    if (actor.subordinateEmployeeIds.length === 0) {
      return { error: 'OUT_OF_SCOPE', message: 'You have no team members under you.' }
    }

    const requests = await prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: actor.subordinateEmployeeIds },
        ...(status ? { status } : {}),
      },
      include: {
        leaveType: { select: { name: true, code: true } },
        employee: { select: { user: { select: { name: true } }, employeeCode: true } },
      },
      orderBy: { startDate: 'desc' },
      take: 100,
    })

    return {
      requests: requests.map((r) => ({
        id: r.id,
        name: r.employee.user.name,
        employeeCode: r.employee.employeeCode,
        leaveType: r.leaveType.name,
        startDate: r.startDate.toISOString().slice(0, 10),
        endDate: r.endDate.toISOString().slice(0, 10),
        days: r.days,
        status: r.status,
        reason: r.reason,
      })),
    }
  },
})

registerTool({
  name: 'getTeamMemberSnapshot',
  description:
    "Get a snapshot for one team member by name: target progress, IPD count, leave balance, and recent attendance. Person must be a subordinate (or self). Never accepts employee IDs — only names.",
  scope: 'TEAM',
  requiresEmployee: true,
  inputSchema: z.object({
    personName: z.string().describe('Full or partial name of the team member'),
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional()
      .describe('Month YYYY-MM for target/IPD. Defaults to current month.'),
  }),
  execute: async ({ personName, month }, actor) => {
    const subject = await resolveSubject(actor, personName)
    if (!subject.ok) return subject

    const m = month || currentMonthYYYYMM()
    const { start, end } = monthToRange(m)
    const range = parseYmdRange(
      start.toISOString().slice(0, 10),
      end.toISOString().slice(0, 10)
    )

    const [targets, ipdDone, balances, empLogs] = await Promise.all([
      prisma.target.findMany({
        where: {
          targetType: 'BD',
          targetForId: subject.userId,
          periodStartDate: { lte: end },
          periodEndDate: { gte: start },
        },
      }),
      prisma.lead.count({
        where: {
          bdId: subject.userId,
          ...canonicalSalesCompletedWhere({ gte: range.start, lte: range.end }),
        },
      }),
      getComputedBalancesForEmployee(subject.employeeId),
      prisma.attendanceLog.findMany({
        where: {
          employeeId: subject.employeeId,
          logDate: { gte: range.start, lte: range.end },
        },
      }),
    ])

    const targetProgress = await Promise.all(
      targets.map(async (t) => {
        const actual = await calculateActual(subject.userId, t.metric, start, end)
        const percentage =
          t.targetValue > 0 ? Math.round((actual / t.targetValue) * 1000) / 10 : 0
        return {
          metric: t.metric,
          targetValue: t.targetValue,
          actual,
          percentage,
          status: progressStatus(percentage),
        }
      })
    )

    return {
      person: {
        name: subject.name,
        email: subject.email,
        role: subject.role,
        isSelf: subject.isSelf,
      },
      month: m,
      targets: targetProgress,
      ipdDone,
      leaveBalances: balances,
      attendancePunchDays: groupAttendanceByDate(empLogs).length,
    }
  },
})

registerTool({
  name: 'getTeamTargetProgress',
  description:
    "Get TEAM/CATEGORY and BD target progress for the caller's team for a given month, including per-BD breakdown.",
  scope: 'TEAM',
  requiresEmployee: true,
  requiresAnyPermission: ['targets:read'],
  inputSchema: z.object({
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
  }),
  execute: async ({ month }, actor) => {
    const m = month || currentMonthYYYYMM()
    const { start, end } = monthToRange(m)

    const scopeUserIds = [actor.user.id, ...actor.subordinateUserIds]
    const targets = await prisma.target.findMany({
      where: {
        periodStartDate: { lte: end },
        periodEndDate: { gte: start },
        OR: [
          { targetType: 'BD', targetForId: { in: scopeUserIds } },
          ...(actor.employeeId
            ? [
                { targetType: 'TEAM' as const, targetForId: actor.employeeId },
                { targetType: 'CATEGORY' as const, targetForId: actor.employeeId },
              ]
            : []),
        ],
      },
      include: { bonusRules: true },
    })

    const results = []
    for (const t of targets) {
      if (t.targetType === 'BD') {
        const actual = await calculateActual(t.targetForId, t.metric, start, end)
        const percentage =
          t.targetValue > 0 ? Math.round((actual / t.targetValue) * 1000) / 10 : 0
        const user = await prisma.user.findUnique({
          where: { id: t.targetForId },
          select: { name: true },
        })
        results.push({
          id: t.id,
          targetType: t.targetType,
          entityName: user?.name ?? t.targetForId,
          metric: t.metric,
          targetValue: t.targetValue,
          actual,
          percentage,
          status: progressStatus(percentage),
        })
      } else {
        // TEAM / CATEGORY: sum actuals across subordinate BDs
        const bdIds = actor.subordinateUserIds.length
          ? actor.subordinateUserIds
          : [actor.user.id]
        let actual = 0
        const bdBreakdown = []
        for (const bdId of bdIds) {
          const a = await calculateActual(bdId, t.metric, start, end)
          actual += a
          const user = await prisma.user.findUnique({
            where: { id: bdId },
            select: { name: true },
          })
          bdBreakdown.push({
            name: user?.name ?? bdId,
            actual: a,
          })
        }
        const percentage =
          t.targetValue > 0 ? Math.round((actual / t.targetValue) * 1000) / 10 : 0
        results.push({
          id: t.id,
          targetType: t.targetType,
          entityName: t.targetType,
          metric: t.metric,
          targetValue: t.targetValue,
          actual,
          percentage,
          status: progressStatus(percentage),
          bdBreakdown,
        })
      }
    }

    return { month: m, targets: results }
  },
})

registerTool({
  name: 'getTeamIpdLeaderboard',
  description:
    "Rank the caller's team members by IPD done in a date range. Answers 'who has done the highest IPD this month' within the team.",
  scope: 'TEAM',
  requiresEmployee: true,
  inputSchema: z.object({
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  execute: async ({ from, to }, actor) => {
    const scopeUserIds = actor.subordinateUserIds.length
      ? actor.subordinateUserIds
      : [actor.user.id]
    const range = parseYmdRange(from, to)
    const dateFilter: Prisma.DateTimeFilter = { gte: range.start, lte: range.end }

    const rows = await Promise.all(
      scopeUserIds.map(async (bdId) => {
        const [user, ipdDone] = await Promise.all([
          prisma.user.findUnique({
            where: { id: bdId },
            select: { name: true, role: true },
          }),
          prisma.lead.count({
            where: {
              bdId,
              ...canonicalSalesCompletedWhere(dateFilter),
            },
          }),
        ])
        return {
          bdId,
          name: user?.name ?? bdId,
          role: user?.role,
          ipdDone,
        }
      })
    )

    rows.sort((a, b) => b.ipdDone - a.ipdDone)

    return {
      from: range.from,
      to: range.to,
      leaderboard: rows,
      top: rows[0] ?? null,
    }
  },
})
