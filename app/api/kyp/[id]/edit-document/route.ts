import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { errorResponse, successResponse, unauthorizedResponse } from '@/lib/api-utils'
import { z } from 'zod'

const EDITABLE_FIELDS = [
  'aadharFileUrl',
  'aadharFiles',
  'panFileUrl',
  'panFiles',
  'insuranceCardFileUrl',
  'prescriptionFileUrl',
  'diseasePhotos',
  'otherFiles',
] as const

const MAX_EDITS = 1

const editDocumentSchema = z.object({
  documentField: z.enum(EDITABLE_FIELDS),
  newFileUrl: z.string().url().optional(),
  newFiles: z.array(z.object({ name: z.string(), url: z.string() })).optional(),
})

/**
 * POST /api/kyp/[id]/edit-document
 * Allows BD to replace an uploaded document on a KYP submission (up to 3 times per field).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getSessionFromRequest(request)
    if (!user) return unauthorizedResponse()
    if (!hasPermission(user, 'leads:write')) return errorResponse('Forbidden', 403)

    const { id: kypId } = await params
    const body = await request.json()
    const { documentField, newFileUrl, newFiles } = editDocumentSchema.parse(body)

    const kyp = await prisma.kYPSubmission.findUnique({
      where: { id: kypId },
      include: {
        lead: { select: { bdId: true } },
      },
    })

    if (!kyp) return errorResponse('KYP submission not found', 404)

    // Verify user is the assigned BD
    if (kyp.lead.bdId !== user.id) {
      return errorResponse('Only the assigned BD can edit documents', 403)
    }

    // Check edit count
    const editCounts = (kyp.documentEditCounts as Record<string, number>) || {}
    const fieldKey = documentField.replace(/FileUrl$/, '').replace(/Files$/, '')
    const currentCount = editCounts[fieldKey] || 0

    if (currentCount >= MAX_EDITS) {
      return errorResponse(`Maximum ${MAX_EDITS} edits reached for this document`, 400)
    }

    // Get old value for history
    const oldValue = (kyp as any)[documentField]

    // Build update data
    const updateData: Record<string, any> = {}
    const isJsonField = ['aadharFiles', 'panFiles', 'diseasePhotos', 'otherFiles'].includes(documentField)

    if (isJsonField) {
      updateData[documentField] = newFiles || []
    } else {
      updateData[documentField] = newFileUrl || null
    }

    // Update edit counts
    const newEditCounts = { ...editCounts, [fieldKey]: currentCount + 1 }
    updateData.documentEditCounts = newEditCounts

    // Append to edit history
    const editHistory = (kyp.documentEditHistory as Array<Record<string, unknown>>) || []
    editHistory.push({
      field: documentField,
      oldValue: oldValue,
      newValue: isJsonField ? newFiles : newFileUrl,
      editedAt: new Date().toISOString(),
      editedById: user.id,
      editNumber: currentCount + 1,
    })
    updateData.documentEditHistory = editHistory

    await prisma.kYPSubmission.update({
      where: { id: kypId },
      data: updateData,
    })

    return successResponse({
      editCount: currentCount + 1,
      remainingEdits: MAX_EDITS - (currentCount + 1),
    }, 'Document updated successfully')
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse('Invalid request data', 400)
    console.error('Error editing KYP document:', error)
    return errorResponse('Failed to edit document', 500)
  }
}
