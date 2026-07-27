import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma, TargetType, PeriodType, UserRole } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'

const targetSchema = z.object({
  targetType: z.enum(['BD', 'TEAM', 'CATEGORY']),
  targetForId: z.string(),
  periodType: z.enum(['WEEK', 'MONTH']).default('MONTH'),
  periodStartDate: z.string(),
  periodEndDate: z.string(),
  metric: z.enum(['LEADS_CLOSED', 'NET_PROFIT', 'BILL_AMOUNT', 'SURGERIES_DONE', 'IPD_DONE']).default('IPD_DONE'),
  targetValue: z.number(),
})

import { getSalesTeamUnits, getTeamScopeUserIds } from '@/lib/hierarchy'
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
        ...(selfCm ? [
          { targetType: 'CATEGORY' as TargetType, targetForId: selfCm.id },
          { targetType: 'BD' as TargetType, targetForId: user.id }
        ] : []),
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

    // Validation based on targetType and role scopes
    if (data.targetType === 'CATEGORY') {
      const allowedRoles = ['SALES_HEAD', 'MD', 'EXECUTIVE_ASSISTANT', 'ADMIN', 'SUPER_ADMIN', 'CRM_ADMIN']
      if (!allowedRoles.includes(user.role)) {
        return errorResponse('Forbidden: only Sales Head or Admin can assign Category targets', 403)
      }

      const targetCm = await prisma.employee.findUnique({
        where: { id: data.targetForId },
        select: { user: { select: { role: true } } },
      })
      if (!targetCm || targetCm.user.role !== 'CATEGORY_MANAGER') {
        return errorResponse('Category targets must be assigned to a Category Manager', 400)
      }
    }

    if (data.targetType === 'TEAM') {
      // Category Managers are the only ones allowed to assign TEAM targets
      if (user.role !== 'CATEGORY_MANAGER') {
        return errorResponse('Forbidden: only Category Managers can assign TEAM targets', 403)
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
        return errorResponse('Forbidden: team is outside your category scope', 403)
      }
    }

    if (data.targetType === 'BD') {
      if (user.role === 'CATEGORY_MANAGER') {
        // Category Managers can only set BD targets for themselves
        if (data.targetForId !== user.id) {
          return errorResponse('Forbidden: Category Managers can only assign BD targets to themselves', 403)
        }
      } else if (isTeamLeadEquivalent(user.role)) {
        // Team Leads / ACMs can set BD targets for themselves or their subordinates
        const manager = await prisma.employee.findUnique({
          where: { userId: user.id },
          select: {
            subordinates: {
              where: { userId: data.targetForId },
              select: { userId: true },
            },
          },
        })
        const isSelf = data.targetForId === user.id
        const isSubordinate = (manager?.subordinates.length ?? 0) > 0

        if (!isSelf && !isSubordinate) {
          return errorResponse('Forbidden: you can only assign targets to BDs on your team or yourself', 403)
        }
      } else {
        // Sales Head, EA, MD, Admin are not allowed to directly set BD targets
        return errorResponse('Forbidden: only Team Leads and Category Managers (for self) can assign BD targets', 403)
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: data.targetForId },
        select: { role: true },
      })
      const allowedTargetRoles = ['BD', 'TEAM_LEAD', 'ASSISTANT_CATEGORY_MANAGER', 'CATEGORY_MANAGER']
      if (!targetUser || !allowedTargetRoles.includes(targetUser.role)) {
        return errorResponse('BD targets must be assigned to a BDE or Manager', 400)
      }
    }

    const periodStart = new Date(data.periodStartDate)
    const periodEnd = new Date(data.periodEndDate)

    // Check if target for the same type, targetForId, period, metric, and creator already exists (to support update / edit)
    const existingTarget = await prisma.target.findFirst({
      where: {
        targetType: data.targetType,
        targetForId: data.targetForId,
        periodStartDate: periodStart,
        periodEndDate: periodEnd,
        metric: data.metric,
        createdById: user.id,
      },
      select: { id: true, targetValue: true },
    })

    const newTargetValue = data.targetValue
    const existingRowValue = existingTarget?.targetValue ?? 0

    // Enforce delegation capacity limits
    // 1. BD Target Capacity Validation (within TEAM target budget)
    if (data.targetType === 'BD') {
      let teamLeadEmployee = await prisma.employee.findFirst({
        where: { userId: data.targetForId, user: { role: { in: [UserRole.TEAM_LEAD, UserRole.ASSISTANT_CATEGORY_MANAGER] } } },
      })

      if (!teamLeadEmployee) {
        const bdEmp = await prisma.employee.findUnique({
          where: { userId: data.targetForId },
          select: { managerId: true },
        })
        if (bdEmp?.managerId) {
          teamLeadEmployee = await prisma.employee.findUnique({
            where: { id: bdEmp.managerId },
          })
        }
      }

      if (teamLeadEmployee) {
        const teamTargets = await prisma.target.findMany({
          where: {
            targetType: 'TEAM',
            targetForId: teamLeadEmployee.id,
            periodStartDate: { lte: periodEnd },
            periodEndDate: { gte: periodStart },
          },
          select: { targetValue: true },
        })
        const totalTeamTarget = teamTargets.reduce((sum, t) => sum + t.targetValue, 0)

        if (totalTeamTarget === 0) {
          return errorResponse(
            `No TEAM target has been allocated to this Team Lead/ACM for this month yet. Please allocate a TEAM target first.`,
            400
          )
        }

        const teamScopeUserIds = await getTeamScopeUserIds(teamLeadEmployee.id)
        const existingBdTargets = await prisma.target.findMany({
          where: {
            targetType: 'BD',
            targetForId: { in: teamScopeUserIds },
            periodStartDate: { lte: periodEnd },
            periodEndDate: { gte: periodStart },
          },
          select: { targetValue: true },
        })
        const totalExistingBdTarget = existingBdTargets.reduce((sum, t) => sum + t.targetValue, 0)

        const currentAllocated = totalExistingBdTarget - existingRowValue

        if (currentAllocated + newTargetValue > totalTeamTarget) {
          return errorResponse(
            `Allocation exceeds Team target. Team Target: ${totalTeamTarget}. Currently Allocated: ${currentAllocated}. Remaining budget: ${totalTeamTarget - currentAllocated}.`,
            400
          )
        }
      }
    }

    // 2. TEAM or Category Manager self BD target Capacity Validation (within CATEGORY target budget)
    if (data.targetType === 'TEAM' || (data.targetType === 'BD' && user.role === 'CATEGORY_MANAGER')) {
      const cmEmployee = await prisma.employee.findFirst({
        where: {
          OR: [
            { userId: user.id, user: { role: UserRole.CATEGORY_MANAGER } },
            { id: data.targetForId, user: { role: UserRole.CATEGORY_MANAGER } },
          ],
        },
      })

      if (cmEmployee) {
        const catTargets = await prisma.target.findMany({
          where: {
            targetType: 'CATEGORY',
            targetForId: cmEmployee.id,
            periodStartDate: { lte: periodEnd },
            periodEndDate: { gte: periodStart },
          },
          select: { targetValue: true },
        })
        const totalCatTarget = catTargets.reduce((sum, t) => sum + t.targetValue, 0)

        if (totalCatTarget === 0) {
          return errorResponse(
            `No CATEGORY target has been allocated to this Category Manager for this month yet. Please allocate a CATEGORY target first.`,
            400
          )
        }

        const subTeams = await prisma.employee.findMany({
          where: { managerId: cmEmployee.id, user: { role: { in: [UserRole.TEAM_LEAD, UserRole.ASSISTANT_CATEGORY_MANAGER] } } },
          select: { id: true },
        })
        const subTeamIds = subTeams.map(t => t.id)

        const allocatedTargets = await prisma.target.findMany({
          where: {
            OR: [
              { targetType: 'TEAM', targetForId: { in: subTeamIds } },
              { targetType: 'BD', targetForId: cmEmployee.userId },
            ],
            periodStartDate: { lte: periodEnd },
            periodEndDate: { gte: periodStart },
          },
          select: { targetValue: true },
        })
        const totalAllocated = allocatedTargets.reduce((sum, t) => sum + t.targetValue, 0)

        const currentAllocated = totalAllocated - existingRowValue

        if (currentAllocated + newTargetValue > totalCatTarget) {
          return errorResponse(
            `Allocation exceeds Category target. Category Target: ${totalCatTarget}. Currently Allocated: ${currentAllocated}. Remaining budget: ${totalCatTarget - currentAllocated}.`,
            400
          )
        }
      }
    }

    let target
    if (existingTarget) {
      target = await prisma.target.update({
        where: { id: existingTarget.id },
        data: { targetValue: newTargetValue },
      })
    } else {
      target = await prisma.target.create({
        data: {
          targetType: data.targetType,
          targetForId: data.targetForId,
          periodType: data.periodType,
          periodStartDate: periodStart,
          periodEndDate: periodEnd,
          metric: data.metric,
          targetValue: newTargetValue,
          createdById: user.id,
        },
      })
    }

    return successResponse(target, 'Target created successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error creating/updating target:', error)
    return errorResponse('Failed to create target', 500)
  }
}

