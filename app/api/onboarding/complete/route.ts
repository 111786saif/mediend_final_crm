import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

/**
 * POST /api/onboarding/complete
 * Employee acknowledges profile preview and submits for HR approval.
 */
export async function POST(request: NextRequest) {
  try {
    const sessionUser = getSessionFromRequest(request)
    if (!sessionUser) return unauthorizedResponse()

    const employee = await prisma.employee.findUnique({
      where: { userId: sessionUser.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    })

    if (!employee) {
      return errorResponse('Employee record not found', 404)
    }

    if (employee.onboardingStatus === 'APPROVED') {
      return errorResponse('Onboarding already completed', 400)
    }

    if (employee.onboardingStatus === 'PENDING_APPROVAL') {
      return successResponse(
        { onboardingStatus: 'PENDING_APPROVAL' },
        'Already submitted for HR approval'
      )
    }

    const missing: string[] = []
    if (!employee.user.name?.trim()) missing.push('name')
    if (!employee.user.phoneNumber?.trim()) missing.push('phone number')
    if (!employee.aadharNumber?.trim()) missing.push('Aadhaar number')
    if (!employee.panNumber?.trim()) missing.push('PAN number')
    if (!employee.bankAccountNumber?.trim()) missing.push('bank account number')
    if (!employee.ifscCode?.trim()) missing.push('IFSC code')
    if (!employee.bankAccountName?.trim()) missing.push('bank account holder name')

    if (missing.length > 0) {
      return errorResponse(
        `Please complete required profile fields before submitting: ${missing.join(', ')}`,
        400
      )
    }

    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        onboardingStatus: 'PENDING_APPROVAL',
        onboardingSubmittedAt: new Date(),
      },
      select: {
        id: true,
        onboardingStatus: true,
        onboardingSubmittedAt: true,
      },
    })

    try {
      const hrUsers = await prisma.user.findMany({
        where: {
          OR: [
            { role: 'HR_HEAD' },
            { role: 'ADMIN' },
          ],
        },
        select: { id: true },
      })

      if (hrUsers.length > 0) {
        await prisma.notification.createMany({
          data: hrUsers.map((hr) => ({
            userId: hr.id,
            type: 'ONBOARDING_SUBMITTED' as const,
            title: 'Onboarding pending approval',
            message: `${employee.user.name} has completed their profile and is waiting for HR approval.`,
            link: '/hr/onboarding',
          })),
        })
      }
    } catch (notifErr) {
      console.error('Failed to notify HR of onboarding submission:', notifErr)
    }

    return successResponse(updated, 'Profile submitted for HR approval')
  } catch (error) {
    console.error('Error completing onboarding:', error)
    return errorResponse('Failed to complete onboarding', 500)
  }
}
