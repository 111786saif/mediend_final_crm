import { z } from 'zod'
import { registerTool } from '@/lib/ai/registry'
import { searchKnowledgeBase } from '@/lib/ai/knowledge'

registerTool({
  name: 'searchKnowledgeBase',
  description:
    'Search company knowledge documents (HR rules, platform guides, role-restricted docs) the user is allowed to see. Use for how-to / policy / process questions.',
  scope: 'SELF',
  inputSchema: z.object({
    query: z.string().min(1).describe('Natural language search query'),
    limit: z.number().int().min(1).max(15).default(6).optional(),
  }),
  execute: async ({ query, limit }, actor) => {
    const hits = await searchKnowledgeBase(actor, query, limit ?? 6)
    return {
      count: hits.length,
      results: hits.map((h) => ({
        documentId: h.documentId,
        title: h.title,
        chunkIndex: h.chunkIndex,
        excerpt: h.content.slice(0, 800),
        rank: Number(h.rank),
      })),
    }
  },
})
