import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { parseDepartmentTargets } from '../dept-target-utils'

const HEAD_ROLES = ['SALES_HEAD', 'HR_HEAD', 'DIGITAL_MARKETING_HEAD', 'IT_HEAD'] as const

function getMonthBounds(monthOffset: number) {
  const d = new Date()
  d.setMonth(d.getMonth() + monthOffset)
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end, label: d.toLocaleString('default', { month: 'short', year: 'numeric' }) }
}

async function computeAchievement(
  metric: string,
  start: Date,
  end: Date,
  headCountDepartmentIds?: string[] | null
): Promise<number> {
  switch (metric) {
    case 'IPD_DONE': {
      return prisma.lead.count({
        where: {
          pipelineStage: 'COMPLETED',
          OR: [
            { conversionDate: { gte: start, lte: end } },
            {
              AND: [
                { conversionDate: null },
                { surgeryDate: { gte: start, lte: end } },
              ],
            },
            {
              AND: [
                { conversionDate: null },
                { surgeryDate: null },
                { leadDate: { gte: start, lte: end } },
              ],
            },
          ],
        },
      })
    }
    case 'HEAD_COUNT': {
      const joinedInPeriod = { joinDate: { gte: start, lte: end } }
      if (headCountDepartmentIds && headCountDepartmentIds.length > 0) {
        return prisma.employee.count({
          where: {
            departmentId: { in: headCountDepartmentIds },
            ...joinedInPeriod,
          },
        })
      }
      return prisma.employee.count({
        where: joinedInPeriod,
      })
    }
    case 'LEADS_GENERATED': {
      return prisma.incomingLead.count({
        where: { receivedAt: { gte: start, lte: end } },
      })
    }
    case 'REVENUE': {
      const r = await prisma.salesEntry.aggregate({
        where: {
          transactionDate: { gte: start, lte: end },
          isDeleted: false,
        },
        _sum: { amount: true },
      })
      return r._sum.amount ?? 0
    }
    default:
      return 0
  }
}

function getMetricForRole(role: string): string {
  switch (role) {
    case 'SALES_HEAD':
      return 'IPD_DONE'
    case 'HR_HEAD':
      return 'HEAD_COUNT'
    case 'DIGITAL_MARKETING_HEAD':
      return 'LEADS_GENERATED'
    case 'IT_HEAD':
      return 'REVENUE'
    default:
      return 'IPD_DONE'
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const headUserId = searchParams.get('headUserId')

    if (!headUserId) return errorResponse('headUserId is required', 400)

    const canAccess =
      user.role === 'MD' ||
      user.role === 'ADMIN' ||
      user.id === headUserId

    if (!canAccess) return errorResponse('Forbidden', 403)

    const headUser = await prisma.user.findUnique({
      where: { id: headUserId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profilePicture: true,
        departmentHeadOf: { select: { id: true, name: true } },
      },
    })

    if (!headUser) return errorResponse('Head not found', 404)
    if (!HEAD_ROLES.includes(headUser.role as (typeof HEAD_ROLES)[number])) {
      return errorResponse('User is not a department head', 400)
    }

    const metric = getMetricForRole(headUser.role)

    const months = [
      getMonthBounds(0),
      getMonthBounds(-1),
      getMonthBounds(-2),
      getMonthBounds(-3),
    ]

    const targets = await prisma.target.findMany({
      where: {
        targetType: 'DEPARTMENT_HEAD',
        targetForId: headUserId,
        OR: months.map((m) => ({
          periodStartDate: { lte: m.end },
          periodEndDate: { gte: m.start },
        })),
      },
      orderBy: { periodStartDate: 'desc' },
    })

    const targetByMonth = new Map<
      string,
      { targetValue: number; targetId: string; departmentTargets: unknown }
    >()
    for (const t of targets) {
      const key = `${t.periodStartDate.getFullYear()}-${String(t.periodStartDate.getMonth() + 1).padStart(2, '0')}`
      const parsed = parseDepartmentTargets(t.departmentTargets)
      const targetValue =
        metric === 'HEAD_COUNT' && parsed?.length
          ? parsed.reduce((s, d) => s + d.addCount, 0)
          : t.targetValue
      targetByMonth.set(key, {
        targetValue,
        targetId: t.id,
        departmentTargets: t.departmentTargets,
      })
    }

    const history = await Promise.all(
      months.map(async (m) => {
        const key = `${m.start.getFullYear()}-${String(m.start.getMonth() + 1).padStart(2, '0')}`
        const targetInfo = targetByMonth.get(key)
        const deptParsed = parseDepartmentTargets(targetInfo?.departmentTargets)
        const headCountDeptIds =
          metric === 'HEAD_COUNT' && deptParsed?.length
            ? deptParsed.map((d) => d.departmentId)
            : null
        const actual = await computeAchievement(
          metric,
          m.start,
          m.end,
          headCountDeptIds
        )
        const targetValue = targetInfo?.targetValue ?? 0
        const percentage =
          targetValue > 0 ? Math.round((actual / targetValue) * 100) : 0

        return {
          month: m.label,
          monthKey: key,
          start: m.start.toISOString(),
          end: m.end.toISOString(),
          targetValue,
          targetId: targetInfo?.targetId ?? null,
          actual,
          percentage,
        }
      })
    )

    let departmentBreakdown: {
      departmentId: string
      departmentName: string
      currentCount: number
      addedInPeriod: number
      monthlyTarget: number
    }[] = []

    if (headUser.role === 'HR_HEAD') {
      const departments = await prisma.department.findMany({
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      })

      const currentMonthKey = `${months[0].start.getFullYear()}-${String(months[0].start.getMonth() + 1).padStart(2, '0')}`
      const currentTargetRow = targetByMonth.get(currentMonthKey)
      const targetByDept = new Map(
        parseDepartmentTargets(currentTargetRow?.departmentTargets)?.map((r) => [
          r.departmentId,
          r.addCount,
        ]) ?? []
      )

      const [currentCounts, addedCounts] = await Promise.all([
        prisma.employee.groupBy({
          by: ['departmentId'],
          _count: { id: true },
          where: { departmentId: { not: null } },
        }),
        prisma.employee.groupBy({
          by: ['departmentId'],
          _count: { id: true },
          where: {
            departmentId: { not: null },
            joinDate: { gte: months[0].start, lte: months[0].end },
          },
        }),
      ])

      const currentMap = new Map(currentCounts.map((c) => [c.departmentId ?? '', c._count.id]))
      const addedMap = new Map(addedCounts.map((c) => [c.departmentId ?? '', c._count.id]))

      departmentBreakdown = departments.map((d) => ({
        departmentId: d.id,
        departmentName: d.name,
        currentCount: currentMap.get(d.id) ?? 0,
        addedInPeriod: addedMap.get(d.id) ?? 0,
        monthlyTarget: targetByDept.get(d.id) ?? 0,
      }))
    }

    return successResponse({
      head: {
        id: headUser.id,
        name: headUser.name,
        email: headUser.email,
        role: headUser.role,
        profilePicture: headUser.profilePicture,
        department: headUser.departmentHeadOf[0] ?? null,
      },
      metric,
      currentMonth: history[0],
      history: history.slice(1),
      departmentBreakdown,
    })
  } catch (error) {
    console.error('Error fetching head achievement:', error)
    return errorResponse('Failed to fetch achievement', 500)
  }
}
