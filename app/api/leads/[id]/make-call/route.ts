import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { logCrmActivity } from '@/lib/crm-activity'
import { canUserViewLeadOwner } from '@/lib/lead-ownership'
import {
  getLeadQrClientIp,
  loadLeadForQrAudit,
  normalizeLeadQrPhone,
  parseLeadQrDeviceInfo,
} from '@/lib/lead-qr'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'

const KNOWLARITY_URL =
  process.env.KNOWLARITY_MAKECALL_URL ||
  'https://kpi.knowlarity.com/Basic/v1/account/call/makecall'

async function authorizeLeadAccess(request: NextRequest, id: string) {
  const user = await getSessionWithFreshUser()
  if (!user) {
    return { user: null, lead: null, response: unauthorizedResponse() }
  }

  const lead = await loadLeadForQrAudit(id)
  if (!lead) {
    return { user, lead: null, response: errorResponse('Lead not found', 404) }
  }

  const canAccess = await canUserViewLeadOwner(user, lead.bdId)
  if (!canAccess) {
    return { user, lead, response: errorResponse('Forbidden', 403) }
  }

  return { user, lead, response: null }
}

function getKnowlarityConfig() {
  const authKey = process.env.KNOWLARITY_AUTH_KEY?.trim()
  const apiKey = process.env.KNOWLARITY_X_API_KEY?.trim()
  const kNumber = process.env.KNOWLARITY_K_NUMBER?.trim()
  const callerId = process.env.KNOWLARITY_CALLER_ID?.trim()

  if (!authKey || !apiKey || !kNumber || !callerId) {
    return null
  }

  return { authKey, apiKey, kNumber, callerId }
}

