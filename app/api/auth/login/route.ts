import { NextRequest } from 'next/server'
import { authenticateUser, InactiveUserError } from '@/lib/auth'
import { createSession } from '@/lib/session'
import { errorResponse, successResponse } from '@/lib/api-utils'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = loginSchema.parse(body)

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim()
    const user = await authenticateUser(normalizedEmail, password)
    if (!user) {
      return errorResponse('Invalid email or password', 401)
    }

    await createSession(user)

    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
  } catch (error) {
    if (error instanceof InactiveUserError) {
      return errorResponse(error.message, 403)
    }
    if (error instanceof z.ZodError) {
      return errorResponse('Invalid request data', 400)
    }
    return errorResponse('Internal server error', 500)
  }
}
