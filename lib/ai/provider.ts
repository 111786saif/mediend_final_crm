import { createOpenAI } from '@ai-sdk/openai'

const DEFAULT_BASE_URL = 'https://api.commandcode.ai/provider/v1'

/** Strip optional surrounding quotes from .env values (common in Docker env_file). */
function cleanEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  return trimmed.replace(/^['"]|['"]$/g, '')
}

/**
 * Command Code keys are usually `user_…` (see commandcode.ai/docs/studio/api-keys).
 * We accept several env names; do not fall back to OPENAI_API_KEY.
 */
export function resolveGatewayApiKey(): string | undefined {
  for (const name of ['AI_GATEWAY_API_KEY', 'COMMAND_CODE_API_KEY', 'CMD_API_KEY']) {
    const value = cleanEnvValue(process.env[name])
    if (value) return value
  }
  return undefined
}

function resolveGatewayBaseUrl(): string {
  return cleanEnvValue(process.env.AI_GATEWAY_BASE_URL) ?? DEFAULT_BASE_URL
}

/**
 * Command Code OpenAI-compatible gateway.
 * Uses @ai-sdk/openai (spec v3) — openai-compatible@3.x returns v4 models, which ai@6 rejects.
 */
function createGateway() {
  const apiKey = resolveGatewayApiKey()
  if (!apiKey) {
    throw new Error(
      'AI gateway is not configured. Set AI_GATEWAY_API_KEY (or COMMAND_CODE_API_KEY) in .env'
    )
  }

  return createOpenAI({
    name: 'commandcode',
    baseURL: resolveGatewayBaseUrl(),
    apiKey,
  })
}

export function chatModel() {
  const gateway = createGateway()
  const modelId = cleanEnvValue(process.env.AI_CHAT_MODEL) ?? 'deepseek/deepseek-v4-flash'
  // Gateway exposes arbitrary model IDs; OpenAI typings are for OpenAI SKUs only.
  return gateway.chat(modelId as Parameters<typeof gateway.chat>[0])
}

export function isAiGatewayConfigured(): boolean {
  return Boolean(resolveGatewayApiKey())
}
