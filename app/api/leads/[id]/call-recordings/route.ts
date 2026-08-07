import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canUserViewLeadOwner } from '@/lib/lead-ownership'

type CallRecordingItem = {
  id: string
  recordingUrl: string
  createdAt: string
  agentName?: string | null
  agentRole?: string | null
  summary?: string | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, 'leads:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: {
        id: true,
        bdId: true,
        phoneNumber: true,
        alternateNumber: true,
      },
    })

    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    if (!(await canUserViewLeadOwner(user, lead.bdId))) {
      return errorResponse('Forbidden', 403)
    }

    const phoneDigits = lead.phoneNumber ? lead.phoneNumber.replace(/\D+/g, '').slice(-10) : ''

    const logs = await prisma.crmActivityLog.findMany({
      where: {
        OR: [
          { entityId: lead.id, action: 'KNOWLARITY_CALL_RECORDING' },
          { entityId: lead.id },
          phoneDigits
            ? {
                action: 'KNOWLARITY_CALL_RECORDING',
              }
            : { id: '__none__' },
        ],
      },
      include: {
        actorUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    const recordings: CallRecordingItem[] = []
    const seenUrls = new Set<string>()

    for (const log of logs) {
      const meta = (log.metadata ?? {}) as Record<string, unknown>
      const url =
        typeof meta.callRecordingUrl === 'string' && meta.callRecordingUrl.startsWith('http')
          ? meta.callRecordingUrl
          : typeof meta.recordingUrl === 'string' && meta.recordingUrl.startsWith('http')
          ? meta.recordingUrl
          : typeof meta.call_recording === 'string' && meta.call_recording.startsWith('http')
          ? meta.call_recording
          : null

      if (!url || seenUrls.has(url)) continue
      seenUrls.add(url)

      recordings.push({
        id: log.id,
        recordingUrl: url,
        createdAt: log.createdAt.toISOString(),
        agentName: log.actorUser?.name ?? null,
        agentRole: log.actorRole ?? null,
        summary: log.summary,
      })
    }

    return successResponse({ recordings })
  } catch (error) {
    console.error('GET /api/leads/[id]/call-recordings error:', error)
    return errorResponse('Failed to fetch call recordings', 500)
  }
}
