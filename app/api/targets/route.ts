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

import { getSubordinateUserIdsForLeadAccess } from '@/lib/hierarchy'

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
    } else if (user.role === 'TEAM_LEAD') {
      const employee = await prisma.employee.findUnique({ where: { userId: user.id }, select: { id: true } })
      where.OR = [
        { targetType: 'BD', targetForId: user.id },
        ...(employee ? [{ targetType: 'TEAM' as TargetType, targetForId: employee.id }] : []),
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

