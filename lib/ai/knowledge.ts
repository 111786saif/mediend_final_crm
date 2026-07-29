import { prisma } from '@/lib/prisma'
import type { AiActor } from '@/lib/ai/actor'
import { UserRole } from '@/generated/prisma/client'

export interface KnowledgeSearchHit {
  chunkId: string
  documentId: string
  title: string
  chunkIndex: number
  content: string
  rank: number
}

const CHUNK_SIZE = 1200
const CHUNK_OVERLAP = 150

/** Split plain text into overlapping chunks for FTS. */
export function chunkText(text: string): string[] {
  const cleaned = text.replace(/\r\n/g, '\n').trim()
  if (!cleaned) return []
  if (cleaned.length <= CHUNK_SIZE) return [cleaned]

  const chunks: string[] = []
  let start = 0
  while (start < cleaned.length) {
    const end = Math.min(start + CHUNK_SIZE, cleaned.length)
    chunks.push(cleaned.slice(start, end))
    if (end >= cleaned.length) break
    start = Math.max(0, end - CHUNK_OVERLAP)
  }
  return chunks
}

/**
 * Search knowledge base with audience predicate enforced inside SQL WHERE.
 * SUPER_ADMIN and MD bypass audience restrictions.
 */
export async function searchKnowledgeBase(
  actor: AiActor,
  query: string,
  limit = 8
): Promise<KnowledgeSearchHit[]> {
  const q = query.trim()
  if (!q) return []

  const bypassAudience =
    actor.user.role === UserRole.SUPER_ADMIN || actor.user.role === UserRole.MD

  if (bypassAudience) {
    return prisma.$queryRaw<KnowledgeSearchHit[]>`
      SELECT
        c.id AS "chunkId",
        c."documentId" AS "documentId",
        d.title AS title,
        c."chunkIndex" AS "chunkIndex",
        c.content AS content,
        ts_rank(c.search_vector, websearch_to_tsquery('english', ${q})) AS rank
      FROM "KnowledgeChunk" c
      INNER JOIN "KnowledgeDocument" d ON d.id = c."documentId"
      WHERE d."isActive" = true
        AND c.search_vector @@ websearch_to_tsquery('english', ${q})
      ORDER BY rank DESC
      LIMIT ${limit}
    `
  }

  const role = actor.user.role
  const userId = actor.user.id
  const departmentId = actor.departmentId

  return prisma.$queryRaw<KnowledgeSearchHit[]>`
    SELECT
      c.id AS "chunkId",
      c."documentId" AS "documentId",
      d.title AS title,
      c."chunkIndex" AS "chunkIndex",
      c.content AS content,
      ts_rank(c.search_vector, websearch_to_tsquery('english', ${q})) AS rank
    FROM "KnowledgeChunk" c
    INNER JOIN "KnowledgeDocument" d ON d.id = c."documentId"
    WHERE d."isActive" = true
      AND c.search_vector @@ websearch_to_tsquery('english', ${q})
      AND (
        d.visibility = 'GENERAL'
        OR EXISTS (
          SELECT 1 FROM "KnowledgeDocumentRole" r
          WHERE r."documentId" = d.id AND r.role = ${role}
        )
        OR EXISTS (
          SELECT 1 FROM "KnowledgeDocumentUser" u
          WHERE u."documentId" = d.id AND u."userId" = ${userId}
        )
        OR (
          ${departmentId}::text IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM "KnowledgeDocumentDepartment" dep
            WHERE dep."documentId" = d.id AND dep."departmentId" = ${departmentId}
          )
        )
      )
    ORDER BY rank DESC
    LIMIT ${limit}
  `
}

export async function replaceDocumentChunks(documentId: string, text: string) {
  const chunks = chunkText(text)
  await prisma.$transaction([
    prisma.knowledgeChunk.deleteMany({ where: { documentId } }),
    ...chunks.map((content, chunkIndex) =>
      prisma.knowledgeChunk.create({
        data: { documentId, chunkIndex, content },
      })
    ),
  ])
  return chunks.length
}

export async function extractTextFromUpload(
  buffer: Buffer,
  mimeType: string | null,
  fileName: string
): Promise<string> {
  const lower = fileName.toLowerCase()
  const mime = (mimeType || '').toLowerCase()

  if (
    mime.includes('text/') ||
    lower.endsWith('.txt') ||
    lower.endsWith('.md') ||
    lower.endsWith('.markdown') ||
    lower.endsWith('.csv')
  ) {
    return buffer.toString('utf8')
  }

  if (mime.includes('pdf') || lower.endsWith('.pdf')) {
    try {
      const { PDFParse } = await import('pdf-parse')
      const parser = new PDFParse({ data: new Uint8Array(buffer) })
      const result = await parser.getText()
      await parser.destroy().catch(() => undefined)
      return result.text || ''
    } catch (err) {
      console.error('[knowledge] pdf extract failed', err)
      throw new Error('Failed to extract text from PDF. Paste the text instead.')
    }
  }

  if (
    mime.includes('word') ||
    mime.includes('officedocument') ||
    lower.endsWith('.docx')
  ) {
    try {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      return result.value || ''
    } catch (err) {
      console.error('[knowledge] docx extract failed', err)
      throw new Error('Failed to extract text from DOCX. Paste the text instead.')
    }
  }

  throw new Error(
    'Unsupported file type. Upload .txt, .md, .pdf, or .docx, or paste text directly.'
  )
}
