import { createOpenAI } from '@ai-sdk/openai'

const COMMAND_CODE_BASE_URL = 'https://api.commandcode.ai/provider/v1'
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'

/** Strip optional surrounding quotes from .env values (common in Docker env_file). */
function cleanEnvValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  return trimmed.replace(/^['"]|['"]$/g, '')
}

/**
 * Command Code keys from Studio (user_…). DeepSeek keys from platform.deepseek.com (sk-…).
 * We accept several env names; do not fall back to OPENAI_API_KEY.
 */
export function resolveGatewayApiKey(): string | undefined {
  for (const name of ['AI_GATEWAY_API_KEY', 'COMMAND_CODE_API_KEY', 'CMD_API_KEY', 'DEEPSEEK_API_KEY']) {
    const value = cleanEnvValue(process.env[name])
    if (value) return value
  }
  return undefined
}

function resolveGatewayBaseUrl(): string {
  return cleanEnvValue(process.env.AI_GATEWAY_BASE_URL) ?? COMMAND_CODE_BASE_URL
}

function isCommandCodeBaseUrl(baseURL: string): boolean {
  return baseURL.includes('commandcode.ai')
}

function isDeepSeekBaseUrl(baseURL: string): boolean {
  return baseURL.includes('deepseek.com')
}

/** Normalize model id for the configured gateway (Command Code vs DeepSeek direct). */
function resolveChatModelId(baseURL: string): string {
  let modelId = cleanEnvValue(process.env.AI_CHAT_MODEL) ?? 'deepseek/deepseek-v4-flash'

  if (isDeepSeekBaseUrl(baseURL)) {
    // DeepSeek API: deepseek-v4-flash (no deepseek/ prefix)
    if (modelId.startsWith('deepseek/')) {
      modelId = modelId.slice('deepseek/'.length)
    }
    if (!modelId) modelId = 'deepseek-v4-flash'
  }

  return modelId
}

function assertGatewayCredentials(baseURL: string, apiKey: string): void {
  const commandCode = isCommandCodeBaseUrl(baseURL)
  const deepSeek = isDeepSeekBaseUrl(baseURL)

  if (commandCode && apiKey.startsWith('sk-')) {
    throw new Error(
      'AI_GATEWAY_API_KEY looks like a DeepSeek key (sk-…) but AI_GATEWAY_BASE_URL points at Command Code. ' +
        'Either use a Command Code Studio key (user_… from commandcode.ai) with the default base URL, ' +
        'or switch to DeepSeek direct: AI_GATEWAY_BASE_URL=https://api.deepseek.com and AI_CHAT_MODEL=deepseek-v4-flash'
    )
  }

  if (deepSeek && apiKey.startsWith('user_')) {
    throw new Error(
      'AI_GATEWAY_API_KEY looks like a Command Code key (user_…) but AI_GATEWAY_BASE_URL points at DeepSeek. ' +
        'Use a DeepSeek platform key (sk-… from platform.deepseek.com) or switch the base URL back to Command Code.'
    )
  }

  if (commandCode && !apiKey.startsWith('user_') && !apiKey.startsWith('sk-')) {
    console.warn(
      '[ai/provider] Command Code keys usually start with user_. Check Studio if requests return 401.'
    )
  }
}

/**
 * OpenAI-compatible LLM gateway (Command Code or DeepSeek direct).
 * Uses @ai-sdk/openai (spec v3).
 */
function createGateway() {
  const apiKey = resolveGatewayApiKey()
  if (!apiKey) {
    throw new Error(
      'AI gateway is not configured. Set AI_GATEWAY_API_KEY (Command Code user_… or DeepSeek sk-…) in .env'
    )
  }

  const baseURL = resolveGatewayBaseUrl()
  assertGatewayCredentials(baseURL, apiKey)

  return createOpenAI({
    name: isDeepSeekBaseUrl(baseURL) ? 'deepseek' : 'commandcode',
    baseURL,
    apiKey,
  })
}

export function chatModel() {
  const baseURL = resolveGatewayBaseUrl()
  const gateway = createGateway()
  const modelId = resolveChatModelId(baseURL)
  return gateway.chat(modelId as Parameters<typeof gateway.chat>[0])
}

export function isAiGatewayConfigured(): boolean {
  return Boolean(resolveGatewayApiKey())
}

export { COMMAND_CODE_BASE_URL, DEEPSEEK_BASE_URL }
