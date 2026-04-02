import { streamText, convertToModelMessages } from 'ai'
import { openai } from '@ai-sdk/openai'
import { google } from '@ai-sdk/google'
import { groq } from '@ai-sdk/groq'
import { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { unauthorizedResponse, errorResponse } from '@/lib/api-utils'
import { buildSystemPrompt } from '@/lib/ai/schema-context'
import { createQueryLeadsTool, createQueryAnalyticsTool, createQueryFinanceTool, createExecuteQueryTool, createGetSchemaInfoTool } from '@/lib/ai/tools'
import { getUserById } from '@/lib/auth'

// Provider order: Google (if GOOGLE_GENERATIVE_AI_API_KEY) → OpenAI → Groq
const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'

function getChatModel() {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return google('gemini-2.0-flash')
  }
  if (process.env.OPENAI_API_KEY) {
    return openai(OPENAI_CHAT_MODEL)
  }
  if (process.env.GROQ_API_KEY) {
    return groq('llama-3.3-70b-versatile')
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const user = getSessionFromRequest(req)
    if (!user) {
      return unauthorizedResponse('Please log in to use mediendAI')
    }

    // Get full user data for role context
    const fullUser = await getUserById(user.id)
    if (!fullUser) {
      return unauthorizedResponse()
    }

    // Only allowed roles can use AI chat
    const AI_ALLOWED_ROLES = ['ADMIN', 'MD', 'EXECUTIVE_ASSISTANT', 'FINANCE_HEAD']
    if (!AI_ALLOWED_ROLES.includes(fullUser.role)) {
      return errorResponse('Access denied. AI features are not available for your role.', 403)
    }

    const body = await req.json()
    const messages = body.messages

    if (!messages || !Array.isArray(messages)) {
      return errorResponse('Invalid request: messages array required', 400)
    }

    // Build system prompt with user role context
    const systemPrompt = buildSystemPrompt(fullUser.role)

    // Create tools with user context
    const cookieHeader = req.headers.get('cookie') || ''
    const tools = {
      queryLeads: createQueryLeadsTool(fullUser),
      queryAnalytics: createQueryAnalyticsTool(fullUser),
      queryFinance: createQueryFinanceTool(fullUser),
      executeQuery: createExecuteQueryTool(cookieHeader),
      getSchemaInfo: createGetSchemaInfoTool(),
    }

    const model = getChatModel()
    if (!model) {
      return errorResponse(
        'No AI provider configured. Set OPENAI_API_KEY, GROQ_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY in .env',
        503
      )
    }

    // Client sends UIMessage[] (id, role, parts); streamText expects CoreMessage[] (role, content).
    const modelMessages = await convertToModelMessages(messages, { tools })

    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      tools,
      temperature: 0.7,
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error('Error in AI chat:', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to process chat request',
      500
    )
  }
}