async function resolveActorKnowlaritySettings(userId: string) {
  const actor = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      role: true,
      phoneNumber: true,
    },
  })

  if (!actor) {
    return null
  }

  const employeeRows = await prisma.$queryRaw<
    Array<{
      knowlarityPhoneNumber: string | null
      knowlarityCallerId: string | null
      knowlarityNotificationsEnabled: boolean
    }>
  >`
    SELECT
      "knowlarityPhoneNumber",
      "knowlarityCallerId",
      "knowlarityNotificationsEnabled"
    FROM "Employee"
    WHERE "userId" = ${userId}
    LIMIT 1
  `

  const employee = employeeRows[0] ?? null

  return {
    ...actor,
    knowlarityPhoneNumber: employee?.knowlarityPhoneNumber ?? null,
    knowlarityCallerId: employee?.knowlarityCallerId ?? null,
    knowlarityNotificationsEnabled: employee?.knowlarityNotificationsEnabled ?? false,
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await authorizeLeadAccess(request, id)
    if (auth.response || !auth.user || !auth.lead) {
      return auth.response!
    }

    const config = getKnowlarityConfig()
    if (!config) {
      return errorResponse(
        'Knowlarity calling is not configured. Please set KNOWLARITY_AUTH_KEY, KNOWLARITY_X_API_KEY, KNOWLARITY_K_NUMBER, and KNOWLARITY_CALLER_ID.',
        500
      )
    }

    const actor = await resolveActorKnowlaritySettings(auth.user.id)

    if (!actor) {
      return unauthorizedResponse()
    }

    const customerNumber = normalizeLeadQrPhone(auth.lead.phoneNumber ?? '')
    const agentNumber = normalizeLeadQrPhone(
      actor.knowlarityPhoneNumber ?? actor.phoneNumber ?? ''
    )
    const callerId = actor.knowlarityCallerId?.trim() || config.callerId

    if (!customerNumber) {
      await logCrmActivity({
        action: 'CRM_LEAD_WORKSPACE_CALL_FAILED',
        entityType: 'CRM_LEAD_QR',
        entityId: auth.lead.id,
        entityLabel: auth.lead.patientName || auth.lead.leadRef || auth.lead.id,
        actorUserId: actor.id,
        actorRole: actor.role,
        route: request.nextUrl.pathname,
        method: request.method,
        status: 'FAILED',
        errorMessage: 'Lead does not have a valid phone number.',
        request,
        summary: `Workspace make-call failed for ${auth.lead.patientName || auth.lead.leadRef || 'lead'} because no valid patient phone number was available`,
        metadata: {
          leadRef: auth.lead.leadRef,
          patientName: auth.lead.patientName,
          phoneNumber: auth.lead.phoneNumber,
        },
      })
      return errorResponse('Lead does not have a valid phone number.', 400)
    }

    if (!agentNumber) {
      await logCrmActivity({
        action: 'CRM_LEAD_WORKSPACE_CALL_FAILED',
        entityType: 'CRM_LEAD_QR',
        entityId: auth.lead.id,
        entityLabel: auth.lead.patientName || auth.lead.leadRef || auth.lead.id,
        actorUserId: actor.id,
        actorRole: actor.role,
        route: request.nextUrl.pathname,
        method: request.method,
        status: 'FAILED',
        errorMessage: 'Logged-in user does not have a valid phone number.',
        request,
        summary: `Workspace make-call failed for ${auth.lead.patientName || auth.lead.leadRef || 'lead'} because ${actor.name || 'the logged-in user'} does not have a valid phone number`,
        metadata: {
          leadRef: auth.lead.leadRef,
          patientName: auth.lead.patientName,
          actorPhoneNumber: actor.phoneNumber,
          knowlarityPhoneNumber: actor.knowlarityPhoneNumber,
        },
      })
      return errorResponse('Your Knowlarity number is not configured with a valid phone number.', 400)
    }

    if (!callerId) {
      await logCrmActivity({
        action: 'CRM_LEAD_WORKSPACE_CALL_FAILED',
        entityType: 'CRM_LEAD_QR',
        entityId: auth.lead.id,
        entityLabel: auth.lead.patientName || auth.lead.leadRef || auth.lead.id,
        actorUserId: actor.id,
        actorRole: actor.role,
        route: request.nextUrl.pathname,
        method: request.method,
        status: 'FAILED',
        errorMessage: 'Logged-in user does not have a valid Knowlarity caller ID.',
        request,
        summary: `Workspace make-call failed for ${auth.lead.patientName || auth.lead.leadRef || 'lead'} because ${actor.name || 'the logged-in user'} does not have a valid Knowlarity caller ID`,
        metadata: {
          leadRef: auth.lead.leadRef,
          patientName: auth.lead.patientName,
          knowlarityCallerId: actor.knowlarityCallerId,
        },
      })
      return errorResponse('Your Knowlarity caller ID is not configured.', 400)
    }

    const response = await fetch(KNOWLARITY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: config.authKey,
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify({
        customer_number: customerNumber,
        agent_number: agentNumber,
        k_number: config.kNumber,
        caller_id: callerId,
      }),
      cache: 'no-store',
    })

    const responseText = await response.text()
    let responseBody: unknown = null
    try {
      responseBody = responseText ? JSON.parse(responseText) : null
    } catch {
      responseBody = responseText
    }

    const userAgent = request.headers.get('user-agent')
    const ipAddress = getLeadQrClientIp(request.headers)
    const deviceInfo = parseLeadQrDeviceInfo(userAgent)

    if (!response.ok) {
      await logCrmActivity({
        action: 'CRM_LEAD_WORKSPACE_CALL_FAILED',
        entityType: 'CRM_LEAD_QR',
        entityId: auth.lead.id,
        entityLabel: auth.lead.patientName || auth.lead.leadRef || auth.lead.id,
        actorUserId: actor.id,
        actorRole: actor.role,
        route: request.nextUrl.pathname,
        method: request.method,
        status: 'FAILED',
        errorMessage: `Knowlarity call request failed with status ${response.status}.`,
        request,
        summary: `Workspace make-call failed for ${auth.lead.patientName || auth.lead.leadRef || 'lead'}`,
        metadata: {
          leadRef: auth.lead.leadRef,
          patientName: auth.lead.patientName,
          customerNumber,
          agentNumber,
          callerId,
          ipAddress,
          userAgent,
          deviceInfo,
          knowlarityStatus: response.status,
          knowlarityResponse: responseBody,
        },
      })

      return errorResponse('Failed to initiate call via Knowlarity.', 502)
    }

    await logCrmActivity({
      action: 'CRM_LEAD_WORKSPACE_CALL_STARTED',
      entityType: 'CRM_LEAD_QR',
      entityId: auth.lead.id,
      entityLabel: auth.lead.patientName || auth.lead.leadRef || auth.lead.id,
      actorUserId: actor.id,
      actorRole: actor.role,
      route: request.nextUrl.pathname,
      method: request.method,
      request,
      summary: `Workspace call started for ${auth.lead.patientName || auth.lead.leadRef || 'lead'}`,
      metadata: {
        leadRef: auth.lead.leadRef,
        patientName: auth.lead.patientName,
        customerNumber,
        agentNumber,
        callerId,
        ipAddress,
        userAgent,
        deviceInfo,
        knowlarityResponse: responseBody,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        customerNumber,
        agentNumber,
        knowlarity: responseBody,
      },
    })
  } catch (error) {
    console.error('POST /api/leads/[id]/make-call', error)
    return errorResponse('Failed to initiate call.', 500)
  }
}
