import { RequestTimeoutException, ServiceUnavailableException } from '@nestjs/common'
import { AiProviderService, type AiProviderTool, type AiFetch } from './ai-provider.service'

function makeProvider(
  options: {
    settings?: Record<string, string>
    booleans?: Record<string, boolean>
    env?: Record<string, unknown>
    fetchImpl?: AiFetch
    storedKey?: string | null
  } = {},
) {
  const settings = options.settings ?? {}
  const booleans = options.booleans ?? {}
  const env = options.env ?? {}
  const prisma = {
    institutionSetting: {
      findUnique: jest.fn(async ({ where }: { where: { key: string } }) =>
        where.key in settings ? { value: settings[where.key] } : null,
      ),
    },
  }
  const config = {
    get: jest.fn((key: string) => env[key]),
  }
  const settingsService = {
    getAiApiKey: jest.fn(async () => options.storedKey ?? null),
    getBoolean: jest.fn(async (key: string, fallback = false) => (key in booleans ? booleans[key] : fallback)),
  }
  const provider = new AiProviderService(prisma as never, config as never, settingsService as never, options.fetchImpl)
  return { provider, prisma, config, settingsService }
}

function sseResponse(chunks: string[]) {
  const encoder = new TextEncoder()
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
        controller.close()
      },
    }),
    { status: 200, headers: { 'content-type': 'text/event-stream' } },
  )
}

