import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { TransactionType, LedgerStatus } from '@/generated/prisma/client'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'finance:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type') || 'payment-mode'
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate)
    }

    switch (reportType) {
      case 'payment-mode': {
        // Payment mode balance summary
        const paymentModes = await prisma.paymentModeMaster.findMany({
          where: { isActive: true },
          include: {
            ledgerEntries: {
              where: {
                status: LedgerStatus.APPROVED,
                ...(Object.keys(dateFilter).length > 0 && {
                  transactionDate: dateFilter,
                }),
                OR: [
                  {
                    transactionType: TransactionType.DEBIT,
                  },
                  {
                    transactionType: TransactionType.CREDIT,
                    paymentType: {
                      paymentType: {
                        not: 'RECEIPT',
                      },
                    },
                    paymentTypeId: { not: null },
                  },
                ],
              },
              select: {
                transactionType: true,
                paymentAmount: true,
                receivedAmount: true,
                paymentType: {
                  select: {
                    paymentType: true,
                  },
                },
              },
            },
          },
        })

        const summary = paymentModes.map((mode) => {
          const totalCredits = mode.ledgerEntries
            .filter((e) => e.transactionType === TransactionType.CREDIT)
            .filter((e) => e.paymentType?.paymentType !== 'RECEIPT')
            .reduce((sum, e) => sum + (e.receivedAmount || 0), 0)

          const totalDebits = mode.ledgerEntries
            .filter((e) => e.transactionType === TransactionType.DEBIT)
            .reduce((sum, e) => sum + (e.paymentAmount || 0), 0)

          return {
            id: mode.id,
            name: mode.name,
            openingBalance: mode.openingBalance,
            currentBalance: mode.currentBalance,
            totalCredits,
            totalDebits,
            netChange: totalCredits - totalDebits,
          }
        })

        return successResponse({
          type: 'payment-mode',
          data: summary,
          totals: {
            totalCredits: summary.reduce((sum, s) => sum + s.totalCredits, 0),
            totalDebits: summary.reduce((sum, s) => sum + s.totalDebits, 0),
            totalBalance: summary.reduce((sum, s) => sum + s.currentBalance, 0),
          },
        })
      }

      case 'party-wise': {
        // Party-wise summary - Exclude SELF_TRANSFER and RECEIPT payment type
        const entries = await prisma.ledgerEntry.groupBy({
          by: ['partyId', 'transactionType'],
          where: {
            status: LedgerStatus.APPROVED,
            transactionType: {
              in: [TransactionType.CREDIT, TransactionType.DEBIT],
            },
            ...(Object.keys(dateFilter).length > 0 && {
              transactionDate: dateFilter,
            }),
            OR: [
              {
                transactionType: TransactionType.DEBIT,
              },
              {
                transactionType: TransactionType.CREDIT,
                paymentType: {
                  paymentType: {
                    not: 'RECEIPT',
                  },
                },
              },
            ],
          },
          _sum: {
            paymentAmount: true,
            receivedAmount: true,
          },
          _count: true,
        })

        // Get party names
        const partyIds = [...new Set(entries.map((e) => e.partyId).filter((id): id is string => id !== null))]
        const parties = await prisma.partyMaster.findMany({
          where: { id: { in: partyIds } },
          select: { id: true, name: true, partyType: true },
        })
        const partyMap = new Map(parties.map((p) => [p.id, p]))

        // Aggregate by party
        const partyData = new Map<
          string,
          {
            partyId: string
            partyName: string
            partyType: string
            totalCredits: number
            totalDebits: number
            entriesCount: number
          }
        >()

        entries.forEach((entry) => {
          // Ensure entry.partyId is a string before using as Map key
          if (!entry.partyId) return;
          const party = partyMap.get(entry.partyId)
          if (!party) return

          const existing = partyData.get(entry.partyId) || {
            partyId: entry.partyId,
            partyName: party.name,
            partyType: party.partyType,
            totalCredits: 0,
            totalDebits: 0,
            entriesCount: 0,
          }

          if (entry.transactionType === TransactionType.CREDIT) {
            existing.totalCredits += entry._sum.receivedAmount || 0
          } else if (entry.transactionType === TransactionType.DEBIT) {
            existing.totalDebits += entry._sum.paymentAmount || 0
          }
          existing.entriesCount += entry._count

          partyData.set(entry.partyId, existing)
        })

        const summary = Array.from(partyData.values()).map((p) => ({
          ...p,
          netAmount: p.totalCredits - p.totalDebits,
        }))

        return successResponse({
          type: 'party-wise',
          data: summary,
          totals: {
            totalCredits: summary.reduce((sum, s) => sum + s.totalCredits, 0),
            totalDebits: summary.reduce((sum, s) => sum + s.totalDebits, 0),
            entriesCount: summary.reduce((sum, s) => sum + s.entriesCount, 0),
          },
        })
      }

      case 'head-wise': {
        // Head-wise summary - Exclude SELF_TRANSFER and RECEIPT payment type
        const entries = await prisma.ledgerEntry.groupBy({
          by: ['headId', 'transactionType'],
          where: {
            status: LedgerStatus.APPROVED,
            transactionType: {
              in: [TransactionType.CREDIT, TransactionType.DEBIT],
            },
            ...(Object.keys(dateFilter).length > 0 && {
              transactionDate: dateFilter,
            }),
            OR: [
              {
                transactionType: TransactionType.DEBIT,
              },
              {
                transactionType: TransactionType.CREDIT,
                paymentType: {
                  paymentType: {
                    not: 'RECEIPT',
                  },
                },
              },
            ],
          },
          _sum: {
            paymentAmount: true,
            componentA: true,
            receivedAmount: true,
          },
          _count: true,
        })

        // Get head names
        const headIds = [...new Set(entries.map((e) => e.headId).filter((id): id is string => id !== null))]
        const heads = await prisma.headMaster.findMany({
          where: { id: { in: headIds } },
          select: { id: true, name: true, department: true },
        })
        const headMap = new Map(heads.map((h) => [h.id, h]))

        // Aggregate by head
        const headData = new Map<
          string,
          {
            headId: string
            headName: string
            department: string | null
            totalCredits: number
            totalExpenses: number
            entriesCount: number
          }
        >()

        entries.forEach((entry) => {
          // Ensure entry.headId is a string before using as Map key
          if (!entry.headId) return;
          const head = headMap.get(entry.headId)
          if (!head) return

          const existing = headData.get(entry.headId) || {
            headId: entry.headId,
            headName: head.name,
            department: head.department,
            totalCredits: 0,
            totalExpenses: 0,
            entriesCount: 0,
          }

          if (entry.transactionType === TransactionType.CREDIT) {
            existing.totalCredits += entry._sum.receivedAmount || 0
          } else if (entry.transactionType === TransactionType.DEBIT) {
            existing.totalExpenses += entry._sum.componentA || 0
          }
          existing.entriesCount += entry._count

          headData.set(entry.headId, existing)
        })

        const summary = Array.from(headData.values()).map((h) => ({
          ...h,
          netAmount: h.totalCredits - h.totalExpenses,
        }))

        return successResponse({
          type: 'head-wise',
          data: summary,
          totals: {
            totalCredits: summary.reduce((sum, s) => sum + s.totalCredits, 0),
            totalExpenses: summary.reduce((sum, s) => sum + s.totalExpenses, 0),
            entriesCount: summary.reduce((sum, s) => sum + s.entriesCount, 0),
          },
        })
      }

      case 'expense-report': {
        // Expense report - Only DEBIT entries with componentA > 0, no credits
        const entries = await prisma.ledgerEntry.groupBy({
          by: ['headId'],
          where: {
            status: LedgerStatus.APPROVED,
            transactionType: TransactionType.DEBIT,
            componentA: { gt: 0 },
            ...(Object.keys(dateFilter).length > 0 && {
              transactionDate: dateFilter,
            }),
          },
          _sum: {
            componentA: true,
          },
          _count: true,
        })

        // Get head names
        const headIds = [...new Set(entries.map((e) => e.headId).filter((id): id is string => id !== null))]
        const heads = await prisma.headMaster.findMany({
          where: { id: { in: headIds } },
          select: { id: true, name: true, department: true },
        })
        const headMap = new Map(heads.map((h) => [h.id, h]))

        // Aggregate by head
        const summary = entries
          .filter((entry) => entry.headId !== null)
          .map((entry) => {
            const head = headMap.get(entry.headId!)
            return {
              headId: entry.headId!,
              headName: head?.name || 'Unknown',
              department: head?.department || null,
              totalExpenses: entry._sum.componentA || 0,
              entriesCount: entry._count,
            }
          })
          .sort((a, b) => b.totalExpenses - a.totalExpenses)

        return successResponse({
          type: 'expense-report',
          data: summary,
          totals: {
            totalExpenses: summary.reduce((sum, s) => sum + s.totalExpenses, 0),
            entriesCount: summary.reduce((sum, s) => sum + s.entriesCount, 0),
          },
        })
      }

      case 'non-expense-report': {
        // Non-Expense report - Only DEBIT entries with componentB > 0, no credits
        const entries = await prisma.ledgerEntry.groupBy({
          by: ['headId'],
          where: {
            status: LedgerStatus.APPROVED,
            transactionType: TransactionType.DEBIT,
            componentB: { gt: 0 },
            ...(Object.keys(dateFilter).length > 0 && {
              transactionDate: dateFilter,
            }),
          },
          _sum: {
            componentB: true,
          },
          _count: true,
        })

        const headIds = [...new Set(entries.map((e) => e.headId).filter((id): id is string => id !== null))]
        const heads = await prisma.headMaster.findMany({
          where: { id: { in: headIds } },
          select: { id: true, name: true, department: true },
        })
        const headMap = new Map(heads.map((h) => [h.id, h]))

        const summary = entries
          .filter((entry) => entry.headId !== null)
          .map((entry) => {
            const head = headMap.get(entry.headId!)
            return {
              headId: entry.headId!,
              headName: head?.name || 'Unknown',
              department: head?.department || null,
              totalExpenses: entry._sum.componentB || 0,
              entriesCount: entry._count,
            }
          })
          .sort((a, b) => b.totalExpenses - a.totalExpenses)

        return successResponse({
          type: 'non-expense-report',
          data: summary,
          totals: {
            totalExpenses: summary.reduce((sum, s) => sum + s.totalExpenses, 0),
            entriesCount: summary.reduce((sum, s) => sum + s.entriesCount, 0),
          },
        })
      }

      case 'day-wise': {
        // Day-wise summary - Exclude SELF_TRANSFER and RECEIPT payment type
        const entries = await prisma.ledgerEntry.findMany({
          where: {
            status: LedgerStatus.APPROVED,
            transactionType: {
              in: [TransactionType.CREDIT, TransactionType.DEBIT],
            },
            ...(Object.keys(dateFilter).length > 0 && {
              transactionDate: dateFilter,
            }),
            OR: [
              {
                transactionType: TransactionType.DEBIT,
              },
              {
                transactionType: TransactionType.CREDIT,
                paymentType: {
                  paymentType: {
                    not: 'RECEIPT',
                  },
                },
              },
            ],
          },
          select: {
            transactionDate: true,
            transactionType: true,
            paymentAmount: true,
            receivedAmount: true,
          },
          orderBy: { transactionDate: 'desc' },
        })

        // Group by date
        const dayData = new Map<
          string,
          {
            date: string
            totalCredits: number
            totalDebits: number
            entriesCount: number
          }
        >()

        entries.forEach((entry) => {
          const dateKey = entry.transactionDate.toISOString().split('T')[0]

          const existing = dayData.get(dateKey) || {
            date: dateKey,
            totalCredits: 0,
            totalDebits: 0,
            entriesCount: 0,
          }

          if (entry.transactionType === TransactionType.CREDIT) {
            existing.totalCredits += entry.receivedAmount || 0
          } else if (entry.transactionType === TransactionType.DEBIT) {
            existing.totalDebits += entry.paymentAmount || 0
          }
          existing.entriesCount += 1

          dayData.set(dateKey, existing)
        })

        const summary = Array.from(dayData.values())
          .map((d) => ({
            ...d,
            netChange: d.totalCredits - d.totalDebits,
          }))
          .sort((a, b) => b.date.localeCompare(a.date))

        return successResponse({
          type: 'day-wise',
          data: summary,
          totals: {
            totalCredits: summary.reduce((sum, s) => sum + s.totalCredits, 0),
            totalDebits: summary.reduce((sum, s) => sum + s.totalDebits, 0),
            entriesCount: summary.reduce((sum, s) => sum + s.entriesCount, 0),
          },
        })
      }

      case 'revenue': {
        // Revenue report - From SalesEntry grouped by project
        const entries = await prisma.salesEntry.groupBy({
          by: ['projectId'],
          where: {
            isDeleted: false,
            ...(Object.keys(dateFilter).length > 0 && {
              transactionDate: dateFilter,
            }),
          },
          _sum: {
            amount: true,
          },
          _count: true,
        })

        // Get project names
        const projectIds = [...new Set(entries.map((e) => e.projectId).filter((id): id is string => id !== null))]
        const projects = await prisma.projectMaster.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, name: true, description: true },
        })
        const projectMap = new Map(projects.map((p) => [p.id, p]))

        // Aggregate by project
        const summary = entries
          .filter((entry) => entry.projectId !== null)
          .map((entry) => {
            const project = projectMap.get(entry.projectId!)
            return {
              projectId: entry.projectId!,
              projectName: project?.name || 'Unknown',
              totalRevenue: entry._sum.amount || 0,
              entriesCount: entry._count,
            }
          })
          .sort((a, b) => b.totalRevenue - a.totalRevenue)

        return successResponse({
          type: 'revenue',
          data: summary,
          totals: {
            totalRevenue: summary.reduce((sum, s) => sum + s.totalRevenue, 0),
            entriesCount: summary.reduce((sum, s) => sum + s.entriesCount, 0),
          },
        })
      }

      case 'profit-loss': {
        // P/L Report - Revenue (from SalesEntry by Project) and Expenses (from LedgerEntry componentA by Head)
        const dateWhere = Object.keys(dateFilter).length > 0 ? { transactionDate: dateFilter } : {}

        // Revenue by project (SalesEntry)
        const revenueByProjectEntries = await prisma.salesEntry.groupBy({
          by: ['projectId'],
          where: {
            isDeleted: false,
            ...dateWhere,
          },
          _sum: { amount: true },
          _count: true,
        })
        const revenueProjectIds = [...new Set(revenueByProjectEntries.map((e) => e.projectId).filter((id): id is string => id !== null))]
        const revenueProjects = await prisma.projectMaster.findMany({
          where: { id: { in: revenueProjectIds } },
          select: { id: true, name: true },
        })
        const revenueProjectMap = new Map(revenueProjects.map((p) => [p.id, p]))
        const revenueByProject = revenueByProjectEntries
          .filter((e) => e.projectId !== null)
          .map((e) => ({
            projectId: e.projectId!,
            projectName: revenueProjectMap.get(e.projectId!)?.name || 'Unknown',
            totalRevenue: e._sum.amount || 0,
            entriesCount: e._count,
          }))
          .sort((a, b) => b.totalRevenue - a.totalRevenue)

        // Expenses by head (LedgerEntry DEBIT, componentA)
        const expensesByHeadEntries = await prisma.ledgerEntry.groupBy({
          by: ['headId'],
          where: {
            status: LedgerStatus.APPROVED,
            transactionType: TransactionType.DEBIT,
            componentA: { gt: 0 },
            ...dateWhere,
          },
          _sum: { componentA: true },
          _count: true,
        })
        const expenseHeadIds = [...new Set(expensesByHeadEntries.map((e) => e.headId).filter((id): id is string => id !== null))]
        const expenseHeads = await prisma.headMaster.findMany({
          where: { id: { in: expenseHeadIds } },
          select: { id: true, name: true, department: true },
        })
        const expenseHeadMap = new Map(expenseHeads.map((h) => [h.id, h]))
        const expensesByHead = expensesByHeadEntries
          .filter((e) => e.headId !== null)
          .map((e) => ({
            headId: e.headId!,
            headName: expenseHeadMap.get(e.headId!)?.name || 'Unknown',
            department: expenseHeadMap.get(e.headId!)?.department || null,
            totalExpenses: e._sum.componentA || 0,
            entriesCount: e._count,
          }))
          .sort((a, b) => b.totalExpenses - a.totalExpenses)

        const totalRevenue = revenueByProject.reduce((sum, s) => sum + s.totalRevenue, 0)
        const totalExpenses = expensesByHead.reduce((sum, s) => sum + s.totalExpenses, 0)

        return successResponse({
          type: 'profit-loss',
          data: [],
          revenueByProject,
          expensesByHead,
          totals: {
            totalRevenue,
            totalExpenses,
            netProfitLoss: totalRevenue - totalExpenses,
          },
        })
      }

      default:
        return errorResponse('Invalid report type', 400)
    }
  } catch (error) {
    console.error('Error generating report:', error)
    return errorResponse('Failed to generate report', 500)
  }
}

