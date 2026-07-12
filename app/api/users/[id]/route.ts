import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission, canCreateRole } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'
import { Prisma } from '@/generated/prisma/client'
import { UserRole } from '@/generated/prisma/enums'

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(UserRole).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'users:write')) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params
    const body = await request.json()
    const data = updateUserSchema.parse(body)

    // Normalize email to lowercase
    const normalizedEmail = data.email ? data.email.toLowerCase().trim() : undefined

    // Check if email is being updated and is unique
    if (normalizedEmail) {
      const existing = await prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          id: { not: id },
        },
      })

      if (existing) {
        return errorResponse('Email already exists', 400)
      }
    }

    const updateData: Prisma.UserUpdateInput = {}
    if (data.name !== undefined) updateData.name = data.name
    if (normalizedEmail !== undefined) updateData.email = normalizedEmail
    if (data.role !== undefined) {
      // Prevent users from changing their own role
      if (user.id === id) {
        return errorResponse('Cannot change your own role', 400)
      }
      // Prevent changing MD role
      if (data.role === 'MD') {
        return errorResponse('Cannot assign MD role', 400)
      }
      // Prevent changing role of MD user
      const targetUser = await prisma.user.findUnique({
        where: { id },
        select: { role: true },
      })
      if (targetUser?.role === 'MD') {
        return errorResponse('Cannot change role of MD user', 400)
      }
      if (!canCreateRole(user, data.role)) {
        return errorResponse(`You do not have permission to assign role: ${data.role}`, 403)
      }
      updateData.role = data.role
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        employee: {
          include: {
            department: {
              select: {
                id: true,
                name: true,
              },
            },
            team: {
              select: {
                id: true,
                name: true,
                teamLead: { select: { user: { select: { name: true } } } },
              },
            },
          },
        },
      },
    })

    const safeUser = { ...updated }
    delete (safeUser as { passwordHash?: string }).passwordHash
    const employee = safeUser.employee

    return successResponse(
      {
        ...safeUser,
        employee,
        team: employee?.team ?? null,
      },
      'User updated successfully'
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return errorResponse('Email already exists', 400)
    }
    console.error('Error updating user:', error)
    return errorResponse('Failed to update user', 500)
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'users:write')) {
      return errorResponse('Forbidden', 403)
    }

    const { id } = await params

    // Prevent deleting self
    if (user.id === id) {
      return errorResponse('Cannot delete your own account', 400)
    }

    // Delete the user (this will cascade delete related employee record if exists)
    await prisma.user.delete({
      where: { id },
    })

    return successResponse(null, 'User deleted successfully')
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return errorResponse('Cannot delete user due to existing relationships. Please remove all associations first.', 400)
    }
    console.error('Error deleting user:', error)
    return errorResponse('Failed to delete user', 500)
  }
}
