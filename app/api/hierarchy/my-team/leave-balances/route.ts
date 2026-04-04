import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { getEmployeeByUserId, getSubordinates } from '@/lib/hierarchy'
import { differenceInMonths } from 'date-fns'

export interface TeamLeaveBalance {
  employeeId: string
  employeeName: string
  employeeEmail: string
  isProbation: boolean
  balances: {
    leaveTypeId: string
    leaveTypeName: string
    allocated: number
    used: number
    remaining: number
    locked: number
  }[]
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    if (!hasPermission(user, 'hierarchy:team:read')) {
      return errorResponse('Forbidden', 403)
    }

    const employee = await getEmployeeByUserId(user.id)
    if (!employee) return errorResponse('Employee record not found', 404)

    const { searchParams } = new URL(request.url)
    const managerEmployeeIdParam = searchParams.get('managerEmployeeId')

    let rootEmployeeId = employee.id
    if (managerEmployeeIdParam && managerEmployeeIdParam !== employee.id) {
      const { isManagerOf } = await import('@/lib/hierarchy')
      const inChain = await isManagerOf(employee.id, managerEmployeeIdParam)
      if (!inChain) {
        return errorResponse('You can only view leave data of your direct or indirect reports', 403)
      }
      rootEmployeeId = managerEmployeeIdParam
    }

    const mdAtOwnRoot = user.role === 'MD' && rootEmployeeId === employee.id
    const subordinates = await getSubordinates(rootEmployeeId, !mdAtOwnRoot)
    let subordinateIds = subordinates.map((s) => s.id)
    if (managerEmployeeIdParam && managerEmployeeIdParam !== employee.id) {
      subordinateIds = [managerEmployeeIdParam, ...subordinateIds]
    }
    if (subordinateIds.length === 0) {
      return successResponse({ balances: [] })
    }

    // Batch: 4 queries for ALL subordinates instead of N×4
    const now = new Date()
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const [employees, leaveTypes, approvedLeaves, dbBalances] = await Promise.all([
      prisma.employee.findMany({
        where: { id: { in: subordinateIds } },
        select: {
          id: true,
          joinDate: true,
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.leaveTypeMaster.findMany({
        where: { isActive: true },
        select: { id: true, name: true, monthlyAccrual: true, carryForward: true },
      }),
      prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: subordinateIds },
          status: 'APPROVED',
        },
        select: { employeeId: true, leaveTypeId: true, days: true },
      }),
      prisma.leaveBalance.findMany({
        where: { employeeId: { in: subordinateIds } },
        select: { employeeId: true, leaveTypeId: true, allocated: true },
      }),
    ])

    // Index approved leaves by employee → leaveType
    const usedMap = new Map<string, Map<string, number>>()
    for (const l of approvedLeaves) {
      if (!usedMap.has(l.employeeId)) usedMap.set(l.employeeId, new Map())
      const m = usedMap.get(l.employeeId)!
      m.set(l.leaveTypeId, (m.get(l.leaveTypeId) ?? 0) + l.days)
    }

    // Index DB balances by employee → leaveType
    const dbBalMap = new Map<string, Map<string, number>>()
    for (const b of dbBalances) {
      if (!dbBalMap.has(b.employeeId)) dbBalMap.set(b.employeeId, new Map())
      dbBalMap.get(b.employeeId)!.set(b.leaveTypeId, b.allocated)
    }

    const result: TeamLeaveBalance[] = employees.map((emp) => {
      const isProbation = emp.joinDate ? emp.joinDate > sixMonthsAgo : false
      const empUsed = usedMap.get(emp.id)
      const empDbBal = dbBalMap.get(emp.id)

      const balances = leaveTypes.map((lt) => {
        let allocated = 0
        let locked = 0

        const dbAlloc = empDbBal?.get(lt.id)
        if (dbAlloc !== undefined && !isProbation) {
          allocated = dbAlloc
        } else if (emp.joinDate) {
          const monthsWorked = Math.max(0, differenceInMonths(now, emp.joinDate))
          allocated = monthsWorked * lt.monthlyAccrual
          if (isProbation) locked = allocated
        }

        const used = empUsed?.get(lt.id) ?? 0
        const remaining = Math.max(0, allocated - used)

        return {
          leaveTypeId: lt.id,
          leaveTypeName: lt.name,
          allocated,
          used,
          remaining,
          locked,
        }
      })

      return {
        employeeId: emp.id,
        employeeName: emp.user.name,
        employeeEmail: emp.user.email,
        isProbation,
        balances,
      }
    })

    return successResponse({ balances: result })
  } catch (error) {
    console.error('Error fetching team leave balances:', error)
    return errorResponse('Failed to fetch team leave balances', 500)
  }
}
