import { describe, expect, it, vi } from 'vitest'
import type Redis from 'ioredis'
import { createPinAttemptConsumer, resolveRuntimePlan } from '../src/runtime'
import { PIN_ATTEMPT_KEY_PREFIX, PIN_ATTEMPT_WINDOW_SECONDS } from '../src/core/scan'
import { testConfig } from './config-fixture'

const primary = { isPrimary: true, isWorker: false }
const worker = { isPrimary: false, isWorker: true }

describe('runtime role plan', () => {
  it('keeps the default role in one process', () => {
    expect(resolveRuntimePlan({ ...testConfig, INGEST_ROLE: 'all' }, primary)).toEqual({ kind: 'single', role: 'all' })
  })

  it('runs a dedicated drainer without forking', () => {
    expect(resolveRuntimePlan({ ...testConfig, INGEST_ROLE: 'drain' }, primary)).toEqual({ kind: 'single', role: 'drain' })
  })

  it('serves a single http process when cluster mode is off or one worker is configured', () => {
    expect(
      resolveRuntimePlan({ ...testConfig, INGEST_ROLE: 'http', INGEST_CLUSTER_ENABLED: false }, primary),
    ).toEqual({ kind: 'single', role: 'http' })
    expect(resolveRuntimePlan({ ...testConfig, INGEST_ROLE: 'http', INGEST_HTTP_WORKERS: 1 }, primary)).toEqual({
      kind: 'single',
      role: 'http',
    })
  })

  it('forks workers in the primary and serves in the forked children', () => {
    expect(resolveRuntimePlan({ ...testConfig, INGEST_ROLE: 'http', INGEST_HTTP_WORKERS: 4 }, primary)).toEqual({
      kind: 'cluster-primary',
      workers: 4,
    })
    expect(resolveRuntimePlan({ ...testConfig, INGEST_ROLE: 'http', INGEST_HTTP_WORKERS: 4 }, worker)).toEqual({
      kind: 'cluster-worker',
    })
  })
})

describe('createPinAttemptConsumer', () => {
  const redis = (incrValue = 1) => {
    const client = {
      incr: vi.fn().mockResolvedValue(incrValue),
      pexpire: vi.fn().mockResolvedValue(1),
    }
    return { client: client as unknown as Redis, clientMock: client }
  }

  it('expires the counter in milliseconds derived from the seconds window', async () => {
    const { client, clientMock } = redis()
    const consume = createPinAttemptConsumer(client)

    await consume(`${PIN_ATTEMPT_KEY_PREFIX}sess-1:stu-1:start`, 6, PIN_ATTEMPT_WINDOW_SECONDS)

    // PEXPIRE is millisecond-denominated; a raw 600 expired in 0.6s instead of 10min.
    expect(clientMock.pexpire).toHaveBeenCalledWith(
      `${PIN_ATTEMPT_KEY_PREFIX}sess-1:stu-1:start`,
      PIN_ATTEMPT_WINDOW_SECONDS * 1_000,
    )
  })

  it('matches the control-plane key namespace exactly', async () => {
    const { client, clientMock } = redis()
    const consume = createPinAttemptConsumer(client)

    await consume(`${PIN_ATTEMPT_KEY_PREFIX}sess-1:stu-1:start`, 6, PIN_ATTEMPT_WINDOW_SECONDS)

    // control plane: RedisService.key(`rate:${'pin-attempt:...'}`) = polycheck:rate:pin-attempt:...
    expect(clientMock.incr).toHaveBeenCalledWith('polycheck:rate:pin-attempt:sess-1:stu-1:start')
  })

  it('only arms the expiry on the first increment of the window', async () => {
    const { client, clientMock } = redis(4)
    const consume = createPinAttemptConsumer(client)

    await consume(`${PIN_ATTEMPT_KEY_PREFIX}sess-1:stu-1:start`, 6, PIN_ATTEMPT_WINDOW_SECONDS)

    expect(clientMock.pexpire).not.toHaveBeenCalled()
  })
})
