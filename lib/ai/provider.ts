import { createOpenAI } from '@ai-sdk/openai'

/**
 * Command Code OpenAI-compatible gateway.
 * Uses @ai-sdk/openai (spec v3) — openai-compatible@3.x returns v4 models, which ai@6 rejects.
 * Models: deepseek/deepseek-v4-flash, Qwen/Qwen3.6-Plus, etc. (see opencode.json)
 */
const gateway = createOpenAI({
  name: 'commandcode',
  baseURL: process.env.AI_GATEWAY_BASE_URL ?? 'https://api.commandcode.ai/provider/v1',
  apiKey: process.env.AI_GATEWAY_API_KEY ?? '',
})

export function chatModel() {
  if (!process.env.AI_GATEWAY_API_KEY) {
    throw new Error(
      'AI gateway is not configured. Set AI_GATEWAY_API_KEY (and optionally AI_GATEWAY_BASE_URL / AI_CHAT_MODEL) in .env'
    )
  }
  const modelId = process.env.AI_CHAT_MODEL ?? 'deepseek/deepseek-v4-flash'
  // Gateway exposes arbitrary model IDs; OpenAI typings are for OpenAI SKUs only.
  return gateway.chat(modelId as Parameters<typeof gateway.chat>[0])
}

export function isAiGatewayConfigured(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY?.trim())
}
