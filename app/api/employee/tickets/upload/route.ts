import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { uploadFileToS3 } from '@/lib/s3-client'

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    const employee = await prisma.employee.findUnique({
      where: { userId: user.id },
    })

    if (!employee) {
      return errorResponse('Employee record not found', 404)
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file || !(file instanceof Blob)) {
      return errorResponse('No file provided', 400)
    }

    if (file.size > MAX_BYTES) {
      return errorResponse('File too large (max 10 MB)', 400)
    }

    const type = file.type || ''
    if (type && !ALLOWED_TYPES.has(type)) {
      return errorResponse('Only PDF and image files (JPEG, PNG, GIF, WebP) are allowed', 400)
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const result = await uploadFileToS3(buffer, file.name, `support-tickets/${employee.id}`)

    return successResponse({ url: result.url, key: result.key }, 'Uploaded')
  } catch (error) {
    console.error('Ticket attachment upload error:', error)
    const msg = error instanceof Error ? error.message : 'Upload failed'
    return errorResponse(msg.includes('AWS') ? 'File storage is not configured' : msg, 500)
  }
}
