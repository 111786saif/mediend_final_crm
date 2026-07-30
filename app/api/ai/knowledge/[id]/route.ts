import { NextRequest } from 'next/server'
import { UserRole, KnowledgeVisibility } from '@/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionFromRequest } from '@/lib/session'
import { getUserById } from '@/lib/auth'
import {
  errorResponse,
  successResponse,
  unauthorizedResponse,
} from '@/lib/api-utils'
import { replaceDocumentChunks } from '@/lib/ai/knowledge'

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.EXECUTIVE_ASSISTANT]

async function requireAdmin(req: NextRequest) {
  const session = getSessionFromRequest(req)
  if (!session) return { error: unauthorizedResponse() as Response }
  const user = await getUserById(session.id)
  if (!user || !ADMIN_ROLES.includes(user.role)) {
    return { error: errorResponse('Forbidden', 403) as Response }
  }
  return { user }
}

/** PATCH /api/ai/knowledge/[id] — update metadata / audience / content */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin(req)
    if ('error' in gate && gate.error) return gate.error

    const { id } = await ctx.params
    const body = await req.json()

    const existing = await prisma.knowledgeDocument.findUnique({ where: { id } })
    if (!existing) return errorResponse('Document not found', 404)

    const visibility: KnowledgeVisibility =
      body.visibility === 'RESTRICTED'
        ? KnowledgeVisibility.RESTRICTED
        : body.visibility === 'GENERAL'
          ? KnowledgeVisibility.GENERAL
          : existing.visibility

    await prisma.$transaction(async (tx) => {
      await tx.knowledgeDocument.update({
        where: { id },
        data: {
          title: body.title !== undefined ? String(body.title) : undefined,
          description:
            body.description !== undefined ? body.description : undefined,
          visibility,
          isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
          contentText:
            body.contentText !== undefined ? String(body.contentText) : undefined,
        },
      })

      if (Array.isArray(body.roles)) {
        await tx.knowledgeDocumentRole.deleteMany({ where: { documentId: id } })
        if (body.roles.length) {
          await tx.knowledgeDocumentRole.createMany({
            data: body.roles.map((role: string) => ({ documentId: id, role: String(role) })),
          })
        }
      }
      if (Array.isArray(body.userIds)) {
        await tx.knowledgeDocumentUser.deleteMany({ where: { documentId: id } })
        if (body.userIds.length) {
          await tx.knowledgeDocumentUser.createMany({
            data: body.userIds.map((userId: string) => ({
              documentId: id,
              userId: String(userId),
            })),
          })
        }
      }
      if (Array.isArray(body.departmentIds)) {
        await tx.knowledgeDocumentDepartment.deleteMany({ where: { documentId: id } })
        if (body.departmentIds.length) {
          await tx.knowledgeDocumentDepartment.createMany({
            data: body.departmentIds.map((departmentId: string) => ({
              documentId: id,
              departmentId: String(departmentId),
            })),
          })
        }
      }
    })

    if (typeof body.contentText === 'string') {
      await replaceDocumentChunks(id, body.contentText)
    }

    const doc = await prisma.knowledgeDocument.findUnique({
      where: { id },
      include: {
        roles: true,
        users: true,
        departments: true,
        _count: { select: { chunks: true } },
      },
    })

    return successResponse(doc)
  } catch (err) {
    console.error('[ai/knowledge PATCH]', err)
    return errorResponse(err instanceof Error ? err.message : 'Failed to update', 500)
  }
}

/** DELETE /api/ai/knowledge/[id] */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const gate = await requireAdmin(req)
    if ('error' in gate && gate.error) return gate.error

    const { id } = await ctx.params
    await prisma.knowledgeDocument.delete({ where: { id } })
    return successResponse({ deleted: true })
  } catch (err) {
    console.error('[ai/knowledge DELETE]', err)
    return errorResponse(err instanceof Error ? err.message : 'Failed to delete', 500)
  }
}
