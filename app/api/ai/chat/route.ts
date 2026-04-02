import { streamText, convertToModelMessages } from 'ai'
import { openai } from '@ai-sdk/openai'
import { google } from '@ai-sdk/google'
import { NextRequest } from 'next/server'
import { getSessionFromRequest } from '@/lib/session'
import { unauthorizedResponse, errorResponse } from '@/lib/api-utils'
import { buildSystemPrompt } from '@/lib/ai/schema-context'
import { createQueryLeadsTool, createQueryAnalyticsTool, createQueryFinanceTool, createExecuteQueryTool, createGetSchemaInfoTool } from '@/lib/ai/tools'
import { getUserById } from '@/lib/auth'

const OPENAI_CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini'

type AIProvider = 'openai' | 'gemini'

function getChatModel(provider: AIProvider) {
  if (provider === 'gemini') {
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return errorResponse('Gemini is not configured. Set GOOGLE_GENERATIVE_AI_API_KEY in .env', 503)
    }
    return google('gemini-2.0-flash')
  }
  // default: openai
  if (!process.env.OPENAI_API_KEY) {
    return errorResponse('OpenAI is not configured. Set OPENAI_API_KEY in .env', 503)
  }
  return openai(OPENAI_CHAT_MODEL)
}

export async function POST(req: NextRequest) {
  try {
    const user = getSessionFromRequest(req)
    if (!user) {
      return unauthorizedResponse('Please log in to use mediendAI')
    }

    const fullUser = await getUserById(user.id)
    if (!fullUser) {
      return unauthorizedResponse()
    }

    const AI_ALLOWED_ROLES = ['ADMIN', 'MD', 'EXECUTIVE_ASSISTANT', 'FINANCE_HEAD']
    if (!AI_ALLOWED_ROLES.includes(fullUser.role)) {
      return errorResponse('Access denied. AI features are not available for your role.', 403)
    }

    const body = await req.json()
    const messages = body.messages

    if (!messages || !Array.isArray(messages)) {
      return errorResponse('Invalid request: messages array required', 400)
    }

    const providerParam = (req.nextUrl.searchParams.get('model') ?? 'openai') as AIProvider
    const modelOrError = getChatModel(providerParam)

    // If getChatModel returned a Response (error), return it directly
    if (modelOrError instanceof Response) return modelOrError

    const systemPrompt = buildSystemPrompt(fullUser.role)

    const cookieHeader = req.headers.get('cookie') || ''
    const tools = {
      queryLeads: createQueryLeadsTool(fullUser),
      queryAnalytics: createQueryAnalyticsTool(fullUser),
      queryFinance: createQueryFinanceTool(fullUser),
      executeQuery: createExecuteQueryTool(cookieHeader),
      getSchemaInfo: createGetSchemaInfoTool(),
    }

    const modelMessages = await convertToModelMessages(messages, { tools })

    const result = streamText({
      model: modelOrError,
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
