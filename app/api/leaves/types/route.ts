import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { hasPermission } from '@/lib/rbac'
import { z } from 'zod'

const createLeaveTypeSchema = z.object({
  name: z.string().min(1),
  code: z.string().optional().nullable(),
  maxDays: z.number().int().positive(),
  monthlyAccrual: z.number().min(0).optional().default(0),
  carryForward: z.boolean().optional().default(false),
  probationUnlockDays: z.number().min(0).optional().nullable(),
  isActive: z.boolean().optional().default(true),
})

export async function GET(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') === 'true'

    // Allow all authenticated users to view leave types
    // HR can see all, others see only active
    const where = hasPermission(user, 'hrms:leaves:read') && !activeOnly
      ? {}
      : { isActive: true }

    // Ensure LWB (Leave Without Benefits) exists in LeaveTypeMaster
    const lwbExists = await prisma.leaveTypeMaster.findFirst({
      where: { OR: [{ code: 'LWB' }, { name: 'LWB' }] },
    })
    if (!lwbExists) {
      await prisma.leaveTypeMaster.create({
        data: {
          name: 'LWB',
          code: 'LWB',
          maxDays: 365,
          monthlyAccrual: 0,
          carryForward: false,
          isActive: true,
        },
      })
    }

    const leaveTypes = await prisma.leaveTypeMaster.findMany({
      where,
      orderBy: {
        name: 'asc',
      },
    })

    return successResponse(leaveTypes)
  } catch (error) {
    console.error('Error fetching leave types:', error)
    return errorResponse('Failed to fetch leave types', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'hrms:leaves:write')) {
      return errorResponse('Forbidden', 403)
    }

    const body = await request.json()
    const data = createLeaveTypeSchema.parse(body)

    // Check if leave type name already exists
    const existing = await prisma.leaveTypeMaster.findUnique({
      where: { name: data.name },
    })

    if (existing) {
      return errorResponse('Leave type name already exists', 400)
    }

    const leaveType = await prisma.leaveTypeMaster.create({
      data,
    })

    return successResponse(leaveType, 'Leave type created successfully')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    console.error('Error creating leave type:', error)
    return errorResponse('Failed to create leave type', 500)
  }
}

// PATCH is handled in [id]/route.ts

