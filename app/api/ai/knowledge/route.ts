import { NextRequest } from 'next/server'
import { UserRole, KnowledgeVisibility, KnowledgeSourceType } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { getUserById } from '@/lib/auth'
import {
  errorResponse,
  successResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { uploadFileToS3 } from '@/lib/s3-client'
import {
  extractTextFromUpload,
  replaceDocumentChunks,
} from '@/lib/ai/knowledge'

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.EXECUTIVE_ASSISTANT]

async function requireKnowledgeAdmin(req: NextRequest) {
  const session = getSessionFromRequest(req)
  if (!session) return { error: unauthorizedResponse('Please log in') as Response }
  const user = await getUserById(session.id)
  if (!user) return { error: unauthorizedResponse() as Response }
  if (!ADMIN_ROLES.includes(user.role)) {
    return { error: errorResponse('Only SUPER_ADMIN or EXECUTIVE_ASSISTANT can manage knowledge documents', 403) as Response }
  }
  return { user }
}

/** GET /api/ai/knowledge — list documents */
export async function GET(req: NextRequest) {
  try {
    const gate = await requireKnowledgeAdmin(req)
    if ('error' in gate && gate.error) return gate.error

    const docs = await prisma.knowledgeDocument.findMany({
      include: {
        uploadedBy: { select: { id: true, name: true } },
        roles: true,
        users: { include: { user: { select: { id: true, name: true, email: true } } } },
        departments: { include: { department: { select: { id: true, name: true } } } },
        _count: { select: { chunks: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return successResponse(docs)
  } catch (err) {
    console.error('[ai/knowledge GET]', err)
    return errorResponse(err instanceof Error ? err.message : 'Failed to list documents', 500)
  }
}

/** POST /api/ai/knowledge — create document (JSON text or multipart upload) */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireKnowledgeAdmin(req)
    if ('error' in gate && gate.error) return gate.error
    const user = gate.user!

    const contentType = req.headers.get('content-type') || ''
    let title = ''
    let description: string | null = null
    let contentText = ''
    let visibility: KnowledgeVisibility = KnowledgeVisibility.GENERAL
    let roles: string[] = []
    let userIds: string[] = []
    let departmentIds: string[] = []
    let fileUrl: string | null = null
    let mimeType: string | null = null
    let sourceType: KnowledgeSourceType = KnowledgeSourceType.TEXT

    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData()
      title = String(form.get('title') || '').trim()
      description = (form.get('description') as string) || null
      const pasted = String(form.get('contentText') || '')
      visibility =
        form.get('visibility') === 'RESTRICTED'
          ? KnowledgeVisibility.RESTRICTED
          : KnowledgeVisibility.GENERAL
      roles = parseJsonArray(form.get('roles'))
      userIds = parseJsonArray(form.get('userIds'))
      departmentIds = parseJsonArray(form.get('departmentIds'))

      const file = form.get('file')
      if (file && typeof file !== 'string') {
        const buffer = Buffer.from(await file.arrayBuffer())
        mimeType = file.type || null
        const uploaded = await uploadFileToS3(buffer, file.name, 'knowledge')
        fileUrl = uploaded.url
        sourceType = KnowledgeSourceType.UPLOAD
        contentText = await extractTextFromUpload(buffer, mimeType, file.name)
      } else {
        contentText = pasted
      }
    } else {
      const body = await req.json()
      title = String(body.title || '').trim()
      description = body.description ?? null
      contentText = String(body.contentText || '')
      visibility =
        body.visibility === 'RESTRICTED'
          ? KnowledgeVisibility.RESTRICTED
          : KnowledgeVisibility.GENERAL
      roles = Array.isArray(body.roles) ? body.roles.map(String) : []
      userIds = Array.isArray(body.userIds) ? body.userIds.map(String) : []
      departmentIds = Array.isArray(body.departmentIds)
        ? body.departmentIds.map(String)
        : []
      sourceType = KnowledgeSourceType.TEXT
    }

    if (!title) return errorResponse('title is required', 400)
    if (!contentText.trim()) {
      return errorResponse('Document content is empty — provide text or a readable file', 400)
    }
    if (visibility === KnowledgeVisibility.RESTRICTED) {
      if (roles.length === 0 && userIds.length === 0 && departmentIds.length === 0) {
        return errorResponse(
          'Restricted documents need at least one role, user, or department audience',
          400
        )
      }
    }

    const doc = await prisma.knowledgeDocument.create({
      data: {
        title,
        description,
        sourceType,
        fileUrl,
        mimeType,
        contentText,
        visibility,
        uploadedById: user.id,
        roles: {
          create: roles.map((role) => ({ role })),
        },
        users: {
          create: userIds.map((userId) => ({ userId })),
        },
        departments: {
          create: departmentIds.map((departmentId) => ({ departmentId })),
        },
      },
    })

    const chunkCount = await replaceDocumentChunks(doc.id, contentText)

    return successResponse({ ...doc, chunkCount })
  } catch (err) {
    console.error('[ai/knowledge POST]', err)
    return errorResponse(err instanceof Error ? err.message : 'Failed to create document', 500)
  }
}

function parseJsonArray(value: FormDataEntryValue | null): string[] {
  if (!value || typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
}
