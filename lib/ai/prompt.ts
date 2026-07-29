import type { AiActor } from '@/lib/ai/actor'

/**
 * Role-aware system prompt for mediend AI.
 * No DB schema dump — tools are the only data access path.
 */
export function buildSystemPrompt(actor: AiActor, toolNames: string[]): string {
  const teamSize = actor.subordinateUserIds.length
  const lines = [
    'You are mediend AI, the internal assistant for the Mediend portal.',
    `The current user is ${actor.user.name} (role: ${actor.user.role}).`,
    teamSize > 0
      ? `They manage a team of ${teamSize} people (direct + indirect reports).`
      : 'They do not manage a team — answer only about their own data.',
    '',
    'Rules:',
    '1. Never invent numbers, names, dates, or KPIs. Only report values returned by tools.',
    '2. If a tool returns error OUT_OF_SCOPE or NOT_FOUND, clearly tell the user they do not have access or the data was not found — do not guess.',
    '3. Prefer calling the most specific tool for the question. You may call multiple tools when needed.',
    '4. When presenting lists or comparisons, use markdown tables.',
    '5. Keep answers concise and actionable. Use INR formatting for money when relevant.',
    '6. You cannot mutate data (no leave applications, no target edits) — read-only assistant.',
    '',
    `Available tools for this user: ${toolNames.join(', ') || '(none)'}.`,
  ]

  return lines.join('\n')
}

/** Suggested prompts keyed by tool availability. */
export function suggestedPromptsForTools(toolNames: string[]): string[] {
  const set = new Set(toolNames)
  const prompts: string[] = []

  if (set.has('getMyTargetProgress')) {
    prompts.push('What is my target this month and how much have I completed?')
  }
  if (set.has('getMyIpdCount')) {
    prompts.push('How many IPDs have I done this month?')
  }
  if (set.has('getMyLeaveBalance')) {
    prompts.push('How many leaves do I have left?')
  }
  if (set.has('getMyAttendanceStats')) {
    prompts.push('How is my attendance this month?')
  }
  if (set.has('getTeamAttendanceSummary')) {
    prompts.push('How many of my staff were present today?')
  }
  if (set.has('getTeamIpdLeaderboard')) {
    prompts.push('Who has done the highest IPD on my team this month?')
  }
  if (set.has('getTeamMemberSnapshot')) {
    prompts.push('Show me a snapshot of [team member name] this month')
  }
  if (set.has('getOrgSalesKpis')) {
    prompts.push('What is the total revenue this month?')
  }
  if (set.has('getOrgHrKpis')) {
    prompts.push('How many employees are present vs absent today?')
  }
  if (set.has('searchKnowledgeBase')) {
    prompts.push('How do I mark a lead as IPD done?')
  }

  return prompts.slice(0, 6)
}
