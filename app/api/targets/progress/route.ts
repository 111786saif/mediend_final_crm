import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Prisma, UserRole } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { calculateActual } from '@/lib/analytics/target-progress'
import { getSalesTeamUnits, getTeamScopeUserIds } from '@/lib/hierarchy'
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
          { targetType: 'BD' as const, targetForId: { in: [...scope, user.id] } },
          ...(selfCm ? [{ targetType: 'CATEGORY' as const, targetForId: selfCm.id }] : []),
        ]
      }
    }

    const targets = await prisma.target.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        bonusRules: true,
      },
      orderBy: { periodStartDate: 'desc' },
    })

    // Fetch all team structures to map BD user IDs to their Team Lead employee IDs
    const allTeamLeads = await prisma.employee.findMany({
      where: {
        user: { role: UserRole.TEAM_LEAD },
      },
      select: {
        id: true, // Employee.id of Team Lead
        userId: true, // User.id of Team Lead
        user: { select: { name: true } },
        subordinates: {
          select: { userId: true },
          where: { user: { role: UserRole.BD } },
        },
      },
    })

    // Map bdUserId -> Team Lead Employee.id
    const bdToTeamLeadMap = new Map<string, string>()
    for (const tl of allTeamLeads) {
      if (tl.subordinates) {
        for (const sub of tl.subordinates) {
          bdToTeamLeadMap.set(sub.userId, tl.id)
        }
      }
    }

    // Calculate direct BDE target adjustments for TEAM targets
    // BDE targets created by CATEGORY_MANAGER and above roles increase the Team target
    const allowedTeamRoles: UserRole[] = [
      UserRole.CATEGORY_MANAGER,
      UserRole.SALES_HEAD,
      UserRole.EXECUTIVE_ASSISTANT,
      UserRole.MD,
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
      UserRole.CRM_ADMIN
    ]

    const teamAdjustmentMap = new Map<string, number>()
    for (const t of targets) {
      if (t.targetType === 'BD') {
        const creatorRole = t.createdBy.role
        
        // Team level adjustment
        if (allowedTeamRoles.includes(creatorRole)) {
          const teamLeadId = bdToTeamLeadMap.get(t.targetForId)
          if (teamLeadId) {
            const current = teamAdjustmentMap.get(teamLeadId) || 0
            teamAdjustmentMap.set(teamLeadId, current + t.targetValue)
          }
        }
      }
    }

    // Group and accumulate duplicate targets for the same entity in the same month
    const consolidatedMap = new Map<string, typeof targets[0]>()
    for (const t of targets) {
      const key = `${t.targetType}_${t.targetForId}`
      const existing = consolidatedMap.get(key)
      if (existing) {
        existing.targetValue += t.targetValue
        if (t.bonusRules && t.bonusRules.length > 0) {
          existing.bonusRules = [...(existing.bonusRules || []), ...t.bonusRules]
        }
      } else {
        consolidatedMap.set(key, {
          ...t,
          bonusRules: t.bonusRules ? [...t.bonusRules] : [],
        })
      }
    }

    // Apply BDE target adjustments directly to consolidated TEAM targets
    for (const [teamLeadId, adjustVal] of teamAdjustmentMap.entries()) {
      const key = `TEAM_${teamLeadId}`
      const existingTeamTarget = consolidatedMap.get(key)
      if (existingTeamTarget) {
        existingTeamTarget.targetValue += adjustVal
      } else {
        // If no TEAM target was created by a Team Lead yet, create a virtual TEAM target record
        const tl = allTeamLeads.find((item) => item.id === teamLeadId)
        if (tl) {
          const firstTarget = targets[0]
          consolidatedMap.set(key, {
            id: `virtual_team_target_${teamLeadId}`,
            targetType: 'TEAM',
            targetForId: teamLeadId,
            periodType: firstTarget?.periodType ?? 'MONTH',
            periodStartDate: firstTarget?.periodStartDate ?? periodStart,
            periodEndDate: firstTarget?.periodEndDate ?? periodEnd,
            metric: firstTarget?.metric ?? 'IPD_DONE',
            targetValue: adjustVal,
            createdById: tl.userId,
            createdAt: new Date(),
            updatedAt: new Date(),
            departmentTargets: null,
            createdBy: { id: tl.userId, name: tl.user.name, role: UserRole.TEAM_LEAD },
            bonusRules: [],
          })
        }
      }
    }

    let consolidatedTargets = Array.from(consolidatedMap.values())

    if (targetType) {
      consolidatedTargets = consolidatedTargets.filter(t => t.targetType === targetType)
    }

    // Collect all unique targetForIds to resolve names and subordinates
    const teamTargetIds = consolidatedTargets.filter(t => t.targetType === 'TEAM').map(t => t.targetForId)
    const bdTargetIds = consolidatedTargets.filter(t => t.targetType === 'BD').map(t => t.targetForId)
    const categoryTargetIds = consolidatedTargets.filter(t => t.targetType === 'CATEGORY').map(t => t.targetForId)

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

    // Resolve Category Managers
    const categoryManagers = categoryTargetIds.length > 0
      ? await prisma.employee.findMany({
          where: { id: { in: categoryTargetIds } },
          select: {
            id: true,
            userId: true,
            user: { select: { id: true, name: true, profilePicture: true } },
          },
        })
      : []

    const categoryManagerMap = new Map(categoryManagers.map(cm => [cm.id, cm]))

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
      consolidatedTargets.map(async (target) => {
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

        if (target.targetType === 'CATEGORY') {
          const cm = categoryManagerMap.get(target.targetForId)
          if (cm) {
            entityName = `${cm.user.name}'s Category`
            entityAvatar = cm.user.profilePicture
            
            const scopeUserIds = await getTeamScopeUserIds(cm.id)
            bdIds = scopeUserIds

            // Resolve Team Leads under this Category Manager for breakdown (direct reports who are TLs/ACMs)
            const categoryTeams = await prisma.employee.findMany({
              where: {
                managerId: cm.id,
                user: { role: { in: [UserRole.TEAM_LEAD, UserRole.ASSISTANT_CATEGORY_MANAGER] } },
              },
              select: {
                id: true,
                userId: true,
                user: { select: { name: true, profilePicture: true } },
              },
            })

            const teamActuals = await Promise.all(
              categoryTeams.map(async (teamEmp) => {
                const teamScopeUserIds = await getTeamScopeUserIds(teamEmp.id)
                let actual = 0
                for (const uid of teamScopeUserIds) {
                  actual += await calculateActual(uid, target.metric, tStart, tEnd)
                }
                return {
                  id: teamEmp.userId,
                  name: teamEmp.user.name,
                  profilePicture: teamEmp.user.profilePicture,
                  actual,
                  percentage: target.targetValue > 0 ? Math.round((actual / target.targetValue) * 100) : 0,
                }
              })
            )
            bdBreakdown = teamActuals.sort((a, b) => b.actual - a.actual)
          }
        } else if (target.targetType === 'TEAM') {
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

        // Calculate team/category-level actual
        const totalActual =
          target.targetType === 'TEAM'
            ? bdBreakdown.reduce((sum, item) => sum + item.actual, 0)
            : target.targetType === 'CATEGORY'
              ? (await Promise.all(bdIds.map(uid => calculateActual(uid, target.metric, tStart, tEnd)))).reduce((sum, val) => sum + val, 0)
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