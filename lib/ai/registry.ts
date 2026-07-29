import { tool, type Tool } from 'ai'
import { z } from 'zod'
import type { UserRole } from '@/generated/prisma/client'
import type { Permission } from '@/lib/rbac'
import type { AiActor } from '@/lib/ai/actor'
import { actorHasTeamScope } from '@/lib/ai/actor'

export type ToolScope = 'SELF' | 'TEAM' | 'GLOBAL'

export interface AiToolDef<TIn extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string
  description: string
  inputSchema: TIn
  scope: ToolScope
  requiresAnyPermission?: Permission[]
  allowedRoles?: UserRole[]
  /** Extra gate beyond scope (e.g. needs employee record) */
  requiresEmployee?: boolean
  execute: (input: z.infer<TIn>, actor: AiActor) => Promise<unknown>
}

const registry: AiToolDef[] = []

export function registerTool<TIn extends z.ZodTypeAny>(def: AiToolDef<TIn>) {
  if (registry.some((t) => t.name === def.name)) {
    throw new Error(`AI tool already registered: ${def.name}`)
  }
  registry.push(def as unknown as AiToolDef)
}

export function getRegisteredToolDefs(): readonly AiToolDef[] {
  return registry
}

function isToolAllowed(def: AiToolDef, actor: AiActor): boolean {
  if (def.requiresEmployee && !actor.employeeId) return false

  if (def.allowedRoles && def.allowedRoles.length > 0) {
    if (!def.allowedRoles.includes(actor.user.role)) return false
  }

  if (def.requiresAnyPermission && def.requiresAnyPermission.length > 0) {
    const ok = def.requiresAnyPermission.some((p) => actor.permissions.has(p))
    if (!ok && !actor.isGlobal) return false
  }

  switch (def.scope) {
    case 'SELF':
      return true
    case 'TEAM':
      return actorHasTeamScope(actor)
    case 'GLOBAL':
      return actor.isGlobal || Boolean(def.allowedRoles?.includes(actor.user.role))
    default:
      return false
  }
}

/**
 * Build the AI SDK tools object for this actor.
 * Disallowed tools are omitted entirely — the model cannot call what it cannot see.
 */
export function buildToolsForActor(actor: AiActor): Record<string, Tool> {
  const out: Record<string, Tool> = {}

  for (const def of registry) {
    if (!isToolAllowed(def, actor)) continue

    out[def.name] = tool({
      description: def.description,
      inputSchema: def.inputSchema,
      execute: async (input) => {
        // Execution-time re-check
        if (!isToolAllowed(def, actor)) {
          return {
            error: 'OUT_OF_SCOPE',
            message: `You do not have permission to use ${def.name}.`,
          }
        }
        try {
          return await def.execute(input, actor)
        } catch (err) {
          console.error(`[ai-tool:${def.name}]`, err)
          return {
            error: 'TOOL_FAILED',
            message: err instanceof Error ? err.message : 'Tool execution failed',
          }
        }
      },
    })
  }

  return out
}

/** Tool names the actor may use (for capabilities / suggested prompts). */
export function listToolNamesForActor(actor: AiActor): string[] {
  return registry.filter((d) => isToolAllowed(d, actor)).map((d) => d.name)
}
