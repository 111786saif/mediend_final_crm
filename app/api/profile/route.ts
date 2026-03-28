import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'

const updateProfileSchema = z.object({
  // User fields - always editable by self
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().max(20).optional().nullable(),
  address: z.string().max(2000).optional().nullable(),
  profilePicture: z.string().max(2000).optional().nullable().or(z.literal('')),
  // Employee fields - first-time only by user, then HR only
  panNumber: z.string().max(10).optional().nullable(),
  aadharNumber: z.string().max(12).optional().nullable(),
  uanNumber: z.string().max(12).optional().nullable(),
  bankAccountName: z.string().max(100).optional().nullable(),
  bankAccountNumber: z.string().max(50).optional().nullable(),
  ifscCode: z.string().max(11).optional().nullable(),
})

/**
 * GET /api/profile
 * Returns current user's full profile (user + employee if exists)
 */
export async function GET(request: NextRequest) {
  try {
    const sessionUser = getSessionFromRequest(request)
    if (!sessionUser) return unauthorizedResponse()

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phoneNumber: true,
        address: true,
        profilePicture: true,
        employee: {
          include: {
            department: { select: { id: true, name: true, description: true } },
          },
        },
      },
    })

    if (!user) return errorResponse('User not found', 404)

    const { employee, ...userData } = user
    return successResponse({ user: userData, employee: employee ?? null })
  } catch (error) {
    console.error('Error fetching profile:', error)
    return errorResponse('Failed to fetch profile', 500)
  }
}

/**
 * PATCH /api/profile
 * Self-profile update with restrictions:
 * - User can always update: name, email, phoneNumber, address, profilePicture
 * - PAN, Aadhar, bank details: user can add once (when null), then only HR can change
 */
export async function PATCH(request: NextRequest) {
  try {
    const sessionUser = getSessionFromRequest(request)
    if (!sessionUser) return unauthorizedResponse()

    const isHr = hasPermission(sessionUser, 'hrms:employees:write')

    const body = await request.json()
    const data = updateProfileSchema.parse(body)

    // Normalize email
    const normalizedEmail = data.email ? data.email.toLowerCase().trim() : undefined

    if (normalizedEmail) {
      const existing = await prisma.user.findFirst({
        where: { email: normalizedEmail, id: { not: sessionUser.id } },
      })
      if (existing) return errorResponse('Email already exists', 400)
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      include: {
        employee: {
          select: {
            id: true,
            panNumber: true,
            aadharNumber: true,
            uanNumber: true,
            bankAccountName: true,
            bankAccountNumber: true,
            ifscCode: true,
          },
        },
      },
    })

    if (!user) return errorResponse('User not found', 404)

    // Build user update
    const userUpdate: Record<string, unknown> = {}
    if (data.name !== undefined) userUpdate.name = data.name
    if (normalizedEmail !== undefined) userUpdate.email = normalizedEmail
    if (data.phoneNumber !== undefined) userUpdate.phoneNumber = data.phoneNumber ?? null
    if (data.address !== undefined) userUpdate.address = data.address ?? null
    if (data.profilePicture !== undefined) userUpdate.profilePicture = data.profilePicture || null

    await prisma.user.update({
      where: { id: sessionUser.id },
      data: userUpdate,
    })

    // Employee update (with restrictions)
    if (user.employee) {
      const emp = user.employee
      const empUpdate: Record<string, unknown> = {}

      const hrOnlyFields = ['panNumber', 'aadharNumber', 'uanNumber', 'bankAccountName', 'bankAccountNumber', 'ifscCode']
      for (const field of hrOnlyFields) {
        const val = data[field as keyof typeof data]
        if (val === undefined) continue

        const currentVal = emp[field as keyof typeof emp]
        const isFirstTime = currentVal == null || currentVal === ''
        const canUserUpdate = isFirstTime && !isHr
        const canHrUpdate = isHr

        if (canUserUpdate || canHrUpdate) {
          empUpdate[field] = val ?? null
        } else if (!isFirstTime && !isHr) {
          return errorResponse(
            `${field === 'panNumber' ? 'PAN' : field === 'aadharNumber' ? 'Aadhar' : field === 'uanNumber' ? 'UAN' : 'Bank account details'} can only be changed by HR once saved`,
            403
          )
        }
      }

      if (Object.keys(empUpdate).length > 0) {
        await prisma.employee.update({
          where: { id: user.employee.id },
          data: empUpdate,
        })
      }
    }

    return successResponse(null, 'Profile updated successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error updating profile:', error)
    return errorResponse('Failed to update profile', 500)
  }
}
