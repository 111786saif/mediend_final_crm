import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { buildProfileDocuments, parseAddress } from '@/lib/employee-profile'
import type { OnboardingStatus } from '@/generated/prisma/client'

/**
 * GET /api/hr/onboarding
 * List employees pending profile completion or HR approval.
 */
export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    if (!hasPermission(user, 'hrms:employees:write') && !hasPermission(user, 'hrms:employees:read')) {
      return errorResponse('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const statusFilter = searchParams.get('status')

    const statusIn: OnboardingStatus[] =
      statusFilter === 'PENDING_PROFILE' || statusFilter === 'PENDING_APPROVAL'
        ? [statusFilter]
        : ['PENDING_PROFILE', 'PENDING_APPROVAL']

    const employees = await prisma.employee.findMany({
      where: {
        onboardingStatus: { in: statusIn },
      },
      include: {
        user: {
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
          },
        },
        department: {
          select: { id: true, name: true },
        },
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
      orderBy: [
        { onboardingSubmittedAt: 'asc' },
        { createdAt: 'asc' },
      ],
    })

    const items = employees.map((emp) => {
      const { documents: hrDocuments, user: empUser, ...rest } = emp
      const documents = buildProfileDocuments({
        aadharDocUrl: emp.aadharDocUrl,
        panDocUrl: emp.panDocUrl,
        passportDocUrl: emp.passportDocUrl,
        drivingLicenseDocUrl: emp.drivingLicenseDocUrl,
        resumeDocUrl: emp.resumeDocUrl,
        educationalCertDocUrl: emp.educationalCertDocUrl,
        experienceCertDocUrl: emp.experienceCertDocUrl,
        appointmentLetterDocUrl: emp.appointmentLetterDocUrl,
        otherDocuments: emp.otherDocuments,
        hrDocuments,
      })

      return {
        ...rest,
        user: {
          ...empUser,
          currentAddress: parseAddress(empUser.currentAddress, empUser.address),
          permanentAddress: parseAddress(empUser.permanentAddress),
        },
        documents,
      }
    })

    return successResponse({
      items,
      summary: {
        total: items.length,
        pendingProfile: items.filter((i) => i.onboardingStatus === 'PENDING_PROFILE').length,
        pendingApproval: items.filter((i) => i.onboardingStatus === 'PENDING_APPROVAL').length,
      },
    })
  } catch (error) {
    console.error('Error fetching onboarding queue:', error)
    return errorResponse('Failed to fetch onboarding queue', 500)
  }
}
