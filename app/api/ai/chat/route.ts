import {
  streamText,
  convertToModelMessages,
  stepCountIs,
  smoothStream,
} from 'ai'
import { NextRequest } from 'next/server'
import { unauthorizedResponse, errorResponse } from '@/lib/api-utils'
import { buildAiActor } from '@/lib/ai/actor'
import { buildToolsForActor } from '@/lib/ai/registry'
import { buildSystemPrompt } from '@/lib/ai/prompt'
import { chatModel, isAiGatewayConfigured } from '@/lib/ai/provider'
import { prisma } from '@/lib/prisma'
import '@/lib/ai/tools'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    if (!isAiGatewayConfigured()) {
      return errorResponse(
        'AI gateway is not configured. Set AI_GATEWAY_API_KEY in .env',
        503
      )
    }

    const actor = await buildAiActor(req)
    if (!actor) {
      return unauthorizedResponse('Please log in to use mediend AI')
    }

    const body = await req.json()
    const messages = body.messages
    if (!messages || !Array.isArray(messages)) {
      return errorResponse('Invalid request: messages array required', 400)
    }

    const tools = buildToolsForActor(actor)
    const toolNames = Object.keys(tools)
    const system = buildSystemPrompt(actor, toolNames)

    // Lightweight audit: create/reuse conversation from body.conversationId
    let conversationId: string | null =
      typeof body.conversationId === 'string' ? body.conversationId : null
    try {
      if (!conversationId) {
        const conv = await prisma.aiConversation.create({
          data: {
            userId: actor.user.id,
            title: 'Chat',
          },
        })
        conversationId = conv.id
      }
    } catch (err) {
      console.warn('[ai/chat] audit conversation create failed', err)
    }

    const modelMessages = await convertToModelMessages(messages, { tools })

    const result = streamText({
      // Command Code gateway returns LanguageModelV4; cast for AI SDK streamText typing.
      model: chatModel() as never,
      system,
      messages: modelMessages,
      tools,
      stopWhen: stepCountIs(6),
      experimental_transform: smoothStream(),
      temperature: 0.2,
      onStepFinish: async ({ toolCalls, toolResults }) => {
        if (!toolCalls?.length) return
        try {
          await prisma.aiToolCall.createMany({
            data: toolCalls.map((tc, i) => {
              const result = toolResults?.[i] as
                | { output?: { error?: string } }
                | undefined
              const errCode =
                result?.output &&
                typeof result.output === 'object' &&
                result.output !== null &&
                'error' in result.output
                  ? String((result.output as { error?: string }).error)
                  : null
              return {
                conversationId,
                userId: actor.user.id,
                toolName: tc.toolName,
                input: tc.input as object,
                denied: errCode === 'OUT_OF_SCOPE',
                errorCode: errCode,
              }
            }),
          })
        } catch (err) {
          console.warn('[ai/chat] tool call audit failed', err)
        }
      },
    })

    return result.toUIMessageStreamResponse({
      headers: conversationId
        ? { 'X-Conversation-Id': conversationId }
        : undefined,
    })
  } catch (error) {
    console.error('Error in AI chat:', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to process chat request',
      500
    )
  }
}
