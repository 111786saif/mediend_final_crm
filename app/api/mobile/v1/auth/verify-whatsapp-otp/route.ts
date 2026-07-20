import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, zodErrorResponse } from '@/lib/api-utils'
import { verifyDoctorAppWhatsappOtp } from '@/lib/doctor-app/auth'

const verifyWhatsappOtpSchema = z.object({
  phone: z.string().min(8).max(20).trim(),
  otp: z.string().length(6).trim(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, otp } = verifyWhatsappOtpSchema.parse(body)

    const result = await verifyDoctorAppWhatsappOtp(phone, otp)
    if (!result) {
      return errorResponse('Invalid or expired OTP', 401)
    }

    return successResponse(result, 'Verified')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }

    console.error('Doctor app WhatsApp OTP verify failed:', error)
    return errorResponse('Internal server error', 500)
  }
}
