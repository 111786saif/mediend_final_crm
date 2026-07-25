import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma, UserRole } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { calculateActual } from '@/lib/analytics/target-progress'
import { getSalesTeamUnits } from '@/lib/hierarchy'
import { isTeamLeadEquivalent } from '@/lib/sales-hierarchy-roles'

/**
 * GET /api/targets/progress
 *
 * Returns targets with calculated progress for a given month.
 * Query params:
 *   - month: YYYY-MM (required)
 *   - teamId: Employee.id of the team lead (optional, for filtering by team)
 *   - targetType: BD | TEAM (optional)
 *
 * Returns enriched targets with actual achievement and BD-level breakdown for TEAM targets.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'targets:read')) return errorResponse('Forbidden', 403)

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('month') // YYYY-MM
    const teamId = searchParams.get('teamId') // Employee.id of team lead
    const targetType = searchParams.get('targetType')

    if (!month) return errorResponse('month parameter is required (YYYY-MM)', 400)

    const [year, mon] = month.split('-').map(Number)
    const periodStart = new Date(year, mon - 1, 1)
    const periodEnd = new Date(year, mon, 0, 23, 59, 59, 999) // last day of month

    // Build target query
    const where: Prisma.TargetWhereInput = {
      periodStartDate: { lte: periodEnd },
      periodEndDate: { gte: periodStart },
    }

    if (targetType) where.targetType = targetType as Prisma.EnumTargetTypeFilter['equals']
    if (teamId) where.targetForId = teamId

    // Role-based filtering
    if (user.role === 'BD') {
      where.targetType = 'BD'
      where.targetForId = user.id
    } else if (isTeamLeadEquivalent(user.role)) {
      const emp = await prisma.employee.findUnique({
        where: { userId: user.id },
        select: {
          id: true,
          subordinates: {
            select: { userId: true },
            where: { user: { role: UserRole.BD } },
          },
        },
      })
      const subordinateUserIds = emp?.subordinates.map((s) => s.userId) ?? []
      if (!teamId) {
        where.OR = [
          { targetType: 'BD', targetForId: { in: [user.id, ...subordinateUserIds] } },
          ...(emp ? [{ targetType: 'TEAM' as const, targetForId: emp.id }] : []),
        ]
      }
    } else if (user.role === 'CATEGORY_MANAGER') {
      const [tlUnits, cmUnits] = await Promise.all([
        getSalesTeamUnits({ level: 'tl' }),
        getSalesTeamUnits({ level: 'cm' }),
      ])
      const selfCm = cmUnits.find((c) => c.userId === user.id)
      const scope = new Set(selfCm?.scopeUserIds ?? [])
      const teamIds = tlUnits.filter((t) => scope.has(t.userId)).map((t) => t.id)
      if (teamId && !teamIds.includes(teamId)) {
        return errorResponse('Forbidden', 403)
      }
      if (!teamId) {
        where.OR = [
          { targetType: 'TEAM' as const, targetForId: { in: teamIds } },
          { targetType: 'BD' as const, targetForId: { in: [...scope] } },
        ]
      }
    }

    const targets = await prisma.target.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        bonusRules: true,
      },
      orderBy: { periodStartDate: 'desc' },
    })

    // Collect all unique targetForIds to resolve names and subordinates
    const teamTargetIds = targets.filter(t => t.targetType === 'TEAM').map(t => t.targetForId)
    const bdTargetIds = targets.filter(t => t.targetType === 'BD').map(t => t.targetForId)

    // Resolve team leads and their subordinates
    const teamLeads = teamTargetIds.length > 0
      ? await prisma.employee.findMany({
          where: { id: { in: teamTargetIds } },
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, profilePicture: true } },
            subordinates: {
              select: {
                id: true,
                userId: true,
                user: { select: { id: true, name: true, profilePicture: true } },
              },
              where: { user: { role: UserRole.BD } },
            },
          },
        })
      : []

    const teamLeadMap = new Map(teamLeads.map(tl => [tl.id, tl]))

    // Resolve BD names
    const bdUsers = bdTargetIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: bdTargetIds } },
          select: { id: true, name: true, profilePicture: true },
        })
      : []
    const bdUserMap = new Map(bdUsers.map(u => [u.id, u]))

    // Calculate progress for each target
    const enrichedTargets = await Promise.all(
      targets.map(async (target) => {
        const tStart = new Date(Math.max(periodStart.getTime(), target.periodStartDate.getTime()))
        const tEnd = new Date(Math.min(periodEnd.getTime(), target.periodEndDate.getTime()))

        let bdIds: string[] = []
        let entityName = 'Unknown'
        let entityAvatar: string | null = null
        let bdBreakdown: Array<{
          id: string
          name: string
          profilePicture: string | null
          actual: number
          percentage: number
        }> = []

        if (target.targetType === 'TEAM') {
          const tl = teamLeadMap.get(target.targetForId)
          if (tl) {
            entityName = `${tl.user.name}'s Team`
            entityAvatar = tl.user.profilePicture
            bdIds = [tl.userId, ...tl.subordinates.map(s => s.userId)]

            // Calculate per-BD breakdown (include team lead + subordinates)
            const allMembers = [
              { userId: tl.userId, user: tl.user },
              ...tl.subordinates.map(s => ({ userId: s.userId, user: s.user })),
            ]
            const bdActuals = await Promise.all(
              allMembers.map(async (member) => {
                const actual = await calculateActual(member.userId, target.metric, tStart, tEnd)
                return {
                  id: member.userId,
                  name: member.user.name,
                  profilePicture: member.user.profilePicture,
                  actual,
                  percentage: target.targetValue > 0 ? Math.round((actual / target.targetValue) * 100) : 0,
                }
              })
            )
            bdBreakdown = bdActuals.sort((a, b) => b.actual - a.actual)
          }
        } else {
          // BD target
          const bdUser = bdUserMap.get(target.targetForId)
          if (bdUser) {
            entityName = bdUser.name
            entityAvatar = bdUser.profilePicture
          }
          bdIds = [target.targetForId]
        }

        // Calculate team-level actual
        const totalActual =
          target.targetType === 'TEAM'
            ? bdBreakdown.reduce((sum, item) => sum + item.actual, 0)
            : await calculateActual(target.targetForId, target.metric, tStart, tEnd)

        const percentage = target.targetValue > 0
          ? Math.round((totalActual / target.targetValue) * 100 * 100) / 100
          : 0

        const status = percentage >= 100 ? 'completed' : percentage >= 60 ? 'on_track' : 'at_risk'

        return {
          id: target.id,
          targetType: target.targetType,
          targetForId: target.targetForId,
          entityName,
          entityAvatar,
          periodType: target.periodType,
          periodStartDate: target.periodStartDate.toISOString(),
          periodEndDate: target.periodEndDate.toISOString(),
          metric: target.metric,
          targetValue: target.targetValue,
          actual: totalActual,
          percentage,
          status,
          createdBy: target.createdBy,
          bonusRules: target.bonusRules,
          bdBreakdown,
        }
      })
    )

    return successResponse(enrichedTargets)
  } catch (error) {
    console.error('Error fetching target progress:', error)
    return errorResponse('Failed to fetch target progress', 500)
  }
}