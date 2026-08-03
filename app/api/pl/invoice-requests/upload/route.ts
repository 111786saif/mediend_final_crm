import { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { uploadFileToS3 } from '@/lib/s3-client'
import {
  INVOICE_ATTACHMENT_MAX_BYTES,
  isAllowedInvoiceAttachment,
} from '@/lib/finance/invoice-request/attachments'

export async function POST(request: NextRequest) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'pl:write')) return errorResponse('Forbidden', 403)

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) return errorResponse('No file provided', 400)
    if (!isAllowedInvoiceAttachment(file)) {
      return errorResponse('Only PDF or image files (JPG, PNG, WEBP, GIF) are allowed', 400)
    }
    if (file.size > INVOICE_ATTACHMENT_MAX_BYTES) {
      return errorResponse('File too large (max 15 MB)', 400)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await uploadFileToS3(buffer, file.name, 'pl/invoice-requests')

    return successResponse(
      { url: result.url, key: result.key, name: file.name },
      'Invoice file uploaded successfully',
    )
  } catch (error) {
    console.error('Error uploading PL invoice file:', error)
    return errorResponse('Failed to upload invoice file', 500)
  }
}
