import { NextRequest, NextResponse } from 'next/server'
import { errorResponse } from '@/lib/api-utils'
import {
  loadLeadQrPublicLink,
  normalizeLeadQrPhone,
  parseLeadQrDeviceInfo,
  recordLeadQrEvent,
} from '@/lib/lead-qr'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const publicLink = await loadLeadQrPublicLink(token)
    if (!publicLink) {
      return errorResponse('QR link is invalid or has expired.', 400)
    }
    const lead = publicLink.lead

    const targetParam = request.nextUrl.searchParams.get('target')
    const callTarget = targetParam === 'alternate' ? 'alternate' : 'primary'
    const targetPhone = normalizeLeadQrPhone(
      callTarget === 'alternate' ? lead.alternateNumber ?? '' : lead.phoneNumber ?? ''
    )
    if (!targetPhone) {
      const errorUrl = new URL(`/lead-contact/${encodeURIComponent(token)}`, request.url)
      errorUrl.searchParams.set('error', 'no-phone')
      return NextResponse.redirect(errorUrl)
    }
    const deviceInfo = parseLeadQrDeviceInfo(request.headers.get('user-agent'))

    await recordLeadQrEvent({
      headers: request.headers,
      requestUrl: request.url,
      route: request.nextUrl.pathname,
      method: request.method,
      lead,
      actorUserId: publicLink.actorUser.id,
      actorRole: publicLink.actorUser.role,
      actorName: publicLink.actorUser.name ?? null,
      auditAction: callTarget === 'alternate' ? 'QR_ALTERNATE_CALL_INITIATED' : 'QR_CALL_INITIATED',
      crmAction:
        callTarget === 'alternate'
          ? 'CRM_LEAD_QR_ALTERNATE_CALL_STARTED'
          : 'CRM_LEAD_QR_CALL_STARTED',
      summary:
        callTarget === 'alternate'
          ? `QR alternate contact call started from ${deviceInfo.label} for ${lead.patientName || lead.leadRef || 'lead'}`
          : `QR contact call started from ${deviceInfo.label} for ${lead.patientName || lead.leadRef || 'lead'}`,
      source: 'public_page',
      phoneNumber: callTarget === 'alternate' ? lead.alternateNumber : lead.phoneNumber,
      metadata: {
        contactTarget: callTarget,
      },
    })

    return NextResponse.redirect(`tel:${targetPhone}`)
  } catch (error) {
    console.error('GET /api/lead-contact/[token]/call', error)
    return errorResponse('Failed to initiate call.', 500)
  }
}
