/**
 * AI Tools - Functions that the AI can call to interact with the system
 */

import { tool } from 'ai'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { Prisma, PipelineStage } from '@/generated/prisma/client'
import { SessionUser } from '@/lib/auth'
import { getSubordinateUserIdsForLeadAccess } from '@/lib/hierarchy'
import { getTableInfo, getAllTables } from './schema-context'

/**
 * Create queryLeads tool with user context
 */
export function createQueryLeadsTool(user: SessionUser) {
  return tool({
    description: 'Query leads/cases with filters. Use this to find leads by status, date range, circle, BD, etc.',
    inputSchema: z.object({
      status: z.string().optional().describe('Lead status filter'),
      pipelineStage: z.enum(['SALES', 'INSURANCE', 'PL', 'COMPLETED', 'LOST']).optional().describe('Pipeline stage'),
      caseStage: z.string().optional().describe('Case stage (NEW_LEAD, KYP_PENDING, etc.)'),
      circle: z.string().optional().describe('Circle filter (e.g. PUNE, Mumbai)'),
      bdId: z.string().optional().describe('BD user ID'),
      startDate: z.string().optional().describe('Start date (ISO format)'),
      endDate: z.string().optional().describe('End date (ISO format)'),
      limit: z.number().max(100).default(50).optional().describe('Max number of results'),
    }),
    execute: async ({ status, pipelineStage, caseStage, circle, bdId, startDate, endDate, limit = 50 }) => {
      const where: Prisma.LeadWhereInput = {}

      // Role-based filtering
      if (user.role === 'BD') {
        where.bdId = user.id
      } else if (user.role === 'TEAM_LEAD') {
        const subIds = await getSubordinateUserIdsForLeadAccess(user.id)
        where.bdId = { in: [user.id, ...subIds] }
      }

      if (status) where.status = status
      if (pipelineStage) where.pipelineStage = pipelineStage as PipelineStage
      if (caseStage) where.caseStage = caseStage as any
      if (circle) where.circle = circle
      if (bdId) where.bdId = bdId

      if (startDate || endDate) {
        where.createdDate = {}
        if (startDate) where.createdDate.gte = new Date(startDate)
        if (endDate) where.createdDate.lte = new Date(endDate)
      }

      const leads = await prisma.lead.findMany({
        where,
        take: limit,
        select: {
          id: true,
          leadRef: true,
          patientName: true,
          phoneNumber: true,
          status: true,
          pipelineStage: true,
          caseStage: true,
          circle: true,
          hospitalName: true,
          treatment: true,
          billAmount: true,
          netProfit: true,
          conversionDate: true,
          createdDate: true,
          source: true,
          bd: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdDate: 'desc' },
      })

      return {
        count: leads.length,
        leads: leads.map(lead => ({
          ...lead,
          conversionDate: lead.conversionDate?.toISOString(),
          createdDate: lead.createdDate.toISOString(),
        })),
      }
    },
  })
}

/**
 * Create queryAnalytics tool with user context
 */
export function createQueryAnalyticsTool(user: SessionUser) {
  return tool({
    description: 'Get dashboard analytics - revenue, profit, conversion rates, trends, etc.',
    inputSchema: z.object({
      metric: z.enum(['dashboard', 'leaderboard', 'source-campaign', 'financial', 'trends']).describe('Analytics metric type'),
      startDate: z.string().optional().describe('Start date (ISO format)'),
      endDate: z.string().optional().describe('End date (ISO format)'),
      circle: z.string().optional().describe('Circle filter (e.g. PUNE, Mumbai)'),
      groupBy: z.enum(['day', 'week', 'month']).optional().describe('Grouping for trends'),
    }),
    execute: async ({ metric, startDate, endDate, circle, groupBy }) => {
      const dateFilter: Prisma.DateTimeFilter = {}
      if (startDate) dateFilter.gte = new Date(startDate)
      if (endDate) dateFilter.lte = new Date(endDate)

      const where: Prisma.LeadWhereInput = {
        pipelineStage: 'COMPLETED',
        conversionDate: dateFilter,
      }

      if (circle) where.circle = circle

      // Role-based filtering
      if (user.role === 'BD') {
        where.bdId = user.id
      } else if (user.role === 'TEAM_LEAD') {
        const subIds = await getSubordinateUserIdsForLeadAccess(user.id)
        where.bdId = { in: [user.id, ...subIds] }
      }

      switch (metric) {
        case 'dashboard': {
          const [totalSurgeries, totalProfit, avgTicketSize, totalLeads] = await Promise.all([
            prisma.lead.count({ where }),
            prisma.lead.aggregate({
              where,
              _sum: { netProfit: true },
            }),
            prisma.lead.aggregate({
              where,
              _avg: { ticketSize: true },
            }),
            prisma.lead.count({
              where: {
                ...where,
                pipelineStage: undefined,
                conversionDate: undefined,
                createdDate: dateFilter,
              },
            }),
          ])

          const conversionRate = totalLeads > 0 ? (totalSurgeries / totalLeads) * 100 : 0

          return {
            totalSurgeries,
            totalProfit: totalProfit._sum.netProfit || 0,
            avgTicketSize: avgTicketSize._avg.ticketSize || 0,
            totalLeads,
            conversionRate: Math.round(conversionRate * 100) / 100,
          }
        }

        case 'leaderboard': {
          const bdPerformance = await prisma.lead.groupBy({
            by: ['bdId'],
            where,
            _count: { id: true },
            _sum: { netProfit: true },
          })

          const bdData = await Promise.all(
            bdPerformance.map(async (bd) => {
              const user = await prisma.user.findUnique({
                where: { id: bd.bdId },
                select: { id: true, name: true, email: true },
              })
              return {
                bdId: bd.bdId,
                bdName: user?.name || 'Unknown',
                closedLeads: bd._count.id,
                netProfit: bd._sum.netProfit || 0,
              }
            })
          )

          return {
            bdPerformance: bdData.sort((a, b) => b.closedLeads - a.closedLeads).slice(0, 10),
          }
        }

        case 'source-campaign': {
          const sourceData = await prisma.lead.groupBy({
            by: ['source'],
            where,
            _count: { id: true },
            _sum: { billAmount: true, netProfit: true },
          })

          return {
            sources: sourceData.map((s) => ({
              source: s.source || 'Unknown',
              leadCount: s._count.id,
              revenue: s._sum.billAmount || 0,
              profit: s._sum.netProfit || 0,
            })),
          }
        }

        default:
          return { message: `Analytics metric "${metric}" not yet implemented in AI tools` }
      }
    },
  })
}

