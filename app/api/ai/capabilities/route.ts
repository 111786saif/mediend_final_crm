import { NextRequest } from 'next/server'
import { successResponse, unauthorizedResponse, errorResponse } from '@/lib/api-utils'
import { buildAiActor, actorCanManageKnowledge } from '@/lib/ai/actor'
import { listToolNamesForActor } from '@/lib/ai/registry'
import { suggestedPromptsForTools } from '@/lib/ai/prompt'
import '@/lib/ai/tools'

/** GET /api/ai/capabilities — tools + suggested prompts for the current actor */
export async function GET(req: NextRequest) {
  try {
    const actor = await buildAiActor(req)
    if (!actor) return unauthorizedResponse()

    const tools = listToolNamesForActor(actor)
    return successResponse({
      role: actor.user.role,
      name: actor.user.name,
      teamSize: actor.subordinateUserIds.length,
      isGlobal: actor.isGlobal,
      canManageKnowledge: actorCanManageKnowledge(actor),
      tools,
      suggestedPrompts: suggestedPromptsForTools(tools),
    })
  } catch (err) {
    console.error('[ai/capabilities]', err)
    return errorResponse(
      err instanceof Error ? err.message : 'Failed to load capabilities',
      500
    )
  }
}
