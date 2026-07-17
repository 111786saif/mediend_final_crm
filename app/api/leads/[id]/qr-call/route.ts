import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canUserViewLeadOwner } from '@/lib/lead-ownership'
import { logCrmActivity } from '@/lib/crm-activity'
import { prisma } from '@/lib/prisma'
import { getSessionWithFreshUser } from '@/lib/session'

const VALID_POST_ACTIONS = new Set(['QR_VIEWED'])
const VALID_GET_SOURCES = new Set(['qr', 'button'])

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D+/g, '')
  if (!digits) return ''
  if (digits.startsWith('91') && digits.length >= 12) return `+${digits}`
  if (digits.length === 10) return `+91${digits}`
  return `+${digits}`
}

function getClientIp(request: NextRequest): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  )
}

async function loadLeadForQrAudit(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      bdId: true,
      leadRef: true,
      phoneNumber: true,
      patientName: true,
      campaignId: true,
      campaignName: true,
      circle: true,
      category: true,
    },
  })
}

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

async function createAuditLog(params: {
  leadId: string
  userId: string
  phoneNumber: string
  action: string
  source?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown> | null
}) {
  await prisma.leadQrCallAuditLog.create({
    data: {
      leadId: params.leadId,
      userId: params.userId,
      phoneNumber: params.phoneNumber,
      action: params.action,
      source: params.source ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      metadata: params.metadata ?? null,
    },
  })
}

async function logQrCrmActivity(params: {
  request: NextRequest
  userId: string
  userRole: string
  lead: {
    id: string
    leadRef: string | null
    patientName: string | null
    campaignId: string | null
    campaignName: string | null
    circle: string
    category: string | null
  }
  action: string
  source?: string | null
  phoneNumber: string
  status?: 'SUCCESS' | 'FAILED'
  errorMessage?: string | null
}) {
  await logCrmActivity({
    action: params.action,
    entityType: 'CRM_LEAD_QR',
    entityId: params.lead.id,
    entityLabel: params.lead.patientName || params.lead.leadRef || params.lead.id,
    actorUserId: params.userId,
    actorRole: params.userRole,
    request: params.request,
    status: params.status,
    errorMessage: params.errorMessage ?? null,
    summary:
      params.action === 'CRM_LEAD_QR_VIEWED'
        ? `Viewed lead QR for ${params.lead.patientName || params.lead.leadRef || 'lead'}`
        : params.action === 'CRM_LEAD_QR_CALL_BUTTON'
          ? `Used lead call button for ${params.lead.patientName || params.lead.leadRef || 'lead'}`
          : `Started QR call flow for ${params.lead.patientName || params.lead.leadRef || 'lead'}`,
    metadata: {
      leadRef: params.lead.leadRef,
      patientName: params.lead.patientName,
      campaignId: params.lead.campaignId,
      campaignName: params.lead.campaignName,
      circle: params.lead.circle,
      category: params.lead.category,
      source: params.source ?? null,
      phoneNumber: params.phoneNumber,
    },
  })
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

    await createAuditLog({
      leadId: auth.lead.id,
      userId: auth.user.id,
      phoneNumber: auth.lead.phoneNumber,
      action,
      source: typeof body.source === 'string' ? body.source : 'popover',
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
      metadata: {
        patientName: auth.lead.patientName,
      },
    })

    await logQrCrmActivity({
      request,
      userId: auth.user.id,
      userRole: auth.user.role,
      lead: auth.lead,
      action: 'CRM_LEAD_QR_VIEWED',
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
    const normalizedPhone = normalizePhone(auth.lead.phoneNumber)

    if (!normalizedPhone) {
      await logQrCrmActivity({
        request,
        userId: auth.user.id,
        userRole: auth.user.role,
        lead: auth.lead,
        action: source === 'button' ? 'CRM_LEAD_QR_CALL_BUTTON' : 'CRM_LEAD_QR_CALL_STARTED',
        source,
        phoneNumber: auth.lead.phoneNumber,
        status: 'FAILED',
        errorMessage: 'Lead does not have a valid phone number.',
      })
      return errorResponse('Lead does not have a valid phone number.', 400)
    }

    await createAuditLog({
      leadId: auth.lead.id,
      userId: auth.user.id,
      phoneNumber: auth.lead.phoneNumber,
      action: source === 'button' ? 'CALL_BUTTON_INITIATED' : 'QR_CALL_INITIATED',
      source,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get('user-agent'),
      metadata: {
        patientName: auth.lead.patientName,
      },
    })

    await logQrCrmActivity({
      request,
      userId: auth.user.id,
      userRole: auth.user.role,
      lead: auth.lead,
      action: source === 'button' ? 'CRM_LEAD_QR_CALL_BUTTON' : 'CRM_LEAD_QR_CALL_STARTED',
      source,
      phoneNumber: auth.lead.phoneNumber,
    })

    return NextResponse.redirect(`tel:${normalizedPhone}`)
  } catch (error) {
    console.error('Error processing audited lead call:', error)
    return errorResponse('Failed to initiate lead call', 500)
  }
}