const findSectionsTool: AiProviderTool = {
  type: 'function',
  function: {
    name: 'find_sections',
    description: 'Find sections',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
}

describe('AiProviderService', () => {
  it('reports the assistant as disabled when no settings or environment are configured', async () => {
    const { provider } = makeProvider()

    await expect(provider.isConfigured()).resolves.toBe(false)
    await expect(provider.describe({ role: 'teacher' })).resolves.toEqual({
      enabled: false,
      maxMessageChars: 2_000,
      reason: 'Assistant is not configured (missing base_url, model, api_key)',
      missing: ['base_url', 'model', 'api_key'],
    })
    await expect(provider.chat([], [])).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it('reports which configuration pieces are missing', async () => {
    const { provider } = makeProvider({
      settings: { ai_base_url: 'https://ai.example/v1', ai_model: 'test-model' },
    })

    await expect(provider.describe({ role: 'teacher' })).resolves.toMatchObject({
      enabled: false,
      missing: ['api_key'],
      reason: 'Assistant is not configured (missing api_key)',
    })
  })

  it('blocks roles by institution policy before exposing configuration details', async () => {
    const configured = {
      settings: { ai_base_url: 'https://ai.example/v1', ai_model: 'test-model' },
      env: { AI_API_KEY: 'secret' },
    }

    const masterOff = makeProvider({ ...configured, booleans: { ai_assistant_enabled: false } })
    await expect(masterOff.provider.describe({ role: 'super_admin' })).resolves.toEqual({
      enabled: false,
      policyBlocked: true,
      maxMessageChars: 2_000,
      reason: 'The AI assistant has been disabled by your administrator.',
    })
    await expect(masterOff.provider.describe({ role: 'teacher' })).resolves.toMatchObject({
      policyBlocked: true,
    })

    const teacherOff = makeProvider({ ...configured, booleans: { ai_assistant_teacher_enabled: false } })
    await expect(teacherOff.provider.describe({ role: 'teacher' })).resolves.toMatchObject({
      enabled: false,
      policyBlocked: true,
      reason: 'The AI assistant is disabled for teachers by your administrator.',
    })
    await expect(teacherOff.provider.describe({ role: 'super_admin' })).resolves.toMatchObject({ enabled: true })
    await expect(teacherOff.provider.describe({ role: 'student' })).resolves.toMatchObject({ enabled: true })

    const studentOff = makeProvider({ ...configured, booleans: { ai_assistant_student_enabled: false } })
    await expect(studentOff.provider.describe({ role: 'student' })).resolves.toMatchObject({
      enabled: false,
      policyBlocked: true,
      reason: 'The AI assistant is disabled for students by your administrator.',
    })
    await expect(studentOff.provider.describe({ role: 'teacher' })).resolves.toMatchObject({ enabled: true })
  })

  it('prefers an encrypted key stored by a super admin over the environment', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(sseResponse(['data: [DONE]\n\n']))
    const { provider } = makeProvider({
      settings: { ai_base_url: 'https://ai.example/v1', ai_model: 'test-model' },
      env: { AI_API_KEY: 'env-secret' },
      storedKey: 'stored-secret',
      fetchImpl: fetchImpl as unknown as AiFetch,
    })

    await expect(provider.describe({ role: 'teacher' })).resolves.toEqual({
      enabled: true,
      model: 'test-model',
      maxMessageChars: 2_000,
    })
    await provider.chat([{ role: 'user', content: 'hello' }], [], undefined, undefined, 'thread-123')
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(init.headers).toMatchObject({ authorization: 'Bearer stored-secret' })
  })

  it('falls back to the environment and lets institution settings override it', async () => {
    const envProvider = makeProvider({
      env: { AI_BASE_URL: 'https://env.example/v1', AI_MODEL: 'env-model', AI_API_KEY: 'env-secret' },
    })
    await expect(envProvider.provider.describe({ role: 'teacher' })).resolves.toEqual({
      enabled: true,
      model: 'env-model',
      maxMessageChars: 2_000,
    })

    const settingsProvider = makeProvider({
      settings: { ai_base_url: 'https://settings.example/v1', ai_model: 'settings-model' },
      env: { AI_BASE_URL: 'https://env.example/v1', AI_MODEL: 'env-model', AI_API_KEY: 'env-secret' },
    })
    const description = await settingsProvider.provider.describe({ role: 'teacher' })
    expect(description).toEqual({ enabled: true, model: 'settings-model', maxMessageChars: 2_000 })
    expect(JSON.stringify(description)).not.toContain('env-secret')
  })

  it('parses delta content and assembles fragmented tool calls from SSE', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        sseResponse([
          'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"lo"}}]}\n\ndata: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"find_","arguments":"{\\"query\\":"}}]}}]}\n\n',
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"sections","arguments":"\\"math\\"}"}}]}}]}\n\n',
          'data: [DONE]\n\n',
        ]),
      )
    const { provider } = makeProvider({
      settings: { ai_base_url: 'https://settings.example/v1/', ai_model: 'settings-model' },
      env: { AI_API_KEY: 'env-secret' },
      fetchImpl: fetchImpl as unknown as AiFetch,
    })
    const deltas: string[] = []

    const result = await provider.chat(
      [{ role: 'user', content: 'find math' }],
      [findSectionsTool],
      (text) => deltas.push(text),
      undefined,
      'thread-123',
    )

    expect(deltas).toEqual(['Hel', 'lo'])
    expect(result).toEqual({
      content: 'Hello',
      toolCalls: [{ id: 'call_1', name: 'find_sections', arguments: '{"query":"math"}' }],
    })

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://settings.example/v1/chat/completions')
    expect(init.headers).toMatchObject({
      'content-type': 'application/json',
      authorization: 'Bearer env-secret',
      'user-agent': 'polycheck/1.0',
      'x-opencode-session': 'thread-123',
    })
    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({
      model: 'settings-model',
      temperature: 0.2,
      stream: true,
      max_tokens: 1_024,
      tool_choice: 'auto',
      tools: [findSectionsTool],
    })
    expect(body.messages).toEqual([{ role: 'user', content: 'find math' }])
  })

  it('aborts a provider call that exceeds the configured timeout', async () => {
    const fetchImpl = jest.fn(() => new Promise<Response>(() => undefined))
    const { provider } = makeProvider({
      settings: { ai_base_url: 'https://ai.example/v1', ai_model: 'test-model' },
      env: { AI_API_KEY: 'env-secret', AI_TIMEOUT_MS: 20 },
      fetchImpl: fetchImpl as unknown as AiFetch,
    })

    await expect(provider.chat([{ role: 'user', content: 'hello' }], [])).rejects.toBeInstanceOf(
      RequestTimeoutException,
    )
  })

  it('uses the configured output token cap', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(sseResponse(['data: {"choices":[{"delta":{}}]}\n\n']))
    const { provider } = makeProvider({
      settings: { ai_base_url: 'https://ai.example/v1', ai_model: 'test-model' },
      env: { AI_API_KEY: 'env-secret', AI_MAX_OUTPUT_TOKENS: 256 },
      fetchImpl: fetchImpl as unknown as AiFetch,
    })

    await provider.chat([{ role: 'user', content: 'hello' }], [])
    const body = JSON.parse(String((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body))
    expect(body.max_tokens).toBe(256)
  })
})
