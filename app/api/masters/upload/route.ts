import { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { hasEffectivePermission } from '@/lib/rbac-new'
import { errorResponse, successResponse, unauthorizedResponse, forbiddenResponse } from '@/lib/api-utils'
import { uploadFileToS3 } from '@/lib/s3-client'
import { KYP_UPLOAD_MAX_BYTES } from '@/lib/upload-limits'

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!(await hasEffectivePermission(user, 'masters:write'))) return forbiddenResponse()

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'masters'

    if (!file) return errorResponse('No file provided', 400)
    if (file.size > KYP_UPLOAD_MAX_BYTES) {
      return errorResponse(
        `File too large (max ${KYP_UPLOAD_MAX_BYTES / (1024 * 1024)} MB)`,
        413,
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadFileToS3(buffer, file.name, folder)
    return successResponse(result, 'File uploaded successfully')
  } catch (error) {
    console.error('Error uploading master-data file:', error)
    const message = error instanceof Error ? error.message : 'Failed to upload file'
    return errorResponse(message, 500)
  }
}
