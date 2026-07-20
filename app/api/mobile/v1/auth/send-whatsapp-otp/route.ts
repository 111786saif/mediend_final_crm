import { NextRequest } from 'next/server'
import { z } from 'zod'
import { errorResponse, successResponse, zodErrorResponse } from '@/lib/api-utils'
import { DoctorAppWhatsappOtpError, sendDoctorAppWhatsappOtp } from '@/lib/doctor-app/auth'

const sendWhatsappOtpSchema = z.object({
  phone: z.string().min(8).max(20).trim(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone } = sendWhatsappOtpSchema.parse(body)

    const result = await sendDoctorAppWhatsappOtp(phone)
    if (!result) {
      return errorResponse('No doctor account found for this phone number', 401)
    }

    return successResponse(result, 'OTP sent')
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error)
    }
    if (error instanceof DoctorAppWhatsappOtpError) {
      return errorResponse(error.message, error.status)
    }
    if (error instanceof Error && error.message) {
      return errorResponse(error.message, 400)
    }

    console.error('Doctor app WhatsApp OTP send failed:', error)
    return errorResponse('Internal server error', 500)
  }
}
