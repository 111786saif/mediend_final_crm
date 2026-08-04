import { NextRequest } from 'next/server'
import { errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { createLeadQrPublicLink, loadLeadForQrAudit } from '@/lib/lead-qr'
import { canUserViewLeadOwner } from '@/lib/lead-ownership'
import { getSessionWithFreshUser } from '@/lib/session'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getSessionWithFreshUser()
    if (!currentUser) {
      return unauthorizedResponse()
    }

    const { id } = await params
    const lead = await loadLeadForQrAudit(id)
    if (!lead) {
      return errorResponse('Lead not found', 404)
    }

    const canAccess = await canUserViewLeadOwner(currentUser, lead.bdId)
    if (!canAccess) {
      return errorResponse('Forbidden', 403)
    }

    const publicLink = await createLeadQrPublicLink({
      leadId: lead.id,
      actorUserId: currentUser.id,
    })

    const origin = new URL(request.url).origin
    const encodedId = encodeURIComponent(publicLink.id)

    return Response.json({
      success: true,
      data: {
        publicLinkId: publicLink.id,
        expiresAt: publicLink.expiresAt,
        landingUrl: `${origin}/lead-contact/${encodedId}`,
        callUrl: `${origin}/api/lead-contact/${encodedId}/call`,
      },
    })
  } catch (error) {
    console.error('POST /api/leads/[id]/qr-call/public-link', error)
    return errorResponse('Failed to create public QR link', 500)
  }
}
