import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

/**
 * GET /api/new-hires/welcome
 * Returns the latest unread NEW_HIRE_WELCOME notification for the current user,
 * with the new hire's photo / department for the welcome popup.
 */
export async function GET(request: NextRequest) {
  try {
    const sessionUser = getSessionFromRequest(request)
    if (!sessionUser) return unauthorizedResponse()

    const notification = await prisma.notification.findFirst({
      where: {
        userId: sessionUser.id,
        type: 'NEW_HIRE_WELCOME',
        isRead: false,
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!notification || !notification.relatedId) {
      return successResponse(null)
    }

    const newHire = await prisma.user.findUnique({
      where: { id: notification.relatedId },
      select: {
        id: true,
        name: true,
        profilePicture: true,
        employee: {
          select: {
            designation: true,
            department: { select: { name: true } },
          },
        },
      },
    })

    if (!newHire) {
      return successResponse(null)
    }

    return successResponse({
      notificationId: notification.id,
      title: notification.title,
      message: notification.message,
      newHire: {
        id: newHire.id,
        name: newHire.name,
        profilePicture: newHire.profilePicture,
        designation: newHire.employee?.designation ?? null,
        department: newHire.employee?.department?.name ?? null,
      },
    })
  } catch (error) {
    console.error('Error fetching new-hire welcome:', error)
    return errorResponse('Failed to fetch welcome', 500)
  }
}

/**
 * POST /api/new-hires/welcome
 * Mark the welcome notification as read (dismiss popup).
 */
export async function POST(request: NextRequest) {
  try {
    const sessionUser = getSessionFromRequest(request)
    if (!sessionUser) return unauthorizedResponse()

    const body = await request.json().catch(() => ({}))
    const notificationId = typeof body?.notificationId === 'string' ? body.notificationId : null

    if (!notificationId) {
      return errorResponse('notificationId is required', 400)
    }

    const updated = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId: sessionUser.id,
        type: 'NEW_HIRE_WELCOME',
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    })

    if (updated.count === 0) {
      return errorResponse('Notification not found', 404)
    }

    return successResponse(null, 'Welcome dismissed')
  } catch (error) {
    console.error('Error dismissing new-hire welcome:', error)
    return errorResponse('Failed to dismiss welcome', 500)
  }
}
