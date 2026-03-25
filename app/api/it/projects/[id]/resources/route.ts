import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { canReadItPnl, canWriteItPnl } from '@/lib/pnl/auth-it-pnl'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(_request)
    if (!user) return unauthorizedResponse()
    if (!canReadItPnl(user)) return errorResponse('Forbidden', 403)

    const { id: projectId } = await context.params
    const resources = await prisma.iTProjectResource.findMany({
      where: { projectId },
      include: {
        employee: { include: { user: { select: { id: true, name: true, email: true } } } },
        freelancer: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return successResponse(resources)
  } catch (error) {
    console.error('Error fetching resources:', error)
    return errorResponse('Failed to fetch resources', 500)
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!canWriteItPnl(user)) return errorResponse('Forbidden', 403)

    const { id: projectId } = await context.params
    const project = await prisma.iTProject.findUnique({ where: { id: projectId } })
    if (!project) return errorResponse('Project not found', 404)

    const body = await request.json()
    const {
      resourceType,
      employeeId,
      freelancerId,
      allocationPercent,
      paymentType,
      monthlyCost,
      oneTimeCost,
      startDate,
      endDate,
      isActive,
    } = body

    if (resourceType === 'SALARIED') {
      if (!employeeId) return errorResponse('employeeId is required for salaried resource', 400)
    } else if (resourceType === 'FREELANCE') {
      if (!freelancerId) return errorResponse('freelancerId is required for freelance resource', 400)
    } else {
      return errorResponse('Invalid resourceType', 400)
    }

    const resource = await prisma.iTProjectResource.create({
      data: {
        projectId,
        resourceType,
        employeeId: resourceType === 'SALARIED' ? employeeId : null,
        freelancerId: resourceType === 'FREELANCE' ? freelancerId : null,
        allocationPercent: Number(allocationPercent) || 0,
        paymentType: paymentType || 'MONTHLY',
        monthlyCost: Number(monthlyCost) || 0,
        oneTimeCost: Number(oneTimeCost) || 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        isActive: isActive !== false,
      },
      include: {
        employee: { include: { user: { select: { id: true, name: true, email: true } } } },
        freelancer: true,
      },
    })

    return successResponse(resource)
  } catch (error) {
    console.error('Error creating resource:', error)
    return errorResponse('Failed to create resource', 500)
  }
}
