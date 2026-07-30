import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, zodErrorResponse } from '@/lib/api-utils'
import { emailField, requiredStringField } from '@/lib/doctor-api-validation'
import { loginDoctorApp } from '@/lib/doctor-app/auth'

const loginSchema = z.object({
  email: emailField('Email'),
  password: requiredStringField('Password'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = loginSchema.parse(body)

    const result = await loginDoctorApp(email, password)
    if (!result) {
      return errorResponse('Invalid email or password', 401)
    }

    return successResponse(result, 'Login successful')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }

    console.error('Doctor app login failed:', error)
    return errorResponse('Internal server error', 500)
  }
}
