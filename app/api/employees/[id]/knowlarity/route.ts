import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse, zodErrorResponse } from '@/lib/api-utils'
import {
  fetchKnowlarityRegistrations,
  getKnowlarityChannel,
  getKnowlarityNotificationsUrl,
  isKnowlarityNumberRegistered,
  normalizeKnowlarityPhone,
} from '@/lib/knowlarity'

const knowlaritySettingsSchema = z.object({
  phoneNumber: z.string().trim().min(10, 'Phone number is required').max(20, 'Phone number is too long'),
  callerId: z.string().trim().min(3, 'Caller ID is required').max(40, 'Caller ID is too long'),
  notificationsEnabled: z.boolean(),
})

async function readSettings(employeeId: string) {
  const rows = await prisma.$queryRaw<
    Array<{
      knowlarityPhoneNumber: string | null
      knowlarityCallerId: string | null
      knowlarityNotificationsEnabled: boolean
    }>
  >(Prisma.sql`
    SELECT
      "knowlarityPhoneNumber",
      "knowlarityCallerId",
      "knowlarityNotificationsEnabled"
    FROM "Employee"
    WHERE "id" = ${employeeId}
    LIMIT 1
  `)

  return (
    rows[0] ?? {
      knowlarityPhoneNumber: null,
      knowlarityCallerId: null,
      knowlarityNotificationsEnabled: false,
    }
  )
}

async function registerForKnowlarityNotifications(phoneNumber: string) {
  const authKey = process.env.KNOWLARITY_AUTH_KEY?.trim()
  const apiKey = process.env.KNOWLARITY_X_API_KEY?.trim()
  if (!authKey || !apiKey) {
    throw new Error(
      'Knowlarity notifications are not configured. Please set KNOWLARITY_AUTH_KEY and KNOWLARITY_X_API_KEY.'
    )
  }

  const url = new URL(getKnowlarityNotificationsUrl())
  if (!url.searchParams.has('channel')) {
    url.searchParams.set('channel', getKnowlarityChannel())
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: authKey,
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      knowlarity_number: [phoneNumber],
    }),
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const message =
      (payload && typeof payload.message === 'string' && payload.message) ||
      (payload && typeof payload.error === 'string' && payload.error) ||
      'Failed to register the Knowlarity number for notifications.'
    throw new Error(message)
  }
}

function ensureExecutiveAssistant(user: ReturnType<typeof getSessionFromRequest>) {
  if (!user) {
    return unauthorizedResponse()
  }

  if (user.role !== 'EXECUTIVE_ASSISTANT') {
    return errorResponse('Only Executive Assistant users can manage Knowlarity settings.', 403)
  }

  return null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    const eaGuard = ensureExecutiveAssistant(user)
    if (eaGuard) return eaGuard

    if (!hasPermission(user, 'hrms:employees:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
      },
    })

    if (!employee) return errorResponse('Employee not found', 404)

    return successResponse(await readSettings(id))
  } catch (error) {
    console.error('Error fetching employee Knowlarity settings:', error)
    return errorResponse('Failed to fetch Knowlarity settings', 500)
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    const eaGuard = ensureExecutiveAssistant(user)
    if (eaGuard) return eaGuard

    if (!hasPermission(user, 'hrms:employees:write')) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        user: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!employee) return errorResponse('Employee not found', 404)

    const parsed = knowlaritySettingsSchema.safeParse(await request.json())
    if (!parsed.success) {
      return zodErrorResponse(parsed.error)
    }

    const normalizedPhoneNumber = normalizeKnowlarityPhone(parsed.data.phoneNumber)
    if (!/^\+\d{10,15}$/.test(normalizedPhoneNumber)) {
      return errorResponse('Please enter a valid Knowlarity phone number with country code support.', 400)
    }

    if (parsed.data.notificationsEnabled) {
      const alreadyRegistered = await isKnowlarityNumberRegistered(normalizedPhoneNumber)
      if (!alreadyRegistered) {
        await registerForKnowlarityNotifications(normalizedPhoneNumber)
      }
    }

    await prisma.$executeRaw(Prisma.sql`
      UPDATE "Employee"
      SET
        "knowlarityPhoneNumber" = ${normalizedPhoneNumber},
        "knowlarityCallerId" = ${parsed.data.callerId},
        "knowlarityNotificationsEnabled" = ${parsed.data.notificationsEnabled},
        "updatedAt" = NOW()
      WHERE "id" = ${id}
    `)

    return successResponse(
      await readSettings(id),
      parsed.data.notificationsEnabled
        ? `Knowlarity settings saved and notifications enabled for ${employee.user.name}.`
        : `Knowlarity settings saved for ${employee.user.name}.`
    )
  } catch (error) {
    console.error('Error updating employee Knowlarity settings:', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to update Knowlarity settings',
      500
    )
  }
}
