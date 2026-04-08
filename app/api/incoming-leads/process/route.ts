import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { processAllPendingLeads, processIncomingLead } from '@/lib/process-incoming-leads'
import { prisma } from '@/lib/prisma'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

/**
 * POST /api/incoming-leads/process
 * Process all pending incoming leads or a specific one
 * 
 * Authentication: 
 * - Session cookie (for browser requests)
 * - Bearer token with CRON_SECRET (for API/curl requests)
 */
export async function POST(request: NextRequest) {
  try {
    // Check for API key authentication first (for curl/automation)
    const authHeader = request.headers.get('authorization')
    const isApiKeyAuth = authHeader?.startsWith('Bearer ') &&
                         authHeader.substring(7) === process.env.CRON_SECRET

    let user = null
    if (!isApiKeyAuth) {
      // Try session-based authentication
      user = getSessionFromRequest(request)
      if (!user) {
        return unauthorizedResponse()
      }

      // Only admins and sales heads can process leads
      if (!hasPermission(user, 'leads:write')) {
        return errorResponse('Forbidden', 403)
      }
    }

    const body = await request.json().catch(() => ({}))
    const { incomingLeadId, autoCreateBD } = body

    // Process specific lead if ID provided
    if (incomingLeadId) {
      const incomingLead = await prisma.incomingLead.findUnique({
        where: { id: incomingLeadId },
      })

      if (!incomingLead) {
        return errorResponse('Incoming lead not found', 404)
      }

      if (incomingLead.status !== 'PENDING') {
        return errorResponse(
          `Lead already ${incomingLead.status.toLowerCase()}`,
          400
        )
      }

      const result = await processIncomingLead(
        incomingLeadId,
        incomingLead.payload as any,
        autoCreateBD === true
      )

      if (result.success) {
        return successResponse(
          { leadId: result.leadId },
          'Lead processed successfully'
        )
      } else {
        return errorResponse(result.error || 'Failed to process lead', 400)
      }
    }

    // Process all pending leads
    const results = await processAllPendingLeads(autoCreateBD === true)

    return successResponse(results, 'Processing completed')
  } catch (error) {
    console.error('Error processing incoming leads:', error)
    return errorResponse('Failed to process leads', 500)
  }
}

/**
 * GET /api/incoming-leads/process
 * Get status of pending incoming leads
 * 
 * Authentication: 
 * - Session cookie (for browser requests)
 * - Bearer token with CRON_SECRET (for API/curl requests)
 */
export async function GET(request: NextRequest) {
  try {
    // Check for API key authentication first (for curl/automation)
    const authHeader = request.headers.get('authorization')
    const isApiKeyAuth = authHeader?.startsWith('Bearer ') &&
                         authHeader.substring(7) === process.env.CRON_SECRET

    let user = null
    if (!isApiKeyAuth) {
      // Try session-based authentication
      user = getSessionFromRequest(request)
      if (!user) {
        return unauthorizedResponse()
      }

      if (!hasPermission(user, 'leads:read')) {
        return errorResponse('Forbidden', 403)
      }
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'PENDING'

    const incomingLeads = await prisma.incomingLead.findMany({
      where: { status },
      orderBy: { receivedAt: 'desc' },
      take: 100,
    })

    return successResponse({
      count: incomingLeads.length,
      leads: incomingLeads,
    })
  } catch (error) {
    console.error('Error fetching incoming leads:', error)
    return errorResponse('Failed to fetch incoming leads', 500)
  }
}

