import { NextRequest } from 'next/server'
import { errorResponse, unauthorizedResponse } from '@/lib/api-utils'
import { createLeadQrPublicLink, loadLeadForQrAudit } from '@/lib/lead-qr'
import { canUserViewLeadOwner } from '@/lib/lead-ownership'
import { getSessionWithFreshUser } from '@/lib/session'

function resolvePublicOrigin(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }

  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  if (forwardedHost) {
    const protocol = forwardedProto || 'https'
    return `${protocol}://${forwardedHost}`
  }

  const host = request.headers.get('host')
  if (host) {
    const protocol = forwardedProto || (host.includes('localhost') ? 'http' : 'https')
    return `${protocol}://${host}`
  }

  return new URL(request.url).origin
}

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

    const origin = resolvePublicOrigin(request)
    const encodedToken = encodeURIComponent(publicLink.token)

    return Response.json({
      success: true,
      data: {
        publicLinkId: publicLink.id,
        expiresAt: publicLink.expiresAt,
        landingUrl: `${origin}/lead-contact/${encodedToken}`,
      },
    })
  } catch (error) {
    console.error('POST /api/leads/[id]/qr-call/public-link', error)
    return errorResponse('Failed to create public QR link', 500)
  }
}
