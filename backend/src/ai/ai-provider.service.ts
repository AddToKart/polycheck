import {
  Inject,
  Injectable,
  Logger,
  Optional,
  RequestTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { randomUUID } from 'node:crypto'
import type { AiCapabilities, AiMissingConfig } from '@polycheck/shared'
import type { RequestUser } from '../auth/authenticated-principal'
import { PrismaService } from '../prisma/prisma.service'
import { SettingsService } from '../settings/settings.service'

export const AI_FETCH = Symbol('AI_FETCH')

export type AiFetch = typeof fetch

export interface AiProviderMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: AiProviderToolCall[]
  tool_call_id?: string
}

export interface AiProviderToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface AiProviderAssistantToolCall {
  id: string
  name: string
  arguments: string
}

export interface AiProviderTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface AiProviderChatResult {
  content: string
  toolCalls: AiProviderAssistantToolCall[]
}

export type AiDeltaHandler = (text: string) => void

const AI_BASE_URL_SETTING = 'ai_base_url'
const AI_MODEL_SETTING = 'ai_model'
const MAX_MESSAGE_CHARS = 2_000
const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_OUTPUT_TOKENS = 1_024
const MASTER_DISABLED_REASON = 'The AI assistant has been disabled by your administrator.'
const TEACHER_DISABLED_REASON = 'The AI assistant is disabled for teachers by your administrator.'
const STUDENT_DISABLED_REASON = 'The AI assistant is disabled for students by your administrator.'

interface ResolvedAiConfig {
  baseUrl: string
  model: string
  apiKey: string
}

interface ToolCallAccumulator {
  id: string
  name: string
  arguments: string
}