/**
 * Create queryFinance tool with user context
 */
export function createQueryFinanceTool(user: SessionUser) {
  return tool({
    description: 'Query finance ledger entries - transactions, payments, expenses',
    inputSchema: z.object({
      transactionType: z.enum(['CREDIT', 'DEBIT', 'SELF_TRANSFER']).optional().describe('Transaction type'),
      startDate: z.string().optional().describe('Start date (ISO format)'),
      endDate: z.string().optional().describe('End date (ISO format)'),
      status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional().describe('Entry status'),
      limit: z.number().max(100).default(50).optional().describe('Max number of results'),
    }),
    execute: async ({ transactionType, startDate, endDate, status, limit = 50 }) => {
      const where: Prisma.LedgerEntryWhereInput = {}

      if (transactionType) where.transactionType = transactionType
      if (status) where.status = status as any

      if (startDate || endDate) {
        where.transactionDate = {}
        if (startDate) where.transactionDate.gte = new Date(startDate)
        if (endDate) where.transactionDate.lte = new Date(endDate)
      }

      const entries = await prisma.ledgerEntry.findMany({
        where,
        take: limit,
        select: {
          id: true,
          serialNumber: true,
          transactionType: true,
          transactionDate: true,
          description: true,
          paymentAmount: true,
          receivedAmount: true,
          status: true,
          party: {
            select: {
              id: true,
              name: true,
            },
          },
          paymentMode: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { transactionDate: 'desc' },
      })

      return {
        count: entries.length,
        entries: entries.map((entry) => ({
          ...entry,
          transactionDate: entry.transactionDate.toISOString(),
        })),
      }
    },
  })
}

/**
 * Create executeQuery tool
 */
export function createExecuteQueryTool(cookieHeader: string) {
  return tool({
    description: 'Execute a raw SQL SELECT query for complex data analysis. Use this when existing tools are insufficient.',
    inputSchema: z.object({
      query: z.string().describe('SQL SELECT query to execute'),
    }),
    execute: async ({ query }) => {
      // Call the SQL API endpoint
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const sqlResponse = await fetch(`${baseUrl}/api/ai/sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookieHeader || '',
        },
        body: JSON.stringify({ query }),
      })

      if (!sqlResponse.ok) {
        const error = await sqlResponse.json()
        return {
          error: error.error || 'Failed to execute SQL query',
        }
      }

      const data = await sqlResponse.json()
      return data.data || data
    },
  })
}

/**
 * Create getSchemaInfo tool
 */
export function createGetSchemaInfoTool() {
  return tool({
    description: 'Get information about database tables, their fields, and relationships',
    inputSchema: z.object({
      tableName: z.string().optional().describe('Specific table name, or omit to list all tables'),
    }),
    execute: async ({ tableName }) => {
      if (tableName) {
        const info = getTableInfo(tableName)
        if (!info) {
          return {
            error: `Table "${tableName}" not found`,
            availableTables: getAllTables(),
          }
        }
        return info
      }

      return {
        tables: getAllTables(),
        message: 'Use getSchemaInfo with a tableName parameter to get detailed information about a specific table',
      }
    },
  })
}
