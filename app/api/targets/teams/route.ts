import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/generated/prisma/client'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { resolveSuggestedIpdTarget } from '@/lib/targets/ipd-target-rules'

/**
 * GET /api/targets/teams
 *
 * Returns all team leads (managers) with their BD subordinates.
 * Used by sales head to select a team when creating targets.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'targets:read')) return errorResponse('Forbidden', 403)

    // Find all employees who are team leads (have subordinates or have TEAM_LEAD role)
    const teamLeads = await prisma.employee.findMany({
      where: {
        user: { role: UserRole.TEAM_LEAD },
      },
      select: {
        id: true,
        employeeCode: true,
        userId: true,
        user: {
          select: {
            id: true,
            name: true,
            profilePicture: true,
          },
        },
        subordinates: {
          select: {
            id: true,
            userId: true,
            employeeCode: true,
            joinDate: true,
            salary: true,
            salaryStructures: {
              orderBy: { effectiveFrom: 'desc' },
              take: 1,
              select: { monthlyGross: true },
            },
            user: {
              select: {
                id: true,
                name: true,
                profilePicture: true,
                role: true,
              },
            },
          },
          where: { user: { role: UserRole.BD } },
          orderBy: { user: { name: 'asc' } },
        },
      },
      orderBy: { user: { name: 'asc' } },
    })

    const teams = teamLeads.map((tl) => ({
      id: tl.id, // Employee.id - used as targetForId for TEAM targets
      userId: tl.userId,
      name: tl.user.name,
      profilePicture: tl.user.profilePicture,
      employeeCode: tl.employeeCode,
      memberCount: tl.subordinates.length,
      members: tl.subordinates.map((s) => {
        const suggested = resolveSuggestedIpdTarget({
          joinDate: s.joinDate,
          salary: s.salary,
          monthlyGross: s.salaryStructures?.[0]?.monthlyGross,
        })
        return {
          id: s.userId,
          employeeId: s.id,
          name: s.user.name,
          profilePicture: s.user.profilePicture,
          suggestedTarget: suggested.suggestedTarget,
          suggestedBasis: suggested.basis,
          suggestedLabel: suggested.label,
        }
      }),
    }))

    return successResponse(teams)
  } catch (error) {
    console.error('Error fetching target teams:', error)
    return errorResponse('Failed to fetch teams', 500)
  }
}
