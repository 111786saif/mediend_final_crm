import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma, TargetType, PeriodType } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'

const targetSchema = z.object({
  targetType: z.enum(['BD', 'TEAM']),
  targetForId: z.string(),
  periodType: z.enum(['WEEK', 'MONTH']).default('MONTH'),
  periodStartDate: z.string(),
  periodEndDate: z.string(),
  metric: z.enum(['LEADS_CLOSED', 'NET_PROFIT', 'BILL_AMOUNT', 'SURGERIES_DONE', 'IPD_DONE']).default('IPD_DONE'),
  targetValue: z.number(),
})

import { getSalesTeamUnits } from '@/lib/hierarchy'
import { isTeamLeadEquivalent } from '@/lib/sales-hierarchy-roles'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'targets:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const targetType = searchParams.get('targetType')
    const targetForId = searchParams.get('targetForId')
    const periodType = searchParams.get('periodType')

    const where: Prisma.TargetWhereInput = {}

    // Role-based filtering: TEAM targets now use manager's Employee.id as targetForId
    if (user.role === 'BD') {
      where.targetType = 'BD'
      where.targetForId = user.id
    } else if (isTeamLeadEquivalent(user.role)) {
      const employee = await prisma.employee.findUnique({ where: { userId: user.id }, select: { id: true } })
      where.OR = [
        { targetType: 'BD', targetForId: user.id },
        ...(employee ? [{ targetType: 'TEAM' as TargetType, targetForId: employee.id }] : []),
      ]
    } else if (user.role === 'CATEGORY_MANAGER') {
      const [tlUnits, cmUnits] = await Promise.all([
        getSalesTeamUnits({ level: 'tl' }),
        getSalesTeamUnits({ level: 'cm' }),
      ])
      const selfCm = cmUnits.find((c) => c.userId === user.id)
      const scope = new Set(selfCm?.scopeUserIds ?? [])
      const teamIds = tlUnits.filter((t) => scope.has(t.userId)).map((t) => t.id)
      where.OR = [
        { targetType: 'TEAM' as TargetType, targetForId: { in: teamIds } },
        ...(selfCm ? [{ targetType: 'TEAM' as TargetType, targetForId: selfCm.id }] : []),
        { targetType: 'BD' as TargetType, targetForId: { in: [...scope] } },
      ]
    }

    if (targetType) where.targetType = targetType as TargetType
    if (targetForId) where.targetForId = targetForId
    if (periodType) where.periodType = periodType as PeriodType

    const targets = await prisma.target.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        bonusRules: true,
      },
      orderBy: {
        periodStartDate: 'desc',
      },
    })

    return successResponse(targets)
  } catch (error) {
    console.error('Error fetching targets:', error)
    return errorResponse('Failed to fetch targets', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'targets:write')) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const data = targetSchema.parse(body)

    // CM may only assign TEAM targets to TL/ACM units in their subtree
    if (user.role === 'CATEGORY_MANAGER') {
      if (data.targetType !== 'TEAM') {
        return errorResponse('Category Managers can only set team targets', 403)
      }
      const [tlUnits, cmUnits] = await Promise.all([
        getSalesTeamUnits({ level: 'tl' }),
        getSalesTeamUnits({ level: 'cm' }),
      ])
      const selfCm = cmUnits.find((c) => c.userId === user.id)
      const scope = new Set(selfCm?.scopeUserIds ?? [])
      const allowedTeamIds = new Set(
        tlUnits.filter((t) => scope.has(t.userId)).map((t) => t.id)
      )
      if (!allowedTeamIds.has(data.targetForId)) {
        return errorResponse('Forbidden: team is outside your category', 403)
      }
    }

    const target = await prisma.target.create({
      data: {
        targetType: data.targetType,
        targetForId: data.targetForId,
        periodType: data.periodType,
        periodStartDate: new Date(data.periodStartDate),
        periodEndDate: new Date(data.periodEndDate),
        metric: data.metric,
        targetValue: data.targetValue,
        createdById: user.id,
      },
    })

    return successResponse(target, 'Target created successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error creating target:', error)
    return errorResponse('Failed to create target', 500)
  }
}

