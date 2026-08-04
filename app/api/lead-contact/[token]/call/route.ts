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

    const normalizedPhone = normalizeLeadQrPhone(lead.phoneNumber)
    if (!normalizedPhone) {
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
      auditAction: 'QR_CALL_INITIATED',
      crmAction: 'CRM_LEAD_QR_CALL_STARTED',
      summary: `QR contact call started from ${deviceInfo.label} for ${lead.patientName || lead.leadRef || 'lead'}`,
      source: 'public_page',
    })

    return NextResponse.redirect(`tel:${normalizedPhone}`)
  } catch (error) {
    console.error('GET /api/lead-contact/[token]/call', error)
    return errorResponse('Failed to initiate call.', 500)
  }
}