@Injectable()
export class AiProviderService {
  private readonly logger = new Logger(AiProviderService.name)
  private readonly defaultSessionId = randomUUID()

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
    @Optional() @Inject(AI_FETCH) private readonly transport?: AiFetch,
  ) {}

  async isConfigured(): Promise<boolean> {
    return (await this.resolveConfig()) !== null
  }

  async describe(user: Pick<RequestUser, 'role'>): Promise<AiCapabilities> {
    const policyBlocked = await this.policyBlockedCapabilities(user)
    if (policyBlocked) return policyBlocked

    const resolved = await this.resolveConfig()
    if (resolved) {
      return { enabled: true, model: resolved.model, maxMessageChars: MAX_MESSAGE_CHARS }
    }
    const [baseUrlSetting, modelSetting, storedKey] = await Promise.all([
      this.readSetting(AI_BASE_URL_SETTING),
      this.readSetting(AI_MODEL_SETTING),
      this.settings.getAiApiKey(),
    ])
    const missing: AiMissingConfig[] = []
    if (!this.pick(baseUrlSetting, 'AI_BASE_URL')) missing.push('base_url')
    if (!this.pick(modelSetting, 'AI_MODEL')) missing.push('model')
    if (!storedKey?.trim() && !this.config.get<string>('AI_API_KEY')?.trim()) missing.push('api_key')
    return {
      enabled: false,
      maxMessageChars: MAX_MESSAGE_CHARS,
      reason: `Assistant is not configured (missing ${missing.join(', ')})`,
      missing,
    }
  }

  /**
   * Institution policy wins over provider configuration: a disabled assistant
   * reports the administrator's reason instead of leaking setup details.
   */
  private async policyBlockedCapabilities(user: Pick<RequestUser, 'role'>): Promise<AiCapabilities | null> {
    if (!(await this.settings.getBoolean('ai_assistant_enabled', true))) {
      return this.policyBlocked(MASTER_DISABLED_REASON)
    }
    if (user.role === 'teacher' && !(await this.settings.getBoolean('ai_assistant_teacher_enabled', true))) {
      return this.policyBlocked(TEACHER_DISABLED_REASON)
    }
    if (user.role === 'student' && !(await this.settings.getBoolean('ai_assistant_student_enabled', true))) {
      return this.policyBlocked(STUDENT_DISABLED_REASON)
    }
    return null
  }

  private policyBlocked(reason: string): AiCapabilities {
    return { enabled: false, policyBlocked: true, maxMessageChars: MAX_MESSAGE_CHARS, reason }
  }

  async chat(
    messages: AiProviderMessage[],
    tools: AiProviderTool[],
    onDelta?: AiDeltaHandler,
    signal?: AbortSignal,
    sessionId?: string,
  ): Promise<AiProviderChatResult> {
    const resolved = await this.resolveConfig()
    if (!resolved) throw new ServiceUnavailableException('Assistant is not configured')

    const controller = new AbortController()
    let timedOut = false
    const timeoutMs = this.positiveInteger(this.config.get('AI_TIMEOUT_MS'), DEFAULT_TIMEOUT_MS)
    const maxOutputTokens = this.positiveInteger(this.config.get('AI_MAX_OUTPUT_TOKENS'), DEFAULT_MAX_OUTPUT_TOKENS)
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        timedOut = true
        controller.abort()
        reject(new RequestTimeoutException('The assistant timed out'))
      }, timeoutMs)
      timer.unref?.()
    })
    const forwardAbort = () => controller.abort()
    if (signal) {
      if (signal.aborted) controller.abort()
      else signal.addEventListener('abort', forwardAbort, { once: true })
    }

    try {
      return await Promise.race([
        this.sendChat(resolved, messages, tools, onDelta, maxOutputTokens, controller.signal, sessionId),
        timeout,
      ])
    } catch (error) {
      if (error instanceof ServiceUnavailableException || error instanceof RequestTimeoutException) throw error
      if (timedOut) throw new RequestTimeoutException('The assistant timed out')
      throw new ServiceUnavailableException('The assistant is temporarily unavailable')
    } finally {
      if (timer) clearTimeout(timer)
      signal?.removeEventListener('abort', forwardAbort)
    }
  }

  private async sendChat(
    resolved: ResolvedAiConfig,
    messages: AiProviderMessage[],
    tools: AiProviderTool[],
    onDelta: AiDeltaHandler | undefined,
    maxOutputTokens: number,
    signal: AbortSignal,
    sessionId?: string,
  ): Promise<AiProviderChatResult> {
    const body: Record<string, unknown> = {
      model: resolved.model,
      messages,
      temperature: 0.2,
      stream: true,
      max_tokens: maxOutputTokens,
    }
    if (tools.length > 0) {
      body.tools = tools
      body.tool_choice = 'auto'
    }

    const fetchImpl = this.transport ?? globalThis.fetch
    const response = await fetchImpl(`${resolved.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${resolved.apiKey}`,
        'user-agent': 'polycheck/1.0',
        'x-opencode-session': sessionId?.trim() || this.defaultSessionId,
      },
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      this.logger.warn(
        `AI provider rejected the request (${response.status}): ${detail.slice(0, 400).replace(/\s+/g, ' ')}`,
      )
      throw new ServiceUnavailableException(`Assistant provider rejected the request (${response.status})`)
    }

    return this.readStream(response, onDelta)
  }

  private async resolveConfig(): Promise<ResolvedAiConfig | null> {
    const [baseUrlSetting, modelSetting, storedKey] = await Promise.all([
      this.readSetting(AI_BASE_URL_SETTING),
      this.readSetting(AI_MODEL_SETTING),
      this.settings.getAiApiKey(),
    ])
    const baseUrl = this.pick(baseUrlSetting, 'AI_BASE_URL').replace(/\/+$/, '')
    const model = this.pick(modelSetting, 'AI_MODEL')
    const apiKey = storedKey?.trim() || this.config.get<string>('AI_API_KEY')?.trim() || ''
    if (!baseUrl || !model || !apiKey) return null
    this.logger.debug(`Using AI endpoint ${baseUrl} with model ${model}`)
    return { baseUrl, model, apiKey }
  }

  private pick(settingValue: string | null | undefined, envKey: string) {
    return settingValue?.trim() || this.config.get<string>(envKey)?.trim() || ''
  }

  private async readSetting(key: string): Promise<string | null> {
    try {
      const setting = await this.prisma.institutionSetting.findUnique({
        where: { key },
        select: { value: true },
      })
      return setting?.value ?? null
    } catch {
      return null
    }
  }

  private async readStream(response: Response, onDelta?: AiDeltaHandler): Promise<AiProviderChatResult> {
    if (!response.body) throw new ServiceUnavailableException('Assistant provider returned an empty response')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const toolCalls = new Map<number, ToolCallAccumulator>()
    let buffer = ''
    let content = ''

    const processLine = (rawLine: string) => {
      const line = rawLine.trim()
      if (!line.startsWith('data:')) return
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') return

      let parsed: unknown
      try {
        parsed = JSON.parse(payload)
      } catch {
        return
      }

      const delta = this.streamDelta(parsed)
      if (!delta) return
      if (typeof delta.content === 'string' && delta.content.length > 0) {
        content += delta.content
        onDelta?.(delta.content)
      }
      if (!Array.isArray(delta.tool_calls)) return
      for (const fragment of delta.tool_calls) {
        if (!fragment || typeof fragment !== 'object') continue
        const value = fragment as {
          index?: unknown
          id?: unknown
          function?: { name?: unknown; arguments?: unknown }
        }
        const index = typeof value.index === 'number' ? value.index : 0
        const accumulator = toolCalls.get(index) ?? { id: '', name: '', arguments: '' }
        if (typeof value.id === 'string' && value.id.length > 0) accumulator.id = value.id
        if (typeof value.function?.name === 'string') accumulator.name += value.function.name
        if (typeof value.function?.arguments === 'string') accumulator.arguments += value.function.arguments
        toolCalls.set(index, accumulator)
      }
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      for (const line of lines) processLine(line)
    }
    buffer += decoder.decode()
    for (const line of buffer.split(/\r?\n/)) processLine(line)

    return {
      content,
      toolCalls: [...toolCalls.entries()]
        .sort(([left], [right]) => left - right)
        .filter(([, call]) => call.name.length > 0)
        .map(([index, call]) => ({
          id: call.id || `tool-${index}`,
          name: call.name,
          arguments: call.arguments,
        })),
    }
  }

  private streamDelta(parsed: unknown): { content?: unknown; tool_calls?: unknown } | null {
    if (!parsed || typeof parsed !== 'object') return null
    const choices = (parsed as { choices?: unknown }).choices
    if (!Array.isArray(choices) || choices.length === 0) return null
    const first = choices[0]
    if (!first || typeof first !== 'object') return null
    const delta = (first as { delta?: unknown }).delta
    if (!delta || typeof delta !== 'object') return null
    return delta as { content?: unknown; tool_calls?: unknown }
  }

  private positiveInteger(value: unknown, fallback: number) {
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
  }
}
