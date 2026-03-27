import { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { uploadFileToS3 } from '@/lib/s3-client'

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()

    if (!hasPermission(user, 'hrms:recruitment:write')) {
      return errorResponse('Forbidden', 403)
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file || !(file instanceof Blob)) {
      return errorResponse('No file provided', 400)
    }

    if (file.size > MAX_BYTES) {
      return errorResponse('File too large (max 10MB)', 400)
    }

    const type = file.type || ''
    if (type && !ALLOWED.has(type)) {
      return errorResponse('Only PDF and Word documents are allowed', 400)
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const result = await uploadFileToS3(buffer, file.name, 'hr/interview-resumes')

    return successResponse({ url: result.url, key: result.key }, 'Uploaded')
  } catch (error) {
    console.error('Resume upload error:', error)
    const msg = error instanceof Error ? error.message : 'Upload failed'
    return errorResponse(msg.includes('AWS') ? 'File storage is not configured' : msg, 500)
  }
}
