import { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { uploadFileToS3 } from '@/lib/s3-client'
import { KYP_UPLOAD_MAX_BYTES } from '@/lib/upload-limits'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png'])

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'compliance:write')) return errorResponse('Forbidden', 403)

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return errorResponse('No file provided', 400)

    if (file.size > KYP_UPLOAD_MAX_BYTES) {
      return errorResponse(
        `File too large (max ${KYP_UPLOAD_MAX_BYTES / (1024 * 1024)} MB)`,
        413,
      )
    }

    const type = file.type?.toLowerCase() ?? ''
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const allowedByExt = ext === 'jpg' || ext === 'jpeg' || ext === 'png'
    if (type && !ALLOWED_TYPES.has(type) && !allowedByExt) {
      return errorResponse('Only JPG, JPEG, and PNG images are allowed', 400)
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const result = await uploadFileToS3(buffer, file.name, 'compliance/reviews')

    return successResponse(result, 'File uploaded successfully')
  } catch (error) {
    console.error('Compliance review upload error:', error)
    const message = error instanceof Error ? error.message : 'Failed to upload file'
    return errorResponse(message, 500)
  }
}
