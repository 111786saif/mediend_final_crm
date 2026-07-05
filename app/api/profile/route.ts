import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import {
  buildProfileDocuments,
  parseAddress,
} from '@/lib/employee-profile'
import { z } from 'zod'

const addressSchema = z
  .object({
    line: z.string().max(500).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    state: z.string().max(100).optional().nullable(),
    pinCode: z.string().max(20).optional().nullable(),
    country: z.string().max(100).optional().nullable(),
  })
  .optional()
  .nullable()

const updateProfileSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().max(20).optional().nullable(),
  address: z.string().max(2000).optional().nullable(),
  profilePicture: z.string().max(2000).optional().nullable().or(z.literal('')),
  gender: z.string().max(50).optional().nullable(),
  emergencyContactName: z.string().max(100).optional().nullable(),
  emergencyContactPhone: z.string().max(20).optional().nullable(),
  currentAddress: addressSchema,
  permanentAddress: addressSchema,
  panNumber: z.string().max(10).optional().nullable(),
  aadharNumber: z.string().max(12).optional().nullable(),
  uanNumber: z.string().max(12).optional().nullable(),
  bankAccountName: z.string().max(100).optional().nullable(),
  bankAccountNumber: z.string().max(50).optional().nullable(),
  ifscCode: z.string().max(11).optional().nullable(),
})

const managerSelect = {
  id: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
    },
  },
} as const

const departmentSelect = {
  id: true,
  name: true,
  description: true,
  head: {
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
    },
  },
} as const

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
        gender: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        currentAddress: true,
        permanentAddress: true,
        employee: {
          include: {
            department: { select: departmentSelect },
            manager: { select: managerSelect },
            documents: {
              where: { documentUrl: { not: null } },
              orderBy: { generatedAt: 'desc' },
              select: {
                id: true,
                documentType: true,
                documentUrl: true,
                title: true,
              },
            },
          },
        },
      },
    })

    if (!user) return errorResponse('User not found', 404)

    const { employee, ...userData } = user

    const currentAddress = parseAddress(userData.currentAddress, userData.address)
    const permanentAddress = parseAddress(userData.permanentAddress)

    const documents = employee
      ? buildProfileDocuments({
          aadharDocUrl: employee.aadharDocUrl,
          panDocUrl: employee.panDocUrl,
          passportDocUrl: employee.passportDocUrl,
          drivingLicenseDocUrl: employee.drivingLicenseDocUrl,
          resumeDocUrl: employee.resumeDocUrl,
          educationalCertDocUrl: employee.educationalCertDocUrl,
          experienceCertDocUrl: employee.experienceCertDocUrl,
          appointmentLetterDocUrl: employee.appointmentLetterDocUrl,
          otherDocuments: employee.otherDocuments,
          hrDocuments: employee.documents,
        })
      : []

    const { documents: _hrDocs, ...employeeData } = employee ?? {}

    return successResponse({
      user: {
        ...userData,
        currentAddress,
        permanentAddress,
      },
      employee: employeeData ?? null,
      documents,
    })
  } catch (error) {
    console.error('Error fetching profile:', error)
    return errorResponse('Failed to fetch profile', 500)
  }
}

/**
 * PATCH /api/profile
 * Self-profile update with restrictions:
 * - User can always update: name, email, phoneNumber, address, profilePicture, gender, emergency contact, addresses
 * - PAN, Aadhar, bank details: user can add once (when null), then only HR can change
 */
export async function PATCH(request: NextRequest) {
  try {
    const sessionUser = getSessionFromRequest(request)
    if (!sessionUser) return unauthorizedResponse()

    const isHr = hasPermission(sessionUser, 'hrms:employees:write')

    const body = await request.json()
    const data = updateProfileSchema.parse(body)

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

    const userUpdate: Record<string, unknown> = {}
    if (data.name !== undefined) userUpdate.name = data.name
    if (normalizedEmail !== undefined) userUpdate.email = normalizedEmail
    if (data.phoneNumber !== undefined) userUpdate.phoneNumber = data.phoneNumber ?? null
    if (data.address !== undefined) userUpdate.address = data.address ?? null
    if (data.profilePicture !== undefined) userUpdate.profilePicture = data.profilePicture || null
    if (data.gender !== undefined) userUpdate.gender = data.gender ?? null
    if (data.emergencyContactName !== undefined) {
      userUpdate.emergencyContactName = data.emergencyContactName ?? null
    }
    if (data.emergencyContactPhone !== undefined) {
      userUpdate.emergencyContactPhone = data.emergencyContactPhone ?? null
    }
    if (data.currentAddress !== undefined) {
      userUpdate.currentAddress = data.currentAddress ?? null
      if (data.currentAddress?.line !== undefined) {
        userUpdate.address = data.currentAddress.line ?? null
      }
    }
    if (data.permanentAddress !== undefined) {
      userUpdate.permanentAddress = data.permanentAddress ?? null
    }

    await prisma.user.update({
      where: { id: sessionUser.id },
      data: userUpdate,
    })

    if (user.employee) {
      const emp = user.employee
      const empUpdate: Record<string, unknown> = {}

      const hrOnlyFields = [
        'panNumber',
        'aadharNumber',
        'uanNumber',
        'bankAccountName',
        'bankAccountNumber',
        'ifscCode',
      ]
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
