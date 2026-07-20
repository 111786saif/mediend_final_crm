import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!employee) {
      return successResponse({ isBirthday: false })
    }

    if (!employee.dateOfBirth) {
      return successResponse({ isBirthday: false })
    }

    const today = new Date()
    const dob = new Date(employee.dateOfBirth)
    
    const isBirthday = 
      today.getDate() === dob.getDate() && 
      today.getMonth() === dob.getMonth()

    if (isBirthday) {
      const age = today.getFullYear() - dob.getFullYear()
      return successResponse({
        isBirthday: true,
        name: employee.user.name,
        age,
      })
    }

    return successResponse({ isBirthday: false })
  } catch (error) {
    console.error('Error checking birthday:', error)
    return errorResponse('Failed to check birthday', 500)
  }
}
