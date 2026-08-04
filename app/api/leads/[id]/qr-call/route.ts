import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canUserViewLeadOwner } from '@/lib/lead-ownership'
import {
  loadLeadForQrAudit,
  normalizeLeadQrPhone,
  recordLeadQrEvent,
} from '@/lib/lead-qr'
import { getSessionWithFreshUser } from '@/lib/session'

const VALID_POST_ACTIONS = new Set(['QR_VIEWED'])
const VALID_GET_SOURCES = new Set(['qr', 'button'])

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

    const body = (await request.json().catch(() => ({}))) as {
      action?: string
      source?: string
    }
    const action = typeof body.action === 'string' ? body.action : ''
    if (!VALID_POST_ACTIONS.has(action)) {
      return errorResponse('Invalid QR audit action.', 400)
    }

    await recordLeadQrEvent({
      headers: request.headers,
      requestUrl: request.url,
      route: request.nextUrl.pathname,
      method: request.method,
      lead: auth.lead,
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      actorName: auth.user.name,
      auditAction: action,
      crmAction: 'CRM_LEAD_QR_VIEWED',
      summary: `Viewed lead QR in workspace for ${auth.lead.patientName || auth.lead.leadRef || 'lead'}`,
      source: typeof body.source === 'string' ? body.source : 'popover',
      phoneNumber: auth.lead.phoneNumber,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error creating lead QR audit log:', error)
    return errorResponse('Failed to log QR activity', 500)
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await authorizeLeadAccess(request, id)
    if (auth.response || !auth.user || !auth.lead) {
      return auth.response!
    }

    const { searchParams } = new URL(request.url)
    const sourceParam = searchParams.get('source')
    const source = sourceParam && VALID_GET_SOURCES.has(sourceParam) ? sourceParam : 'qr'
    const normalizedPhone = normalizeLeadQrPhone(auth.lead.phoneNumber)

    if (!normalizedPhone) {
      await recordLeadQrEvent({
        headers: request.headers,
        requestUrl: request.url,
        route: request.nextUrl.pathname,
        method: request.method,
        lead: auth.lead,
        actorUserId: auth.user.id,
        actorRole: auth.user.role,
        actorName: auth.user.name,
        auditAction: source === 'button' ? 'CALL_BUTTON_INITIATED' : 'QR_CALL_INITIATED',
        crmAction: source === 'button' ? 'CRM_LEAD_QR_CALL_BUTTON' : 'CRM_LEAD_QR_CALL_STARTED',
        summary: `Lead QR call failed for ${auth.lead.patientName || auth.lead.leadRef || 'lead'} because no valid phone number was available`,
        source,
        phoneNumber: auth.lead.phoneNumber,
        status: 'FAILED',
        errorMessage: 'Lead does not have a valid phone number.',
      })
      return errorResponse('Lead does not have a valid phone number.', 400)
    }

    await recordLeadQrEvent({
      headers: request.headers,
      requestUrl: request.url,
      route: request.nextUrl.pathname,
      method: request.method,
      lead: auth.lead,
      actorUserId: auth.user.id,
      actorRole: auth.user.role,
      actorName: auth.user.name,
      auditAction: source === 'button' ? 'CALL_BUTTON_INITIATED' : 'QR_CALL_INITIATED',
      crmAction: source === 'button' ? 'CRM_LEAD_QR_CALL_BUTTON' : 'CRM_LEAD_QR_CALL_STARTED',
      summary:
        source === 'button'
          ? `Used workspace call button for ${auth.lead.patientName || auth.lead.leadRef || 'lead'}`
          : `Started QR call flow for ${auth.lead.patientName || auth.lead.leadRef || 'lead'}`,
      source,
      phoneNumber: auth.lead.phoneNumber,
    })

    return NextResponse.redirect(`tel:${normalizedPhone}`)
  } catch (error) {
    console.error('Error processing audited lead call:', error)
    return errorResponse('Failed to initiate lead call', 500)
  }
}
