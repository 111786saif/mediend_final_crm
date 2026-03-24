import { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { uploadFileToS3 } from '@/lib/s3-client'
import { KYP_UPLOAD_MAX_BYTES } from '@/lib/upload-limits'

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) {
      return unauthorizedResponse()
    }

    if (!hasPermission(user, 'leads:write')) {
      return errorResponse('Forbidden', 403)
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'kyp'

    if (!file) {
      return errorResponse('No file provided', 400)
    }

    if (file.size > KYP_UPLOAD_MAX_BYTES) {
      return errorResponse(
        `File too large (max ${KYP_UPLOAD_MAX_BYTES / (1024 * 1024)} MB)`,
        413
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to S3
    const result = await uploadFileToS3(buffer, file.name, folder)

    return successResponse(result, 'File uploaded successfully')
  } catch (error) {
    console.error('Error uploading file:', error)
    return errorResponse('Failed to upload file', 500)
  }
}
