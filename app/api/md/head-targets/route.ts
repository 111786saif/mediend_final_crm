import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'
import { parseDepartmentTargets } from './dept-target-utils'

const HEAD_ROLES = ['SALES_HEAD', 'HR_HEAD', 'DIGITAL_MARKETING_HEAD', 'IT_HEAD'] as const

function getMonthBounds(monthOffset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + monthOffset)
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

async function computeAchievement(
  metric: string,
  start: Date,
  end: Date,
  headCountDepartmentIds?: string[] | null
): Promise<number> {
  switch (metric) {
    case 'IPD_DONE': {
      const count = await prisma.lead.count({
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
      return count
    }
    case 'HEAD_COUNT': {
      if (headCountDepartmentIds && headCountDepartmentIds.length > 0) {
        return prisma.employee.count({
          where: {
            departmentId: { in: headCountDepartmentIds },
            createdAt: { gte: start, lte: end },
          },
        })
      }
      return prisma.employee.count({
        where: {
          createdAt: { gte: start, lte: end },
        },
      })
    }
    case 'LEADS_GENERATED': {
      const count = await prisma.incomingLead.count({
        where: {
          receivedAt: { gte: start, lte: end },
        },
      })
      return count
    }
    case 'REVENUE': {
      const result = await prisma.salesEntry.aggregate({
        where: {
          transactionDate: { gte: start, lte: end },
          isDeleted: false,
        },
        _sum: { amount: true },
      })
      return result._sum.amount ?? 0
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

function getDepartmentLabel(role: string): string {
  switch (role) {
    case 'SALES_HEAD':
      return 'Sales'
    case 'HR_HEAD':
      return 'HR'
    case 'DIGITAL_MARKETING_HEAD':
      return 'Digital Marketing'
    case 'IT_HEAD':
      return 'IT'
    default:
      return role.replace(/_/g, ' ')
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (user.role !== 'MD' && user.role !== 'ADMIN') {
      return errorResponse('Forbidden', 403)
    }

    const { start, end } = getMonthBounds(0)

    const heads = await prisma.user.findMany({
      where: {
        role: { in: [...HEAD_ROLES] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profilePicture: true,
        departmentHeadOf: {
          select: { id: true, name: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    const headIds = heads.map((h) => h.id)

    const targets = await prisma.target.findMany({
      where: {
        targetType: 'DEPARTMENT_HEAD',
        targetForId: { in: headIds },
        periodStartDate: { lte: end },
        periodEndDate: { gte: start },
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { periodStartDate: 'desc' },
    })

    const targetByHead = new Map(targets.map((t) => [t.targetForId, t]))

    const result = await Promise.all(
      heads.map(async (head) => {
        const target = targetByHead.get(head.id)
        const metric = target?.metric ?? getMetricForRole(head.role)
        const deptTargets = parseDepartmentTargets(target?.departmentTargets)
        const targetValue =
          metric === 'HEAD_COUNT' && deptTargets?.length
            ? deptTargets.reduce((s, d) => s + d.addCount, 0)
            : (target?.targetValue ?? 0)
        const headCountDeptIds =
          metric === 'HEAD_COUNT' && deptTargets?.length
            ? deptTargets.map((d) => d.departmentId)
            : null
        const actual = await computeAchievement(metric, start, end, headCountDeptIds)
        const percentage =
          targetValue > 0 ? Math.round((actual / targetValue) * 100) : 0

        return {
          head: {
            id: head.id,
            name: head.name,
            email: head.email,
            role: head.role,
            profilePicture: head.profilePicture,
            department: head.departmentHeadOf[0] ?? null,
            departmentLabel: getDepartmentLabel(head.role),
          },
          activeTarget: target
            ? {
                id: target.id,
                metric: target.metric,
                targetValue: target.targetValue,
                departmentTargets: parseDepartmentTargets(target.departmentTargets),
                periodStartDate: target.periodStartDate.toISOString(),
                periodEndDate: target.periodEndDate.toISOString(),
                periodType: target.periodType,
              }
            : null,
          achievement: {
            actual,
            targetValue,
            percentage,
            metric,
          },
        }
      })
    )

    return successResponse(result)
  } catch (error) {
    console.error('Error fetching head targets:', error)
    return errorResponse('Failed to fetch head targets', 500)
  }
}

const createTargetSchema = z.object({
  headUserId: z.string(),
  metric: z.enum([
    'IPD_DONE',
    'HEAD_COUNT',
    'LEADS_GENERATED',
    'REVENUE',
  ]),
  targetValue: z.number().positive(),
  periodStartDate: z.string(),
  periodEndDate: z.string(),
  periodType: z.enum(['WEEK', 'MONTH']),
  departmentBreakdown: z
    .array(
      z.object({
        departmentId: z.string(),
        addCount: z.number().int().min(0),
      })
    )
    .optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (user.role !== 'MD' && user.role !== 'ADMIN') {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const data = createTargetSchema.parse(body)

    const headUser = await prisma.user.findUnique({
      where: { id: data.headUserId },
    })
    if (!headUser) return errorResponse('Head user not found', 404)
    if (!HEAD_ROLES.includes(headUser.role as (typeof HEAD_ROLES)[number])) {
      return errorResponse('User is not a department head', 400)
    }

    const isHrHeadCount =
      headUser.role === 'HR_HEAD' && data.metric === 'HEAD_COUNT'

    if (isHrHeadCount) {
      if (!data.departmentBreakdown?.length) {
        return errorResponse(
          'Set a target for each department (department-wise headcount)',
          400
        )
      }
      const sum = data.departmentBreakdown.reduce((s, d) => s + d.addCount, 0)
      if (sum <= 0) {
        return errorResponse(
          'At least one department must have a positive hiring target',
          400
        )
      }
    } else if (data.departmentBreakdown?.length) {
      return errorResponse(
        'Department breakdown is only used for HR headcount targets',
        400
      )
    }

    const periodStart = new Date(data.periodStartDate)
    const periodEnd = new Date(data.periodEndDate)

    const targetValueToStore = isHrHeadCount
      ? data.departmentBreakdown!.reduce((s, d) => s + d.addCount, 0)
      : data.targetValue

    await prisma.target.deleteMany({
      where: {
        targetType: 'DEPARTMENT_HEAD',
        targetForId: data.headUserId,
        periodStartDate: periodStart,
        periodEndDate: periodEnd,
      },
    })

    const target = await prisma.target.create({
      data: {
        targetType: 'DEPARTMENT_HEAD',
        targetForId: data.headUserId,
        periodType: data.periodType,
        periodStartDate: periodStart,
        periodEndDate: periodEnd,
        metric: data.metric,
        targetValue: targetValueToStore,
        departmentTargets: isHrHeadCount
          ? data.departmentBreakdown!.filter((d) => d.addCount > 0)
          : undefined,
        createdById: user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    })

    return successResponse(target, 'Target created successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(
        error.errors.map((e) => e.message).join('; ') || 'Invalid request data',
        400
      )
    }
    console.error('Error creating head target:', error)
    return errorResponse('Failed to create target', 500)
  }
}
