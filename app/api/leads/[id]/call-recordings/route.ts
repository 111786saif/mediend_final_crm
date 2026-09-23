import { leadIdSchema } from '@/lib/lead-id'
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

function extractLast10Digits(raw: string | null | undefined): string {
  if (!raw) return ''
  const digits = String(raw).replace(/\D+/g, '')
  if (digits.length >= 10) return digits.slice(-10)
  return digits
}

function isRoleAboveBD(role: string | null | undefined): boolean {
  if (!role) return false
  const r = role.toUpperCase().trim()
  return r !== 'BD'
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

    // Role Hierarchy Enforcement: Only roles strictly above BD are allowed to view call recordings
    if (!isRoleAboveBD(user.role)) {
      return errorResponse('Call recordings are restricted to roles above BD in hierarchy', 403)
    }

    if (user.role !== 'SUPER_ADMIN' && !hasPermission(user, 'leads:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { id: rawLeadId } = await params
    const parsedLeadId = leadIdSchema.safeParse(rawLeadId)
    if (!parsedLeadId.success) return errorResponse('Invalid lead ID', 400)
    const id = parsedLeadId.data
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

    const leadPhoneDigits = extractLast10Digits(lead.phoneNumber)
    const altPhoneDigits = extractLast10Digits(lead.alternateNumber)

    // Strict Per-Patient Query: Only recordings linked to lead.id or this patient's phone numbers
    const logs = await prisma.crmActivityLog.findMany({
      where: {
        action: 'KNOWLARITY_CALL_RECORDING',
        OR: [
          { entityId: String(lead.id) },
          leadPhoneDigits ? { entityId: leadPhoneDigits } : { id: '__none__' },
          altPhoneDigits ? { entityId: altPhoneDigits } : { id: '__none__' },
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

    // Fetch all Users & Employees to accurately resolve agent names by phone
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        employee: {
          select: {
            knowlarityPhoneNumber: true,
            knowlarityCallerId: true,
          },
        },
      },
    })

    const phoneToAgentMap = new Map<string, string>()
    for (const u of users) {
      if (u.name) {
        const p1 = extractLast10Digits(u.phoneNumber)
        const p2 = extractLast10Digits(u.employee?.knowlarityPhoneNumber)
        const p3 = extractLast10Digits(u.employee?.knowlarityCallerId)

        if (p1) phoneToAgentMap.set(p1, u.name)
        if (p2) phoneToAgentMap.set(p2, u.name)
        if (p3) phoneToAgentMap.set(p3, u.name)
      }
    }

    const recordings: CallRecordingItem[] = []
    const seenUrls = new Set<string>()

    for (const log of logs) {
      const meta = (log.metadata ?? {}) as Record<string, unknown>
      const payload = (meta.payload ?? {}) as Record<string, unknown>

      const url =
        typeof meta.callRecordingUrl === 'string' && meta.callRecordingUrl.startsWith('http')
          ? meta.callRecordingUrl
          : typeof meta.recordingUrl === 'string' && meta.recordingUrl.startsWith('http')
          ? meta.recordingUrl
          : typeof meta.call_recording === 'string' && meta.call_recording.startsWith('http')
          ? meta.call_recording
          : typeof payload.call_recording === 'string' && payload.call_recording.startsWith('http')
          ? payload.call_recording
          : null

      if (!url || seenUrls.has(url)) continue

      // Verify that recording customer phone number strictly matches THIS patient
      const logCustomerPhone =
        (typeof meta.customerPhone === 'string' && extractLast10Digits(meta.customerPhone)) ||
        (typeof payload.customer_number === 'string' && extractLast10Digits(payload.customer_number)) ||
        (typeof payload.caller === 'string' && extractLast10Digits(payload.caller)) ||
        (typeof log.entityId === 'string' && extractLast10Digits(log.entityId)) ||
        ''

      if (log.entityId !== String(lead.id)) {
        if (!logCustomerPhone) continue
        if (logCustomerPhone !== leadPhoneDigits && logCustomerPhone !== altPhoneDigits) {
          continue
        }
      }

      seenUrls.add(url)

      // Resolve actual agent name from metadata agentPhone or payload agent_number
      const rawAgentPhone =
        (typeof meta.agentPhone === 'string' && meta.agentPhone) ||
        (typeof payload.agent_number === 'string' && payload.agent_number) ||
        (typeof payload.agent_phone === 'string' && payload.agent_phone) ||
        null

      const agentPhoneDigits = extractLast10Digits(rawAgentPhone)
      let resolvedAgentName = typeof meta.agentName === 'string' ? meta.agentName : null

      if (!resolvedAgentName && agentPhoneDigits) {
        resolvedAgentName = phoneToAgentMap.get(agentPhoneDigits) ?? null
      }

      if (!resolvedAgentName) {
        resolvedAgentName = log.actorUser?.name ?? null
      }

      recordings.push({
        id: log.id,
        recordingUrl: url,
        createdAt: log.createdAt.toISOString(),
        agentName: resolvedAgentName,
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
