import { leadIdSchema } from '@/lib/lead-id'
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

function maskPhone(value: string | null | undefined) {
  const digits = value?.replace(/\D+/g, '') ?? ''
  if (!digits) return null
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`
}

function summarizeKnowlarityResponse(value: unknown) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value)
  if (!raw) return null

  // Keep production logs useful without exposing full phone numbers from provider payloads.
  return raw.replace(/\d{7,}/g, (number) => maskPhone(number) ?? '***').slice(0, 2_000)
}

function providerEndpointForLog(url: string) {
  try {
    const parsed = new URL(url)
    return `${parsed.origin}${parsed.pathname}`
  } catch {
    return 'invalid-configured-url'
  }
}

function logMakeCall(
  attemptId: string,
  event: string,
  details: Record<string, unknown> = {}
) {
  console.log('[make-call]', { attemptId, event, ...details })
}

async function authorizeLeadAccess(request: NextRequest, id: number) {
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
  const attemptId = crypto.randomUUID()

  try {
    const { id: rawLeadId } = await params
    const parsedLeadId = leadIdSchema.safeParse(rawLeadId)
    if (!parsedLeadId.success) return errorResponse('Invalid lead ID', 400)
    const id = parsedLeadId.data
    const auth = await authorizeLeadAccess(request, id)
    if (auth.response || !auth.user || !auth.lead) {
      logMakeCall(attemptId, 'authorization_failed', { leadId: id })
      return auth.response!
    }

    logMakeCall(attemptId, 'started', {
      leadId: auth.lead.id,
      leadRef: auth.lead.leadRef,
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
    })

    const config = getKnowlarityConfig()
    if (!config) {
      logMakeCall(attemptId, 'configuration_missing', {
        leadId: auth.lead.id,
        hasAuthKey: Boolean(process.env.KNOWLARITY_AUTH_KEY?.trim()),
        hasApiKey: Boolean(process.env.KNOWLARITY_X_API_KEY?.trim()),
        hasKNumber: Boolean(process.env.KNOWLARITY_K_NUMBER?.trim()),
        hasCallerId: Boolean(process.env.KNOWLARITY_CALLER_ID?.trim()),
      })
      return errorResponse(
        'Knowlarity calling is not configured. Please set KNOWLARITY_AUTH_KEY, KNOWLARITY_X_API_KEY, KNOWLARITY_K_NUMBER, and KNOWLARITY_CALLER_ID.',
        500
      )
    }

    const actor = await resolveActorKnowlaritySettings(auth.user.id)

    if (!actor) {
      logMakeCall(attemptId, 'actor_not_found', { actorUserId: auth.user.id })
      return unauthorizedResponse()
    }

    const customerNumber = normalizeLeadQrPhone(auth.lead.phoneNumber ?? '')
    const agentNumber = normalizeLeadQrPhone(actor.knowlarityPhoneNumber ?? '')
    const callerId = actor.knowlarityCallerId?.trim() || config.callerId

    logMakeCall(attemptId, 'call_inputs_resolved', {
      leadId: auth.lead.id,
      leadRef: auth.lead.leadRef,
      customerNumber: maskPhone(customerNumber),
      agentNumber: maskPhone(agentNumber),
      configuredKnowlarityNumber: maskPhone(actor.knowlarityPhoneNumber),
      callerId: maskPhone(callerId),
      callerIdSource: actor.knowlarityCallerId?.trim() ? 'employee' : 'environment',
      notificationsEnabled: actor.knowlarityNotificationsEnabled,
    })

    if (!customerNumber) {
      logMakeCall(attemptId, 'invalid_customer_number', {
        leadId: auth.lead.id,
        leadRef: auth.lead.leadRef,
        rawCustomerNumber: maskPhone(auth.lead.phoneNumber),
      })
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
      logMakeCall(attemptId, 'invalid_agent_number', {
        leadId: auth.lead.id,
        actorUserId: actor.id,
        actorPhoneNumber: maskPhone(actor.phoneNumber),
        configuredKnowlarityNumber: maskPhone(actor.knowlarityPhoneNumber),
      })
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
      logMakeCall(attemptId, 'missing_caller_id', {
        leadId: auth.lead.id,
        actorUserId: actor.id,
      })
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

    logMakeCall(attemptId, 'provider_request_started', {
      leadId: auth.lead.id,
      endpoint: providerEndpointForLog(KNOWLARITY_URL),
    })

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

    logMakeCall(attemptId, 'provider_response_received', {
      leadId: auth.lead.id,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      responsePreview: summarizeKnowlarityResponse(responseBody),
    })

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
    console.error('[make-call] unexpected_error', {
      attemptId,
      error: error instanceof Error ? error.message : String(error),
    })
    return errorResponse('Failed to initiate call.', 500)
  }
}
