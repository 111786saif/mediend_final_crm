import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { LedgerStatus, LeaveRequestStatus } from '@/generated/prisma/client'
import { mdPendingNormalizationsWhere } from '@/lib/hrms/normalization-md-pending'
import { hrPendingNormalizationsWhere } from '@/lib/hrms/normalization-hr-pending'
import { getTaskOverviewCount } from '@/lib/tasks/stats-scope'

export interface BadgeCounts {
  pendingFinanceApprovals: number
  unreadMessages: number
  pendingAppointments: number
  pendingTaskReviews: number
  pendingDueDateApprovals: number
  myOverdueTasks: number
  myPendingTasks: number
  pendingLeaveApprovals: number
  pendingTickets: number
  unreadChatMessages: number
  pendingHRActions: number
  pendingNotices: number
  pendingFinanceTeamApprovals: number
  pendingMDApprovals: number
  pendingLeaveBalanceEditRequests: number
  // Granular counts for tab badges
  pendingLeaveRequests: number
  pendingFeedback: number
  pendingIncrementRequests: number
  pendingMDAppointments: number
  pendingMentalHealth: number
  hrPendingFeedback: number
  hrPendingTickets: number
  hrPendingMentalHealth: number
  hrPendingNormalizations: number
  /** Pending attendance normalizations for MD direct reports (MD Attendance). */
  pendingMDTeamNormalizations: number
  hrPendingLeaves: number
  hrPendingIncrements: number
  taskApprovalCount: number
  taskOverdueCount: number
  taskOverviewCount: number
  upcomingMeetsToday: number
  pendingOnboardingApprovals: number
}

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const isMdOrAdmin = user.role === 'MD' || user.role === 'ADMIN'
    const now = new Date()

    const counts: BadgeCounts = {
      pendingFinanceApprovals: 0,
      unreadMessages: 0,
      pendingAppointments: 0,
      pendingTaskReviews: 0,
      pendingDueDateApprovals: 0,
      myOverdueTasks: 0,
      myPendingTasks: 0,
      pendingLeaveApprovals: 0,
      pendingTickets: 0,
      unreadChatMessages: 0,
      pendingHRActions: 0,
      pendingNotices: 0,
      pendingFinanceTeamApprovals: 0,
      pendingMDApprovals: 0,
      pendingLeaveBalanceEditRequests: 0,
      pendingLeaveRequests: 0,
      pendingFeedback: 0,
      pendingIncrementRequests: 0,
      pendingMDAppointments: 0,
      pendingMentalHealth: 0,
      hrPendingFeedback: 0,
      hrPendingTickets: 0,
      hrPendingMentalHealth: 0,
      hrPendingNormalizations: 0,
      pendingMDTeamNormalizations: 0,
      hrPendingLeaves: 0,
      hrPendingIncrements: 0,
      taskApprovalCount: 0,
      taskOverdueCount: 0,
      taskOverviewCount: 0,
      upcomingMeetsToday: 0,
      pendingOnboardingApprovals: 0,
    }

    const promises: Promise<unknown>[] = []

    // Employee lookup for employee-level counts
    const empPromise = prisma.employee.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })

    // Employee-level: own PENDING leave requests
    promises.push(
      empPromise.then(async (emp) => {
        if (!emp) return
        const c = await prisma.leaveRequest.count({
          where: { employeeId: emp.id, status: LeaveRequestStatus.PENDING },
        })
        counts.pendingLeaveRequests = c
      })
    )

    // Employee-level: own PENDING feedback
    promises.push(
      empPromise.then(async (emp) => {
        if (!emp) return
        const c = await prisma.feedback.count({
          where: { employeeId: emp.id, status: 'PENDING' },
        })
        counts.pendingFeedback = c
      })
    )

    // Employee-level: own PENDING increment requests
    promises.push(
      empPromise.then(async (emp) => {
        if (!emp) return
        const c = await prisma.incrementRequest.count({
          where: { employeeId: emp.id, status: 'PENDING' },
        })
        counts.pendingIncrementRequests = c
      })
    )

    // Employee-level: own PENDING MD appointments
    promises.push(
      empPromise.then(async (emp) => {
        if (!emp) return
        const c = await prisma.mDAppointment.count({
          where: { employeeId: emp.id, status: 'PENDING' },
        })
        counts.pendingMDAppointments = c
      })
    )

    // Employee-level: own PENDING mental health requests
    promises.push(
      empPromise.then(async (emp) => {
        if (!emp) return
        const c = await prisma.mentalHealthRequest.count({
          where: { employeeId: emp.id, status: 'PENDING' },
        })
        counts.pendingMentalHealth = c
      })
    )

    // HR-level: all PENDING feedback (for HR Engagement tab)
    if (hasPermission(user, 'hrms:employees:read')) {
      promises.push(
        prisma.feedback.count({ where: { status: 'PENDING' } }).then((c) => {
          counts.hrPendingFeedback = c
        })
      )
      promises.push(
        prisma.supportTicket.count({ where: { status: 'OPEN' } }).then((c) => {
          counts.hrPendingTickets = c
        })
      )
      promises.push(
        prisma.mentalHealthRequest.count({ where: { status: 'PENDING' } }).then((c) => {
          counts.hrPendingMentalHealth = c
        })
      )
    }

    // HR-level: PENDING normalizations ready for HR action (for HR Attendance tab)
    if (hasPermission(user, 'hrms:attendance:write')) {
      promises.push(
        prisma.attendanceNormalization
          .count({
            where: hrPendingNormalizationsWhere(),
          })
          .then((c) => {
            counts.hrPendingNormalizations = c
          })
      )
    }

    // HR-level: all PENDING leave requests (for HR Attendance tab)
    if (hasPermission(user, 'hrms:leaves:write') || hasPermission(user, 'hrms:leaves:read')) {
      promises.push(
        prisma.leaveRequest.count({ where: { status: LeaveRequestStatus.PENDING } }).then((c) => {
          counts.hrPendingLeaves = c
        })
      )
    }

    // HR-level: all PENDING increment requests (for HR Compensation tab)
    if (hasPermission(user, 'hrms:employees:read')) {
      promises.push(
        prisma.incrementRequest.count({ where: { status: 'PENDING' } }).then((c) => {
          counts.hrPendingIncrements = c
        })
      )
    }

    // Finance approvals: only for users with finance:approve
    if (hasPermission(user, 'finance:approve')) {
      promises.push(
        prisma.ledgerEntry
          .count({
            where: {
              isDeleted: false,
              status: LedgerStatus.PENDING,
              transactionType: 'DEBIT',
            },
          })
          .then((c) => {
            counts.pendingFinanceApprovals = c
          })
      )
      promises.push(
        prisma.ledgerEntry
          .count({
            where: {
              isDeleted: false,
              status: LedgerStatus.APPROVED,
              editRequestStatus: LedgerStatus.PENDING,
            },
          })
          .then((c) => {
            counts.pendingFinanceApprovals += c
          })
      )
      promises.push(
        prisma.ledgerEntry
          .count({
            where: {
              isDeleted: false,
              status: LedgerStatus.APPROVED,
              deleteRequestStatus: LedgerStatus.PENDING,
            },
          })
          .then((c) => {
            counts.pendingFinanceApprovals += c
          })
      )
    }

    // Anonymous messages (MD/ADMIN only)
    if (isMdOrAdmin) {
      promises.push(
        prisma.anonymousMessage.count({ where: { isRead: false } }).then((c) => {
          counts.unreadMessages = c
        })
      )
      promises.push(
        prisma.mDAppointment.count({ where: { status: 'PENDING' } }).then((c) => {
          counts.pendingAppointments = c
        })
      )
    }

    // Task reviews: EMPLOYEE_DONE tasks (MD/ADMIN see all, others see only tasks they created)
    if (isMdOrAdmin) {
      promises.push(
        prisma.task.count({ where: { status: 'EMPLOYEE_DONE' } }).then((c) => {
          counts.pendingTaskReviews = c
        })
      )
    } else {
      promises.push(
        prisma.task
          .count({
            where: { status: 'EMPLOYEE_DONE', createdById: user.id },
          })
          .then((c) => {
            counts.pendingTaskReviews = c
          })
      )
    }

    // Due date approvals (MD/ADMIN see all PENDING, others only where they created the task)
    if (isMdOrAdmin) {
      promises.push(
        prisma.taskDueDateApproval.count({ where: { status: 'PENDING' } }).then((c) => {
          counts.pendingDueDateApprovals = c
        })
      )
    } else {
      promises.push(
        prisma.taskDueDateApproval.count({
          where: { status: 'PENDING', task: { createdById: user.id } },
        }).then((c) => {
          counts.pendingDueDateApprovals = c
        })
      )
    }

    // My overdue tasks: assigned to me, status PENDING or IN_PROGRESS, dueDate < now
    promises.push(
      prisma.task.count({
        where: {
          assigneeId: user.id,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          dueDate: { lt: now },
        },
      }).then((c) => {
        counts.myOverdueTasks = c
      })
    )

    // My pending tasks: assigned to me, not completed
    promises.push(
      prisma.task.count({
        where: {
          assigneeId: user.id,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
        },
      }).then((c) => {
        counts.myPendingTasks = c
      })
    )

    // Pending leave approvals: user is target approver or has HR leave permissions
    if (hasPermission(user, 'hrms:leaves:write') || hasPermission(user, 'hierarchy:leave:approve')) {
      const empPromise = prisma.employee.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      const hrOverride = hasPermission(user, 'hrms:leaves:write')
      promises.push(
        empPromise.then(async (employee) => {
          const leaveWhere: { status: (typeof LeaveRequestStatus)[keyof typeof LeaveRequestStatus]; targetApproverId?: string } = { status: LeaveRequestStatus.PENDING }
          if (!hrOverride && employee) {
            leaveWhere.targetApproverId = employee.id
          } else if (!hrOverride) {
            return
          }
          const c = await prisma.leaveRequest.count({ where: leaveWhere })
          counts.pendingLeaveApprovals = c
        })
      )
    }

    // Pending tickets: for department heads, tickets targeted at their role
    const headRoles = ['HR_HEAD', 'FINANCE_HEAD', 'SALES_HEAD', 'INSURANCE_HEAD', 'PL_HEAD', 'OUTSTANDING_HEAD', 'DIGITAL_MARKETING_HEAD', 'IT_HEAD']
    if (headRoles.includes(user.role)) {
      promises.push(
        prisma.supportTicket.count({
          where: { status: 'OPEN', targetHeadRole: user.role },
        }).then((c) => {
          counts.pendingTickets = c
        })
      )
    }

    // Unread chat messages: calculate unread lead conversations from CaseChatMessage & ChatReadReceipt
    const chatRoles = [
      'BD',
      'INSURANCE',
      'INSURANCE_HEAD',
      'PL_HEAD',
      'PL_ENTRY',
      'PL_VIEWER',
      'ACCOUNTS',
      'TEAM_LEAD',
      'ASSISTANT_CATEGORY_MANAGER',
      'CATEGORY_MANAGER',
      'SALES_HEAD',
    ]
    if (chatRoles.includes(user.role) || user.role === 'ADMIN') {
      promises.push(
        (async () => {
          const receipts = await prisma.chatReadReceipt.findMany({
            where: { userId: user.id },
            select: { leadId: true, lastReadAt: true },
          })
          const receiptMap = new Map(receipts.map((r) => [r.leadId, r.lastReadAt]))

          const latestMessagesFromOthers = await prisma.caseChatMessage.groupBy({
            by: ['leadId'],
            where: {
              senderId: { not: user.id },
            },
            _max: { createdAt: true },
          })

          if (latestMessagesFromOthers.length === 0) {
            counts.unreadChatMessages = 0
            return
          }

          let unreadLeadCount = 0
          for (const msg of latestMessagesFromOthers) {
            const lastRead = receiptMap.get(msg.leadId)
            const latestMessageTime = msg._max.createdAt
            if (latestMessageTime) {
              if (!lastRead || latestMessageTime > lastRead) {
                unreadLeadCount++
              }
            }
          }

          counts.unreadChatMessages = unreadLeadCount
        })()
      )
    }

    // Pending HR actions: feedback + increment + normalization (for HR_HEAD)
    if (user.role === 'HR_HEAD') {
      promises.push(
        Promise.all([
          prisma.feedback.count({ where: { status: 'PENDING' } }),
          prisma.incrementRequest.count({ where: { status: 'PENDING' } }),
          prisma.attendanceNormalization.count({
            where: hrPendingNormalizationsWhere(),
          }),
        ]).then(([f, i, n]) => {
          counts.pendingHRActions = f + i + n
        })
      )
    }

    // Pending onboarding approvals (HR / Admin / MD)
    if (
      user.role === 'HR_HEAD' ||
      user.role === 'ADMIN' ||
      user.role === 'MD' ||
      hasPermission(user, 'hrms:employees:write')
    ) {
      promises.push(
        prisma.employee
          .count({ where: { onboardingStatus: 'PENDING_APPROVAL' } })
          .then((c) => {
            counts.pendingOnboardingApprovals = c
          })
      )
    }

    // Pending notices: unacknowledged notices for user
    promises.push(
      prisma.noticeRecipient.count({
        where: { userId: user.id, acknowledgedAt: null },
      }).then((c) => {
        counts.pendingNotices = c
      })
    )

    // Pending finance team approvals: MD-approved requests with amount needing finance ack
    if (user.role === 'FINANCE_HEAD') {
      promises.push(
        prisma.mDApprovalRequest.count({
          where: {
            status: 'APPROVED',
            amount: { not: null },
            financeAcknowledged: false,
          },
        }).then((c) => {
          counts.pendingFinanceTeamApprovals = c
        })
      )
    }

    // Pending MD approvals + MD-team normalizations (MD role only; needs employee row)
    if (user.role === 'MD' || user.role === 'ADMIN') {
      promises.push(
        prisma.mDApprovalRequest.count({ where: { status: 'PENDING' } }).then((c) => {
          counts.pendingMDApprovals = c
        })
      )
      promises.push(
        prisma.leaveBalanceEditRequest.count({ where: { status: 'PENDING' } }).then((c) => {
          counts.pendingLeaveBalanceEditRequests = c
        })
      )
    }
    if (user.role === 'MD') {
      promises.push(
        prisma.employee
          .findUnique({
            where: { userId: user.id },
            select: { id: true },
          })
          .then((emp) => {
            if (!emp) return
            return prisma.attendanceNormalization
              .count({ where: mdPendingNormalizationsWhere(emp.id) })
              .then((c) => {
                counts.pendingMDTeamNormalizations = c
              })
          })
      )
    }

    // Upcoming meets today (for mobile nav badge)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date()
    todayEnd.setHours(23, 59, 59, 999)
    promises.push(
      prisma.meet.count({
        where: {
          scheduledAt: { gte: new Date(), lte: todayEnd },
          OR: [
            { createdById: user.id },
            { participants: { some: { userId: user.id } } },
          ],
        },
      }).then((c) => {
        counts.upcomingMeetsToday = c
      })
    )

    // Task overview count (team approvals + overdue — matches Overview tab)
    promises.push(
      getTaskOverviewCount(user).then((c) => {
        counts.taskOverviewCount = c
      })
    )

    await Promise.all(promises)

    // Derived: task tab badges (from existing counts)
    counts.taskApprovalCount = counts.pendingTaskReviews + counts.pendingDueDateApprovals
    counts.taskOverdueCount = counts.myOverdueTasks

    return successResponse(counts)
  } catch (error) {
    console.error('Error fetching badge counts:', error)
    return errorResponse('Failed to fetch badge counts', 500)
  }
}
